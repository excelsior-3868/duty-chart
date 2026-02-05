from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from users.permissions import SuperAdminOrReadOnly
from .models import Directorate, Department, Office, SystemSetting, AccountingOffice, CCOffice
from .serializers import (
    DirectorateSerializer, DepartmentSerializer, 
    OfficeSerializer, SystemSettingSerializer,
    AccountingOfficeSerializer, CCOfficeSerializer
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
            queryset = queryset.filter(name__icontains=search)
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
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]

    def get_queryset(self):
        queryset = Office.objects.all()
        department_id = self.request.query_params.get('department', None)
        if department_id:
            queryset = queryset.filter(department_id=department_id)
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
            queryset = queryset.filter(name__icontains=search)
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
            queryset = queryset.filter(name__icontains=search)
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
