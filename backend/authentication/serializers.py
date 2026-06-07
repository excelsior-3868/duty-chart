from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from org.models import SystemSetting
from otp_service.utils import send_otp_ntc
from otp_service.models import OTPRequest
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

User = get_user_model()

class TokenObtainPair2FASerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # We need to handle the case where username is passed as email or employee_id
        from django.db.models import Q
        from rest_framework.exceptions import AuthenticationFailed
        
        username = attrs.get('employee_id') or attrs.get('email') # field named 'employee_id' but contains username/email/id
        user = User.objects.filter(Q(email=username) | Q(username=username) | Q(employee_id=username)).first()
        
        if not user:
            raise AuthenticationFailed({"detail": "No active account found with the given credentials"})
            
        if not user.is_active:
            raise serializers.ValidationError({"detail": "Your Account is not active. Please contact your administrator."})
            
        # Explicitly check password to provide specific error message (hash verified ONCE)
        password = attrs.get('password')
        if not password or not user.check_password(password):
            raise AuthenticationFailed({"detail": "Incorrect password"})

        if not user.is_activated:
            raise serializers.ValidationError({"detail": "Account not activated. Please use the Employee Activation page to set your password first."})
            
        self.user = user
            
        # Check global 2FA setting.
        system_setting = SystemSetting.objects.first()
        
        # Bypass 2FA for mobile app if a valid mobile session token is present.
        from django.conf import settings
        from authentication.permissions import validate_mobile_session_token
        request = self.context.get('request')

        is_mobile_request = False
        if request and settings.MOBILE_API_TOKEN:
            session_token = (
                request.headers.get('X-Mobile-Session-Token') or
                request.headers.get('Mobile-Session-Token')
            )
            if session_token:
                is_mobile_request = validate_mobile_session_token(
                    session_token, settings.MOBILE_API_TOKEN
                )
        
        if not system_setting or not system_setting.is_2fa_enabled or is_mobile_request:
            refresh = self.get_token(user)
            return {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }

        if not user.phone_number:
            refresh = self.get_token(user)
            return {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }

        # Trigger OTP
        success, otp_data, error = send_otp_ntc(user.phone_number)
        if not success:
            raise serializers.ValidationError({"detail": f"Failed to send 2FA OTP: {error}"})
            
        # Create OTP Request in DB
        seq_no = otp_data.get('seq_no')
        
        OTPRequest.objects.filter(user=user, purpose='login_2fa', status='pending').update(status='expired')
        
        OTPRequest.objects.create(
            user=user,
            otp_code=None,
            seq_no=seq_no,
            purpose='login_2fa',
            channel='sms_ntc',
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        
        return {
            "2fa_required": True,
            "phone_mask": f"{user.phone_number[:3]}****{user.phone_number[-3:]}",
            "employee_id": user.employee_id,
            "username": user.employee_id
        }
