from django.db.models import Q
from rest_framework import viewsets, permissions, pagination
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification, SMSLog, OfficeNotificationSetting
from .serializers import NotificationSerializer, SMSLogSerializer, OfficeNotificationSettingSerializer

class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    # Read-only plus the mark_read/mark_all_read POST actions; notifications
    # are created by the backend, never directly by API clients.
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        return Response({'detail': 'Method "POST" not allowed.'}, status=405)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'all notifications marked as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'])
    def broadcast_changelog(self, request):
        if not request.user.is_superuser and getattr(request.user, 'role', None) != 'SUPERADMIN':
            return Response({'detail': 'You do not have permission to perform this action.'}, status=403)
        
        version = request.data.get('version', 'v2.3.0')
        title = f"New Update Available: {version}"
        message = f"A new system update ({version}) has been deployed. Click here to view what's new."
        link = "/about?showChangelog=true"
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        active_users = User.objects.filter(is_active=True)
        
        from .utils import create_bulk_dashboard_notifications
        create_bulk_dashboard_notifications(
            users=active_users,
            title=title,
            message=message,
            notification_type='SYSTEM',
            link=link
        )
        return Response({'status': f'changelog notification broadcasted for version {version}'})

class SMSLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Super Admins to view all sent SMS logs.
    """
    serializer_class = SMSLogSerializer
    queryset = SMSLog.objects.all()
    permission_classes = [permissions.IsAdminUser]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = SMSLog.objects.all().select_related('user')
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(phone__icontains=search) |
                Q(message__icontains=search) |
                Q(user__full_name__icontains=search) |
                Q(user__username__icontains=search)
            )
        return queryset


class IsSuperAdminOrNetworkAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or getattr(request.user, 'role', None) == 'SUPERADMIN':
            return True
        if getattr(request.user, 'role', None) == 'NETWORK_ADMIN':
            return True
        return False


class OfficeNotificationSettingViewSet(viewsets.ModelViewSet):
    serializer_class = OfficeNotificationSettingSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrNetworkAdmin]
    lookup_field = 'office_id'

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'role', None) == 'SUPERADMIN':
            return OfficeNotificationSetting.objects.all()
        elif getattr(user, 'role', None) == 'NETWORK_ADMIN':
            if user.office_id:
                return OfficeNotificationSetting.objects.filter(office_id=user.office_id)
        return OfficeNotificationSetting.objects.none()

    def retrieve(self, request, *args, **kwargs):
        office_id = self.kwargs.get('office_id')
        user = self.request.user
        
        if getattr(user, 'role', None) == 'NETWORK_ADMIN':
            if str(user.office_id) != str(office_id):
                return Response({"detail": "You do not have permission to view this office's settings."}, status=403)
        
        setting, created = OfficeNotificationSetting.objects.get_or_create(
            office_id=office_id,
            defaults={
                'enable_advance_reminder': True,
                'advance_reminder_days': 1,
                'advance_reminder_time': '18:00:00',
                'advance_reminder_template': 'Dear {{employee_name}}, your duty "{{shift_name}}" at "{{office_name}}" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details.',
                'allowed_shifts': [],
                'allowed_duty_charts': [],
                'schedule_configs': {}
            }
        )
        serializer = self.get_serializer(setting)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        office_id = self.kwargs.get('office_id')
        user = self.request.user
        
        if getattr(user, 'role', None) == 'NETWORK_ADMIN':
            if str(user.office_id) != str(office_id):
                return Response({"detail": "You do not have permission to modify this office's settings."}, status=403)
                
        setting, _ = OfficeNotificationSetting.objects.get_or_create(
            office_id=office_id,
            defaults={
                'enable_advance_reminder': True,
                'advance_reminder_days': 1,
                'advance_reminder_time': '18:00:00',
                'advance_reminder_template': 'Dear {{employee_name}}, your duty "{{shift_name}}" at "{{office_name}}" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details.',
                'allowed_shifts': [],
                'allowed_duty_charts': [],
                'schedule_configs': {}
            }
        )
        
        serializer = self.get_serializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        office_id = request.data.get('office')
        if not office_id:
            return Response({"detail": "Office is required."}, status=400)
            
        user = self.request.user
        if getattr(user, 'role', None) == 'NETWORK_ADMIN':
            if str(user.office_id) != str(office_id):
                return Response({"detail": "You do not have permission to modify this office's settings."}, status=403)
                
        setting, created = OfficeNotificationSetting.objects.get_or_create(
            office_id=office_id,
            defaults={
                'enable_advance_reminder': True,
                'advance_reminder_days': 1,
                'advance_reminder_time': '18:00:00',
                'advance_reminder_template': 'Dear {{employee_name}}, your duty "{{shift_name}}" at "{{office_name}}" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details.',
                'allowed_shifts': [],
                'allowed_duty_charts': [],
                'schedule_configs': {}
            }
        )
        serializer = self.get_serializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201 if created else 200)

