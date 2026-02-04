from celery import shared_task
from django.utils import timezone
from datetime import timedelta, datetime
import logging

logger = logging.getLogger(__name__)

@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def async_send_sms(phone, message, user_id=None):
    """
    Task to send SMS asynchronously with retries.
    """
    from .utils import send_sms
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    user = None
    if user_id:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            pass
            
    success, response = send_sms(phone, message, user=user)
    if not success:
        # Success is False, but we only retry on actual exceptions by default unless we raise one here
        # For now, let's just log failure. If we want to retry on gateway errors, we'd raise Exception.
        logger.error(f"SMS Gateway Error: {response}")
    return success

@shared_task
def send_duty_reminders():
    """
    Periodic task to send reminders for duties starting in ~1 hour.
    """
    from duties.models import Duty
    from .utils import create_dashboard_notification
    from .models import Notification
    
    now = timezone.now()
    # Look for duties starting between 45 and 75 minutes from now (approx 1 hour)
    window_start = now + timedelta(minutes=45)
    window_end = now + timedelta(minutes=75)
    
    target_date = window_start.date()
    
    # Find all duties for target_date that are NOT regular (likely shifts)
    duties = Duty.objects.filter(
        date=target_date,
        user__isnull=False,
        schedule__isnull=False
    ).exclude(
        schedule__shift_type__iexact='Regular'
    )

    sent_count = 0
    for duty in duties:
        start_time = duty.schedule.start_time
        # Create a timezone-aware datetime for comparison
        start_datetime = timezone.make_aware(datetime.combine(duty.date, start_time))
        
        if window_start <= start_datetime <= window_end:
            user = duty.user
            
            # Idempotency: Check if reminder already sent for this specific duty today
            # We check for a reminder notification created today for this user and time
            already_notified = Notification.objects.filter(
                user=user,
                notification_type='REMINDER',
                message__contains=f"starting at {start_time.strftime('%H:%M')}",
                created_at__date=timezone.now().date()
            ).exists()

            if not already_notified:
                full_name = getattr(user, 'full_name', user.username)
                duty_name = duty.schedule.name
                time_str = start_time.strftime('%H:%M')
                
                # 1. Dashboard Notification
                create_dashboard_notification(
                    user=user,
                    title="Duty Starting Soon",
                    message=f"Reminder: Your duty '{duty_name}' is starting at {time_str}.",
                    notification_type='REMINDER',
                    link='/duty-calendar'
                )
                
                # 2. SMS Notification
                if getattr(user, 'phone_number', None):
                    sms_message = f"Reminder: Dear {full_name}, your duty '{duty_name}' is starting at {time_str}. Please be prepared."
                    async_send_sms.delay(user.phone_number, sms_message, user.id)
                    sent_count += 1
                    
    logger.info(f"Finished sending {sent_count} reminders.")
    return sent_count
