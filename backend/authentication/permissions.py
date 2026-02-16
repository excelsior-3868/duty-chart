from rest_framework import permissions
from django.conf import settings

class HasMobileAPIToken(permissions.BasePermission):
    """
    Allows access only if the request contains a valid Mobile API Token.
    """

    def has_permission(self, request, view):
        # Check for the token in the headers
        # Mobile app should send 'X-Mobile-Token' header
        # Django converts headers to 'HTTP_X_MOBILE_TOKEN'
        token = request.META.get('HTTP_X_MOBILE_TOKEN')
        required_token = getattr(settings, 'MOBILE_API_TOKEN', None)

        if not required_token:
            # If token is not set in settings, deny access (security by default)
            return False

        return token == required_token
