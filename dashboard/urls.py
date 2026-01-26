from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("faq/", views.faq, name="faq"),
    path("login/", views.login_view, name="login"),
    path("signup/", views.signup, name="signup"),
    path("profile/", views.profile, name="profile"),
    path("sensor-feed/", views.sensor_feed, name="sensor_feed"),
    path("visualizations/", views.visualizations, name="visualizations"),
    path("ai/", views.ai, name="ai"),
    path("ai-chat/", views.ai_chat, name="ai_chat"),
    path("contact/", views.contact, name="contact"),
    # BluConsole API
    path("api/blu/login/", views.api_blu_login, name="api_blu_login"),
    path("api/blu/logout/", views.api_blu_logout, name="api_blu_logout"),
    path("api/blu/status/", views.api_blu_status, name="api_blu_status"),
    path("api/blu/devices/", views.api_blu_devices, name="api_blu_devices"),
    path("api/blu/measurements/", views.api_blu_measurements, name="api_blu_measurements"),
    # App data API
    path("api/signup/", views.api_signup, name="api_signup"),
    path("api/profile/", views.api_profile, name="api_profile"),
    path("api/notes/", views.api_notes, name="api_notes"),
    path("api/notes/<int:note_id>/", views.api_note_detail, name="api_note_detail"),
    path("api/uploads/", views.api_uploads, name="api_uploads"),
    path("api/uploads/clear/", views.api_uploads_clear, name="api_uploads_clear"),
    path("api/uploads/<int:upload_id>/", views.api_upload_detail, name="api_upload_detail"),
    path("api/ai-chat/", views.api_ai_chat, name="api_ai_chat"),
    path("api/ai-chat/status/", views.api_ai_chat_status, name="api_ai_chat_status"),
    path("api/ai-chat/sessions/", views.api_ai_chat_sessions, name="api_ai_chat_sessions"),
    path("api/ai-chat/sessions/<int:session_id>/", views.api_ai_chat_session_detail, name="api_ai_chat_session_detail"),
    path("api/ai-chat/sessions/clear/", views.api_ai_chat_sessions_clear, name="api_ai_chat_sessions_clear"),
    path("api/ai-chat/attachment/", views.api_ai_chat_attachment, name="api_ai_chat_attachment"),
]
