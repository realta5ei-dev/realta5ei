from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('article/<int:article_id>', views.article, name='article'),
    path('quiz/<int:quiz_id>/', views.quiz_detail, name='quiz_detail'),
    path('api/annotations/add/', views.add_annotation, name='add_annotation'),
    path('api/annotations/slide/<int:slide_id>/', views.get_slide_annotations, name='get_slide_annotations'),
    path('api/annotations/<int:annotation_id>/reply/', views.add_annotation_reply, name='add_annotation_reply'),
    path('api/annotations/<int:annotation_id>/like/', views.like_annotation, name='like_annotation'),
    path('api/quiz/<int:quiz_id>/', views.get_quiz_data, name='get_quiz_data'),
    path('api/quiz/<int:quiz_id>/submit/', views.submit_quiz, name='submit_quiz'),
    path('api/glossary_terms/', views.get_glossary_terms, name='get_glossary_terms'),
    path('api/timeline_events/', views.get_timeline_events, name='get_timeline_events'),
    path('api/interactions/track/', views.track_interaction, name='track_interaction'),
    path('api/articles/<str:article_id>/reactions/', views.add_reaction, name='add_reaction'),
    path('api/articles/<str:article_id>/reactions/get/', views.get_article_reactions, name='get_article_reactions'),
    path('api/teacher/dashboard/', views.teacher_dashboard, name='teacher_dashboard'),
    path('api/progress/update/', views.update_student_progress, name='update_student_progress'),
    path('api/progress/get/', views.get_student_progress, name='get_student_progress'),
    path('api/discussions/create/', views.create_discussion_topic, name='create_discussion_topic'),
    path('api/discussions/<int:topic_id>/posts/', views.get_discussion_posts, name='get_discussion_posts'),
    path('api/discussions/<int:topic_id>/post/', views.add_discussion_post, name='add_discussion_post'),
    path('api/discussions/posts/<int:post_id>/like/', views.like_discussion_post, name='like_discussion_post'),
    path('api/notes/collaborative/update/', views.update_collaborative_note, name='update_collaborative_note'),
    path('api/notes/collaborative/get/', views.get_collaborative_note, name='get_collaborative_note'),
    path('api/search/', views.search_articles, name='search_articles'),
]
