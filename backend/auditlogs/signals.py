from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver
from .models import AuditLog
from .middleware import get_client_ip

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    ip = get_client_ip(request) if request else None
    user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''
    
    AuditLog.objects.create(
        action='LOGIN',
        actor=user,
        actor_name=user.get_full_name() or user.username,
        ip_address=ip,
        user_agent=user_agent,
        entity_type='User',
        entity_id=str(user.pk),
        status='SUCCESS'
    )

@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    if not user: return
    ip = get_client_ip(request) if request else None
    user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''

    AuditLog.objects.create(
        action='LOGOUT',
        actor=user,
        actor_name=user.get_full_name() or user.username,
        ip_address=ip,
        user_agent=user_agent,
        entity_type='User',
        entity_id=str(user.pk),
        status='SUCCESS'
    )

@receiver(user_login_failed)
def log_user_login_failed(sender, credentials, request, **kwargs):
    ip = get_client_ip(request) if request else None
    user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''
    username = credentials.get('username', 'unknown')
    
    # We don't have a user object here usually, or it's Anonymous
    AuditLog.objects.create(
        action='LOGIN',
        actor=None,
        actor_name=username,
        ip_address=ip,
        user_agent=user_agent,
        entity_type='User',
        entity_id='N/A',
        status='FAILURE',
        changes={'reason': 'Invalid credentials'}
    )
