from rest_framework import serializers
from .models import OTPRequest

class RequestOTPSerializer(serializers.Serializer):
    username = serializers.CharField(required=True) # Can be email or phone or employee_id
    channel = serializers.ChoiceField(choices=[('sms_ntc', 'NTC SMS'), ('email', 'Email')], required=False) # Optional now if lookup determines it? No, request still needs channel.
    purpose = serializers.ChoiceField(choices=[('forgot_password', 'Forgot Password'), ('change_password', 'Change Password')])

class UserLookupSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)


class ValidateOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    otp = serializers.CharField(required=True)
    seq_no = serializers.CharField(required=False) # Required for NTC SMS flow
    
class ResetPasswordSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    otp = serializers.CharField(required=True)
    seq_no = serializers.CharField(required=False)
    new_password = serializers.CharField(required=True, min_length=8)
