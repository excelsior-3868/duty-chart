from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.db import transaction, IntegrityError
from datetime import timedelta, datetime
import logging

logger = logging.getLogger(__name__)

@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def async_send_sms(phone, message, user_id=None, log_id=None):
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
            
    success, response = send_sms(phone, message, user=user, log_id=log_id)
    if not success:
        # Success is False, but we only retry on actual exceptions by default unless we raise one here
        # For now, let's just log failure. If we want to retry on gateway errors, we'd raise Exception.
        logger.error(f"SMS Gateway Error: {response}")
    return success

@shared_task
def send_duty_reminders():
    """
    Periodic task to send reminders for duties starting in ~1 hour.
    Runs every minute.
    """
    from duties.models import Duty
    from .utils import create_dashboard_notification
    from .models import Notification, SMSLog
    from django.db import IntegrityError
    
    # Calculate window in Local Time (since Duty dates/times are naive-ish but effectively local)
    # Ideally comparisons should be aware.
    now = timezone.now()
    window_start = now + timedelta(minutes=45)
    window_end = now + timedelta(minutes=75)
    
    # Duties might be on today or tomorrow (if near midnight)
    candidate_dates = [window_start.date(), window_end.date()]
    candidate_dates = list(set(candidate_dates)) # unique
    
    # Find all duties for these dates
    duties = Duty.objects.filter(
        date__in=candidate_dates,
        user__isnull=False,
        schedule__isnull=False,
        schedule__shift_type='Shift'
    ).select_related('user', 'schedule', 'office')

    sent_count = 0
    for duty in duties:
        start_time = duty.schedule.start_time
        # Create user-local datetime for the duty start
        # Assuming server time is configured to Kathmandu as per settings
        duty_start_dt = timezone.make_aware(datetime.combine(duty.date, start_time))
        
        if window_start <= duty_start_dt <= window_end:
            user = duty.user
            if not getattr(user, 'phone_number', None):
                continue
                
            # Idempotency: Attempt to create a PENDING log.
            # If it already exists (Found duplicate), IntegrityError will be raised.
            try:
                # Provide a descriptive message for the log (will be overwritten/used by send_sms logic but good to have)
                duty_name = duty.schedule.name
                office_name = duty.office.name if duty.office else "Unknown Office"
                full_name = getattr(user, 'full_name', user.username)
                sms_message = f'Dear {full_name}, your duty "{duty_name}" at "{office_name}" is starting in about 1 hour. Please visit https://dutychart.ntc.net.np for details.'
                
                log = SMSLog.objects.create(
                    user=user,
                    duty=duty,
                    phone=user.phone_number,
                    message=sms_message,
                    reminder_type='1_HOUR',
                    status='pending'
                )
                
                # If we got here, we "claimed" the reminder. Send it.
                async_send_sms.delay(user.phone_number, sms_message, user.id, log.id)
                sent_count += 1
                
            except IntegrityError:
                # Duplicate reminder attempted. Ignore.
                continue
            except Exception as e:
                logger.error(f"Error processing duty reminder for {duty.id}: {e}")

    logger.info(f"Finished sending {sent_count} reminders (1-hour Check).")
    return sent_count

@shared_task
def send_daily_duty_reminders():
    """
    Periodic task to send a reminder SMS at 10:00 AM for each of today's duties.
    Only for duties starting after 6:00 PM.
    """
    from duties.models import Duty
    from django.contrib.auth import get_user_model
    from .models import SMSLog
    from django.db import IntegrityError
    User = get_user_model()
    
    today = timezone.localdate()
    
    # Get all duties for today with a user assigned and of type 'Shift'
    duties = Duty.objects.filter(
        date=today,
        user__isnull=False,
        schedule__shift_type='Shift',
        schedule__start_time__gte='18:00:00'  # Only for duties starting after 6 PM
    ).select_related('user', 'schedule', 'duty_chart', 'office')
    
    sent_count = 0
    for duty in duties:
        user = duty.user
        if not getattr(user, 'phone_number', None):
            continue
            
        full_name = getattr(user, 'full_name', user.username)
        chart_name = duty.duty_chart.name if duty.duty_chart else "Duty Chart"
        schedule_name = duty.schedule.name if duty.schedule else "Duty"
        office_name = duty.office.name if duty.office else "Unknown Office"
        
        # Individual Reminder Message
        sms_message = f'Reminder: Dear {full_name}, you have a duty "{schedule_name}" at "{office_name}" today ({today}). Visit https://dutychart.ntc.net.np for details.'
        
        try:
             # Idempotency for daily reminders too
            log = SMSLog.objects.create(
                user=user,
                duty=duty,
                phone=user.phone_number,
                message=sms_message,
                reminder_type='DAILY_10AM',
                status='pending'
            )
            async_send_sms.delay(user.phone_number, sms_message, user.id, log.id)
            sent_count += 1
        except IntegrityError:
            continue
        except Exception as e:
            logger.error(f"Error sending daily reminder for {duty.id}: {e}")
        
    logger.info(f"Finished sending {sent_count} daily duty reminder SMS notifications for {today}.")
    return sent_count
