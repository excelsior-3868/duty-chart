from rest_framework import serializers
from .models import Notification, SMSLog, OfficeNotificationSetting

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class SMSLogSerializer(serializers.ModelSerializer):
    user_full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SMSLog
        fields = ['id', 'user', 'user_full_name', 'phone', 'message', 'status', 'response_raw', 'created_at']
    
    def get_user_full_name(self, obj):
        if obj.user:
            return obj.user.full_name
        return "N/A"


class OfficeNotificationSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficeNotificationSetting
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

