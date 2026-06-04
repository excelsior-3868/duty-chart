# Duty Chart Mobile Application — Security Implementation Documentation

**Project:** Nepal Telecom Duty Chart Management System  
**Version:** 1.0  
**Date:** 2026-06-04  
**Scope:** Mobile API Security, Authentication, Bot Protection

---

## Table of Contents

1. [Overview](#1-overview)
2. [Security Architecture](#2-security-architecture)
3. [Layer 1 — Firebase App Check](#3-layer-1--firebase-app-check)
4. [Layer 2 — Mobile Session Token](#4-layer-2--mobile-session-token)
5. [Layer 3 — JWT Authentication](#5-layer-3--jwt-authentication)
6. [Google reCAPTCHA v3 (Web)](#6-google-recaptcha-v3-web)
7. [Backend Implementation](#7-backend-implementation)
8. [Frontend Implementation](#8-frontend-implementation)
9. [Mobile App Implementation](#9-mobile-app-implementation)
10. [Environment Configuration](#10-environment-configuration)
11. [API Reference](#11-api-reference)
12. [Security Flow Diagrams](#12-security-flow-diagrams)
13. [Threat Model](#13-threat-model)
14. [Setup & Deployment Checklist](#14-setup--deployment-checklist)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Overview

The Duty Chart mobile application implements a three-layer security model to protect the backend API from unauthorized access, bot attacks, and reverse-engineering attempts. Each layer independently addresses a distinct attack class, meaning an attacker must defeat all three simultaneously to gain unauthorized access.

### Security Layers at a Glance

| Layer | Technology | Defends Against |
|-------|-----------|-----------------|
| Layer 1 | Firebase App Check (Play Integrity / App Attest) | Fake clients, APK reverse-engineering, automated scripts |
| Layer 2 | Short-lived Mobile Session Token | Replay attacks, static secret exposure, token interception |
| Layer 3 | JWT Authentication | Unauthorized user access, session hijacking |
| Bonus | Google reCAPTCHA v3 (Web only) | Bot brute-force on web login, OTP abuse, fake signups |

### Key Security Properties

- The static `MOBILE_API_TOKEN` is **never transmitted** in regular API requests — it is used only once internally for the token exchange, and only if Firebase App Check is unavailable.
- All mobile session tokens are **short-lived** (1 hour) and **cryptographically signed** by the server using Django's signing framework.
- **2FA is intentionally bypassed** for mobile app requests — the mobile session token acts as the second factor, proving the request originates from the genuine app on a real device.
- Bot protection on the web frontend uses **Google reCAPTCHA v3** (invisible, score-based) — no user interaction required.

---

## 2. Security Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE APP                                    │
│                                                                      │
│  App Starts                                                          │
│       │                                                              │
│       ▼                                                              │
│  Firebase.initializeApp()                                            │
│  FirebaseAppCheck.activate(PlayIntegrity / AppAttest)                │
│       │                                                              │
│       ▼                                                              │
│  MobileSessionService.getSessionToken()                              │
│       │                                                              │
│       ├─── Try: FirebaseAppCheck.getToken()                          │
│       │         → X-Firebase-AppCheck header                         │
│       │                                                              │
│       └─── Fallback (dev only): X-Mobile-Token header               │
│                                                                      │
│  POST /api/v1/mobile/auth/                                           │
│       │                                                              │
│       ▼                                                              │
│  Receives: { session_token, expires_in: 3600 }                       │
│  Stored in: FlutterSecureStorage                                     │
│       │                                                              │
│       ▼                                                              │
│  All API requests:                                                   │
│    Header: X-Mobile-Session-Token: <session_token>                   │
│    Header: Authorization: Bearer <jwt_access_token>  (when logged in)│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Django)                              │
│                                                                      │
│  POST /api/v1/mobile/auth/  (MobileAuthView)                        │
│       │                                                              │
│       ├─── If FIREBASE_PROJECT_NUMBER set:                           │
│       │    Verify X-Firebase-AppCheck JWT via Google JWKS            │
│       │    (https://firebaseappcheck.googleapis.com/v1/jwks)         │
│       │                                                              │
│       └─── Else (dev fallback):                                      │
│            Verify X-Mobile-Token via hmac.compare_digest()           │
│                                                                      │
│       Pass → signing.dumps({ iat, v:1 }, key=MOBILE_API_TOKEN)      │
│       Returns: { session_token, expires_in: 3600 }                   │
│                                                                      │
│  All other endpoints:                                                │
│       HasMobileAPIToken → signing.loads(X-Mobile-Session-Token)     │
│       JWTAuthentication → validates Authorization: Bearer token      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layer 1 — Firebase App Check

### What It Does

Firebase App Check uses **Google Play Integrity** (Android) and **Apple App Attest** (iOS) to cryptographically verify that:

- The request originates from **your genuine, unmodified APK/IPA**
- The app is installed from the **official app store**
- The device is a **real, non-rooted Android / non-jailbroken iOS device**

Even if an attacker fully decompiles the APK and extracts every secret inside it, they **cannot produce a valid App Check token** — only Google/Apple can sign these tokens for your specific app binary.

### Attestation Providers

| Platform | Provider | Minimum OS | Notes |
|----------|----------|-----------|-------|
| Android | Play Integrity API | Android 5.0+ | Requires Google Play Services |
| iOS | App Attest | iOS 14+ | Strongest attestation |
| iOS (fallback) | DeviceCheck | iOS 11+ | Older devices |

### Backend Verification

The backend verifies App Check tokens **without the `firebase-admin` SDK** — it uses `PyJWT` (already a project dependency) to validate the RS256-signed JWT against Firebase's public JWKS endpoint.

**File:** `backend/authentication/app_check.py`

```python
# Verification endpoint used
APPCHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks'

# Token claims verified:
# - Signature (RS256, against Google's public keys)
# - audience: projects/1078964414120
# - issuer:   https://firebaseappcheck.googleapis.com/1078964414120
# - expiry:   checked by PyJWT automatically
```

### Configuration

| Setting | Value | Location |
|---------|-------|----------|
| `FIREBASE_PROJECT_NUMBER` | `1078964414120` | `.env.docker`, `backend/.env` |
| Firebase project | Configured in Firebase Console | [console.firebase.google.com](https://console.firebase.google.com) |
| `google-services.json` | Downloaded from Firebase Console | `android/app/google-services.json` |
| `GoogleService-Info.plist` | Downloaded from Firebase Console | `ios/Runner/GoogleService-Info.plist` |

### Development Fallback

When `FIREBASE_PROJECT_NUMBER` is **not set** (local development), the token exchange endpoint falls back to verifying the static `MOBILE_API_TOKEN` header. This means:

- Dev builds without Firebase configuration continue to work
- Production builds with `FIREBASE_PROJECT_NUMBER` set require genuine app attestation
- No code changes are needed when switching from dev to production

---

## 4. Layer 2 — Mobile Session Token

### What It Does

The mobile session token is a **short-lived (1 hour), cryptographically signed** token issued by the backend after Layer 1 passes. It:

- Proves this specific request comes from an authenticated mobile app instance
- **Bypasses 2FA** on the login endpoint (mobile app cannot display OTP screens)
- Grants access to mobile-specific read-only endpoints (org structure data)
- Expires automatically — even if intercepted, it is useless after 1 hour

### Token Exchange Flow

```
Mobile App                              Backend
    │                                      │
    │── GET Firebase App Check token ──►  (Google/Apple signs it)
    │                                      │
    │── POST /api/v1/mobile/auth/ ────────►│
    │   Header: X-Firebase-AppCheck: <token>│
    │                                      │── Verify App Check JWT
    │                                      │   (JWKS from Google)
    │                                      │
    │◄── { session_token, expires_in } ───│
    │                                      │
    │   (stored in FlutterSecureStorage)   │
    │                                      │
    │── POST /api/token/ ────────────────►│
    │   Header: X-Mobile-Session-Token: <token>
    │   Body: { employee_id, password }    │── Validate session token
    │                                      │── Skip 2FA (mobile bypass)
    │◄── { access, refresh } ────────────│
```

### Token Implementation

**Signing:** Django's `django.core.signing` module with `HMAC-SHA256`.

```python
# Token generation (backend)
session_token = signing.dumps(
    {'iat': int(time.time()), 'v': 1},
    key=settings.MOBILE_API_TOKEN,    # signing key
    salt='mobile_app_session',        # namespace isolation
)

# Token validation (backend)
signing.loads(
    token,
    key=settings.MOBILE_API_TOKEN,
    salt='mobile_app_session',
    max_age=3600,                     # 1-hour expiry enforced
)
```

### Token Lifecycle (Flutter)

```
App Startup
    │
    ▼
MobileSessionService.getSessionToken()
    │
    ├── Check SecureStorage for cached token
    │       │
    │       ├── Found AND not expiring in <5 min → return cached token
    │       │
    │       └── Not found OR expiring soon → refresh
    │                   │
    │                   ▼
    │           _refreshSessionToken()
    │               │
    │               ├── Try: FirebaseAppCheck.getToken()
    │               │       → POST /api/v1/mobile/auth/ with X-Firebase-AppCheck
    │               │
    │               └── Fallback: POST with X-Mobile-Token (dev only)
    │                       │
    │                       ▼
    │               Cache in SecureStorage with expiry timestamp
    │
    ▼
Return session_token → added to every request as X-Mobile-Session-Token
```

### Concurrent Refresh Protection

The service uses a `Future` deduplication pattern to prevent multiple simultaneous token refresh calls when several requests are made before the first refresh completes:

```dart
Future<String?>? _ongoingRefresh;

Future<String?> getSessionToken() async {
  final cached = await _getCachedToken();
  if (cached != null) return cached;

  _ongoingRefresh ??= _refreshSessionToken().whenComplete(() {
    _ongoingRefresh = null;
  });
  return _ongoingRefresh;
}
```

### Header Reference

| Header | Used For | Set By |
|--------|----------|--------|
| `X-Firebase-AppCheck` | App Check token exchange only | Flutter app (MobileSessionService) |
| `X-Mobile-Token` | Dev fallback token exchange only | Flutter app (MobileSessionService) |
| `X-Mobile-Session-Token` | All API requests after token exchange | Dio interceptor (ApiClient) |

---

## 5. Layer 3 — JWT Authentication

### What It Does

After the mobile app proves its identity (Layers 1 & 2), individual users must still authenticate with their **employee credentials**. This layer:

- Verifies the user is who they claim to be
- Issues short-lived **JWT access tokens** (1 hour) and **refresh tokens** (1 day)
- Enforces **role-based access control** (SuperAdmin, OfficeAdmin, NetworkAdmin, etc.)
- Restricts data access to the user's assigned office(s)

### JWT Configuration

| Setting | Value |
|---------|-------|
| Algorithm | HS256 |
| Access token lifetime | 60 minutes |
| Refresh token lifetime | 1 day |
| Signing key | `SECRET_KEY` from environment |

### Login Flow (Mobile)

```
Mobile App sends:
  POST /api/token/
  Headers:
    X-Mobile-Session-Token: <valid_session_token>   ← Layer 2
    Content-Type: application/json
  Body:
    { "employee_id": "...", "password": "..." }

Backend:
  1. Validates X-Mobile-Session-Token (Layer 2 check)
  2. is_mobile_request = True → skip 2FA
  3. Validates employee_id + password
  4. Returns { access, refresh } JWT tokens

Mobile App:
  Stores access + refresh tokens in FlutterSecureStorage
  Subsequent requests: Authorization: Bearer <access_token>
```

### 2FA Bypass Justification

2FA is bypassed for mobile requests because:

1. **Layer 1** (Firebase App Check) already provides a stronger second factor than SMS OTP — it verifies the device hardware and app integrity at the cryptographic level
2. Native mobile apps cannot easily display browser-based OTP flows
3. The bypass requires a valid, non-expired session token (itself requiring App Check attestation)

The bypass is implemented in `backend/authentication/serializers.py`:

```python
# 2FA is skipped only when a valid mobile session token is present
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
    return data  # Skip OTP challenge
```

### Token Storage (Flutter)

All tokens are stored in `FlutterSecureStorage` — encrypted storage backed by Android Keystore (Android) and iOS Keychain (iOS):

| Key | Value | Notes |
|-----|-------|-------|
| `access_token` | JWT access token | Attached to all authenticated requests |
| `refresh_token` | JWT refresh token | Used for token renewal |
| `mobile_session_token` | Mobile session token | Managed by MobileSessionService |
| `mobile_session_expiry` | Unix timestamp (ms) | Expiry for session token |
| `saved_username` | Employee ID | Biometric login support |
| `saved_password` | Password | Biometric login support |

---

## 6. Google reCAPTCHA v3 (Web)

### What It Does

reCAPTCHA v3 runs **invisibly in the browser** — no checkbox or image puzzle. It analyses user behaviour (mouse movement, scrolling, timing) and returns a score from `0.0` (bot) to `1.0` (human). The backend rejects requests scoring below `0.5`.

### Protected Endpoints

| Endpoint | Action String | Purpose |
|----------|--------------|---------|
| `POST /api/token/` | `login` | Prevents brute-force login attacks |
| `POST /api/v1/otp/request/` | `otp_request` | Prevents SMS spam / OTP flooding |
| `POST /api/v1/otp/signup/complete/` | `signup` | Prevents automated bot registrations |

### Keys

| Key | Value | Location |
|-----|-------|----------|
| Site Key (public) | `6LdI7wwtAAAAACD2RewXmRaDFQffP1HQMXkckCqx` | `frontend/.env` as `VITE_RECAPTCHA_SITE_KEY` |
| Secret Key (private) | `6LdI7wwtAAAAANbHJIou_F3bxC04FPtN5W3eCvQs` | `.env.docker`, `backend/.env` as `RECAPTCHA_SECRET_KEY` |

> **Important:** The Secret Key must **never** be exposed to the browser or included in frontend code.

### Mobile App Bypass

reCAPTCHA is **not used on the mobile app** — it requires a browser context to execute. Mobile app requests are identified by the presence of a valid `X-Mobile-Session-Token` header and automatically skip the reCAPTCHA check:

```python
# In every protected endpoint:
if not _is_mobile_request(request):
    recaptcha_token = request.data.get('recaptcha_token')
    ok, _ = verify_recaptcha(recaptcha_token, action='login')
    if not ok:
        return Response({"detail": "reCAPTCHA verification failed."}, 400)
```

### Frontend Usage

The site key is loaded from the environment variable:

```typescript
// src/utils/recaptcha.ts
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// Usage in login form:
const recaptchaToken = await executeRecaptcha("login");
await publicApi.post("/token/", {
    employee_id, password,
    ...(recaptchaToken && { recaptcha_token: recaptchaToken }),
});
```

---

## 7. Backend Implementation

### File Structure

```
backend/
├── authentication/
│   ├── permissions.py          # HasMobileAPIToken, IsAuthenticatedOrHasMobileToken
│   ├── serializers.py          # TokenObtainPair2FASerializer (2FA bypass logic)
│   ├── views.py                # MobileAuthView, TokenObtainPair2FAView
│   ├── recaptcha.py            # Google reCAPTCHA v3 verifier
│   └── app_check.py            # Firebase App Check JWT verifier
└── config/
    └── settings.py             # MOBILE_API_TOKEN, RECAPTCHA_SECRET_KEY,
                                #   FIREBASE_PROJECT_NUMBER, CORS headers
```

### Permission Classes

**`HasMobileAPIToken`** (`authentication/permissions.py`)
- Validates `X-Mobile-Session-Token` header using `django.core.signing`
- Returns `True` only if the token is valid and not expired (1-hour max age)

**`IsAuthenticatedOrHasMobileToken`** (`authentication/permissions.py`)
- Global default permission class for all endpoints
- Allows: authenticated JWT users OR read-only requests with valid session token
- Denies: everything else for unauthenticated requests

### Key Functions

```python
# Timing-safe comparison for the static token (used at /api/v1/mobile/auth/ only)
def validate_raw_mobile_token(raw_token, required_secret) -> bool

# Validate a signed session token (used everywhere else)
def validate_mobile_session_token(token, secret) -> bool

# Verify Google reCAPTCHA v3 token
def verify_recaptcha(token, action=None) -> tuple[bool, float]

# Verify Firebase App Check JWT
def verify_app_check_token(token) -> bool
```

### REST Framework Global Settings

```python
# config/settings.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "authentication.permissions.IsAuthenticatedOrHasMobileToken",
    ],
}
```

---

## 8. Frontend Implementation

### File Structure

```
frontend/
├── src/
│   ├── utils/
│   │   └── recaptcha.ts                 # executeRecaptcha() utility
│   ├── pages/
│   │   ├── Login.tsx                    # reCAPTCHA on handleSubmit
│   │   └── Register.tsx                 # reCAPTCHA on OTP request + signup
│   └── components/
│       └── auth/
│           └── PasswordResetModal.tsx   # reCAPTCHA on OTP request
└── .env
    └── VITE_RECAPTCHA_SITE_KEY=...
```

### reCAPTCHA Utility

`src/utils/recaptcha.ts` dynamically loads the reCAPTCHA v3 script on first use and exports a single function:

```typescript
executeRecaptcha(action: string): Promise<string | null>
```

Returns `null` if `VITE_RECAPTCHA_SITE_KEY` is not set (local dev — backend also skips the check when `RECAPTCHA_SECRET_KEY` is empty).

---

## 9. Mobile App Implementation

### File Structure

```
lib/
├── main.dart                           # Firebase.initializeApp() + AppCheck.activate()
└── core/
    ├── api_client.dart                 # Dio HTTP client with session token interceptor
    ├── mobile_session_service.dart     # App Check → session token exchange + caching
    └── providers.dart                  # Riverpod providers
```

### Dependency Graph

```
secureStorageProvider (FlutterSecureStorage)
        │
        ├──► mobileSessionServiceProvider (MobileSessionService)
        │                │
        │                └── Uses Firebase App Check
        │                    + own Dio instance for /api/v1/mobile/auth/
        │
        └──► apiClientProvider (ApiClient)
                  │
                  ├── Injects MobileSessionService
                  └── Adds X-Mobile-Session-Token to every request
```

### Dependencies Added

```yaml
# pubspec.yaml
firebase_core: ^3.6.0
firebase_app_check: ^0.3.1+4
```

### Android Changes

**`android/build.gradle.kts`** — Added Google services classpath:
```kotlin
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.4.2")
    }
}
```

**`android/app/build.gradle.kts`** — Applied plugin:
```kotlin
plugins {
    id("com.google.gms.google-services")
}
```

**`android/app/google-services.json`** — Downloaded from Firebase Console (not committed to version control).

### iOS Changes

**`ios/Runner/GoogleService-Info.plist`** — Downloaded from Firebase Console (not committed to version control).

App Attest requires no additional Podfile changes — the `firebase_app_check` Flutter plugin handles the native integration automatically.

---

## 10. Environment Configuration

### Backend — `.env.docker` (Production)

```env
SECRET_KEY=<generated-with-secrets.token_urlsafe(48)>
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,dutychart.ntc.net.np
CORS_ALLOWED_ORIGINS=http://dutychart.ntc.net.np,https://dutychart.ntc.net.np,...

MOBILE_API_TOKEN=<generated-with-secrets.token_urlsafe(48)>
RECAPTCHA_SECRET_KEY=6LdI7wwtAAAAANbHJIou_F3bxC04FPtN5W3eCvQs
FIREBASE_PROJECT_NUMBER=1078964414120
```

### Backend — `backend/.env` (Local Development)

```env
SECRET_KEY=<generated>
DEBUG=False
MOBILE_API_TOKEN=x9m8AmzfF91RhNo5HMQbX4nRHulE1ykZ2eUKT6A_a9E
RECAPTCHA_SITE_KEY=6LdI7wwtAAAAACD2RewXmRaDFQffP1HQMXkckCqx
RECAPTCHA_SECRET_KEY=6LdI7wwtAAAAANbHJIou_F3bxC04FPtN5W3eCvQs
FIREBASE_PROJECT_NUMBER=1078964414120
```

### Frontend — `frontend/.env`

```env
VITE_BACKEND_HOST=
VITE_RECAPTCHA_SITE_KEY=6LdI7wwtAAAAACD2RewXmRaDFQffP1HQMXkckCqx
```

### Key Generation

To generate new secure random keys:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 11. API Reference

### `POST /api/v1/mobile/auth/`

Issues a short-lived mobile session token after verifying app integrity.

**Authentication:** None required  
**Rate Limiting:** Recommended (not currently implemented)

**Request (Production — Firebase App Check):**
```http
POST /api/v1/mobile/auth/
X-Firebase-AppCheck: <firebase_app_check_token>
Content-Type: application/json
```

**Request (Development Fallback — Static Token):**
```http
POST /api/v1/mobile/auth/
X-Mobile-Token: <MOBILE_API_TOKEN>
Content-Type: application/json
```

**Response `200 OK`:**
```json
{
  "session_token": "<signed_token_string>",
  "expires_in": 3600,
  "token_type": "mobile_session"
}
```

**Response `401 Unauthorized`:**
```json
{
  "detail": "App integrity check failed. Use the official app on a supported device."
}
```

**Response `503 Service Unavailable`:**
```json
{
  "detail": "Mobile API not configured on this server."
}
```

---

### `POST /api/token/`

Authenticates a user and returns JWT tokens. Skips 2FA for mobile requests.

**Request (Mobile):**
```http
POST /api/token/
X-Mobile-Session-Token: <session_token>
Content-Type: application/json

{
  "employee_id": "12345",
  "password": "user_password"
}
```

**Request (Web — with reCAPTCHA):**
```http
POST /api/token/
Content-Type: application/json

{
  "employee_id": "12345",
  "password": "user_password",
  "recaptcha_token": "<recaptcha_v3_token>"
}
```

**Response `200 OK` (direct login):**
```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>"
}
```

**Response `200 OK` (2FA required — web only):**
```json
{
  "2fa_required": true,
  "phone_mask": "980****123",
  "employee_id": "12345",
  "username": "12345"
}
```

---

### Mobile-Accessible Endpoints (Read-Only with Session Token)

These endpoints accept `X-Mobile-Session-Token` without a JWT (read-only):

| Endpoint | Method | Data |
|----------|--------|------|
| `/api/v1/directorates/` | GET | Directorate hierarchy |
| `/api/v1/departments/` | GET | Department list |
| `/api/v1/offices/` | GET | Working offices |
| `/api/v1/accounting-offices/` | GET | Accounting offices |
| `/api/v1/cc-offices/` | GET | Control & compliance offices |

---

## 12. Security Flow Diagrams

### Complete Mobile Login Flow

```
USER                  FLUTTER APP              GOOGLE/APPLE         BACKEND
 │                        │                         │                  │
 │  Open App              │                         │                  │
 │─────────────────────►  │                         │                  │
 │                        │── Firebase.init() ─────►│                  │
 │                        │── AppCheck.activate() ──►│                  │
 │                        │                         │                  │
 │                        │── getToken() ──────────►│                  │
 │                        │◄── App Check Token ─────│                  │
 │                        │                         │                  │
 │                        │── POST /api/v1/mobile/auth/ ──────────────►│
 │                        │   X-Firebase-AppCheck: <token>             │
 │                        │                         │  Verify JWT      │
 │                        │                         │  via JWKS ───────┤
 │                        │◄─────────────────────────── session_token  │
 │                        │   (cached 1 hour)       │                  │
 │                        │                         │                  │
 │  Enter credentials     │                         │                  │
 │─────────────────────►  │                         │                  │
 │                        │── POST /api/token/ ────────────────────────►
 │                        │   X-Mobile-Session-Token: <token>          │
 │                        │   { employee_id, password }                │
 │                        │                         │  Validate session │
 │                        │                         │  Skip 2FA ───────┤
 │                        │                         │  Validate creds  │
 │                        │◄────────────────────────────── { access,   │
 │                        │                                  refresh }  │
 │  Dashboard loads       │                         │                  │
 │◄─────────────────────  │                         │                  │
```

### Token Refresh Flow

```
FLUTTER APP                                         BACKEND
    │                                                  │
    │  (Session token nearing expiry — < 5 min left)  │
    │                                                  │
    │── FirebaseAppCheck.getToken() ─────────────►(Google)
    │◄── New App Check token ─────────────────────────│
    │                                                  │
    │── POST /api/v1/mobile/auth/ ────────────────────►│
    │   X-Firebase-AppCheck: <new_token>               │
    │◄── { session_token, expires_in: 3600 } ─────────│
    │                                                  │
    │  Update SecureStorage with new token + expiry    │
```

---

## 13. Threat Model

### Threats Addressed

| Threat | Attack Vector | Mitigation |
|--------|--------------|------------|
| APK reverse engineering | Decompile APK, extract secrets | Firebase App Check — secrets useless without Google/Apple attestation |
| Static token replay | Capture `X-Mobile-Token` in transit | Token is never transmitted in production; session tokens expire in 1 hour |
| Token interception | MITM / network sniffing | HTTPS enforced; session tokens are short-lived |
| Brute force login (web) | Automated credential stuffing | reCAPTCHA v3 with score < 0.5 rejection |
| SMS OTP flooding | Automated OTP requests | reCAPTCHA v3 on OTP request endpoint |
| Fake mobile client | Custom script impersonating app | App Check requires genuine APK on real device |
| Bot signup | Automated account creation | reCAPTCHA v3 on signup completion endpoint |
| Session token forgery | Create fake session tokens | Tokens are HMAC-signed with server secret; server validates signature |
| 2FA bypass (web) | Steal static mobile token | Session token required (not static token); session token requires App Check |
| Timing attack on token | Measure response time to guess token char-by-char | `hmac.compare_digest()` used for all constant-time comparisons |
| CORS credential theft | Malicious site making authenticated requests | `DEBUG=False` in production; explicit `CORS_ALLOWED_ORIGINS` list |
| Debug information exposure | Log monitoring / scraping | All `print()` debug statements removed |

### Residual Risks

| Risk | Severity | Status |
|------|----------|--------|
| Rate limiting on auth endpoints | Medium | Not implemented — recommended for future |
| Rooted device usage | Low | App Check rejects most rooted devices; App Attest is stricter |
| `MOBILE_API_TOKEN` rotation | Low | Manual process — no automated rotation |
| Swagger/ReDoc publicly accessible | Low | Exposes API structure; acceptable for internal deployment |

---

## 14. Setup & Deployment Checklist

### Backend

- [ ] Set `FIREBASE_PROJECT_NUMBER=1078964414120` in `.env.docker`
- [ ] Set strong `SECRET_KEY` (generated with `secrets.token_urlsafe(48)`)
- [ ] Set strong `MOBILE_API_TOKEN` (generated with `secrets.token_urlsafe(48)`)
- [ ] Set `RECAPTCHA_SECRET_KEY=6LdI7wwtAAAAANbHJIou_F3bxC04FPtN5W3eCvQs`
- [ ] Set `DEBUG=False` in `.env.docker`
- [ ] Verify `ALLOWED_HOSTS` includes production domain
- [ ] Verify `CORS_ALLOWED_ORIGINS` includes only trusted origins

### Frontend

- [ ] Set `VITE_RECAPTCHA_SITE_KEY=6LdI7wwtAAAAACD2RewXmRaDFQffP1HQMXkckCqx` in `frontend/.env`
- [ ] Verify reCAPTCHA domain is registered at [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin)
- [ ] Build with `npm run build` — confirm `VITE_RECAPTCHA_SITE_KEY` is embedded

### Mobile App (Android)

- [ ] Download `google-services.json` from Firebase Console
- [ ] Place at `android/app/google-services.json`
- [ ] Enable **App Check** in Firebase Console → App Check → Apps → Android app
- [ ] Select **Play Integrity** as the provider
- [ ] Run `flutter pub get`
- [ ] Build release APK: `flutter build apk --release`

### Mobile App (iOS)

- [ ] Download `GoogleService-Info.plist` from Firebase Console
- [ ] Place at `ios/Runner/GoogleService-Info.plist`
- [ ] Enable **App Check** in Firebase Console → App Check → Apps → iOS app
- [ ] Select **App Attest** as the provider
- [ ] Run `flutter pub get`
- [ ] Build: `flutter build ios --release`

### Firebase Console

- [ ] Create project at [console.firebase.google.com](https://console.firebase.google.com)
- [ ] Register Android app with package ID: `np.com.ntc.dutychart.duty_chart_mobile`
- [ ] Register iOS app with bundle ID (from Xcode)
- [ ] Enable App Check for both apps
- [ ] Set enforcement mode to **Enforced** (not just monitoring) after testing

---

## 15. Troubleshooting

### `App integrity check failed` on mobile auth

**Cause:** Firebase App Check token verification failed.

**Check:**
1. `FIREBASE_PROJECT_NUMBER` in `.env.docker` matches the Firebase project
2. `google-services.json` / `GoogleService-Info.plist` are present and correct
3. App Check is enabled in Firebase Console for the app
4. Device is not rooted / jailbroken
5. App is installed from Play Store / App Store (not sideloaded) in production

**Dev workaround:** Leave `FIREBASE_PROJECT_NUMBER` empty — backend falls back to static token check.

---

### `Mobile API not configured` (503)

**Cause:** `MOBILE_API_TOKEN` is not set in the environment.

**Fix:** Add `MOBILE_API_TOKEN=<value>` to `.env.docker` and restart the backend.

---

### reCAPTCHA verification failed (web)

**Cause:** reCAPTCHA token is invalid, expired, or the domain is not registered.

**Check:**
1. Domain is registered in [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. `VITE_RECAPTCHA_SITE_KEY` in `frontend/.env` matches the site key
3. `RECAPTCHA_SECRET_KEY` in backend `.env` matches the secret key
4. Frontend is sending `recaptcha_token` in the request body

**Dev workaround:** Leave `RECAPTCHA_SECRET_KEY` empty — backend skips verification.

---

### Session token expired mid-session

**Cause:** The 1-hour session token expired and was not refreshed.

**Expected behavior:** `MobileSessionService` automatically refreshes the token 5 minutes before expiry. If a request fails with 401, the `onUnauthorized` callback triggers logout.

**Check:** Verify device clock is accurate — token expiry uses server-side timestamps.

---

### `X-Mobile-Session-Token` missing from requests

**Cause:** `MobileSessionService` failed to obtain a session token (Firebase unreachable, network error).

**Effect:** Mobile endpoints that require the session token will return 403. Login will proceed with 2FA instead of bypassing it.

**Check:** Logcat / Xcode console for errors from `MobileSessionService._refreshSessionToken()`.

---

*Document prepared by: Claude Code (Anthropic)*  
*Last updated: 2026-06-04*
