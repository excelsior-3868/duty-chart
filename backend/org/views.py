from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from users.permissions import SuperAdminOrReadOnly
from .models import Directorate, Department, Office, SystemSetting, AccountingOffice, CCOffice, WorkingOffice
from .serializers import (
    DirectorateSerializer, DepartmentSerializer, 
    OfficeSerializer, SystemSettingSerializer,
    AccountingOfficeSerializer, CCOfficeSerializer, WorkingOfficeSerializer
)

# Create your views here.

from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class DirectorateViewSet(viewsets.ModelViewSet):
    queryset = Directorate.objects.all().order_by('id')
    serializer_class = DirectorateSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = Directorate.objects.all().order_by('id')
        search = self.request.query_params.get('search', None)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(directorate__icontains=search) | Q(parent__directorate__icontains=search))
        return queryset

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == 'true':
            return None
        return super().paginate_queryset(queryset)

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [SuperAdminOrReadOnly]

    def get_queryset(self):
        queryset = Department.objects.all()
        directorate_id = self.request.query_params.get('directorate', None)
        if directorate_id:
            queryset = queryset.filter(directorate_id=directorate_id)
        return queryset

class OfficeViewSet(viewsets.ModelViewSet):
    queryset = WorkingOffice.objects.all()
    serializer_class = WorkingOfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]

    def get_queryset(self):
        queryset = WorkingOffice.objects.all()
        # Keep filter logic but maybe adapt to directorate if needed
        # For now, searching by name is usually enough if filtered in frontend
        return queryset

class AccountingOfficeViewSet(viewsets.ModelViewSet):
    queryset = AccountingOffice.objects.all().order_by('id')
    serializer_class = AccountingOfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = AccountingOffice.objects.all().order_by('id')
        search = self.request.query_params.get('search', None)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(name__icontains=search) | Q(directorate__directorate__icontains=search))
        return queryset

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == 'true':
            return None
        return super().paginate_queryset(queryset)

class CCOfficeViewSet(viewsets.ModelViewSet):
    queryset = CCOffice.objects.all().order_by('id')
    serializer_class = CCOfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = CCOffice.objects.all().order_by('id')
        search = self.request.query_params.get('search', None)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(name__icontains=search) | Q(accounting_office__name__icontains=search))
        return queryset

class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'create', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        setting = SystemSetting.objects.first()
        if not setting:
            setting = SystemSetting.objects.create()
        serializer = self.get_serializer(setting)
        return Response(serializer.data)
