from celery import shared_task
import logging
from .utils import send_otp_ntc, send_otp_email
from .models import OTPRequest
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_otp_task(user_id, request_id, phone, channel, purpose="verification"):
    """
    Asynchronous task to send OTP via SMS (NTC) or Email.
    Updates the OTPRequest with the sequence number/transaction ID upon success.
    """
    try:
        otp_req = OTPRequest.objects.get(id=request_id)
    except OTPRequest.DoesNotExist:
        logger.error(f"OTPRequest {request_id} not found.")
        return False

    if channel == 'sms_ntc':
        success, data, error = send_otp_ntc(phone)
        if success:
            seq_no = data.get('seq_no')
            otp_req.seq_no = seq_no
            otp_req.save()
            logger.info(f"OTP sent via SMS to {phone}. Transaction ID: {seq_no}")
            return True
        else:
            logger.error(f"Failed to send OTP via SMS to {phone}: {error}")
            return False

    elif channel == 'email':
        # Email OTP is usually generated before calling the task, 
        # so we just need to send it.
        # However, for consistency, if otp_code is missing we could generate here, 
        # but views.py handles it for now.
        otp_code = otp_req.otp_code
        if not otp_code:
             logger.error(f"OTP code missing for email request {request_id}")
             return False
             
        success, error = send_otp_email(otp_req.user.email, otp_code, purpose)
        if success:
            logger.info(f"OTP sent via Email to {otp_req.user.email}")
            return True
        else:
            logger.error(f"Failed to send OTP via Email to {otp_req.user.email}: {error}")
            return False

    return False
