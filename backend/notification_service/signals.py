from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from duties.models import Duty
from .tasks import async_send_sms
from .utils import create_dashboard_notification
import logging
import threading

logger = logging.getLogger(__name__)

_thread_locals = threading.local()

class suppress_duty_notifications:
    """
    Context manager to temporarily suppress duty assignment notifications.
    Useful during bulk imports.
    """
    def __enter__(self):
        _thread_locals.skip_duty_notifications = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        _thread_locals.skip_duty_notifications = False

@receiver(post_save, sender=Duty)
def notify_duty_assignment(sender, instance, created, **kwargs):
    """
    Signal to notify user when a duty is assigned.
    Includes idempotency check and transactional safety.
    """
    if getattr(_thread_locals, 'skip_duty_notifications', False):
        logger.debug(f"Skipping notification for Duty {instance.id} (Suppressed)")
        return

    try:
        logger.info(f"Signal notify_duty_assignment triggered for Duty {instance.id}. Created: {created}, User: {instance.user_id}")
        
        if instance.user and instance.schedule:
            # ONLY notify if the chart is APPROVED
            if instance.duty_chart and instance.duty_chart.status != 'approved':
                logger.info(f"Skipping notification for Duty {instance.id}: Chart status is '{instance.duty_chart.status}' (must be 'approved').")
                return

            logger.info(f"Triggering assignment notification for Duty {instance.id} (Schedule: {instance.schedule.name})")
            # Transactional Safety: Wait for the Duty save to be committed
            transaction.on_commit(lambda: _handle_duty_assignment_notification(instance))
        else:
            reason = "No user" if not instance.user else "No schedule"
            logger.debug(f"Skipping notification for Duty {instance.id} ({reason})")
    except Exception as e:
        logger.error(f"Error in notify_duty_assignment signal: {e}")

def _handle_duty_assignment_notification(instance):
    try:
        from .models import SMSLog
        from django.db import IntegrityError
        
        user = instance.user
        if not user: return
        
        schedule = getattr(instance, 'schedule', None)
        duty_name = schedule.name if schedule and hasattr(schedule, 'name') else "Duty"
        
        # Ensure date is available and formatted
        duty_date = "Unknown Date"
        if instance.date:
            try:
                duty_date = instance.date.strftime("%Y-%m-%d")
            except Exception:
                duty_date = str(instance.date)

        # 1. SMS Notification logic
        if getattr(user, 'phone_number', None):
            full_name = getattr(user, 'full_name', user.username)
            
            chart_name = "Duty Chart"
            if instance.duty_chart and instance.duty_chart.name:
                chart_name = instance.duty_chart.name
            
            # Custom Message
            office_name = instance.office.name if instance.office else "Unknown Office"
            sms_message = f'Dear {full_name}, You have been assigned to "{chart_name}" at "{office_name}" for the "{duty_name}" on {duty_date}. Please visit https://dutychart.ntc.net.np for the detail.'
            
            # Idempotency: Try to create the SMSLog entry first
            try:
                log = SMSLog.objects.create(
                    user=user,
                    duty=instance,
                    phone=user.phone_number,
                    message=sms_message,
                    reminder_type='ASSIGNMENT',
                    status='pending'
                )
                
                # Use a direct background thread for immediate delivery without Celery overhead for single assignments
                def trigger_sms_task():
                    try:
                        from .utils import send_sms
                        success, response = send_sms(user.phone_number, sms_message, user=user, log_id=log.id)
                        if success:
                            logger.info(f"Assignment SMS sent successfully to {user.username}")
                        else:
                            logger.error(f"Assignment SMS failed for {user.username}: {response}")
                    except Exception as e:
                        logger.error(f"Fatal error in SMS thread for {user.username}: {e}")

                threading.Thread(target=trigger_sms_task, daemon=True).start()
                
            except IntegrityError:
                # Already exists, skip sending again
                logger.debug(f"Assignment SMS already sent/queued for user {user.username}, duty {instance.id}")
                return
        else:
            logger.warning(f"User {user.username} has no phone number for SMS notification.")
    except Exception as e:
        logger.exception(f"Error in _handle_duty_assignment_notification for Duty {instance.id}")
