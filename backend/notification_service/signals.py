from django.db.models.signals import post_save
from django.dispatch import receiver
from duties.models import Duty
from .tasks import async_send_sms

@receiver(post_save, sender=Duty)
def notify_duty_assignment(sender, instance, created, **kwargs):
    if created and instance.user:
        user = instance.user
        full_name = user.full_name
        duty_name = instance.schedule.name if instance.schedule else "Duty"
        duty_date = instance.date.strftime("%Y-%m-%d")
        
        # 1. Dashboard Notification
        title = "New Duty Assigned"
        message = f"You have been assigned to {duty_name} on {duty_date}."
        create_dashboard_notification(
            user=user,
            title=title,
            message=message,
            notification_type='ASSIGNMENT',
            link='/duty-calendar'
        )
        
        # 2. SMS Notification
        if user.phone_number:
            sms_message = f"Dear {full_name}, You have been assigned a {duty_name} ({duty_date}). For Detail Please Visit dutychart.ntc.net.np"
            async_send_sms.delay(user.phone_number, sms_message, user_id=user.id)
