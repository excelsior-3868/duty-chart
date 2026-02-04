from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, SMSLogViewSet

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'sms-logs', SMSLogViewSet, basename='sms-log')

urlpatterns = [
    path('', include(router.urls)),
]
