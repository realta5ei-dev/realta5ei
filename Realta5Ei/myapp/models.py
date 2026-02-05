from django.db import models
from django.utils import timezone
# Create your models here.
class Article(models.Model):
    article_id = models.AutoField(primary_key=True)
    article_title = models.CharField(max_length=300)
    smart_description = models.TextField()
    slides_number = models.IntegerField()
    images_number = models.IntegerField()
    pdf = models.FileField(default='pdf')
    group = models.CharField(
        max_length=300,
        choices=[
            (
                "Gruppo 1: Emanuele Magno, Lara Maglione, Antonio De Luca, Luca Pelerusso, Emanuele Cardamuro",
                "Gruppo 1: Emanuele Magno, Lara Maglione, Antonio De Luca, Luca Pelerusso, Emanuele Cardamuro"
            ),
            (
                "Gruppo 2: Carmine Ciccarelli, Filippo Cuccurullo, Giuseppe Cotrufo, Antonio Ventriglia, Antonio De Fenza, Lorenzo Di Guida",
                "Gruppo 2: Carmine Ciccarelli, Filippo Cuccurullo, Giuseppe Cotrufo, Antonio Ventriglia, Antonio De Fenza, Lorenzo Di Guida"
            ),
            (
                "Gruppo 3: Lorenzo Famularo, Giuseppe Luongo, Francesco La Marca, Antonio Talotti, Francesco Cusati",
                "Gruppo 3: Lorenzo Famularo, Giuseppe Luongo, Francesco La Marca, Antonio Talotti, Francesco Cusati"
            ),
            (
                "Gruppo 4: Alejandro Russo, Francesco Cotroneo, Paolo Campana, Emanuele Iuliano, Alessandro De Fenzo",
                "Gruppo 4: Alejandro Russo, Francesco Cotroneo, Paolo Campana, Emanuele Iuliano, Alessandro De Fenzo"
            ),
        ]
    )


class Presentation(models.Model):
    presentation_id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=300)
    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name="presentations"
    )

class Slide(models.Model):
    presentation = models.ForeignKey(
        Presentation,
        on_delete=models.CASCADE,
        related_name="slides"
    )
    slide_number = models.PositiveIntegerField()
    slide_title = models.CharField(max_length=300,  default='Untitled Slide')
    slide_text = models.TextField()

    class Meta:
        ordering = ["slide_number"]

class Image(models.Model):
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name="images"
    )
    image_number = models.PositiveIntegerField()
    image_file = models.ImageField(default='')

    class Meta:
        ordering = ["image_number"]


from django.db import models
from django.contrib.auth.models import User
from django.db.models import Q, Avg, Count
from django.utils import timezone
import json


class Annotation(models.Model):
    slide = models.ForeignKey(Slide, on_delete=models.CASCADE, related_name='annotations')
    student_name = models.CharField(max_length=100)
    class_group = models.CharField(max_length=50)
    text_selection = models.TextField()
    note = models.TextField()
    x_position = models.FloatField()
    y_position = models.FloatField()
    color = models.CharField(max_length=7, default='#FFD700')
    created_at = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=False)
    likes_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']


class AnnotationReply(models.Model):
    annotation = models.ForeignKey(Annotation, on_delete=models.CASCADE, related_name='replies')
    author_name = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Quiz(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=200)
    description = models.TextField()
    difficulty = models.CharField(max_length=20, choices=[
        ('facile', 'Facile'),
        ('medio', 'Medio'),
        ('difficile', 'Difficile')
    ])
    time_limit = models.IntegerField(null=True, blank=True)
    passing_score = models.IntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)


class Question(models.Model):
    QUESTION_TYPES = [
        ('multiple_choice', 'Scelta Multipla'),
        ('true_false', 'Vero/Falso'),
        ('open_ended', 'Risposta Aperta'),
        ('matching', 'Abbinamento')
    ]

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    text = models.TextField()
    explanation = models.TextField()
    points = models.IntegerField(default=1)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']


class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    feedback = models.TextField(blank=True)


