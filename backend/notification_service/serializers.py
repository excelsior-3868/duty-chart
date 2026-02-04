from rest_framework import serializers
from .models import Notification, SMSLog

class NotificationSerializer(serializers.ModelSerializer):
    created_at_human = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'link', 'is_read', 'created_at', 'created_at_human']
        read_only_fields = ['id', 'created_at']

    def get_created_at_human(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")

class SMSLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMSLog
        fields = ['id', 'phone', 'message', 'status', 'created_at']
