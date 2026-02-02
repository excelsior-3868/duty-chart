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
        # TokenObtainPairSerializer uses self.username_field, which is usually 'username' (email in our case)
        
        # Validate credentials normally
        # If credentials are wrong, this raises AuthenticationFailed
        try:
            data = super().validate(attrs)
        except Exception as e:
            raise e
            
        # If we are here, password is correct. Check global 2FA setting.
        system_setting = SystemSetting.objects.first()
        if not system_setting or not system_setting.is_2fa_enabled:
            return data
            
        # 2FA is enabled globally.
        user = self.user
        
        # If user is superadmin, maybe skip? PRD doesn't specify. 
        # Usually superadmins NEED 2FA most.
        
        if not user.phone_number:
            # If no phone number, we can't send OTP. 
            # In a strict system, we'd fail login or redirect to profile.
            # For now, let's allow login but log a warning.
            print(f"WARNING: 2FA enabled but user {user.email} has no phone number.")
            return data

        # Trigger OTP
        success, otp_data, error = send_otp_ntc(user.phone_number)
        if not success:
            raise serializers.ValidationError({"detail": f"Failed to send 2FA OTP: {error}"})
            
        # Create OTP Request in DB
        # The mock server returns the code in otp_data for testing.
        otp_code = otp_data.get('otp')
        seq_no = otp_data.get('seq_no')
        
        # Ensure any old pending 2FA requests for this user are expired
        OTPRequest.objects.filter(user=user, purpose='login_2fa', status='pending').update(status='expired')
        
        OTPRequest.objects.create(
            user=user,
            otp_code=otp_code,
            seq_no=seq_no,
            purpose='login_2fa',
            channel='sms_ntc',
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        
        # Return special response instead of tokens
        # The frontend will check for 2fa_required
        return {
            "2fa_required": True,
            "phone_mask": f"{user.phone_number[:3]}****{user.phone_number[-3:]}",
            "email": user.email,
            "username": user.email # so we can identify them in the next step
        }