class QuizAttempt(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    student_name = models.CharField(max_length=100)
    class_group = models.CharField(max_length=50)
    score = models.FloatField()
    max_score = models.FloatField()
    percentage = models.FloatField()
    time_taken = models.IntegerField()
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-completed_at']


class QuestionResponse(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name='responses')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_answer = models.ForeignKey(Answer, on_delete=models.CASCADE, null=True, blank=True)
    open_answer = models.TextField(blank=True)
    is_correct = models.BooleanField()
    points_earned = models.FloatField()


class GlossaryTerm(models.Model):
    term = models.CharField(max_length=200, unique=True)
    definition = models.TextField()
    extended_explanation = models.TextField(blank=True)
    related_articles = models.ManyToManyField(Article, blank=True, related_name='glossary_terms')
    image = models.ImageField(upload_to='glossary/', null=True, blank=True)
    video_url = models.URLField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['term']


class HistoricalEvent(models.Model):
    date = models.DateField()
    title = models.CharField(max_length=200)
    short_description = models.TextField()
    full_description = models.TextField()
    image = models.ImageField(upload_to='timeline/', null=True, blank=True)
    related_articles = models.ManyToManyField(Article, blank=True, related_name='historical_events')
    importance = models.IntegerField(default=1, choices=[
        (1, 'Bassa'),
        (2, 'Media'),
        (3, 'Alta'),
        (4, 'Cruciale')
    ])

    class Meta:
        ordering = ['date']


class PageView(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='pageviews')
    ip_address = models.GenericIPAddressField()
    user_agent = models.CharField(max_length=500)
    timestamp = models.DateTimeField(auto_now_add=True)
    duration = models.IntegerField(null=True)
    scroll_depth = models.FloatField(null=True)
    referrer = models.URLField(blank=True)


class Interaction(models.Model):
    INTERACTION_TYPES = [
        ('click', 'Click'),
        ('hover', 'Hover'),
        ('scroll', 'Scroll'),
        ('download', 'Download PDF')
    ]

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='interactions')
    type = models.CharField(max_length=20, choices=INTERACTION_TYPES)
    element = models.CharField(max_length=200)
    timestamp = models.DateTimeField(auto_now_add=True)
    student_name = models.CharField(max_length=100, blank=True)


class Reaction(models.Model):
    REACTION_TYPES = [
        ('heart', '❤️'),
        ('star', '⭐'),
        ('thinking', '🤔'),
        ('clap', '👏')
    ]

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='reactions')
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    ip_address = models.GenericIPAddressField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['article', 'type', 'ip_address']


class DiscussionTopic(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='discussion_topics')
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_by = models.CharField(max_length=100)
    class_group = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class DiscussionPost(models.Model):
    topic = models.ForeignKey(DiscussionTopic, on_delete=models.CASCADE, related_name='posts')
    author_name = models.CharField(max_length=100)
    content = models.TextField()
    parent_post = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)
    likes = models.IntegerField(default=0)
    is_highlighted = models.BooleanField(default=False)


class StudentProgress(models.Model):
    student_name = models.CharField(max_length=100)
    class_group = models.CharField(max_length=50)
    article = models.ForeignKey(Article, on_delete=models.CASCADE)
    completion_percentage = models.FloatField(default=0)
    time_spent = models.IntegerField(default=0)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student_name', 'class_group', 'article']


class AIGeneratedContent(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='ai_contents')
    content_type = models.CharField(max_length=50, choices=[
        ('summary', 'Riassunto'),
        ('questions', 'Domande Guida'),
        ('reflection', 'Spunti di Riflessione'),
        ('related', 'Contenuti Correlati')
    ])
    content = models.TextField()
    generated_at = models.DateTimeField(auto_now_add=True)
    student_level = models.CharField(max_length=20, choices=[
        ('base', 'Base'),
        ('intermedio', 'Intermedio'),
        ('avanzato', 'Avanzato')
    ])


class CollaborativeNote(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='collaborative_notes')
    class_group = models.CharField(max_length=50)
    content = models.TextField()
    contributors = models.JSONField(default=list)
    last_edited = models.DateTimeField(auto_now=True)
    version = models.IntegerField(default=1)
    is_locked = models.BooleanField(default=False)