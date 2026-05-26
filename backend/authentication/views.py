import jwt
import requests as http_requests
from jwt.algorithms import RSAAlgorithm

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.utils import timezone
from django.contrib.auth import get_user_model
from users.models import Permission, Role, RolePermission, UserPermission
from otp_service.models import OTPRequest
from .serializers import TokenObtainPair2FASerializer

User = get_user_model()

# ---------------------------------------------------------------------------
# Keycloak SSO — shared config & helpers
# ---------------------------------------------------------------------------
KEYCLOAK_BASE_URL  = "http://10.26.192.122:8080"
KEYCLOAK_REALM     = "Central-SSWAuth"
KEYCLOAK_CLIENT_ID = "duty-chart"

def _get_keycloak_public_key(kid: str):
    """Fetch Keycloak's JWKS and return the RSA public key matching `kid`."""
    jwks_url = f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
    resp = http_requests.get(jwks_url, timeout=5)
    resp.raise_for_status()
    jwks = resp.json()
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            return RSAAlgorithm.from_jwk(key_data)
    raise ValueError(f"No matching key found for kid={kid}")


def _verify_keycloak_token(token: str) -> dict:
    """Verify a Keycloak access token and return its payload."""
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("Token header missing 'kid'.")
    public_key = _get_keycloak_public_key(kid)
    import logging
    logger = logging.getLogger(__name__)

    # Decode without strict audience check — Keycloak access tokens typically have
    # aud=["account"], not the client_id. Issuer check is sufficient to prove origin.
    payload = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        options={"verify_aud": False},
        issuer=f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}",
    )

    # Log the payload to help with debugging (remove after confirming it works)
    # logger.info(f"[SSO] Keycloak token claims: azp={payload.get('azp')} aud={payload.get('aud')} sub={payload.get('sub')} preferred_username={payload.get('preferred_username')}")

    # Verify the token was issued FOR our client (azp = authorized party)
    azp = payload.get("azp", "")
    if azp and azp != KEYCLOAK_CLIENT_ID:
        raise jwt.InvalidAudienceError(f"Token authorized party '{azp}' does not match client '{KEYCLOAK_CLIENT_ID}'.")

    return payload



def _lookup_local_user(payload: dict):
    """Find a local Django user from Keycloak token claims."""
    username = payload.get("preferred_username", "")
    email    = payload.get("email", "")
    user = None
    if username:
        user = User.objects.filter(employee_id=username).first()
    if not user and email:
        user = User.objects.filter(email__iexact=email).first()
    if not user and username:
        user = User.objects.filter(username__iexact=username).first()
    return user


