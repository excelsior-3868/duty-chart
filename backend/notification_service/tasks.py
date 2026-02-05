from celery import shared_task
from django.utils import timezone
from django.db import transaction
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
    
    # Find all duties for target_date with a user and schedule assigned of type 'Shift'
    duties = Duty.objects.filter(
        date=target_date,
        user__isnull=False,
        schedule__isnull=False,
        schedule__shift_type='Shift'
    )

    sent_count = 0
    for duty in duties:
        start_time = duty.schedule.start_time
        # Create a timezone-aware datetime for comparison
        start_datetime = timezone.make_aware(datetime.combine(duty.date, start_time))
        
        if window_start <= start_datetime <= window_end:
            user = duty.user
            
            # Idempotency: Check if reminder already sent for this specific duty today via SMSLog
            from .models import SMSLog
            already_notified = SMSLog.objects.filter(
                user=user,
                phone=user.phone_number,
                created_at__date=timezone.now().date()
            ).filter(message__contains=f'"{duty_name}"').filter(message__contains="starting in about 1 hour").exists()

            if not already_notified:
                full_name = getattr(user, 'full_name', user.username)
                duty_name = duty.schedule.name
                time_str = start_time.strftime('%H:%M')
                
                # 1. Dashboard Notification (Disabled for now)
                # create_dashboard_notification(
                #     user=user,
                #     title="Duty Starting Soon",
                #     message=f"Reminder: Your duty '{duty_name}' is starting at {time_str}.",
                #     notification_type='REMINDER',
                #     link='/duty-calendar'
                # )
                
                # 2. SMS Notification
                if getattr(user, 'phone_number', None):
                    office_name = duty.office.name if duty.office else "Unknown Office"
                    sms_message = f'Dear {full_name}, your duty "{duty_name}" at "{office_name}" is starting in about 1 hour. Please visit dutychart.ntc.net.np for details.'
                    async_send_sms.delay(user.phone_number, sms_message, user.id)
                    sent_count += 1
                    
    logger.info(f"Finished sending {sent_count} reminders.")
    return sent_count

@shared_task
def send_daily_summary_sms():
    """
    Periodic task to send a summary SMS at 10:00 AM for today's duties.
    """
    from duties.models import Duty
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    today = timezone.now().date()
    
    # Get all duties for today with a user assigned and of type 'Shift'
    duties = Duty.objects.filter(
        date=today,
        user__isnull=False,
        schedule__shift_type='Shift'
    ).select_related('user', 'schedule', 'duty_chart', 'office')
    
    # Group duties by user
    user_duties = {}
    for duty in duties:
        if duty.user_id not in user_duties:
            user_duties[duty.user_id] = []
        user_duties[duty.user_id].append(duty)
        
    sent_count = 0
    for user_id, duties_list in user_duties.items():
        user = duties_list[0].user
        if not getattr(user, 'phone_number', None):
            continue
            
        full_name = getattr(user, 'full_name', user.username)
        
        # Construct summary message
        # If multiple duties, list them
        if len(duties_list) == 1:
            duty = duties_list[0]
            chart_name = duty.duty_chart.name if duty.duty_chart else "Duty Chart"
            schedule_name = duty.schedule.name if duty.schedule else "Duty"
            office_name = duty.office.name if duty.office else "Unknown Office"
            sms_message = f'Dear {full_name}, you have been assigned to "{chart_name}" for the "{schedule_name}" at "{office_name}" today. Visit dutychart.ntc.net.np for details.'
        else:
            # Multiple duties summary
            duties_summary = ", ".join([f'"{d.schedule.name}" at "{d.office.name}"' for d in duties_list if d.schedule])
            sms_message = f'Dear {full_name}, you have {len(duties_list)} duties today: {duties_summary}. Visit dutychart.ntc.net.np for details.'
            
        async_send_sms.delay(user.phone_number, sms_message, user.id)
        sent_count += 1
        
    logger.info(f"Finished sending {sent_count} daily summary SMS notifications for {today}.")
    return sent_count
