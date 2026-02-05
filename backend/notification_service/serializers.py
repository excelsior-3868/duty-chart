from rest_framework import serializers
from .models import Notification, SMSLog

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class SMSLogSerializer(serializers.ModelSerializer):
    user_full_name = serializers.ReadOnlyField(source='user.full_name')
    
    class Meta:
        model = SMSLog
        fields = ['id', 'user', 'user_full_name', 'phone', 'message', 'status', 'response_raw', 'created_at']
