from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, datetime
from duties.models import Duty
from notification_service.utils import send_sms, create_dashboard_notification
from notification_service.models import Notification

class Command(BaseCommand):
    help = 'Sends SMS reminders to employees 1 hour before their shift duty starts.'

    def handle(self, *args, **options):
        now = timezone.now()
        # Look for duties starting between 45 and 75 minutes from now
        window_start = now + timedelta(minutes=45)
        window_end = now + timedelta(minutes=75)
        
        target_date = window_start.date()
        
        # Find all duties for target_date that are NOT regular
        duties = Duty.objects.filter(
            date=target_date,
            user__isnull=False,
            schedule__isnull=False
        ).exclude(
            schedule__shift_type__iexact='Regular'
        )

        sent_count = 0
        for duty in duties:
            # Check if start_time is in window
            start_time = duty.schedule.start_time
            # Combine date and time for comparison
            start_datetime = timezone.make_aware(datetime.combine(duty.date, start_time))
            
            if window_start <= start_datetime <= window_end:
                user = duty.user
                
                # Check if reminder already sent for this specific duty
                # (Simple check: is there a reminder notification for this user on this day for this schedule?)
                already_notified = Notification.objects.filter(
                    user=user,
                    notification_type='REMINDER',
                    message__contains=f"starting at {start_time.strftime('%H:%M')}",
                    created_at__date=timezone.now().date()
                ).exists()

                if not already_notified:
                    full_name = user.full_name
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
                    if user.phone_number:
                        sms_message = f"Reminder: Dear {full_name}, your duty '{duty_name}' is starting at {time_str}. Please be prepared."
                        send_sms(user.phone_number, sms_message, user=user)
                        sent_count += 1
                        self.stdout.write(self.style.SUCCESS(f"Sent reminder to {user.username} for {duty_name}"))

        self.stdout.write(self.style.SUCCESS(f"Finished sending {sent_count} reminders."))
