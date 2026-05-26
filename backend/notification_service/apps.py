from django.apps import AppConfig

class NotificationServiceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notification_service'

    def ready(self):
        import notification_service.signals
