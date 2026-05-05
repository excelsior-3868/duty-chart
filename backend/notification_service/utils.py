import requests
import os
import logging
from django.conf import settings
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import SMSLog, Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)

def send_sms(phone, message, user=None, log_id=None):
    """
    Sends SMS using the NTC SMS Gateway.
    Returns: (success: bool, response_text: str)
    """
    # Gateway URL structure:
    # http://10.26.204.149:8080/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/?username=...&password=...&cellNo=...&message=...&encoding=E
    
    base_url = getattr(settings, "NTC_SMS_URL", "http://10.26.192.122:42399/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/")
    params = {
        "username": getattr(settings, "NTC_SMS_USERNAME", "NtcSmsSender"),
        "password": getattr(settings, "NTC_SMS_PASSWORD", ""),
        "cellNo": phone,
        "message": message,
        "encoding": "E",
        "systemId": "1"
    }
    
    if log_id:
        try:
            log = SMSLog.objects.get(id=log_id)
            log.status = 'sending'
            log.save()
        except SMSLog.DoesNotExist:
            log = SMSLog.objects.create(
                user=user,
                phone=phone,
                message=message,
                reminder_type='GENERAL',
                status='sending'
            )
    else:
        log = SMSLog.objects.create(
            user=user,
            phone=phone,
            message=message,
            reminder_type='GENERAL',
            status='sending'
        )
    
    try:
        print(f"DEBUG: Sending SMS to {base_url} with params {params}")
        response = requests.get(base_url, params=params, timeout=10)
        print(f"DEBUG: SMS Gateway Response Status: {response.status_code}")
        print(f"DEBUG: SMS Gateway Raw Response: {response.text}")
        log.response_raw = response.text
        if response.status_code == 200:
            log.status = 'sent'
            log.save()
            return True, response.text
        else:
            log.status = 'failed'
            log.save()
            return False, f"HTTP {response.status_code}: {response.text}"
    except Exception as e:
        log.status = 'error'
        log.response_raw = str(e)
        log.save()
        return False, str(e)

def broadcast_notification(notification):
    """
    Broadcasts a notification to the user's real-time channel.
    """
    # channel_layer = get_channel_layer()
    # if channel_layer:
    #     serializer = NotificationSerializer(notification)
    #     async_to_sync(channel_layer.group_send)(
    #         f"user_{notification.user.id}",
    #         {
    #             "type": "notification_message",
    #             "message": serializer.data
    #         }
    #     )
    pass

def create_dashboard_notification(user, title, message, notification_type='SYSTEM', link=None):
    """
    Creates a dashboard notification and broadcasts it via WebSockets.
    Uses transaction.on_commit to ensure broadcasting only happens if DB transaction succeeds.
    """
    # notification = Notification.objects.create(
    #     user=user,
    #     title=title,
    #     message=message,
    #     notification_type=notification_type,
    #     link=link
    # )
    
    # Ensure broadcast happens after DB transaction is committed
    # transaction.on_commit(lambda: broadcast_notification(notification))
    
    # return notification
    return None

def send_bulk_assignment_notification(users, chart, date_range_str=None):
    """
    Sends a single SMS to each user in the list regarding their assignments in the chart.
    If date_range_str is provided, it's included in the message.
    """
    import threading
    from .models import SMSLog
    
    if not users or not chart:
        return
    
    chart_name = chart.name or "Duty Chart"
    office_name = chart.office.name if chart.office else "Unknown Office"
    
    for user in users:
        if not getattr(user, 'phone_number', None):
            logger.warning(f"User {user.username} has no phone number for bulk SMS notification.")
            continue
            
        full_name = getattr(user, 'full_name', user.username)
        
        if date_range_str:
            sms_message = f'Dear {full_name}, You have been assigned to "{chart_name}" at "{office_name}" for the period {date_range_str}. Please visit dutychart.ntc.net.np for details.'
        else:
            sms_message = f'Dear {full_name}, You have been assigned to "{chart_name}" at "{office_name}". Please visit dutychart.ntc.net.np for details.'
        
        # Create log
        log = SMSLog.objects.create(
            user=user,
            phone=user.phone_number,
            message=sms_message,
            reminder_type='ASSIGNMENT',
            status='pending'
        )
        
        # Send in background
        def trigger_sms_task(u, msg, lid):
            try:
                success, response = send_sms(u.phone_number, msg, user=u, log_id=lid)
                if success:
                    logger.info(f"Bulk Assignment SMS sent successfully to {u.username}")
                else:
                    logger.error(f"Bulk Assignment SMS failed for {u.username}: {response}")
            except Exception as e:
                logger.error(f"Fatal error in bulk SMS thread for {u.username}: {e}")

        threading.Thread(target=trigger_sms_task, args=(user, sms_message, log.id), daemon=True).start()
