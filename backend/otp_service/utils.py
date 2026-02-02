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

def send_otp_ntc(phone):
    """
    Sends OTP via NTC API.
    Returns: (success: bool, data: dict/None, error: str/None)
    """
    # Ensure phone number starts with 977
    if phone and not phone.startswith('977'):
        phone = f"977{phone}"
        
    base_url = settings.NTC_OTP_URL.rstrip('/')
    url = f"{base_url}/otp/send"
    payload = {
        "phone": phone
    }

    try:
        response = requests.post(url, json=payload, timeout=5)
        print(f"DEBUG: NTC Gateway Response Status: {response.status_code}")
        print(f"DEBUG: NTC Gateway Raw Response: {response.text}")
        response.raise_for_status()
        
        data = response.json()
        
        # Robust success check: handle both boolean True and string "true"
        is_success = data.get("success") in [True, "true", "True"]
        
        if is_success:
            nested_data = data.get("data", {})
            if isinstance(nested_data, dict):
                inner_data = nested_data.get("data", {})
                if isinstance(inner_data, dict) and "seq_no" in inner_data:
                    return True, inner_data, None
                
                if "seq_no" in nested_data:
                    return True, nested_data, None
            
            return True, {"seq_no": "DUMMY_SEQ"}, None
        else:
            ntc_data = data.get("data", {})
            error_msg = "NTC Error"
            if isinstance(ntc_data, dict):
                error_msg = ntc_data.get("description") or "NTC Error"
            return False, None, error_msg
        
    except Exception as e:
        if settings.DEBUG:
            print(f"DEBUG: NTC Gateway unreachable ({e}). Returning MOCK OTP since DEBUG=True.")
            return True, {"otp": "1234", "seq_no": "MOCK_SEQ_123"}, None
        return False, None, str(e)

def validate_otp_ntc(seq_no, otp, phone=None):
    """
    Validates OTP via NTC API using seq_no.
    """
    url = f"{settings.NTC_OTP_URL.rstrip('/')}/otp/validate"
    # Ensure phone number starts with 977
    if phone and not phone.startswith('977'):
        phone = f"977{phone}"

    payload = {
        "seq_no": seq_no,
        "otp": otp,
        "phone": phone
    }
    print(f"DEBUG: Payload sent to NTC Validate: {json.dumps(payload)}")
    
    try:
        if settings.DEBUG and seq_no == "MOCK_SEQ_123":
            if otp == "1234":
                return True, "Success (Mock)"
            return False, "Invalid Mock OTP"

        response = requests.post(url, json=payload, timeout=5)
        data = response.json()
        
        # Robust success check
        is_success = data.get("success") in [True, "true", "True"]
        ntc_data = data.get("data", {})
        has_error = isinstance(ntc_data, dict) and "error" in ntc_data
        code = ntc_data.get("code") if isinstance(ntc_data, dict) else None
        
        if is_success and not has_error:
            return True, "Success"
        elif is_success and (code == 0 or code == "0"):
            return True, "Success"
        else:
            error_detail = ntc_data.get("error") if has_error else ntc_data.get("description")
            return False, f"Gateway Error: {error_detail or json.dumps(data)}"
            
    except Exception as e:
        if settings.DEBUG and seq_no == "MOCK_SEQ_123":
             return True, "Success (Mock Fallback)"
        return False, str(e)


