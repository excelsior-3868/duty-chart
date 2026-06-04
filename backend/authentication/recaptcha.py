import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
MIN_SCORE = 0.5  # reCAPTCHA v3: 0.0 = likely bot, 1.0 = likely human


def verify_recaptcha(token, action=None):
    """
    Verify a Google reCAPTCHA v3 token via Google's siteverify API.

    Returns (success: bool, score: float).

    If RECAPTCHA_SECRET_KEY is not set in settings the check is skipped and
    (True, 1.0) is returned, so local development works without a key.

    Args:
        token:  The recaptcha_token value submitted by the client.
        action: Optional expected action string (e.g. 'login', 'otp_request').
                If provided and the token's action doesn't match, the check fails.
    """
    secret = getattr(settings, 'RECAPTCHA_SECRET_KEY', None)
    if not secret:
        return True, 1.0  # reCAPTCHA not configured — allow (dev / unconfigured)

    if not token:
        return False, 0.0

    try:
        resp = requests.post(
            RECAPTCHA_VERIFY_URL,
            data={'secret': secret, 'response': token},
            timeout=5,
        )
        result = resp.json()
    except Exception:
        logger.warning("reCAPTCHA siteverify request failed")
        return False, 0.0

    if not result.get('success'):
        return False, result.get('score', 0.0)

    score = result.get('score', 0.0)

    if action and result.get('action') != action:
        logger.warning("reCAPTCHA action mismatch: expected=%s got=%s", action, result.get('action'))
        return False, score

    return score >= MIN_SCORE, score
