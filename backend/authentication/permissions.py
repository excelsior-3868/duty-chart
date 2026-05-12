from rest_framework import permissions
from django.conf import settings

class HasMobileAPIToken(permissions.BasePermission):
    """
    Allows access only if the request contains a valid Mobile API Token.
    """

    def has_permission(self, request, view):
        # Check for the token in the headers
        # Support both 'X-Mobile-Token' (Standard) and 'MOBILE_API_TOKEN' (User preference)
        token = request.headers.get('X-Mobile-Token') or \
                request.headers.get('MOBILE_API_TOKEN') or \
                request.headers.get('Mobile-Api-Token')
        
        required_token = getattr(settings, 'MOBILE_API_TOKEN', None)

        if not required_token or required_token.strip() == "":
            # If token is not set in settings, deny access (security by default)
            return False

        return token == required_token

class IsAuthenticatedOrHasMobileToken(permissions.BasePermission):
    """
    Allows access if:
    1. The user is authenticated (JWT)
    2. OR it's a READ-ONLY request with a valid Mobile API Token.
    
    This fulfills the requirement: "Expose API to Mobile App via token, 
    but ensure login for sensitive data/operations."
    """
    def has_permission(self, request, view):
        # 1. Always allow if authenticated
        if request.user and request.user.is_authenticated:
            return True

        # 2. For unauthenticated requests, allow ONLY if it's a SAFE method (GET, HEAD, OPTIONS)
        # AND a valid Mobile Token is provided.
        if request.method in permissions.SAFE_METHODS:
            return HasMobileAPIToken().has_permission(request, view)
        
        # 3. Deny everything else for unauthenticated users
        return False
