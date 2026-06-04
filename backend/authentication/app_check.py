"""
Firebase App Check token verification.

App Check proves that a request originates from your genuine, unmodified APK
running on a real (non-rooted) Android device — making static MOBILE_API_TOKEN
extraction from the APK useless, because the attacker cannot produce a valid
App Check token without Google Play Integrity signing it.

Tokens are RS256 JWTs signed by Google. We verify them against Firebase's
public JWKS endpoint using PyJWT (already in requirements).

Setup:
1. Create a Firebase project at https://console.firebase.google.com/
2. Register your Android/iOS app and enable App Check (Play Integrity / DeviceCheck).
3. Copy the numeric Project Number from Project Settings → General.
4. Set FIREBASE_PROJECT_NUMBER=<number> in .env.docker.
5. Mobile team integrates the Firebase App Check SDK and sends the token in
   the X-Firebase-AppCheck header when calling POST /api/v1/mobile/auth/.

If FIREBASE_PROJECT_NUMBER is not set, verification is skipped (dev mode).
"""

import logging
import jwt
from jwt import PyJWKClient
from django.conf import settings

logger = logging.getLogger(__name__)

APPCHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks'

# Module-level JWKS client — caches public keys for 1 hour automatically.
_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(APPCHECK_JWKS_URL, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


def verify_app_check_token(token):
    """
    Verify a Firebase App Check JWT.

    Returns True if the token is valid and comes from an approved app on a
    genuine device. Returns False for any invalid/expired/tampered token.

    If FIREBASE_PROJECT_NUMBER is not configured, always returns True so that
    local development and testing work without Firebase credentials.
    """
    project_number = getattr(settings, 'FIREBASE_PROJECT_NUMBER', None)
    if not project_number:
        return True  # Firebase not configured — skip check (dev / unconfigured)

    if not token:
        return False

    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)

        jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            audience=f'projects/{project_number}',
            issuer=f'https://firebaseappcheck.googleapis.com/{project_number}',
        )
        return True

    except jwt.ExpiredSignatureError:
        logger.warning("Firebase App Check token expired")
    except jwt.InvalidAudienceError:
        logger.warning("Firebase App Check token audience mismatch (wrong project?)")
    except jwt.InvalidIssuerError:
        logger.warning("Firebase App Check token issuer mismatch")
    except jwt.InvalidTokenError as e:
        logger.warning("Firebase App Check token invalid: %s", e)
    except Exception as e:
        logger.error("Firebase App Check verification error: %s", e)

    return False
