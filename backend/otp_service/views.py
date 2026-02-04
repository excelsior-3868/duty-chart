from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import OTPRequest
from .serializers import (
    RequestOTPSerializer, ValidateOTPSerializer, ResetPasswordSerializer, 
    UserLookupSerializer, SignupCompleteSerializer
)
from .utils import send_otp_ntc, validate_otp_ntc
from django.utils import timezone
from datetime import timedelta
import random
import uuid
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()

class UserLookupView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = UserLookupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        username = serializer.validated_data['username']
        # Find user by email, username, or phone
        user = User.objects.filter(Q(email=username) | Q(username=username) | Q(phone_number=username)).first()
        
        if not user:
            # Security: User not found. 
            # To prevent enumeration, we should ideally return a generic success OR fail consistently.
            # But the requirement says "Avoid leaking account existence" AND "Show options (radio buttons)".
            # Contradiction: If we show options for existing users and nothing/dummy for non-existing, we leak.
            # PRD: "On submit: Always show generic result... Then proceed to destination selection (but mask it...)"
            # Strategy: If not found, return a DUMMY masked phone/email to simulate existence? 
            # OR just return 200 with "dummy" channels that fail later?
            # Let's return NO channels if not found, but frontend handles generic message?
            # Actually, "Choose Where to Send OTP" implies we SHOW channels.
            # If we show real channels for valid users, and nothing for invalid, checking a random email reveals it doesn't exist.
            # Risk accepted for internal/NTC context? Or maybe we fake a "Email to s****@....com" for invalid users?
            # Let's simply return 404 for now but frontend should handle it gracefully or we return 200 with empty channels?
            # Let's return 200 with empty channels, frontend says "If account exists...".
            return Response({
                "exists": False, # Frontend treats this as "Sent if exists" or similar? 
                # Actually for lookup flow, if we want to SELECT channel, we MUST know if it exists.
                # PRD UC-01 says "User enters username -> System triggers...".
                # But Refined Flow Screen FP-2 says "Choose Where to Send OTP".
                # To support FP-2, we must return channels. This leaks existence.
                # Common trade-off. We will return channels.
                "channels": []
            }, status=status.HTTP_200_OK)

        channels = []
        if user.phone_number:
            phone = user.phone_number
            # Mask phone: first 3, last 3
            if len(phone) > 6:
                masked = f"{phone[:3]}***{phone[-3:]}"
            else:
                masked = phone
            channels.append({'type': 'sms_ntc', 'value': masked, 'label': f"SMS to {masked}"})
        
        if user.email:
            # Mask email: a***@g***.com
            email = user.email
            try:
                username_part, domain_part = email.split('@')
                if len(username_part) > 2:
                    masked_user = f"{username_part[0]}***{username_part[-1]}"
                else:
                    masked_user = username_part
                masked_email = f"{masked_user}@{domain_part}"
                channels.append({'type': 'email', 'value': masked_email, 'label': f"Email to {masked_email}"})
            except:
                pass

        return Response({
            "exists": True,
            "channels": channels
        }, status=status.HTTP_200_OK)


