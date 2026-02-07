from django.db.models.signals import post_save, post_delete
from django.db import transaction
import json
from django.core.serializers.json import DjangoJSONEncoder
from .models import AuditLog
from .middleware import get_current_request, get_client_ip

class AuditableMixin:
    """
    Mixin to track changes for a model.
    Must be added to the model class.
    Logs CREATION, UPDATE, DELETION.
    """
    audit_log_exclude_fields = ['password', 'last_login', 'is_superuser', 'is_staff', 'groups', 'user_permissions']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._audit_original_state = self._get_model_state()

    def _get_model_state(self):
        """
        Snapshot of current model state.
        """
        state = {}
        for field in self._meta.fields:
            if field.name in self.audit_log_exclude_fields:
                continue
            try:
                # Use value_from_object to get raw value
                val = field.value_from_object(self)
                state[field.name] = val
            except Exception:
                pass
        return state

    def save(self, *args, **kwargs):
        # We need to determine if this is a Create or Update
        is_new = self._state.adding
        
        super().save(*args, **kwargs)
        
        self._log_change(is_new)
        self._audit_original_state = self._get_model_state() # Reset state

    def delete(self, *args, **kwargs):
        self._log_delete()
        super().delete(*args, **kwargs)

    def _log_change(self, is_new):
        request = get_current_request()
        if not request:
            user = None
            ip = None
            actor_userid = 'System'
            actor_employee_id = None
        else:
            user = request.user if request.user.is_authenticated else None
            ip = get_client_ip(request)
            actor_userid = user.username if user else 'Anonymous'
            actor_employee_id = getattr(user, 'employee_id', None) if user else None

        try:
            current_state = self._get_model_state()
            action = 'CREATE' if is_new else 'UPDATE'
            changes = {}

            if is_new:
                changes = {k: {'old': None, 'new': v} for k, v in current_state.items() if v is not None}
            else:
                for field, new_val in current_state.items():
                    old_val = self._audit_original_state.get(field)
                    if new_val != old_val:
                        changes[field] = {'old': old_val, 'new': new_val}
            
            if not changes and not is_new:
                return 

            details = ""
            if hasattr(self, 'get_audit_details'):
                try:
                    details = self.get_audit_details(action, changes)
                except Exception:
                    pass

            with transaction.atomic():
                AuditLog.objects.create(
                    action=action,
                    entity_type=self.__class__.__name__,
                    actor=user,
                    actor_userid=actor_userid,
                    actor_employee_id=actor_employee_id,
                    ip_address=ip,
                    details=details
                )
        except Exception as e:
            print(f"Failed to write audit log: {e}")

    def _log_delete(self):
        request = get_current_request()
        if not request:
            user = None
            ip = None
            actor_userid = 'System'
            actor_employee_id = None
        else:
            user = request.user if request.user.is_authenticated else None
            ip = get_client_ip(request)
            actor_userid = user.username if user else 'Anonymous'
            actor_employee_id = getattr(user, 'employee_id', None) if user else None

        try:
            details = ""
            if hasattr(self, 'get_audit_details'):
                try:
                    details = self.get_audit_details('DELETE', {})
                except Exception:
                    pass

            with transaction.atomic():
                AuditLog.objects.create(
                    action='DELETE',
                    entity_type=self.__class__.__name__,
                    actor=user,
                    actor_userid=actor_userid,
                    actor_employee_id=actor_employee_id,
                    ip_address=ip,
                    details=details
                )
        except Exception as e:
            print(f"Failed to write audit log (delete): {e}")
