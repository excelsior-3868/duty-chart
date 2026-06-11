from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from django.middleware.csrf import CsrfViewMiddleware

class CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        is_cookie = False
        if header is None:
            raw_token = request.COOKIES.get('access')
            is_cookie = True
        else:
            raw_token = self.get_raw_token(header)
            
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        # Enforce CSRF check for cookie authentication
        if is_cookie and request.method not in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            check = CSRFCheck()
            check.process_request(request)
            reason = check.process_view(request, None, (), {})
            if reason:
                raise PermissionDenied(f"CSRF Failed: {reason}")

        return user, validated_token
