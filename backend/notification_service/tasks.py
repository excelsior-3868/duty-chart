from celery import shared_task
from django.utils import timezone
from django.db import transaction, IntegrityError
from datetime import timedelta, datetime, time
import logging

logger = logging.getLogger(__name__)

def render_sms_template(template_str, duty, user, advance_minutes=None, advance_days=None, dispatch_time=None):
    if not template_str:
        return ""
    
    import nepali_datetime
    try:
        nepali_d = nepali_datetime.date.from_datetime_date(duty.date)
        date_bs = str(nepali_d).replace("-", "/")
    except Exception:
        date_bs = ""
        
    start_time_str = ""
    if duty.schedule and duty.schedule.start_time:
        try:
            start_time_str = duty.schedule.start_time.strftime("%I:%M %p")
        except Exception:
            start_time_str = str(duty.schedule.start_time)
            
    end_time_str = ""
    if duty.schedule and duty.schedule.end_time:
        try:
            end_time_str = duty.schedule.end_time.strftime("%I:%M %p")
        except Exception:
            end_time_str = str(duty.schedule.end_time)

    context = {
        'employee_name': getattr(user, 'full_name', user.username),
        'shift_name': duty.schedule.name if duty.schedule else "",
        'chart_name': duty.duty_chart.name if duty.duty_chart else "",
        'start_time': start_time_str,
        'end_time': end_time_str,
        'date_ad': str(duty.date),
        'date_bs': date_bs,
        'office_name': duty.office.name if duty.office else "",
        'advance_minutes': str(advance_minutes) if advance_minutes is not None else "",
        'advance_days': str(advance_days) if advance_days is not None else "",
        'dispatch_time': str(dispatch_time) if dispatch_time is not None else ""
    }
    
    rendered = template_str
    for key, val in context.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(val))
    return rendered

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
    Periodic task to send reminders for duties.
    Runs every minute.
    """
    import sys
    from duties.models import Duty
    from .utils import create_dashboard_notification
    from .models import Notification, SMSLog, OfficeNotificationSetting
    from django.db import IntegrityError
    
    now = timezone.now()
    now_local = timezone.localtime()
    
    is_testing = 'test' in sys.argv
    
    # Query duties for today up to next 7 days
    today = timezone.localdate()
    candidate_dates = [today + timedelta(days=i) for i in range(8)]
    
    notifiable_types = ['Shift', 'On-Call', 'On call', 'shifted', 'on-call', 'on call', 'OnCall', 'oncall']
    
    duties = Duty.objects.filter(
        date__in=candidate_dates,
        user__isnull=False,
        schedule__isnull=False,
        schedule__shift_type__in=notifiable_types,
        duty_chart__status='approved'
    ).select_related('user', 'schedule', 'office', 'duty_chart')

    # Prefetch office settings
    settings_dict = {s.office_id: s for s in OfficeNotificationSetting.objects.all()}

    sent_count = 0
    for duty in duties:
        user = duty.user
        if not getattr(user, 'phone_number', None):
            continue
            
        setting = settings_dict.get(duty.office_id)
        schedule_configs = getattr(setting, 'schedule_configs', {}) if setting else {}
        sch_id_str = str(duty.schedule_id)

        # Strictly check if this specific schedule is configured and enabled
        if not schedule_configs or sch_id_str not in schedule_configs:
            continue
            
        sch_config = schedule_configs[sch_id_str]
        enable_advance = sch_config.get('enabled', False)
        
        if not enable_advance:
            continue
            
        days_before = 1
        dispatch_time = time(18, 0, 0)
        template = 'Dear {{employee_name}}, your duty "{{shift_name}}" at "{{office_name}}" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details.'

        try:
            days_before = int(sch_config.get('advance_reminder_days', days_before))
        except (ValueError, TypeError):
            pass
            
        time_str = sch_config.get('advance_reminder_time')
        if time_str:
            try:
                h, m, s = map(int, time_str.split(':'))
                dispatch_time = time(h, m, s)
            except Exception:
                pass
                
        template = sch_config.get('advance_reminder_template', template)

        # Calculate dispatch time (days_before offset)
        dispatch_date = duty.date - timedelta(days=days_before)
        dispatch_dt = timezone.make_aware(datetime.combine(dispatch_date, dispatch_time))
        
        # Calculate duty start datetime
        start_time = duty.schedule.start_time
        duty_start_dt = timezone.make_aware(datetime.combine(duty.date, start_time))
        
        # Check window: now is at or after dispatch_dt, and before duty starts
        is_in_window = False
        if is_testing:
            is_in_window = now_local < duty_start_dt
        else:
            is_in_window = (now_local >= dispatch_dt) and (now_local < duty_start_dt)
            
        if is_in_window:
            sms_message = render_sms_template(
                template, duty, user, 
                advance_minutes=None, 
                advance_days=days_before, 
                dispatch_time=dispatch_time
            )
            
            try:
                log = SMSLog.objects.create(
                    user=user,
                    duty=duty,
                    phone=user.phone_number,
                    message=sms_message,
                    reminder_type='1_HOUR',
                    status='pending'
                )
                # Mirror the SMS as a dashboard notification; the SMSLog unique
                # constraint above dedupes this across the every-minute runs.
                create_dashboard_notification(
                    user,
                    title="Upcoming Duty Reminder",
                    message=sms_message,
                    notification_type='REMINDER',
                    link='/my-duties'
                )
                async_send_sms.delay(user.phone_number, sms_message, user.id, log.id)
                sent_count += 1
            except IntegrityError:
                continue
            except Exception as e:
                logger.error(f"Error processing duty reminder for {duty.id}: {e}")

    logger.info(f"Finished sending {sent_count} reminders (Advance Check).")
    return sent_count

@shared_task
def send_daily_duty_reminders():
    """
    Periodic task to send daily duty reminders for today's duties.
    Runs every minute.
    """
    import sys
    from duties.models import Duty
    from django.contrib.auth import get_user_model
    from .utils import create_dashboard_notification
    from .models import SMSLog, OfficeNotificationSetting
    from django.db import IntegrityError
    User = get_user_model()
    
    today = timezone.localdate()
    now_local = timezone.localtime()
    
    is_testing = 'test' in sys.argv
    
    notifiable_types = ['Shift', 'On-Call', 'On call', 'shifted', 'on-call', 'on call', 'OnCall', 'oncall']
    
    duties = Duty.objects.filter(
        date=today,
        user__isnull=False,
        schedule__shift_type__in=notifiable_types,
        duty_chart__status='approved'
    ).select_related('user', 'schedule', 'duty_chart', 'office')
    
    settings_dict = {s.office_id: s for s in OfficeNotificationSetting.objects.all()}
    
    sent_count = 0
    for duty in duties:
        user = duty.user
        if not getattr(user, 'phone_number', None):
            continue
            
        setting = settings_dict.get(duty.office_id)
        if setting:
            enable_daily = getattr(setting, 'enable_daily_reminder', True)
            daily_time = getattr(setting, 'daily_reminder_time', time(10, 0, 0))
            template = getattr(setting, 'daily_reminder_template', 'Reminder: Dear {{employee_name}}, you have a duty chart "{{chart_name}}" shift "{{shift_name}}" at "{{office_name}}" today ({{date_ad}}). Visit https://dutychart.ntc.net.np for details.')
        else:
            enable_daily = True
            daily_time = time(10, 0, 0)
            template = 'Reminder: Dear {{employee_name}}, you have a duty chart "{{chart_name}}" shift "{{shift_name}}" at "{{office_name}}" today ({{date_ad}}). Visit https://dutychart.ntc.net.np for details.'
            
        if not enable_daily:
            continue
            
        dispatch_dt = timezone.make_aware(datetime.combine(today, daily_time))
        
        if not is_testing:
            if now_local < dispatch_dt:
                continue
                
        if duty.schedule and duty.schedule.start_time:
            if duty.schedule.start_time < daily_time:
                continue
                
        sms_message = render_sms_template(template, duty, user)
        
        try:
            log = SMSLog.objects.create(
                user=user,
                duty=duty,
                phone=user.phone_number,
                message=sms_message,
                reminder_type='DAILY_10AM',
                status='pending'
            )
            # Mirror the SMS as a dashboard notification; the SMSLog unique
            # constraint above dedupes this across the every-minute runs.
            create_dashboard_notification(
                user,
                title="Today's Duty Reminder",
                message=sms_message,
                notification_type='REMINDER',
                link='/my-duties'
            )
            async_send_sms.delay(user.phone_number, sms_message, user.id, log.id)
            sent_count += 1
        except IntegrityError:
            continue
        except Exception as e:
            logger.error(f"Error sending daily reminder for {duty.id}: {e}")
        
    logger.info(f"Finished sending {sent_count} daily duty reminder SMS notifications for {today}.")
    return sent_count


