from django.shortcuts import render, get_object_or_404
from .models import Article, Quiz, GlossaryTerm, HistoricalEvent
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Avg, Count, Max, Min, F
from django.utils import timezone
from datetime import timedelta
import json
from .models import *
import numpy as np
import torch
import onnxruntime as ort
import re

ONNX_PATH = "myapp/static/model.onnx"
CKPT_PATH = "myapp/static/transformer_text_epoch29.pt"
SRC_SEQ_LEN = 40
TGT_MAX_LEN = 20

checkpoint = torch.load(CKPT_PATH, map_location="cpu")
idx2tok = checkpoint["vocab"]
if isinstance(idx2tok, dict):
    tok2idx = {v: k for k, v in idx2tok.items()}
else:
    tok2idx = {token: idx for idx, token in enumerate(idx2tok)}


def greedy_decode(sess: ort.InferenceSession, encoder_src, max_len: int, sos_idx: int, eos_idx: int):
    if torch.is_tensor(encoder_src):
        src_np = encoder_src.cpu().numpy().astype(np.int64)
    else:
        src_np = np.asarray(encoder_src, dtype=np.int64)

    batch = src_np.shape[0]
    decoder_ids = np.full((batch, 1), sos_idx, dtype=np.int64)
    outputs = []

    for _ in range(max_len):
        ort_inputs = {
            "src": src_np,
            "tgt": decoder_ids
        }

        outs = sess.run(None, ort_inputs)
        logits = outs[0]
        last_logits = logits[:, -1, :]
        next_tokens = np.argmax(last_logits, axis=-1).astype(np.int64)[:, None]
        outputs.append(next_tokens)
        decoder_ids = np.concatenate([decoder_ids, next_tokens], axis=1)

        if np.all(next_tokens.squeeze() == eos_idx):
            break

    if outputs:
        out_np = np.concatenate(outputs, axis=1)
    else:
        out_np = np.zeros((batch, 0), dtype=np.int64)

    return torch.from_numpy(out_np)


sess = ort.InferenceSession("myapp/static/model.onnx", providers=["CPUExecutionProvider"])


def tokenize(text):
    text = text.lower()
    return re.findall(r"\w+|[^\s\w]", text, re.UNICODE)


def encode_src(text, tok2idx, src_seq_len):
    toks = tokenize(text)
    ids = [tok2idx.get(t, tok2idx.get("", 0)) for t in toks][:src_seq_len]
    if len(ids) < src_seq_len:
        ids += [tok2idx.get("", 0)] * (src_seq_len - len(ids))
    return torch.tensor(ids, dtype=torch.long).unsqueeze(0)


def index(request):
    articles = Article.objects.all().order_by('article_id')
    quizzes = Quiz.objects.filter(is_active=True)
    glossary_terms = GlossaryTerm.objects.all().order_by('term')
    historical_events = HistoricalEvent.objects.all().order_by('date')
    slides = Slide.objects.all().order_by('id')
    presentations = Presentation.objects.all().order_by('presentation_id')

    text = ""
    for pre in presentations:
        for slide in slides:
            if slide.presentation == pre.presentation_id:
                text += slide.slide_text + "\n"

    encoder_src = encode_src(text, tok2idx, SRC_SEQ_LEN)

    generated = ""
    for article in articles:
        if article.smart_description == "des":
            out_ids = greedy_decode(
                sess,
                encoder_src,
                max_len=20,
                sos_idx=1,
                eos_idx=2
            )
            tokens = [idx2tok[i] for i in out_ids[0].tolist() if i not in (0, 2)]
            generated = " ".join(tokens)
        else:
            generated = article.smart_description



    context = {
        "articles": articles,
        "quizzes": quizzes,
        "glossary_terms": glossary_terms,
        "historical_events": historical_events,
        "generated": generated,
    }



    return render(request, 'index.html', context)


def quiz_detail(request, quiz_id):
    quiz = get_object_or_404(Quiz, pk=quiz_id)

    if request.method == "POST":
        score = 0
        total_questions = quiz.questions.count()
        results = []

        for question in quiz.questions.all():
            answer_id = request.POST.get(f'q_{question.id}')
            selected_answer = None
            is_correct = False

            if answer_id:
                selected_answer = get_object_or_404(Answer, pk=answer_id)
                if selected_answer.is_correct:
                    score += 1
                    is_correct = True

            results.append({
                'question': question.text,
                'selected': selected_answer.text if selected_answer else "Nessuna risposta",
                'is_correct': is_correct
            })

        percentage = (score / total_questions) * 100 if total_questions > 0 else 0
        passed = percentage >= quiz.passing_score

        return render(request, 'quiz_detail.html', {
            'quiz': quiz,
            'score': score,
            'total': total_questions,
            'percentage': percentage,
            'passed': passed,
            'submitted': True,
            'results': results
        })

    return render(request, 'quiz_detail.html', {'quiz': quiz})

