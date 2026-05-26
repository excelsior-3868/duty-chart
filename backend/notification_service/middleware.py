from urllib.parse import parse_qs
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from rest_framework_simplejwt.tokens import AccessToken
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token_string):
    try:
        # Validate token using SimpleJWT
        access_token = AccessToken(token_string)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except Exception as e:
        logger.error(f"WebSocket Auth Error: {str(e)}")
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware that takes a token from the query string and authenticates the user.
    Usage: ws://host:port/ws/notifications/?token=<JWT_TOKEN>
    """
    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
