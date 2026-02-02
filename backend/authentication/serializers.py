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
        data = super().validate(attrs)
            
        # If we are here, password is correct. Check global 2FA setting.
        system_setting = SystemSetting.objects.first()
        if not system_setting or not system_setting.is_2fa_enabled:
            return data
            
        # Ensure self.user is set (SimpleJWT should do this, but being safe)
        user = getattr(self, 'user', None)
        if not user:
            from django.contrib.auth import authenticate
            # Use email/password from attrs to authenticate
            user = authenticate(
                request=self.context.get('request'),
                email=attrs.get('email'),
                password=attrs.get('password')
            )
            self.user = user

        if not user or not user.phone_number:
            print(f"WARNING: 2FA enabled but user {user.email} has no phone number.")
            return data

        # Trigger OTP
        success, otp_data, error = send_otp_ntc(user.phone_number)
        if not success:
            raise serializers.ValidationError({"detail": f"Failed to send 2FA OTP: {error}"})
            
        # Create OTP Request in DB
        otp_code = otp_data.get('otp')
        seq_no = otp_data.get('seq_no')
        
        OTPRequest.objects.filter(user=user, purpose='login_2fa', status='pending').update(status='expired')
        
        OTPRequest.objects.create(
            user=user,
            otp_code=otp_code,
            seq_no=seq_no,
            purpose='login_2fa',
            channel='sms_ntc',
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        
        return {
            "2fa_required": True,
            "phone_mask": f"{user.phone_number[:3]}****{user.phone_number[-3:]}",
            "email": user.email,
            "username": user.email
        }