def article(request, article_id):
    article = get_object_or_404(Article, article_id=article_id)
    context = {
        "article": article,
    }
    return render(request, 'article.html', context)





def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip




def article_detail(request, article_id):
    article = get_object_or_404(Article, article_id=article_id)

    PageView.objects.create(
        article=article,
        ip_address=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        referrer=request.META.get('HTTP_REFERER', '')
    )

    return render(request, 'article.html', {'article': article})


@csrf_exempt
@require_POST
def add_annotation(request):
    data = json.loads(request.body)

    annotation = Annotation.objects.create(
        slide_id=data['slide_id'],
        student_name=data['student_name'],
        class_group=data['class_group'],
        text_selection=data['text'],
        note=data['note'],
        x_position=float(data['x']),
        y_position=float(data['y']),
        color=data.get('color', '#FFD700'),
        is_public=data.get('is_public', False)
    )

    return JsonResponse({
        'id': annotation.id,
        'student_name': annotation.student_name,
        'note': annotation.note,
        'created_at': annotation.created_at.isoformat(),
        'color': annotation.color
    })


@require_GET
def get_slide_annotations(request, slide_id):
    class_group = request.GET.get('class_group', '')

    annotations = Annotation.objects.filter(
        slide_id=slide_id
    ).filter(
        Q(is_public=True) | Q(class_group=class_group)
    )

    return JsonResponse({
        'annotations': [
            {
                'id': a.id,
                'student_name': a.student_name,
                'note': a.note,
                'x': a.x_position,
                'y': a.y_position,
                'color': a.color,
                'created_at': a.created_at.isoformat(),
                'replies_count': a.replies.count(),
                'likes_count': a.likes_count
            }
            for a in annotations
        ]
    })


@csrf_exempt
@require_POST
def add_annotation_reply(request, annotation_id):
    data = json.loads(request.body)
    annotation = get_object_or_404(Annotation, id=annotation_id)

    reply = AnnotationReply.objects.create(
        annotation=annotation,
        author_name=data['author_name'],
        content=data['content']
    )

    return JsonResponse({
        'id': reply.id,
        'author_name': reply.author_name,
        'content': reply.content,
        'created_at': reply.created_at.isoformat()
    })


@csrf_exempt
@require_POST
def like_annotation(request, annotation_id):
    annotation = get_object_or_404(Annotation, id=annotation_id)
    annotation.likes_count = F('likes_count') + 1
    annotation.save()
    annotation.refresh_from_db()

    return JsonResponse({'likes_count': annotation.likes_count})


@require_GET
def get_quiz_data(request, quiz_id):
    quiz = get_object_or_404(Quiz, id=quiz_id)

    return JsonResponse({
        'id': quiz.id,
        'title': quiz.title,
        'description': quiz.description,
        'difficulty': quiz.difficulty,
        'time_limit': quiz.time_limit,
        'passing_score': quiz.passing_score,
        'questions': [
            {
                'id': q.id,
                'type': q.question_type,
                'text': q.text,
                'points': q.points,
                'answers': [
                    {
                        'id': a.id,
                        'text': a.text
                    }
                    for a in q.answers.all()
                ]
            }
            for q in quiz.questions.all()
        ]
    })


@csrf_exempt
@require_POST
def submit_quiz(request, quiz_id):
    quiz = get_object_or_404(Quiz, id=quiz_id)
    data = json.loads(request.body)

    attempt = QuizAttempt.objects.create(
        quiz=quiz,
        student_name=data['student_name'],
        class_group=data['class_group'],
        time_taken=data['time_taken'],
        max_score=sum(q.points for q in quiz.questions.all()),
        score=0,
        percentage=0
    )

    total_points = 0
    results = []

    for response_data in data['responses']:
        question = Question.objects.get(id=response_data['question_id'])

        if question.question_type == 'open_ended':
            is_correct = False
            points = 0
            selected_answer = None
            open_answer = response_data.get('answer_text', '')
        else:
            selected_answer = Answer.objects.get(id=response_data['answer_id'])
            is_correct = selected_answer.is_correct
            points = question.points if is_correct else 0
            open_answer = ''

        QuestionResponse.objects.create(
            attempt=attempt,
            question=question,
            selected_answer=selected_answer,
            open_answer=open_answer,
            is_correct=is_correct,
            points_earned=points
        )

        total_points += points

        results.append({
            'question_id': question.id,
            'is_correct': is_correct,
            'points_earned': points,
            'explanation': question.explanation if not is_correct else '',
            'correct_answer': question.answers.filter(
                is_correct=True).first().text if not is_correct and question.question_type != 'open_ended' else None,
            'feedback': selected_answer.feedback if selected_answer else ''
        })

    attempt.score = total_points
    attempt.percentage = (total_points / attempt.max_score) * 100 if attempt.max_score > 0 else 0
    attempt.save()

    return JsonResponse({
        'score': total_points,
        'max_score': attempt.max_score,
        'percentage': attempt.percentage,
        'passed': attempt.percentage >= quiz.passing_score,
        'results': results,
        'attempt_id': attempt.id
    })