class KeycloakCodeExchangeView(APIView):
    """
    POST /api/v1/auth/sso/keycloak/code/
    Body: { "code": "<authorization code>", "redirect_uri": "<redirect URI>" }

    Exchanges the Keycloak authorization code for tokens server-side,
    verifies the access token, finds the local user, and returns a
    Django SimpleJWT token pair.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        code         = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri")

        if not code or not redirect_uri:
            return Response(
                {"detail": "Both 'code' and 'redirect_uri' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- 1. Exchange code for Keycloak tokens (server-side, no crypto needed) ---
        token_url = f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
        try:
            token_resp = http_requests.post(
                token_url,
                data={
                    "grant_type":   "authorization_code",
                    "client_id":    KEYCLOAK_CLIENT_ID,
                    "code":         code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10,
            )
            token_resp.raise_for_status()
        except http_requests.RequestException as e:
            return Response(
                {"detail": f"Failed to exchange code with Keycloak: {e}"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        tokens      = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return Response(
                {"detail": "Keycloak did not return an access token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # --- 2. Verify the Keycloak access token ---
        try:
            payload = _verify_keycloak_token(access_token)
        except jwt.ExpiredSignatureError:
            return Response({"detail": "Keycloak token has expired."}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.PyJWTError as e:
            return Response({"detail": f"Token verification failed: {e}"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"detail": f"Token error: {e}"}, status=status.HTTP_401_UNAUTHORIZED)

        # --- 3. Find the local user ---
        user = _lookup_local_user(payload)
        if not user:
            username = payload.get("preferred_username", "")
            email    = payload.get("email", "")
            return Response(
                {"detail": f"No local account found for SSO user '{email or username}'. Please contact your administrator."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.is_active:
            return Response(
                {"detail": "Your account is inactive. Please contact your administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # --- 4. Issue Django SimpleJWT tokens ---
        refresh = RefreshToken.for_user(user)
        return Response({
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
            "id_token": tokens.get("id_token"),
        }, status=status.HTTP_200_OK)




class KeycloakTokenExchangeView(APIView):
    """
    POST /api/v1/auth/sso/keycloak/
    Body: { "keycloak_token": "<Keycloak access token>" }

    Verifies the Keycloak JWT, finds the matching local user by email
    or preferred_username, and returns a Django SimpleJWT token pair.
    """
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_description="Exchange a Keycloak access token for a Django JWT token pair.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["keycloak_token"],
            properties={
                "keycloak_token": openapi.Schema(type=openapi.TYPE_STRING, description="Keycloak access token"),
            },
        ),
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "access":  openapi.Schema(type=openapi.TYPE_STRING),
                    "refresh": openapi.Schema(type=openapi.TYPE_STRING),
                },
            ),
            400: "Missing or invalid token",
            401: "Token verification failed",
            403: "Account inactive",
            404: "User not found in local database",
        },
    )
    def post(self, request):
        keycloak_token = request.data.get("keycloak_token")
        if not keycloak_token:
            return Response({"detail": "keycloak_token is required."}, status=status.HTTP_400_BAD_REQUEST)

        # --- 1. Decode header to get key id (kid) ---
        try:
            unverified_header = jwt.get_unverified_header(keycloak_token)
        except jwt.DecodeError as e:
            return Response({"detail": f"Invalid token format: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        kid = unverified_header.get("kid")
        if not kid:
            return Response({"detail": "Token header missing 'kid'."}, status=status.HTTP_400_BAD_REQUEST)

        # --- 2. Fetch matching Keycloak public key ---
        try:
            public_key = _get_keycloak_public_key(kid)
        except Exception as e:
            return Response({"detail": f"Failed to fetch Keycloak public keys: {e}"}, status=status.HTTP_401_UNAUTHORIZED)

        # --- 3. Verify & decode the token ---
        try:
            payload = jwt.decode(
                keycloak_token,
                public_key,
                algorithms=["RS256"],
                options={"verify_aud": False},
                issuer=f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}",
            )
        except jwt.ExpiredSignatureError:
            return Response({"detail": "Keycloak token has expired."}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidAudienceError:
            return Response({"detail": "Token audience mismatch."}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.PyJWTError as e:
            return Response({"detail": f"Token verification failed: {e}"}, status=status.HTTP_401_UNAUTHORIZED)

        # --- 4. Find the local user ---
        # Keycloak uses employee_id as the username (preferred_username claim).
        username = payload.get("preferred_username", "")
        email    = payload.get("email", "")

        user = None
        # Primary: match preferred_username → employee_id
        if username:
            user = User.objects.filter(employee_id=username).first()
        # Fallback 1: match by email
        if not user and email:
            user = User.objects.filter(email__iexact=email).first()
        # Fallback 2: match preferred_username → username field
        if not user and username:
            user = User.objects.filter(username__iexact=username).first()

        if not user:
            return Response(
                {"detail": f"No local account found for SSO user '{email or username}'. Please contact your administrator."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.is_active:
            return Response(
                {"detail": "Your account is inactive. Please contact your administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # --- 5. Issue Django SimpleJWT tokens ---
        refresh = RefreshToken.for_user(user)
        return Response({
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_200_OK)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Return identity details for the authenticated user.",
        security=[{'Bearer': []}],
    )
    def get(self, request):
        user = request.user
        full_name = getattr(user, "full_name", None)
        if not full_name:
            full_name = f"{user.first_name} {user.last_name}".strip()

        role = getattr(user, "role", None)
        permissions = []
        try:
            if role == "SUPERADMIN":
                permissions = list(Permission.objects.filter(is_active=True).values_list("slug", flat=True))
            else:
                role_obj = Role.objects.filter(slug=role, is_active=True).first()
                if role_obj:
                    role_perm_slugs = list(
                        RolePermission.objects.filter(role=role_obj).select_related("permission").values_list("permission__slug", flat=True)
                    )
                    permissions = role_perm_slugs
                direct_perm_slugs = list(
                    UserPermission.objects.filter(user=user).select_related("permission").values_list("permission__slug", flat=True)
                )
                seen = set()
                merged = []
                for slug in permissions + direct_perm_slugs:
                    if slug not in seen:
                        seen.add(slug)
                        merged.append(slug)
                permissions = merged
        except Exception:
            permissions = []

        image_url = None
        if user.image:
            image_url = request.build_absolute_uri(user.image.url)

        return Response({
            "id": user.id,
            "username": user.username,
            "full_name": full_name,
            "email": user.email,
            "employee_id": getattr(user, "employee_id", None),
            "role": role,
            "position_name": user.position.name if user.position else None,
            "office_name": user.office.name if user.office else None,
            "image": image_url,
            "office_id": getattr(user, "office_id", None),
            "position_id": getattr(user, "position_id", None),
            "phone_number": user.phone_number,
            "secondary_offices": list(user.secondary_offices.values_list('id', flat=True)) if hasattr(user, 'secondary_offices') else [],
            "permissions": permissions,
        })

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class TokenObtainPair2FAView(TokenObtainPairView):
    serializer_class = TokenObtainPair2FASerializer

@method_decorator(csrf_exempt, name='dispatch')
class Verify2FAView(APIView):
    permission_classes = []

    def post(self, request):
        username = request.data.get('username')
        otp = request.data.get('otp')
        
        if not username or not otp:
            return Response({"detail": "Username and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from django.db.models import Q
            user = User.objects.get(Q(email=username) | Q(username=username) | Q(employee_id=username))
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except User.MultipleObjectsReturned:
            user = User.objects.filter(email=username).first()
        if not user.is_active:
            return Response({"detail": "Your Account is not active. Please contact your administrator."}, status=status.HTTP_403_FORBIDDEN)
            
        # Find the latest pending 2FA OTP request for this user
        # We also check recently expired ones to give a better error message
        otp_request = OTPRequest.objects.filter(
            user=user, 
            purpose='login_2fa'
        ).order_by('-created_at').first()
        
        if not otp_request:
            return Response({"detail": "No 2FA request found for this user. Please login again."}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_request.status != 'pending':
            return Response({"detail": f"OTP has already been {otp_request.status}. Please login again."}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_request.expires_at < timezone.now():
            return Response({"detail": "OTP has expired. Please login again."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Validate OTP using NTC gateway if seq_no is present
        from otp_service.utils import validate_otp_ntc
        
        if otp_request.seq_no:
            success, msg = validate_otp_ntc(
                seq_no=otp_request.seq_no, 
                otp=otp, 
                phone=user.phone_number
            )
            if not success:
                # User-friendly message for incorrect OTP
                if "OTP Value Verification Failed" in msg:
                    return Response({"detail": "OTP Verification Failed. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
                return Response({"detail": f"OTP Validation Failed: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Fallback to local validation if no seq_no (e.g. for non-NTC channels if added later)
            if otp_request.otp_code and otp_request.otp_code != otp:
                return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)
             
        # Mark as consumed
        otp_request.status = 'consumed'
        otp_request.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })
