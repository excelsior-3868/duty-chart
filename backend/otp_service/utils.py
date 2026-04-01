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
    Sends OTP via the new OTP API.
    Returns: (success: bool, data: dict/None, error: str/None)
    """
    # Ensure we send exactly 10 digits to the OTP API (stripping +977 or 977)
    if phone:
        # Remove any non-digit characters (+, space, etc)
        clean_phone = ''.join(filter(str.isdigit, phone))
        # Take the last 10 digits (e.g., from 9779851117226 -> 9851117226)
        if len(clean_phone) >= 10:
            phone = clean_phone[-10:]
        else:
            phone = clean_phone
        
    base_url = settings.NTC_OTP_URL.rstrip('/')
    url = f"{base_url}/sendotp"
    payload = {
        "mobileNumber": phone,
        "systemId": "2"
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"DEBUG: OTP Gateway Response Status: {response.status_code}")
        print(f"DEBUG: OTP Gateway Raw Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            # The new API returns transactionId directly or in a nested field?
            # Example provided: "transactionId": "B8146E22ED81431B8C18B616F"
            # Assuming it's in the top level of the response or data field.
            transaction_id = data.get("transactionId") or data.get("data", {}).get("transactionId")
            
            if transaction_id:
                return True, {"seq_no": transaction_id}, None
            
            # If success but no transactionId, return as is if no error field
            return True, {"seq_no": "DUMMY_TXN"}, None
        else:
            try:
                error_data = response.json()
                error_msg = error_data.get("message") or error_data.get("description") or f"HTTP {response.status_code}"
            except:
                error_msg = f"HTTP {response.status_code}: {response.text}"
            return False, None, error_msg
        
    except Exception as e:
        if settings.DEBUG:
            print(f"DEBUG: OTP Gateway unreachable ({e}). Returning MOCK OTP since DEBUG=True.")
            return True, {"seq_no": "MOCK_TXN_123"}, None
        return False, None, str(e)

def validate_otp_ntc(seq_no, otp, phone=None):
    """
    Validates OTP via the new OTP API using transactionId (passed as seq_no).
    """
    base_url = settings.NTC_OTP_URL.rstrip('/')
    url = f"{base_url}/verifyotp"
    
    if phone:
        # Standardize to 10 digits
        clean_phone = ''.join(filter(str.isdigit, phone))
        if len(clean_phone) >= 10:
            phone = clean_phone[-10:]
        else:
            phone = clean_phone

    payload = {
        "mobileNumber": phone,
        "transactionId": seq_no,
        "otp": otp
    }
    print(f"DEBUG: Payload sent to OTP Validate: {json.dumps(payload)}")
    
    try:
        if settings.DEBUG and seq_no == "MOCK_TXN_123":
            if otp == "123456" or otp == "1234":
                return True, "Success (Mock)"
            return False, "Invalid Mock OTP"

        response = requests.post(url, json=payload, timeout=10)
        print(f"DEBUG: OTP Validate Response Status: {response.status_code}")
        print(f"DEBUG: OTP Validate Raw Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            # Check for success indicators in the response body if any, 
            # otherwise 200 is success.
            return True, "Success"
        else:
            try:
                error_data = response.json()
                error_msg = error_data.get("message") or error_data.get("description") or f"Invalid OTP"
            except:
                error_msg = f"Verification failed (HTTP {response.status_code})"
            return False, error_msg
            
    except Exception as e:
        if settings.DEBUG and seq_no == "MOCK_TXN_123":
             return True, "Success (Mock Fallback)"
        return False, str(e)