@require_GET
def get_glossary_terms(request):
    terms = GlossaryTerm.objects.all()

    return JsonResponse({
        'terms': [
            {
                'id': t.id,
                'term': t.term,
                'definition': t.definition,
                'extended_explanation': t.extended_explanation,
                'image': t.image.url if t.image else None,
                'video_url': t.video_url,
                'related_articles': [
                    {'id': a.article_id, 'title': a.article_title}
                    for a in t.related_articles.all()
                ]
            }
            for t in terms
        ]
    })


@require_GET
def get_timeline_events(request):
    events = HistoricalEvent.objects.all()

    return JsonResponse({
        'events': [
            {
                'id': e.id,
                'date': e.date.isoformat(),
                'title': e.title,
                'short_description': e.short_description,
                'full_description': e.full_description,
                'image': e.image.url if e.image else None,
                'importance': e.importance,
                'related_articles': [
                    {'id': a.article_id, 'title': a.article_title}
                    for a in e.related_articles.all()
                ]
            }
            for e in events
        ]
    })


@csrf_exempt
@require_POST
def track_interaction(request):
    data = json.loads(request.body)

    Interaction.objects.create(
        article_id=data['article_id'],
        type=data['type'],
        element=data.get('element', ''),
        student_name=data.get('student_name', '')
    )

    return JsonResponse({'status': 'tracked'})


@csrf_exempt
@require_POST
def add_reaction(request, article_id):
    data = json.loads(request.body)
    article = get_object_or_404(Article, article_id=article_id)
    reaction_type = data['type']
    ip_address = get_client_ip(request)

    reaction, created = Reaction.objects.get_or_create(
        article=article,
        type=reaction_type,
        ip_address=ip_address
    )

    if not created:
        reaction.delete()
        action = 'removed'
    else:
        action = 'added'

    count = article.reactions.filter(type=reaction_type).count()

    return JsonResponse({
        'action': action,
        'count': count
    })


@csrf_exempt
@require_GET
def get_article_reactions(request, article_id):
    article = get_object_or_404(Article, article_id=article_id)

    reactions = {}
    for reaction_type, _ in Reaction.REACTION_TYPES:
        reactions[reaction_type] = article.reactions.filter(type=reaction_type).count()

    return JsonResponse({'reactions': reactions})


@require_GET
def teacher_dashboard(request):
    class_group = request.GET.get('class', 'all')

    quiz_stats = QuizAttempt.objects.all()
    if class_group != 'all':
        quiz_stats = quiz_stats.filter(class_group=class_group)

    quiz_data = quiz_stats.values('quiz__title').annotate(
        avg_score=Avg('percentage'),
        attempts_count=Count('id'),
        max_score=Max('percentage'),
        min_score=Min('percentage')
    )

    active_students = quiz_stats.values('student_name', 'class_group').annotate(
        total_attempts=Count('id'),
        avg_performance=Avg('percentage')
    ).order_by('-total_attempts')[:10]

    annotation_stats = Annotation.objects.all()
    if class_group != 'all':
        annotation_stats = annotation_stats.filter(class_group=class_group)

    annotation_data = annotation_stats.values('slide__presentation__article__article_title').annotate(
        count=Count('id'),
        public_count=Count('id', filter=Q(is_public=True))
    )

    popular_articles = Article.objects.annotate(
        view_count=Count('pageviews')
    ).order_by('-view_count')[:5]

    return JsonResponse({
        'quiz_stats': list(quiz_data),
        'active_students': list(active_students),
        'annotation_stats': list(annotation_data),
        'popular_articles': [
            {
                'id': a.article_id,
                'title': a.article_title,
                'views': a.view_count
            }
            for a in popular_articles
        ]
    })


