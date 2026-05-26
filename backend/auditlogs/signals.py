from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver
from .models import AuditLog
from .middleware import get_client_ip

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    ip = get_client_ip(request) if request else None
    
    AuditLog.objects.create(
        action='LOGIN',
        actor=user,
        actor_userid=user.employee_id,
        actor_employee_id=getattr(user, 'employee_id', None),
        ip_address=ip,
        entity_type='User',
        status='SUCCESS',
        details=f"User {user.full_name} logged in."
    )

@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    if not user: return
    ip = get_client_ip(request) if request else None

    AuditLog.objects.create(
        action='LOGOUT',
        actor=user,
        actor_userid=user.employee_id,
        actor_employee_id=getattr(user, 'employee_id', None),
        ip_address=ip,
        entity_type='User',
        status='SUCCESS',
        details=f"User {user.full_name} logged out."
    )

@receiver(user_login_failed)
def log_user_login_failed(sender, credentials, request, **kwargs):
    ip = get_client_ip(request) if request else None
    username = credentials.get('username', 'unknown')
    
    AuditLog.objects.create(
        action='LOGIN',
        actor=None,
        actor_userid=username,
        ip_address=ip,
        entity_type='User',
        status='FAILURE',
        details=f"Login failed for user {username}."
    )
