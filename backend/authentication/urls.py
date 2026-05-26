from django.urls import path
from .views import MeView, KeycloakTokenExchangeView, KeycloakCodeExchangeView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("sso/keycloak/", KeycloakTokenExchangeView.as_view(), name="keycloak_sso"),
    path("sso/keycloak/code/", KeycloakCodeExchangeView.as_view(), name="keycloak_sso_code"),
]