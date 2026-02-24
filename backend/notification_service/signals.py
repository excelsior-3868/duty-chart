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
        
        NOTIFY_SHIFT_TYPES = ['Shift', 'Regular', 'OnCall']
        shift_type = getattr(instance.schedule, 'shift_type', None) if instance.schedule else None
        if instance.user and instance.schedule and shift_type in NOTIFY_SHIFT_TYPES:
            logger.info(f"Triggering assignment notification for Duty {instance.id} (Created: {created}, shift_type: {shift_type})")
            # Transactional Safety: Wait for the Duty save to be committed
            transaction.on_commit(lambda: _handle_duty_assignment_notification(instance))
        else:
            if not instance.user:
                reason = "No user assigned"
            elif not instance.schedule:
                reason = "No schedule assigned"
            else:
                reason = f"shift_type '{shift_type}' is not in notify list {NOTIFY_SHIFT_TYPES}"
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
            sms_message = f'Dear {full_name} , You have been assigned to "{chart_name}" for the "{duty_name}". Please visit dutychart.ntc.net.np for the detail.'
            
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
                
                # If created, dispatch to Celery
                def trigger_sms_task():
                    try:
                        async_send_sms.delay(user.phone_number, sms_message, user_id=user.id, log_id=log.id)
                    except Exception as sms_err:
                        logger.error(f"Failed to queue SMS (threaded) for user {user.id}: {sms_err}")

                # Build link to duty calendar pre-selecting the office and chart
                office_id = instance.duty_chart.office_id if instance.duty_chart else (instance.office_id if instance.office else None)
                chart_id = instance.duty_chart_id if instance.duty_chart else None
                if office_id and chart_id:
                    calendar_link = f'/duty-calendar?office={office_id}&chart={chart_id}'
                else:
                    calendar_link = '/duty-calendar'

                # 2. Dashboard Notification logic
                create_dashboard_notification(
                    user=user,
                    title="New Duty Assignment",
                    message=f'You have been assigned to "{chart_name}" for the "{duty_name}" on {duty_date}.',
                    notification_type='ASSIGNMENT',
                    link=calendar_link
                )

                threading.Thread(target=trigger_sms_task, daemon=True).start()
                logger.info(f"Queued assignment SMS and dashboard notification for user {user.username}, duty {instance.id}")
                
            except IntegrityError:
                # Already exists, skip sending again
                logger.debug(f"Assignment SMS already sent/queued for user {user.username}, duty {instance.id}")
                return
        else:
            logger.warning(f"User {user.username} has no phone number for SMS notification.")
    except Exception as e:
        logger.exception(f"Error in _handle_duty_assignment_notification for Duty {instance.id}")
