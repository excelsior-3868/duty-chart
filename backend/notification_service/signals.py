from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from duties.models import Duty
from .tasks import async_send_sms
from .utils import create_dashboard_notification
import logging
import threading

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Duty)
def notify_duty_assignment(sender, instance, created, **kwargs):
    """
    Signal to notify user when a duty is assigned.
    Includes idempotency check and transactional safety.
    """
    try:
        logger.debug(f"Signal notify_duty_assignment triggered for Duty {instance.id}. Created: {created}, User: {instance.user_id}")
        
        if instance.user and instance.schedule and getattr(instance.schedule, 'shift_type', None) == 'Shift':
            logger.info(f"Triggering assignment notification for Duty {instance.id} (Created: {created})")
            # Transactional Safety: Wait for the Duty save to be committed
            transaction.on_commit(lambda: _handle_duty_assignment_notification(instance))
        else:
            reason = "No user" if not instance.user else "Not a 'Shift' type"
            logger.debug(f"Skipping notification for Duty {instance.id} ({reason})")
    except Exception as e:
        logger.error(f"Error in notify_duty_assignment signal: {e}")

def _handle_duty_assignment_notification(instance):
    try:
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

        # 1. Dashboard Notification (Disabled for now)
        # title = "New Duty Assigned"
        # message = f"You have been assigned to {duty_name} on {duty_date}."
        
        # Idempotency check with safe created_at access
        # from .models import Notification
        # created_at_date = None
        # if hasattr(instance, 'created_at') and instance.created_at:
        #     try:
        #         created_at_date = instance.created_at.date()
        #     except Exception:
        #         pass
        
        # exists = Notification.objects.filter(
        #     user=user,
        #     notification_type='ASSIGNMENT',
        #     created_at__date=created_at_date,
        #     message__contains=f"on {duty_date}"
        # ).exists()

        # if not exists:
        #     create_dashboard_notification(
        #         user=user,
        #         title=title,
        #         message=message,
        #         notification_type='ASSIGNMENT',
        #         link='/duty-calendar'
        #     )
            
            # 2. SMS Notification
            if getattr(user, 'phone_number', None):
                full_name = getattr(user, 'full_name', user.username)
                
                chart_name = "Duty Chart"
                if instance.duty_chart and instance.duty_chart.name:
                    chart_name = instance.duty_chart.name
                
                # Custom Message: Dear {Name} You have been assigned "{Chart}" for the "{Schedule}" at "{Office}". Visit https://dutychart.ntc.net.np for the detail
                office_name = instance.office.name if instance.office else "Unknown Office"
                sms_message = f'Dear {full_name} , You have been assigned to "{chart_name}" for the "{duty_name}". Please visit dutychart.ntc.net.np for the detail.'
                
                # Run Celery task dispatch in a separate thread to avoid blocking response if Redis is down
                def trigger_sms_task():
                    try:
                        async_send_sms.delay(user.phone_number, sms_message, user_id=user.id)
                    except Exception as sms_err:
                        logger.error(f"Failed to queue SMS (threaded) for user {user.id}: {sms_err}")

                threading.Thread(target=trigger_sms_task, daemon=True).start()
            else:
                logger.warning(f"User {user.username} has no phone number for SMS notification.")
    except Exception as e:
        logger.exception(f"Error in _handle_duty_assignment_notification for Duty {instance.id}")
