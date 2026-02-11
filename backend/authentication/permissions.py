from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    """
    Allocates access only to users with role 'SUPERADMIN'.
    """
    def has_permission(self, request, view):
        # Debugging: Print user details to console
        print(f"DEBUG: User: {request.user}, Auth: {request.user.is_authenticated}", flush=True)
        if request.user.is_authenticated:
            print(f"DEBUG: User Role: {getattr(request.user, 'role', 'No Role')}", flush=True)

        # Check if user is authenticated and has the role 'SUPERADMIN' or is a django superuser
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (getattr(request.user, 'role', None) == 'SUPERADMIN' or request.user.is_superuser)
        )
