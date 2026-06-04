import hmac
from rest_framework import permissions
from django.conf import settings
from django.core import signing
from django.core.signing import BadSignature

# Short-lived mobile session tokens are valid for 1 hour.
MOBILE_SESSION_LIFETIME = 3600


def validate_mobile_session_token(token, secret):
    """Return True if the signed mobile session token is valid and not expired."""
    try:
        signing.loads(token, key=secret, salt='mobile_app_session', max_age=MOBILE_SESSION_LIFETIME)
        return True
    except (BadSignature, signing.SignatureExpired):
        return False


def validate_raw_mobile_token(raw_token, required_secret):
    """Timing-safe comparison for the static MOBILE_API_TOKEN.

    Used only at the /api/v1/mobile/auth/ token-exchange endpoint — never for
    regular API requests.
    """
    try:
        return hmac.compare_digest(
            raw_token.encode('utf-8'),
            required_secret.encode('utf-8'),
        )
    except Exception:
        return False


class HasMobileAPIToken(permissions.BasePermission):
    """
    Grants access when the request carries a valid short-lived mobile session
    token issued by POST /api/v1/mobile/auth/.

    Header: X-Mobile-Session-Token: <session_token>
    """

    def has_permission(self, request, view):
        required_secret = getattr(settings, 'MOBILE_API_TOKEN', None)
        if not required_secret or not required_secret.strip():
            return False

        session_token = (
            request.headers.get('X-Mobile-Session-Token') or
            request.headers.get('Mobile-Session-Token')
        )
        if session_token:
            return validate_mobile_session_token(session_token, required_secret)

        return False


class IsAuthenticatedOrHasMobileToken(permissions.BasePermission):
    """
    Allows access if:
    1. The user is authenticated (JWT), OR
    2. It is a read-only request (GET/HEAD/OPTIONS) carrying a valid mobile
       session token.
    """

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True

        if request.method in permissions.SAFE_METHODS:
            return HasMobileAPIToken().has_permission(request, view)

        return False
