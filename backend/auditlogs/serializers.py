from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    actor_full_name = serializers.SerializerMethodField()
    
    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else "N/A"
        
    def get_actor_full_name(self, obj):
        return obj.actor.full_name if obj.actor else "System/Deleted"
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'actor', 'actor_userid', 'actor_employee_id', 
            'actor_full_name', 'actor_email',
            'action', 'entity_type', 'ip_address', 'status', 'details'
        ]
