from django.shortcuts import render
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from pyaxmlparser import APK
import os
from django.conf import settings
from users.permissions import SuperAdminOrReadOnly
from authentication.permissions import HasMobileAPIToken
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
    permission_classes = [HasMobileAPIToken | SuperAdminOrReadOnly]
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

    @transaction.atomic
    def perform_create(self, serializer):
        directorate_instance = serializer.save()
        # Also create a WorkingOffice entry with name_of_office and directorate_id
        WorkingOffice.objects.create(
            name=directorate_instance.directorate,
            directorate=directorate_instance
        )

    @transaction.atomic
    def perform_update(self, serializer):
        directorate_instance = serializer.save()
        # Update the corresponding WorkingOffice name
        WorkingOffice.objects.filter(directorate=directorate_instance).update(
            name=directorate_instance.directorate
        )

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [HasMobileAPIToken | SuperAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        queryset = Department.objects.all()
        directorate_id = self.request.query_params.get('directorate', None)
        if directorate_id:
            queryset = queryset.filter(directorate_id=directorate_id)
        return queryset

class OfficeViewSet(viewsets.ModelViewSet):
    queryset = WorkingOffice.objects.all()
    serializer_class = WorkingOfficeSerializer
    permission_classes = [HasMobileAPIToken | SuperAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        print(f"[DEBUG] OfficeViewSet.get_queryset() head: {self.request.headers.get('Authorization')[:15] if self.request.headers.get('Authorization') else 'None'}")
        queryset = WorkingOffice.objects.all()
        return queryset

class AccountingOfficeViewSet(viewsets.ModelViewSet):
    queryset = AccountingOffice.objects.all().order_by('id')
    serializer_class = AccountingOfficeSerializer
    permission_classes = [HasMobileAPIToken | SuperAdminOrReadOnly]
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
    permission_classes = [HasMobileAPIToken | SuperAdminOrReadOnly]
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

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_apk(self, request):
        if not request.user.is_superuser and request.user.role != 'SUPERADMIN':
            return Response({"error": "Only Super Admins can upload APKs"}, status=status.HTTP_403_FORBIDDEN)
        
        file_obj = request.FILES.get('apk')
        if not file_obj:
            return Response({"error": "No APK file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file_obj.name.endswith('.apk'):
            return Response({"error": "Only .apk files are allowed"}, status=status.HTTP_400_BAD_REQUEST)

        # Target directory: Mobile App folder
        # In Docker, we map this as a volume to /app/mobileApp
        target_dir = os.path.join(settings.BASE_DIR, 'mobileApp')
        
        # Fallback for host development if the folder is one level up
        if not os.path.exists(target_dir) and os.path.exists(os.path.join(settings.BASE_DIR.parent, 'mobileApp')):
             target_dir = os.path.join(settings.BASE_DIR.parent, 'mobileApp')
             
        if not os.path.exists(target_dir):
            os.makedirs(target_dir, exist_ok=True)
        
        file_path = os.path.join(target_dir, file_obj.name)
        
        try:
            with open(file_path, 'wb+') as destination:
                for chunk in file_obj.chunks():
                    destination.write(chunk)
            
            # Extract version from APK
            try:
                apk_data = APK(file_path)
                version_name = apk_data.version_name
            except Exception as version_error:
                print(f"Error extracting version: {version_error}")
                version_name = None

            # Update the system setting URL and latest version automatically
            # Keep track of old version by shifting the current latest
            setting = SystemSetting.objects.first()
            if not setting:
                setting = SystemSetting.objects.create()
            
            # The URL path for mobile app to fetch
            relative_path = f"mobileApp/{file_obj.name}"
            
            # Record current latest as old before updating
            if setting.latest_app_version:
                setting.old_app_version = setting.latest_app_version
            
            setting.app_update_url = relative_path
            
            if version_name:
                setting.latest_app_version = version_name
            
            setting.save()

            return Response({
                "message": "APK uploaded successfully",
                "filename": file_obj.name,
                "url": relative_path,
                "version": version_name
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to save APK: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
