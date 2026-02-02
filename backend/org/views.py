from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from users.permissions import SuperAdminOrReadOnly
from .models import Directorate, Department, Office, SystemSetting
from .serializers import (
    DirectorateSerializer, DepartmentSerializer, 
    OfficeSerializer, SystemSettingSerializer
)

# Create your views here.

class DirectorateViewSet(viewsets.ModelViewSet):
    queryset = Directorate.objects.all()
    serializer_class = DirectorateSerializer
    permission_classes = [SuperAdminOrReadOnly]

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
