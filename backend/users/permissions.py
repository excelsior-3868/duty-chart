from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Permission, Role, RolePermission, UserPermission

def get_allowed_office_ids(user):
    # If user has global view/create permissions, they can manage all offices
    # Note: we check 'view_any_office_chart' or 'create_any_office_chart'
    from org.models import WorkingOffice
    if user_has_permission_slug(user, 'duties.view_any_office_chart') or \
       user_has_permission_slug(user, 'duties.create_any_office_chart'):
        return set(WorkingOffice.objects.values_list('id', flat=True))

    ids = []
    if getattr(user, 'office_id', None):
        ids.append(user.office_id)
    try:
        if hasattr(user, 'secondary_offices'):
            ids.extend(list(user.secondary_offices.values_list('id', flat=True)))
    except Exception:
        pass
    return set(ids)

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and (getattr(user, 'is_superuser', False) or getattr(user, 'role', None) == 'SUPERADMIN'))

class IsOfficeAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and getattr(user, 'role', None) == 'OFFICE_ADMIN' and getattr(user, 'office_id', None))

class IsOfficeScoped(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        allowed = get_allowed_office_ids(user)
        office_id = None
        office_id = getattr(obj, 'office_id', None) or getattr(getattr(obj, 'office', None), 'id', None)
        if office_id is None:
            chart_office = getattr(getattr(obj, 'duty_chart', None), 'office_id', None)
            office_id = chart_office
        return bool(allowed and office_id in allowed)

class AdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        if IsSuperAdmin().has_permission(request, view):
            return True
        if IsOfficeAdmin().has_permission(request, view):
            return True
        # Allow partial updates (like profile pic) if target is self
        # This is checked further in has_object_permission
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if IsSuperAdmin().has_permission(request, view):
            return True
        # Allow user to edit their own profile
        if request.user == obj:
            return True
        if IsOfficeAdmin().has_permission(request, view):
            # Check if user being edited is in same office
            return IsOfficeScoped().has_object_permission(request, view, obj)
        return False

class SuperAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return IsSuperAdmin().has_permission(request, view)

def user_has_permission_slug(user, slug: str) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    
    role_slug = getattr(user, 'role', None)
    role_obj = Role.objects.filter(slug=role_slug, is_active=True).first() if role_slug else None
    
    role_has = False
    if role_obj:
        role_has = RolePermission.objects.filter(role=role_obj, permission__slug=slug, permission__is_active=True).exists()
    
    direct_has = UserPermission.objects.filter(user=user, permission__slug=slug, permission__is_active=True).exists()
    
    return bool(role_has or direct_has)

class ManageRBACOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        if IsSuperAdmin().has_permission(request, view):
            return True
        return user_has_permission_slug(request.user, 'system.manage_rbac')
