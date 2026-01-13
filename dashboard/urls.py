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
]
