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
        
        # Custom check for inactive users to provide specific message
        from django.db.models import Q
        username = attrs.get('employee_id') or attrs.get('email') # field named 'employee_id' but contains username/email/id
        user = User.objects.filter(Q(email=username) | Q(username=username) | Q(employee_id=username)).first()
        
        if user:
            if not user.is_active:
                raise serializers.ValidationError({"detail": "Your Account is not active. Please contact your administrator."})
            
            # Explicitly check password to provide specific error message
            password = attrs.get('password')
            if password and not user.check_password(password):
                from rest_framework.exceptions import AuthenticationFailed
                raise AuthenticationFailed({"detail": "Incorrect password"})

        # Validate credentials normally
        data = super().validate(attrs)
        
        user = getattr(self, 'user', None)
        if user and not user.is_activated:
            raise serializers.ValidationError({"detail": "Account not activated. Please use the Employee Activation page to set your password first."})
            
        # If we are here, password is correct. Check global 2FA setting.
        system_setting = SystemSetting.objects.first()
        if not system_setting or not system_setting.is_2fa_enabled:
            return data
            
        # Ensure self.user is set (SimpleJWT should do this, but being safe)
        user = getattr(self, 'user', None)
        if not user:
            from django.contrib.auth import authenticate
            # Use employee_id/password from attrs to authenticate
            user = authenticate(
                request=self.context.get('request'),
                employee_id=attrs.get('employee_id'),
                password=attrs.get('password')
            )
            self.user = user

        if not user or not user.phone_number:
            print(f"WARNING: 2FA enabled but user {user.employee_id} has no phone number.")
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
            "employee_id": user.employee_id,
            "username": user.employee_id
        }
