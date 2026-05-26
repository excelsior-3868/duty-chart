from rest_framework import permissions

class IsAdminOrSelf(permissions.BasePermission):
    """
    Admin users can access any user's reports.
    Normal users can access only their own data.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or getattr(request.user, "is_admin", False):
            return True
        return obj.user_id == request.user.id