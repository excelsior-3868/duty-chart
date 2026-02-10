from django.shortcuts import render
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Max, Case, When, Value, CharField
from django.core.exceptions import ValidationError
from .models import User, Position, Role, Permission, RolePermission, UserDashboardOffice
from .serializers import UserSerializer, PositionSerializer, RoleSerializer, PermissionSerializer, UserDashboardOfficeSerializer
from users.permissions import AdminOrReadOnly, IsSuperAdmin, get_allowed_office_ids, ManageRBACOrReadOnly

# Create your views here.

from rest_framework.pagination import PageNumberPagination

class UserPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('position', 'office', 'department', 'directorate').prefetch_related('secondary_offices')
    serializer_class = UserSerializer
    permission_classes = [AdminOrReadOnly]
    pagination_class = UserPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['full_name', 'email', 'employee_id', 'username', 'phone_number', 'department__name', 'office__name', 'directorate__directorate', 'status_text']
    ordering_fields = ['full_name', 'employee_id']
    ordering = ['full_name']

    def get_queryset(self):
        queryset = (
            User.objects
            .select_related('position', 'office', 'department', 'directorate')
            .prefetch_related('secondary_offices')
            .annotate(
                status_text=Case(
                    When(is_activated=True, then=Value('Active')),
                    When(is_activated=False, then=Value('Inactive')),
                    output_field=CharField()
                )
            )
        )

        office_id = self.request.query_params.get('office', None)
        is_activated = self.request.query_params.get('is_activated', None)
        duty_chart_id = self.request.query_params.get('duty_chart_id', None)

        if is_activated is not None:
            queryset = queryset.filter(is_activated=is_activated.lower() == 'true')

        if duty_chart_id:
            queryset = queryset.filter(duties__duty_chart_id=duty_chart_id).distinct()

        if office_id:
            # Include users whose primary office matches OR who have the office as a secondary membership
            queryset = queryset.filter(
                Q(office_id=office_id) | Q(secondary_offices__id=office_id)
            ).distinct()
        else:
            # Default to authenticated user's office context when available
            # EXCEPT if user has permission to assign any office employees (global access)
            user = self.request.user
            from users.permissions import user_has_permission_slug
            can_see_all = getattr(user, 'role', None) == 'SUPERADMIN' or \
                          user_has_permission_slug(user, 'duties.assign_any_office_employee') or \
                          user_has_permission_slug(user, 'users.view_all') or \
                          user_has_permission_slug(user, 'users.view_employee')

            if not can_see_all and self.action != 'retrieve' and user.is_authenticated and getattr(user, 'office_id', None):
                current_office_id = user.office_id
                queryset = queryset.filter(
                    Q(office_id=current_office_id) | Q(secondary_offices__id=current_office_id)
                ).distinct()

        return queryset
    
    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return

        from users.permissions import user_has_permission_slug
        can_assign_any = user_has_permission_slug(self.request.user, 'users.create_any_office_employee')

        allowed = get_allowed_office_ids(self.request.user)
        data_office = self.request.data.get('office')
        # secondary_offices may be list of IDs
        secondary_ids = self.request.data.get('secondary_offices') or []
        if isinstance(secondary_ids, str):
            try:
                secondary_ids = [int(x) for x in secondary_ids.split(',') if x.strip()]
            except Exception:
                secondary_ids = []
        
        if not can_assign_any:
            if not data_office or int(data_office) not in allowed:
                raise DRFValidationError("Not allowed to assign primary office outside your scope.")
            if any(int(sid) not in allowed for sid in secondary_ids):
                raise DRFValidationError("Not allowed to assign secondary offices outside your scope.")
        
        serializer.save()
    
    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        
        # 1. SuperAdmins can do anything
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return

        # 2. Users can always edit their own profile
        if self.request.user == serializer.instance:
            serializer.save()
            return
        
        # 3. Otherwise, check office scope permissions
        from users.permissions import user_has_permission_slug
        can_assign_any = user_has_permission_slug(self.request.user, 'users.create_any_office_employee')

        allowed = get_allowed_office_ids(self.request.user)
        data_office = self.request.data.get('office')
        current_office = getattr(serializer.instance, 'office_id', None)
        target_office = int(data_office) if data_office is not None else current_office
        
        secondary_ids = self.request.data.get('secondary_offices')
        if isinstance(secondary_ids, str):
            try:
                secondary_ids = [int(x) for x in secondary_ids.split(',') if x.strip()]
            except Exception:
                secondary_ids = None

        if not can_assign_any:
            if target_office is None or int(target_office) not in allowed:
                raise DRFValidationError("Not allowed to set primary office outside your scope.")
            if secondary_ids is not None and any(int(sid) not in allowed for sid in secondary_ids):
                raise DRFValidationError("Not allowed to set secondary offices outside your scope.")
        
        serializer.save()


class PositionViewSet(viewsets.ModelViewSet):
    queryset = Position.objects.all().order_by('name')
    serializer_class = PositionSerializer
    permission_classes = [permissions.IsAuthenticated]

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.filter(is_active=True).order_by('slug')
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.filter(is_active=True).order_by('slug')
    serializer_class = RoleSerializer
    permission_classes = [ManageRBACOrReadOnly]

    @action(detail=True, methods=['get', 'put'], url_path='permissions', permission_classes=[ManageRBACOrReadOnly])
    def permissions(self, request, pk=None):
        role = self.get_object()
        if request.method == 'GET':
            slugs = list(
                RolePermission.objects.filter(role=role).select_related('permission').values_list('permission__slug', flat=True)
            )
            return Response({'role': role.slug, 'permissions': slugs})
        # PUT: sync permissions
        perm_slugs = request.data.get('permissions', [])
        if not isinstance(perm_slugs, list):
            return Response({'detail': 'permissions must be a list of slugs'}, status=400)
        valid_perms = list(Permission.objects.filter(slug__in=perm_slugs, is_active=True))
        valid_set = set(p.slug for p in valid_perms)
        
        # Remove mappings not in desired set - Process individually for Audit Logging
        to_remove = RolePermission.objects.filter(role=role).exclude(permission__slug__in=valid_set)
        for rp in to_remove:
            rp.delete() 

        # Add missing
        existing_set = set(RolePermission.objects.filter(role=role).values_list('permission__slug', flat=True))
        to_add = [p for p in valid_perms if p.slug not in existing_set]
        for p in to_add:
            RolePermission.objects.get_or_create(role=role, permission=p)
            
        slugs = list(RolePermission.objects.filter(role=role).values_list('permission__slug', flat=True))
        return Response({'role': role.slug, 'permissions': slugs})

class UserDashboardOfficeViewSet(viewsets.ModelViewSet):
    serializer_class = UserDashboardOfficeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserDashboardOffice.objects.filter(user=self.request.user).order_by('order', 'id')

    def perform_create(self, serializer):
        # Auto-set order to max+1
        max_order = UserDashboardOffice.objects.filter(user=self.request.user).aggregate(m=Max('order'))['m'] or 0
        serializer.save(order=max_order + 1)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        orders = request.data.get('orders', []) # List of {id: X, order: Y}
        if not isinstance(orders, list):
            return Response({'detail': 'orders must be a list'}, status=400)
        
        for item in orders:
            UserDashboardOffice.objects.filter(user=request.user, id=item.get('id')).update(order=item.get('order'))
            
        return Response({'status': 'reordered'})

