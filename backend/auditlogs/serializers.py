from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.ReadOnlyField(source='actor.email')
    actor_full_name = serializers.ReadOnlyField(source='actor.full_name')
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'actor', 'actor_userid', 'actor_employee_id', 
            'actor_full_name', 'actor_email',
            'action', 'entity_type', 'ip_address', 'status', 'details'
        ]
