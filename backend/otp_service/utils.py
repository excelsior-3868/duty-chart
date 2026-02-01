import requests
import json
from django.conf import settings
from django.core.mail import send_mail

def send_otp_email(email, otp_code, purpose="verification"):
    """
    Sends OTP via Email.
    Returns: (success: bool, error: str/None)
    """
    subject = f"Your OTP for {getattr(settings, 'APP_NAME', 'Duty Chart')}"
    message = f"Your One-Time Password (OTP) for {purpose.replace('_', ' ')} is: {otp_code}\n\nThis OTP is valid for 5 minutes."
    
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return True, None
    except Exception as e:
        print(f"Error sending email: {e}")
        return False, str(e)

def send_otp_ntc(phone, message=None):
    """
    Sends OTP via NTC API.
    Returns: (success: bool, data: dict/None, error: str/None)
    """
    url = f"{settings.NTC_OTP_URL.rstrip('/')}/otp/send"
    payload = {
        "phone": phone,
        "message": message or f"Your OTP for {getattr(settings, 'APP_NAME', 'Duty Chart')} is <OTP>"
    }
    
    # Add authentication headers if NTC requires them (Basic Auth or Token)
    # The PRD didn't specify auth mechanism for the /send endpoint, 
    # but env vars NTC_OTP_USER/PASSWORD suggest Basic Auth or similar.
    # Assuming Basic Auth for now or just passing keys if needed.
    # If NTC API is open within internal network, maybe no auth.
    # We will log the request for debugging.
    
    print(f"Sending OTP to NTC: {url} | Payload: {payload}")
    
    try:
        # If credentials provided, use them. 
        auth = None
        if settings.NTC_OTP_USER and settings.NTC_OTP_PASSWORD:
            auth = (settings.NTC_OTP_USER, settings.NTC_OTP_PASSWORD)

        response = requests.post(url, json=payload, auth=auth, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        # NTC response structure assumption based on PRD:
        # returns seq_no? The PRD says "System shall store the seq_no returned by NTC"
        # Example response needed. Assuming standard Success response with data.
        return True, data, None
        
    except Exception as e:
        return False, None, str(e)

def validate_otp_ntc(seq_no, otp):
    """
    Validates OTP via NTC API using seq_no.
    Returns: (success: bool, message: str)
    """
    url = f"{settings.NTC_OTP_URL.rstrip('/')}/otp/validate"
    payload = {
        "seq_no": seq_no,
        "otp": otp
    }
    
    try:
        auth = None
        if settings.NTC_OTP_USER and settings.NTC_OTP_PASSWORD:
            auth = (settings.NTC_OTP_USER, settings.NTC_OTP_PASSWORD)

        response = requests.post(url, json=payload, auth=auth, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        
        # PRD FR-08:
        # { "success": true, "data": { "code": 0, "description": "Success" } }
        
        if data.get("success") is True and data.get("data", {}).get("code") == 0:
            return True, "Success"
        else:
            return False, "Invalid OTP"
            
    except Exception as e:
        return False, str(e)
