from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.core.exceptions import ValidationError
from .models import User, Position, Role, Permission, RolePermission, UserDashboardOffice
from .serializers import UserSerializer, PositionSerializer, RoleSerializer, PermissionSerializer, UserDashboardOfficeSerializer
from users.permissions import AdminOrReadOnly, IsSuperAdmin, get_allowed_office_ids, ManageRBACOrReadOnly

# Create your views here.

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('position', 'office', 'department', 'directorate').prefetch_related('secondary_offices')
    serializer_class = UserSerializer
    permission_classes = [AdminOrReadOnly]

    def get_queryset(self):
        queryset = (
            User.objects
            .select_related('position', 'office', 'department', 'directorate')
            .prefetch_related('secondary_offices')
        )

        office_id = self.request.query_params.get('office', None)

        if office_id:
            # Include users whose primary office matches OR who have the office as a secondary membership
            queryset = queryset.filter(
                Q(office_id=office_id) | Q(secondary_offices__id=office_id)
            ).distinct()
        else:
            # Default to authenticated user's office context when available
            # We skip this default filtering for retrieve/detail actions so that
            # users can view details of staff from other offices (e.g., in duty cards)
            if self.action != 'retrieve' and self.request.user.is_authenticated and getattr(self.request.user, 'office_id', None):
                current_office_id = self.request.user.office_id
                queryset = queryset.filter(
                    Q(office_id=current_office_id) | Q(secondary_offices__id=current_office_id)
                ).distinct()

        return queryset
    
    def perform_create(self, serializer):
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return
        allowed = get_allowed_office_ids(self.request.user)
        data_office = self.request.data.get('office')
        # secondary_offices may be list of IDs
        secondary_ids = self.request.data.get('secondary_offices') or []
        if isinstance(secondary_ids, str):
            try:
                secondary_ids = [int(x) for x in secondary_ids.split(',') if x.strip()]
            except Exception:
                secondary_ids = []
        if not data_office or int(data_office) not in allowed:
            raise ValidationError("Not allowed to assign primary office outside your scope.")
        if any(int(sid) not in allowed for sid in secondary_ids):
            raise ValidationError("Not allowed to assign secondary offices outside your scope.")
        serializer.save()
    
    def perform_update(self, serializer):
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return
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
        if target_office is None or int(target_office) not in allowed:
            raise ValidationError("Not allowed to set primary office outside your scope.")
        if secondary_ids is not None and any(int(sid) not in allowed for sid in secondary_ids):
            raise ValidationError("Not allowed to set secondary offices outside your scope.")
        serializer.save()


class PositionViewSet(viewsets.ReadOnlyModelViewSet):
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
        # Remove mappings not in desired set
        RolePermission.objects.filter(role=role).exclude(permission__slug__in=valid_set).delete()
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
        return UserDashboardOffice.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()

