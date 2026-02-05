from django.db.models import Q
from rest_framework import viewsets, permissions, pagination
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification, SMSLog
from .serializers import NotificationSerializer, SMSLogSerializer

class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

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
