from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Permission, Role, RolePermission, UserPermission

def get_allowed_office_ids(user):
    # If user has global view/create permissions, they can manage all offices
    # Note: we check 'view_any_office_chart' or 'create_any_office_chart'
    from org.models import WorkingOffice
    if user_has_permission_slug(user, 'duties.view_any_office_chart') or \
       user_has_permission_slug(user, 'duties.create_any_office_chart'):
        return set(WorkingOffice.objects.values_list('id', flat=True))

    return _expand_with_children(user, get_managed_office_ids(user))

def get_managed_office_ids(user):
    """Returns ONLY the offices the user is explicitly assigned to (primary + secondary)"""
    ids = []
    if getattr(user, 'office_id', None):
        ids.append(user.office_id)
    try:
        secondary = getattr(user, 'secondary_offices', None)
        if secondary:
            if hasattr(secondary, 'all'):
                # ManyToMany manager or QuerySet
                ids.extend(list(secondary.values_list('id', flat=True)))
            elif isinstance(secondary, (list, tuple)):
                # List of IDs or objects
                ids.extend([getattr(o, 'id', o) for o in secondary])
    except Exception:
        pass
    return set(ids)

def get_descendant_directorate_ids(root_ids):
    """Returns the set of directorate ids = the given roots plus all of their
    recursive sub-directorates (Directorate.parent tree)."""
    from org.models import Directorate
    root_ids = {int(r) for r in root_ids if r}
    if not root_ids:
        return set()

    # One query for the whole (tiny) directorate edge list, then in-memory BFS.
    children_by_parent = {}
    for cid, pid in Directorate.objects.values_list('id', 'parent_id'):
        children_by_parent.setdefault(pid, []).append(cid)

    result = set()
    visited = set()  # cycle guard, mirrors resolve_directorate pattern
    frontier = list(root_ids)
    while frontier:
        d = frontier.pop()
        if d in visited:
            continue
        visited.add(d)
        result.add(d)
        for child in children_by_parent.get(d, []):
            if child not in visited:
                frontier.append(child)
    return result

def _expand_with_children(user, base_ids):
    """Expand a set of office ids with their org-hierarchy descendants when the
    user holds 'duties.create_child_office_chart'. Descendants are derived from
    the directorate -> ac_office -> cc_office chain because WorkingOffice.parent
    is never populated."""
    from django.db.models import Q
    from org.models import WorkingOffice

    base_ids = set(base_ids)
    # Child-office expansion is gated behind an RBAC-managed permission.
    if not base_ids or not user_has_permission_slug(user, 'duties.create_child_office_chart'):
        return base_ids

    # Classify each base office by its tier in the org hierarchy.
    root_dir_ids = set()
    ac_ids = set()
    for o in WorkingOffice.objects.filter(id__in=base_ids).values(
        'directorate_id', 'ac_office_id', 'cc_office_id'
    ):
        if o['directorate_id']:
            root_dir_ids.add(o['directorate_id'])
        elif o['ac_office_id']:
            ac_ids.add(o['ac_office_id'])
        # cc-tier offices have no descendants

    result = set(base_ids)

    # Directorate-tier roots: every working office whose resolved directorate falls
    # inside the (recursive) sub-tree of the managed directorates.
    if root_dir_ids:
        all_dir_ids = get_descendant_directorate_ids(root_dir_ids)
        result |= set(
            WorkingOffice.objects.filter(
                Q(directorate_id__in=all_dir_ids) |
                Q(ac_office__directorate_id__in=all_dir_ids) |
                Q(cc_office__accounting_office__directorate_id__in=all_dir_ids)
            ).values_list('id', flat=True)
        )

    # Accounting-office-tier roots: cc-tier offices under those accounting offices.
    if ac_ids:
        result |= set(
            WorkingOffice.objects.filter(
                cc_office__accounting_office_id__in=ac_ids
            ).values_list('id', flat=True)
        )

    return result

def get_manageable_office_ids(user):
    """Offices the user may MANAGE duty charts for — create, edit, approve, and
    add/remove employees: their assigned offices (primary + secondary) plus
    org-hierarchy child offices when they hold 'duties.create_child_office_chart'.
    Users with 'duties.create_any_office_chart' manage every office.

    NOTE: unlike viewing (get_allowed_office_ids), 'duties.view_any_office_chart'
    does NOT widen management scope — anyone may view any office's charts, but
    management stays scoped to own + child offices.
    """
    from org.models import WorkingOffice
    if user_has_permission_slug(user, 'duties.create_any_office_chart'):
        return set(WorkingOffice.objects.values_list('id', flat=True))
    return _expand_with_children(user, get_managed_office_ids(user))

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
        
        # Also allow if they have specific duty/schedule management permissions
        permission_slugs = [
            'duties.create_dutychart',
            'duties.edit_dutychart',
            'duties.approve_dutychart',
            'duties.assign_employee',
            'schedules.create',
            'schedules.edit',
        ]
        for slug in permission_slugs:
            if user_has_permission_slug(request.user, slug):
                return True

        # If not SuperAdmin, OfficeAdmin, or having specific permissions, deny write permissions
        return False

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if IsSuperAdmin().has_permission(request, view):
            return True
        # Allow user to edit their own profile
        if request.user == obj:
            return True

        # Map methods to required permissions
        permission_map = {
            'PUT': 'users.edit_employee',
            'PATCH': 'users.edit_employee',
            'DELETE': 'users.delete_employee',
        }
        
        required_slug = permission_map.get(request.method)
        if not required_slug:
            # Allow POST for custom actions on objects, but still require IsOfficeAdmin or higher
            if request.method == 'POST':
                return True
            return False

        # Check for permission or the 'any office' override
        has_permission = user_has_permission_slug(request.user, required_slug)
        has_any_permission = user_has_permission_slug(request.user, 'users.create_any_office_employee')

        if not (has_permission or has_any_permission):
            return False
        
        # SuperAdmin is already handled.
        # Office Admin and Network Admin: restricted to their own office(s) unless they have 'any office' permission
        user_role = getattr(request.user, 'role', None)
        if user_role in ['OFFICE_ADMIN', 'NETWORK_ADMIN']:
            if not has_any_permission:
                return IsOfficeScoped().has_object_permission(request, view, obj)
        
        return True

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