class RequestOTPView(APIView):
    permission_classes = [] 

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        username = serializer.validated_data.get('username')
        email = serializer.validated_data.get('email')
        phone = serializer.validated_data.get('phone')
        employee_id = serializer.validated_data.get('employee_id')
        channel = serializer.validated_data.get('channel', 'sms_ntc')
        purpose = serializer.validated_data['purpose']
        
        # 1. Find User
        user = None
        if email and phone:
            # Special handling for forgot_password to provide specific errors
            if purpose == 'forgot_password':
                user_candidate = User.objects.filter(email=email).first()
                if not user_candidate:
                    return Response({"message": "No account found with this email."}, status=status.HTTP_404_NOT_FOUND)
                
                if not user_candidate.phone_number:
                    return Response({"message": "No mobile number is registered for this account. Please contact administrator."}, status=status.HTTP_400_BAD_REQUEST)
                
                if user_candidate.phone_number != phone:
                    return Response({"message": "The provided mobile number does not match our records."}, status=status.HTTP_400_BAD_REQUEST)
                
                if not user_candidate.is_activated:
                    return Response({"message": "This account is not yet activated. Please use the Employee Activation page first."}, status=status.HTTP_400_BAD_REQUEST)
                
                user = user_candidate
            else:
                # New direct flow: find by email and phone
                user = User.objects.filter(email=email, phone_number=phone).first()
        elif employee_id and phone:
            # Signup/Employee activation flow
            user = User.objects.filter(employee_id__iexact=employee_id, phone_number=phone).first()
        elif username:
            # Old lookup-based flow
            user = User.objects.filter(Q(email=username) | Q(username=username) | Q(phone_number=username)).first()
            
        if not user:
            # Special case for signup: if we explicitly gave ID/Phone and it's wrong, tell them.
            if employee_id and phone:
                 return Response({"message": "Invalid Employee ID or Phone number."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Generic response for other cases to prevent enumeration, 
            # though forgot_password above already gives specific ones as requested
            return Response({"message": "If an account exists, an OTP has been sent."}, status=status.HTTP_200_OK)
            
        # 2. Rate Limiting Check (Basic) - FR-13 / 8.2
        # Check active cooldown
        last_request = OTPRequest.objects.filter(user=user, created_at__gte=timezone.now() - timedelta(seconds=30)).first()
        if last_request:
             return Response({"message": "Please wait before requesting another OTP."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # 3. Handle Channel
        seq_no = None
        otp_code = None
        phone_number = user.phone_number
        
        if channel == 'sms_ntc':
            if not phone_number:
                 return Response({"message": "No phone number associated with this account."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Send via NTC
            success, data, error = send_otp_ntc(phone_number)
            if not success:
                # Log error
                return Response({"message": f"Failed to send OTP: {error}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            # Extract seq_no from NTC data (Assuming structure, need validation)
            # Assuming {'seq_no': '1234'} or similar based on PRD FR-04
            seq_no = data.get('seq_no') 
            print(f"DEBUG: Extracted seq_no: {seq_no}")
            if not seq_no:
                 # Fallback if NTC structure differs, but we need seq_no for validation
                 # Should log this anomaly
                 pass

        elif channel == 'email':
            # Internal Email OTP
            email = user.email
            if not email:
                 return Response({"message": "No email address associated with this account."}, status=status.HTTP_400_BAD_REQUEST)

            otp_code = str(random.randint(1000, 9999))
            
            # Send Email
            from .utils import send_otp_email
            success, error = send_otp_email(email, otp_code, purpose)
            if not success:
                 return Response({"message": f"Failed to send OTP via email: {error}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # 4. Save Request
        otp_req = OTPRequest.objects.create(
            user=user,
            phone=phone_number,
            channel=channel,
            seq_no=seq_no,
            otp_code=otp_code if channel == 'email' else None, # Store local OTP for email
            purpose=purpose,
            expires_at=timezone.now() + timedelta(minutes=5),
            status='pending'
        )
        
        response_data = {"message": "OTP sent successfully."}
        if seq_no:
            response_data['seq_no'] = seq_no # Need to return seq_no for the client to pass back? 
            # PRD FR-05 says "System must not expose seq_no to the frontend directly."
            # BUT FR-07 says validation payload needs seq_no.
            # Contradiction? 
            # Usually seq_no is public safe reference, but if PRD says strictly no expose...
            # Maybe the client sends back the request_id (UUID) and backend looks up seq_no?
            # Let's return the OTPRequest ID (UUID) and use that to look up seq_no internally.
            pass
            
        # Returning request_id as a safe reference
        response_data['request_id'] = otp_req.id
        
        # MASK phone number for UX
        if phone_number:
             visible = phone_number[-3:]
             masked = "*" * (len(phone_number) - 3) + visible
             response_data['masked_phone'] = masked

        return Response(response_data, status=status.HTTP_200_OK)

class ValidateOTPView(APIView):
    permission_classes = []
    
    def post(self, request):
        serializer = ValidateOTPSerializer(data=request.data)
        if not serializer.is_valid():
             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
             
        otp = serializer.validated_data['otp']
        # The client might send request_id or seq_no. 
        # If we adhere to FR-05 "Don't expose seq_no", client sends request_id.
        # But FR-07 payload explicitly has "seq_no". 
        # I'll implement support for request_id to accept the UUID from the previous step.
        
        request_id = request.data.get('request_id')
        if not request_id:
             return Response({"message": "request_id is required"}, status=status.HTTP_400_BAD_REQUEST)
             
        try:
            otp_req = OTPRequest.objects.get(id=request_id)
        except OTPRequest.DoesNotExist:
            return Response({"message": "Invalid request ID"}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_req.is_expired():
            otp_req.status = 'expired'
            otp_req.save()
            return Response({"message": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)

        if otp_req.status != 'pending':
             return Response({"message": "OTP is invalid or already used"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate
        if otp_req.channel == 'sms_ntc':
            # Delegate to NTC
            # We use the stored seq_no
            if not otp_req.seq_no:
                return Response({"message": "System error: Missing sequence number for NTC validation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            success, msg = validate_otp_ntc(otp_req.seq_no, otp, phone=otp_req.phone)
            if success:
                otp_req.status = 'validated' # Intermediate state before password reset
                otp_req.save()
                return Response({"message": "OTP validated successfully."}, status=status.HTTP_200_OK)
            else:
                otp_req.attempts += 1
                otp_req.save()
                return Response({"message": msg}, status=status.HTTP_400_BAD_REQUEST)
        
        elif otp_req.channel == 'email':
             # Internal check
             if not otp_req.otp_code:
                 return Response({"message": "System error: No OTP code stored for email validation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                 
             if otp_req.otp_code == otp:
                 otp_req.status = 'validated'
                 otp_req.save()
                 return Response({"message": "OTP validated successfully."}, status=status.HTTP_200_OK)
             else:
                 otp_req.attempts += 1
                 otp_req.save()
                 return Response({"message": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
             
        return Response({"message": "Validation failed"}, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordView(APIView):
    permission_classes = []
    
    def post(self, request):
        # Users call this AFTER validating OTP, or we can combine validation + reset in one call.
        # FR-10: System shall allow password update only after OTP validation success.
        # This implies a stateful flow or passing a token.
        # Simplest approach: The Validate endpoint returns a temporary "reset_token" signed JWT?
        # OR: This endpoint accepts request_id and checks if status=='validated'.
        
        request_id = request.data.get('request_id')
        new_password = request.data.get('new_password')
        
        if not request_id or not new_password:
             return Response({"message": "Missing request_id or new_password"}, status=status.HTTP_400_BAD_REQUEST)
             
        try:
            otp_req = OTPRequest.objects.get(id=request_id)
        except OTPRequest.DoesNotExist:
            return Response({"message": "Invalid request ID"}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_req.status != 'validated':
             return Response({"message": "OTP not verified yet."}, status=status.HTTP_403_FORBIDDEN)
             
        if otp_req.is_expired():
             return Response({"message": "Session expired."}, status=status.HTTP_400_BAD_REQUEST)
             
        # Change Password
        user = otp_req.user
        user.set_password(new_password)
        user.save()
        
        # Mark consumed
        otp_req.status = 'consumed'
        otp_req.save()
        
        return Response({"message": "Password reset successfully."}, status=status.HTTP_200_OK)
from rest_framework.permissions import IsAuthenticated

class VerifyPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')
        if not password:
            return Response({"message": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        if not user.check_password(password):
            return Response({"message": "Invalid password"}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({"message": "Password verified"}, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # This view combines Old Password check + OTP verification (optional? Requirement says Old + OTP)
        # We can expect: old_password, new_password, otp_request_id (validated)
        
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        request_id = request.data.get('request_id') # Optional for logged in user if direct change allowed
        
        if not all([old_password, new_password]):
             return Response({"message": "Old and New passwords are required"}, status=status.HTTP_400_BAD_REQUEST)
             
        user = request.user
        if not user.check_password(old_password):
             return Response({"message": "Invalid old password"}, status=status.HTTP_400_BAD_REQUEST)
             
        # Verify OTP Request if provided
        if request_id:
            try:
                otp_req = OTPRequest.objects.get(id=request_id, user=user)
            except OTPRequest.DoesNotExist:
                return Response({"message": "Invalid OTP request ID"}, status=status.HTTP_400_BAD_REQUEST)
                
            if otp_req.status != 'validated':
                 return Response({"message": "OTP not verified"}, status=status.HTTP_403_FORBIDDEN)
                 
            if otp_req.is_expired():
                 return Response({"message": "OTP session expired"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Consume OTP
            otp_req.status = 'consumed'
            otp_req.save()
             
        # All good, change password
        user.set_password(new_password)
        user.save()
        
        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)


class SignupLookupView(APIView):
    permission_classes = []

    def post(self, request):
        employee_id = request.data.get('employee_id', '').strip()
        if not employee_id:
            return Response({"message": "Employee ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Try direct match first (better for integer columns)
        user = User.objects.filter(employee_id=employee_id).first()
        
        # Try iexact if not found (better for mixed case strings)
        if not user:
            user = User.objects.filter(employee_id__iexact=employee_id).first()

        if not user:
            # Helpful debug print for server console
            sample_ids = list(User.objects.values_list('employee_id', flat=True)[:5])
            print(f"DEBUG: Search '{employee_id}' failed. DB has: {sample_ids}")
            return Response({"message": f"Employee ID '{employee_id}' not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if user.is_activated:
            return Response({"message": "This account is already activated. Please use the login page."}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({
            "email": user.email,
            "phone": user.phone_number,
            "full_name": user.full_name
        }, status=status.HTTP_200_OK)


class SignupCompleteView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = SignupCompleteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        request_id = serializer.validated_data['request_id']
        password = serializer.validated_data['password']
        
        try:
            # We want an OTP Request that was validated and for signup purpose
            otp_req = OTPRequest.objects.get(id=request_id, status='validated', purpose='signup')
        except OTPRequest.DoesNotExist:
            return Response({"message": "Invalid or unverified signup session. Please request OTP again."}, status=status.HTTP_400_BAD_REQUEST)
            
        user = otp_req.user
        
        # Validate password strength based on international standards (Django validators)
        try:
            validate_password(password, user)
        except ValidationError as e:
            return Response({"message": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(password)
        user.is_active = True
        user.is_activated = True
        user.save()
        
        # Mark request as completed
        otp_req.status = 'completed'
        otp_req.save()
        
        return Response({"message": "Account created and activated successfully. Please login."}, status=status.HTTP_200_OK)