@csrf_exempt
@require_POST
def update_student_progress(request):
    data = json.loads(request.body)

    progress, created = StudentProgress.objects.update_or_create(
        student_name=data['student_name'],
        class_group=data['class_group'],
        article_id=data['article_id'],
        defaults={
            'completion_percentage': data['completion_percentage'],
            'time_spent': F('time_spent') + data['time_increment']
        }
    )

    progress.refresh_from_db()

    return JsonResponse({
        'completion_percentage': progress.completion_percentage,
        'time_spent': progress.time_spent
    })


@require_GET
def get_student_progress(request):
    student_name = request.GET.get('student_name')
    class_group = request.GET.get('class_group')

    progress = StudentProgress.objects.filter(
        student_name=student_name,
        class_group=class_group
    )

    return JsonResponse({
        'progress': [
            {
                'article_id': p.article.article_id,
                'article_title': p.article.article_title,
                'completion': p.completion_percentage,
                'time_spent': p.time_spent,
                'last_accessed': p.last_accessed.isoformat()
            }
            for p in progress
        ]
    })


@csrf_exempt
@require_POST
def create_discussion_topic(request):
    data = json.loads(request.body)

    topic = DiscussionTopic.objects.create(
        article_id=data['article_id'],
        title=data['title'],
        description=data['description'],
        created_by=data['created_by'],
        class_group=data['class_group']
    )

    return JsonResponse({
        'id': topic.id,
        'title': topic.title,
        'created_at': topic.created_at.isoformat()
    })


@csrf_exempt
@require_POST
def add_discussion_post(request, topic_id):
    data = json.loads(request.body)
    topic = get_object_or_404(DiscussionTopic, id=topic_id)

    post = DiscussionPost.objects.create(
        topic=topic,
        author_name=data['author_name'],
        content=data['content'],
        parent_post_id=data.get('parent_post_id')
    )

    return JsonResponse({
        'id': post.id,
        'author_name': post.author_name,
        'content': post.content,
        'created_at': post.created_at.isoformat()
    })


@require_GET
def get_discussion_posts(request, topic_id):
    topic = get_object_or_404(DiscussionTopic, id=topic_id)
    posts = topic.posts.filter(parent_post=None)

    def serialize_post(post):
        return {
            'id': post.id,
            'author_name': post.author_name,
            'content': post.content,
            'created_at': post.created_at.isoformat(),
            'likes': post.likes,
            'is_highlighted': post.is_highlighted,
            'replies': [serialize_post(reply) for reply in post.replies.all()]
        }

    return JsonResponse({
        'topic': {
            'id': topic.id,
            'title': topic.title,
            'description': topic.description
        },
        'posts': [serialize_post(post) for post in posts]
    })


@csrf_exempt
@require_POST
def like_discussion_post(request, post_id):
    post = get_object_or_404(DiscussionPost, id=post_id)
    post.likes = F('likes') + 1
    post.save()
    post.refresh_from_db()

    return JsonResponse({'likes': post.likes})


@csrf_exempt
@require_POST
def update_collaborative_note(request):
    data = json.loads(request.body)

    note, created = CollaborativeNote.objects.get_or_create(
        article_id=data['article_id'],
        class_group=data['class_group']
    )

    if not created:
        note.version += 1

    note.content = data['content']

    contributors = note.contributors if isinstance(note.contributors, list) else []
    if data['contributor'] not in contributors:
        contributors.append(data['contributor'])
    note.contributors = contributors

    note.save()

    return JsonResponse({
        'version': note.version,
        'contributors': note.contributors,
        'last_edited': note.last_edited.isoformat()
    })


@require_GET
def get_collaborative_note(request):
    article_id = request.GET.get('article_id')
    class_group = request.GET.get('class_group')

    try:
        note = CollaborativeNote.objects.get(
            article_id=article_id,
            class_group=class_group
        )
        return JsonResponse({
            'content': note.content,
            'version': note.version,
            'contributors': note.contributors,
            'last_edited': note.last_edited.isoformat(),
            'is_locked': note.is_locked
        })
    except CollaborativeNote.DoesNotExist:
        return JsonResponse({
            'content': '',
            'version': 0,
            'contributors': [],
            'is_locked': False
        })


@require_GET
def search_articles(request):
    query = request.GET.get('q', '')

    if not query:
        return JsonResponse({'results': []})

    articles = Article.objects.filter(
        Q(article_title__icontains=query) |
        Q(smart_description__icontains=query) |
        Q(group__icontains=query)
    )

    return JsonResponse({
        'results': [
            {
                'id': a.article_id,
                'title': a.article_title,
                'description': a.smart_description,
                'group': a.group
            }
            for a in articles
        ]
    })