import requests
import logging
from django.conf import settings
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import SMSLog, Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)

def send_sms(phone, message, user=None):
    """
    Sends SMS using the NTC SMS Gateway.
    Returns: (success: bool, response_text: str)
    """
    # Gateway URL structure:
    # http://10.26.204.149:8080/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/?username=...&password=...&cellNo=...&message=...&encoding=E
    
    base_url = "http://10.26.204.149:8080/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/"
    params = {
        "username": "NtcSmsSender",
        "password": ">xfhT4:/W^6YyY,M",
        "cellNo": phone,
        "message": message,
        "encoding": "E"
    }
    
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

def broadcast_notification(notification):
    """
    Broadcasts a notification to the user's real-time channel.
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        serializer = NotificationSerializer(notification)
        async_to_sync(channel_layer.group_send)(
            f"user_{notification.user.id}",
            {
                "type": "notification_message",
                "message": serializer.data
            }
        )

def create_dashboard_notification(user, title, message, notification_type='SYSTEM', link=None):
    """
    Creates a dashboard notification and broadcasts it via WebSockets.
    Uses transaction.on_commit to ensure broadcasting only happens if DB transaction succeeds.
    """
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link
    )
    
    # Ensure broadcast happens after DB transaction is committed
    transaction.on_commit(lambda: broadcast_notification(notification))
    
    return notification
