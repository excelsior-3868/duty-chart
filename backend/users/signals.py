from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import User
from notification_service.utils import send_sms
import logging
import threading

logger = logging.getLogger(__name__)

@receiver(pre_save, sender=User)
def capture_user_state(sender, instance, **kwargs):
    """
    Capture original state of user before saving to detect changes.
    """
    if instance.pk:
        try:
            original = User.objects.get(pk=instance.pk)
            instance._old_is_activated = original.is_activated
            instance._old_role = original.role
        except User.DoesNotExist:
            instance._old_is_activated = None
            instance._old_role = None
    else:
        instance._old_is_activated = None
        instance._old_role = None

@receiver(post_save, sender=User)
def send_user_status_sms(sender, instance, created, **kwargs):
    """
    Send SMS when user is activated or role is changed.
    """
    is_now_activated = instance.is_activated
    was_activated = getattr(instance, '_old_is_activated', None)
    
    # 1. Activation Check
    # Case A: Newly created user who is active
    # Case B: Existing user who was inactive and is now active
    if is_now_activated and (created or was_activated is False):
        logger.info(f"User {instance.username} created/activated. Triggering SMS.")
        _trigger_status_sms(
            instance, 
            f"Dear {instance.full_name}, your DCMS account has been created. Please visit https://dutychart.ntc.net.np and use the Forgot Password option to set your new password."
        )
        return # Avoid double SMS if role also changed in same save
    
    # 2. Role Change Check
    # Only notify if already activated (or just activated) and role changed
    if is_now_activated:
        new_role = instance.get_role_display()
        old_role = getattr(instance, '_old_role', None)
        
        if old_role and old_role != instance.role:
            logger.info(f"User {instance.username} role changed from {old_role} to {instance.role}. Triggering SMS.")
            _trigger_status_sms(
                instance,
                f"Dear {instance.full_name}, your system role of DCMS has been updated to '{new_role}'. Please visit https://dutychart.ntc.net.np for details."
            )

def _trigger_status_sms(user, message):
    """
    Helper to send SMS in a background thread to avoid blocking the request.
    """
    if not user.phone_number:
        logger.warning(f"Cannot send status SMS to {user.username}: No phone number.")
        return

    def trigger():
        try:
            # Use the existing send_sms utility which also handles SMSLog
            success, response = send_sms(user.phone_number, message, user=user)
            if success:
                logger.info(f"Status SMS sent successfully to {user.username}")
            else:
                logger.error(f"Status SMS failed for {user.username}: {response}")
        except Exception as e:
            logger.error(f"Error in background status SMS for {user.username}: {e}")

    import sys
    if 'test' in sys.argv:
        trigger()
    else:
        threading.Thread(target=trigger, daemon=True).start()
