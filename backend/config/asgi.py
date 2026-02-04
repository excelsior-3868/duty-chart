import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI application early to ensure AppRegistry is ready
# for other imports like consumers that may use Django models.
django_asgi_app = get_asgi_application()

# Import routing and middleware AFTER get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from notification_service.middleware import TokenAuthMiddleware
import notification_service.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter(
            notification_service.routing.websocket_urlpatterns
        )
    ),
})
