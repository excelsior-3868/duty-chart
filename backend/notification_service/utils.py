import requests
import urllib.parse
from django.conf import settings
from .models import SMSLog, Notification

def send_sms(phone, message, user=None):
    """
    Sends SMS using the NTC SMS Gateway.
    Returns: (success: bool, response_text: str)
    """
    # Provided Gateway URL structure:
    # http://10.26.204.149:8080/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/?username=NtcSmsSender&password=%3ExfhT4:/W^6YyY,M&cellNo=9851117226&message=MessageToSendmessage&encoding=E
    
    base_url = "http://10.26.204.149:8080/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/"
    params = {
        "username": "NtcSmsSender",
        "password": ">xfhT4:/W^6YyY,M",
        "cellNo": phone,
        "message": message,
        "encoding": "E"
    }
    
    # Create log entry
    log = SMSLog.objects.create(
        user=user,
        phone=phone,
        message=message,
        status='sending'
    )
    
    try:
        response = requests.get(base_url, params=params, timeout=10)
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

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

def create_dashboard_notification(user, title, message, notification_type='SYSTEM', link=None):
    """
    Creates a dashboard notification for the user and broadcasts it via WebSockets.
    """
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link
    )
    
    # Broadcast to user's real-time channel
    channel_layer = get_channel_layer()
    if channel_layer:
        from .serializers import NotificationSerializer
        serializer = NotificationSerializer(notification)
        
        async_to_sync(channel_layer.group_send)(
            f"user_{user.id}",
            {
                "type": "notification_message",
                "message": serializer.data
            }
        )
    
    return notification
