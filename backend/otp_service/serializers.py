from rest_framework import serializers
from .models import OTPRequest

class RequestOTPSerializer(serializers.Serializer):
    username = serializers.CharField(required=False) # Keep for backward compatibility or general usage
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    employee_id = serializers.CharField(required=False)
    channel = serializers.ChoiceField(choices=[('sms_ntc', 'NTC SMS'), ('email', 'Email')], required=False)
    purpose = serializers.ChoiceField(choices=[
        ('forgot_password', 'Forgot Password'), 
        ('change_password', 'Change Password'),
        ('signup', 'Signup')
    ])

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
    request_id = serializers.UUIDField(required=False)
    new_password = serializers.CharField(required=True, min_length=8)

class SignupCompleteSerializer(serializers.Serializer):
    request_id = serializers.UUIDField(required=True)
    password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True, min_length=8)

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return data
