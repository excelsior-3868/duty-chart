from django.urls import path
from .views import MeView, LogoutView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("logout/", LogoutView.as_view(), name="logout"),
]