# Duty Chart Management System - Architecture Diagrams

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Database Entity Relationship Diagram](#database-entity-relationship-diagram)
3. [API Request Flow](#api-request-flow)
4. [Authentication Flow](#authentication-flow)
5. [Component Hierarchy](#component-hierarchy)

---

## 1. System Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Web Browser                                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
│  │  │   React    │  │ TailwindCSS│  │  TypeScript│             │  │
│  │  │  (v18.3)   │  │  + shadcn  │  │            │             │  │
│  │  └────────────┘  └────────────┘  └────────────┘             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/HTTPS
                                │ REST API + JWT
                                │
┌────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Django + DRF                               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
│  │  │   Views    │  │Serializers │  │Permissions │             │  │
│  │  └────────────┘  └────────────┘  └────────────┘             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
│  │  │   Models   │  │ Middleware │  │   Admin    │             │  │
│  │  └────────────┘  └────────────┘  └────────────┘             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                │ ORM (Django)
                                │
┌────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
│  │  │   Users    │  │    Org     │  │   Duties   │             │  │
│  │  └────────────┘  └────────────┘  └────────────┘             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Entity Relationship Diagram

### Complete ERD

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USERS & RBAC                                  │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │      Position        │
    ├──────────────────────┤
    │ PK: id               │
    │     name             │
    │     level (1-12)     │
    └──────────────────────┘
              ▲
              │ FK
              │
    ┌─────────┴────────────────────────────────────────────┐
    │                    User                               │
    ├───────────────────────────────────────────────────────┤
    │ PK: id                                                │
    │     username                                          │
    │     email (unique) ← USERNAME_FIELD                   │
    │     password                                          │
    │     employee_id (unique)                              │
    │     full_name                                         │
    │     phone_number                                      │
    │     image                                             │
    │     role (SUPERADMIN|OFFICE_ADMIN|USER)              │
    │ FK: position_id                                       │
    │ FK: office_id (primary)                               │
    │ FK: department_id                                     │
    │ FK: directorate_id                                    │
    │ M2M: secondary_offices                                │
    └───────────────────────────────────────────────────────┘
              │                    │
              │                    │ M2M
              │                    ▼
              │          ┌──────────────────────┐
              │          │  UserPermission      │
              │          ├──────────────────────┤
              │          │ PK: id               │
              │          │ FK: user_id          │
              │          │ FK: permission_id    │
              │          │     created_at       │
              │          └──────────────────────┘
              │                    │
              │                    │
              │                    ▼
    ┌─────────┴────────────┐  ┌──────────────────────┐
    │       Role           │  │    Permission        │
    ├──────────────────────┤  ├──────────────────────┤
    │ PK: id               │  │ PK: id               │
    │     slug (unique)    │  │     slug (unique)    │
    │     name             │  │     name             │
    │     is_active        │  │     description      │
    │     created_at       │  │     is_active        │
    │     updated_at       │  │     created_at       │
    └──────────────────────┘  │     updated_at       │
              │               └──────────────────────┘
              │ M2M                   ▲
              │                       │
              ▼                       │
    ┌──────────────────────┐         │
    │  RolePermission      │─────────┘
    ├──────────────────────┤
    │ PK: id               │
    │ FK: role_id          │
    │ FK: permission_id    │
    │     created_at       │
    └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      ORGANIZATIONAL HIERARCHY                            │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │    Directorate       │
    ├──────────────────────┤
    │ PK: id               │
    │     name             │
    └──────────────────────┘
              │
              │ 1:N
              ▼
    ┌──────────────────────┐
    │    Department        │
    ├──────────────────────┤
    │ PK: id               │
    │     name             │
    │ FK: directorate_id   │
    └──────────────────────┘
              │
              │ 1:N
              ▼
    ┌──────────────────────┐
    │      Office          │
    ├──────────────────────┤
    │ PK: id               │
    │     name             │
    │ FK: department_id    │
    └──────────────────────┘
              │
              │ Referenced by User, DutyChart, Schedule
              │

┌─────────────────────────────────────────────────────────────────────────┐
│                         DUTY MANAGEMENT                                  │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐         ┌──────────────────────┐
    │      Office          │         │     Schedule         │
    └──────────────────────┘         ├──────────────────────┤
              │                      │ PK: id               │
              │                      │     name             │
              │ FK                   │     start_time       │
              ▼                      │     end_time         │
    ┌──────────────────────┐         │     status           │
    │    DutyChart         │         │ FK: office_id        │
    ├──────────────────────┤         │     created_at       │
    │ PK: id               │         │     updated_at       │
    │     name             │         └──────────────────────┘
    │     effective_date   │                   ▲
    │     end_date         │                   │
    │ FK: office_id        │                   │ M2M
    │ M2M: schedules       │───────────────────┘
    └──────────────────────┘
              │
              │ 1:N
              ▼
    ┌──────────────────────────────────────────┐
    │              Duty                         │
    ├──────────────────────────────────────────┤
    │ PK: id                                    │
    │ FK: user_id                               │
    │ FK: office_id                             │
    │ FK: schedule_id                           │
    │ FK: duty_chart_id                         │
    │     date                                  │
    │     is_completed                          │
    │     currently_available                   │
    │                                           │
    │ UNIQUE: (user, duty_chart, date, schedule)│
    └──────────────────────────────────────────┘
              ▲
              │ FK
              │
    ┌─────────┴────────────┐
    │       User           │
    └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    ROSTER & DOCUMENTS                                    │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │        RosterAssignment                   │
    ├──────────────────────────────────────────┤
    │ PK: id                                    │
    │     status                                │
    │     start_date                            │
    │     end_date                              │
    │     start_time                            │
    │     end_time                              │
    │     shift                                 │
    │     employee_name                         │
    │     phone_number                          │
    │     office                                │
    │     created_at                            │
    │     updated_at                            │
    │                                           │
    │ UNIQUE: (employee_name, office,          │
    │          start_date, end_date,           │
    │          start_time, end_time, shift)    │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │           Document                        │
    ├──────────────────────────────────────────┤
    │ PK: id (UUID)                             │
    │     file                                  │
    │     filename                              │
    │     content_type                          │
    │     size                                  │
    │     checksum (SHA-256, unique)           │
    │ FK: uploaded_by (User)                    │
    │     uploaded_at                           │
    │     description                           │
    └──────────────────────────────────────────┘

    ┌──────────────────────┐
    │    RosterShift       │
    ├──────────────────────┤
    │ PK: id               │
    │     name (unique)    │
    └──────────────────────┘
```

---

## 3. API Request Flow

### Typical API Request Lifecycle

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. HTTP Request
       │    GET /api/v1/duty-charts/
       │    Authorization: Bearer <JWT>
       │
       ▼
┌──────────────────────────────────────┐
│         Django Middleware            │
├──────────────────────────────────────┤
│  1. SecurityMiddleware               │
│  2. SessionMiddleware                │
│  3. CorsMiddleware ← CORS Check      │
│  4. CommonMiddleware                 │
│  5. CsrfViewMiddleware               │
│  6. AuthenticationMiddleware         │
│     └─> JWTAuthentication            │
│         └─> Decode & Validate Token  │
│         └─> Set request.user         │
│  7. MessageMiddleware                │
└──────┬───────────────────────────────┘
       │
       │ 2. Route to View
       │
       ▼
┌──────────────────────────────────────┐
│         URL Dispatcher               │
│  config/urls.py                      │
│    └─> router.urls                   │
│        └─> DutyChartViewSet          │
└──────┬───────────────────────────────┘
       │
       │ 3. Permission Check
       │
       ▼
┌──────────────────────────────────────┐
│    DutyChartViewSet.list()           │
│  permission_classes = [AdminOrReadOnly]│
├──────────────────────────────────────┤
│  1. Check permissions                │
│     └─> AdminOrReadOnly.has_permission()│
│         ├─> If GET: IsAuthenticated  │
│         └─> If POST: IsSuperAdmin or │
│                      IsOfficeAdmin   │
│                                      │
│  2. Get queryset                     │
│     └─> get_queryset()               │
│         └─> Filter by office scope   │
│                                      │
│  3. Serialize data                   │
│     └─> DutyChartSerializer          │
│         └─> to_representation()      │
└──────┬───────────────────────────────┘
       │
       │ 4. Database Query
       │
       ▼
┌──────────────────────────────────────┐
│         Django ORM                   │
│  DutyChart.objects.filter(...)       │
│    .select_related('office')         │
│    .prefetch_related('schedules')    │
└──────┬───────────────────────────────┘
       │
       │ 5. SQL Query
       │
       ▼
┌──────────────────────────────────────┐
│       PostgreSQL Database            │
│  SELECT * FROM duties_dutychart      │
│  LEFT JOIN org_office ...            │
└──────┬───────────────────────────────┘
       │
       │ 6. Return Results
       │
       ▼
┌──────────────────────────────────────┐
│      Serializer Processing           │
│  DutyChartSerializer.to_representation()│
│    └─> Convert model to dict         │
│    └─> Add related data              │
│    └─> Format dates/times            │
└──────┬───────────────────────────────┘
       │
       │ 7. JSON Response
       │
       ▼
┌──────────────────────────────────────┐
│      DRF Response Renderer           │
│  JSONRenderer.render()               │
│    └─> Convert to JSON               │
│    └─> Set Content-Type              │
└──────┬───────────────────────────────┘
       │
       │ 8. HTTP Response
       │    Status: 200 OK
       │    Content-Type: application/json
       │    Body: [{...}, {...}]
       │
       ▼
┌─────────────┐
│   Client    │
│  (Browser)  │
└─────────────┘
```

---

## 4. Authentication Flow

### Login & Token Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                      INITIAL LOGIN                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /api/token/
       │    {
       │      "email": "user@example.com",
       │      "password": "password123"
       │    }
       │
       ▼
┌──────────────────────────────────────┐
│   TokenObtainPairView                │
│   (rest_framework_simplejwt)         │
└──────┬───────────────────────────────┘
       │
       │ 2. Authenticate user
       │
       ▼
┌──────────────────────────────────────┐
│   Django Authentication Backend      │
│   User.objects.get(email=...)        │
│   check_password(password)           │
└──────┬───────────────────────────────┘
       │
       │ 3. If valid, generate tokens
       │
       ▼
┌──────────────────────────────────────┐
│   JWT Token Generation               │
│   ┌────────────────────────────────┐ │
│   │  Access Token (60 min)         │ │
│   │  {                             │ │
│   │    "token_type": "access",     │ │
│   │    "exp": 1706345678,          │ │
│   │    "user_id": 1                │ │
│   │  }                             │ │
│   └────────────────────────────────┘ │
│   ┌────────────────────────────────┐ │
│   │  Refresh Token (1 day)         │ │
│   │  {                             │ │
│   │    "token_type": "refresh",    │ │
│   │    "exp": 1706432078,          │ │
│   │    "user_id": 1                │ │
│   │  }                             │ │
│   └────────────────────────────────┘ │
└──────┬───────────────────────────────┘
       │
       │ 4. Return tokens
       │    {
       │      "access": "eyJ0eXAi...",
       │      "refresh": "eyJ0eXAi..."
       │    }
       │
       ▼
┌─────────────┐
│   Client    │
│  Store in   │
│ localStorage│
└─────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATED REQUEST                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. GET /api/v1/duty-charts/
       │    Authorization: Bearer eyJ0eXAi...
       │
       ▼
┌──────────────────────────────────────┐
│   JWTAuthentication Middleware       │
└──────┬───────────────────────────────┘
       │
       │ 2. Extract token from header
       │
       ▼
┌──────────────────────────────────────┐
│   Decode & Validate JWT              │
│   ┌────────────────────────────────┐ │
│   │ 1. Check signature             │ │
│   │ 2. Check expiration            │ │
│   │ 3. Extract user_id             │ │
│   └────────────────────────────────┘ │
└──────┬───────────────────────────────┘
       │
       │ 3. Load user from database
       │
       ▼
┌──────────────────────────────────────┐
│   User.objects.get(id=user_id)       │
│   Set request.user                   │
└──────┬───────────────────────────────┘
       │
       │ 4. Proceed to view
       │
       ▼
┌──────────────────────────────────────┐
│   View processes request             │
│   with authenticated user            │
└──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    TOKEN REFRESH                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Client    │
│ (Access token│
│  expired)    │
└──────┬──────┘
       │
       │ 1. POST /api/token/refresh/
       │    {
       │      "refresh": "eyJ0eXAi..."
       │    }
       │
       ▼
┌──────────────────────────────────────┐
│   TokenRefreshView                   │
└──────┬───────────────────────────────┘
       │
       │ 2. Validate refresh token
       │
       ▼
┌──────────────────────────────────────┐
│   Generate new access token          │
│   {                                  │
│     "access": "eyJ0eXAi..."          │
│   }                                  │
└──────┬───────────────────────────────┘
       │
       │ 3. Return new access token
       │
       ▼
┌─────────────┐
│   Client    │
│  Update     │
│ localStorage│
└─────────────┘
```

---

## 5. Component Hierarchy

### Frontend Component Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                            App.tsx                                   │
│                         (Root Component)                             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│    AuthProvider           │   │    ThemeProvider          │
│    (Context)              │   │    (next-themes)          │
└───────────────────────────┘   └───────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Router (react-router-dom)                     │
└─────────────────────────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Login  │ │Dashboard│ │ Users  │ │ Duties │ │Reports │
│ Page   │ │  Page   │ │  Page  │ │  Page  │ │  Page  │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
                │
                │ Uses Layout
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DashboardLayout                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────────────────────────────────────────────┐  │
│  │   Sidebar    │  │           Main Content Area                │  │
│  │              │  │  ┌──────────────────────────────────────┐  │  │
│  │ ┌──────────┐ │  │  │           Header                     │  │  │
│  │ │Navigation│ │  │  └──────────────────────────────────────┘  │  │
│  │ │  Items   │ │  │  ┌──────────────────────────────────────┐  │  │
│  │ └──────────┘ │  │  │         Page Content                 │  │  │
│  │              │  │  │  (Children components)               │  │  │
│  │ ┌──────────┐ │  │  └──────────────────────────────────────┘  │  │
│  │ │  User    │ │  │                                            │  │
│  │ │  Menu    │ │  │                                            │  │
│  │ └──────────┘ │  │                                            │  │
│  └──────────────┘  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Duty Chart Page Component Tree

```
DutyChartsPage
├── PageHeader
│   ├── Title
│   └── CreateButton
│       └── Dialog
│           └── DutyChartForm
│               ├── OfficeSelect
│               ├── DatePicker (effective_date)
│               ├── DatePicker (end_date)
│               └── ScheduleMultiSelect
│
├── FilterBar
│   ├── OfficeFilter
│   └── DateRangeFilter
│
└── DutyChartTable
    ├── TableHeader
    │   ├── ColumnHeader (Office)
    │   ├── ColumnHeader (Effective Date)
    │   ├── ColumnHeader (End Date)
    │   └── ColumnHeader (Actions)
    │
    └── TableBody
        └── DutyChartRow (for each duty chart)
            ├── OfficeCell
            ├── DateCell
            ├── DateCell
            └── ActionsCell
                ├── ViewButton
                ├── EditButton
                │   └── Dialog
                │       └── DutyChartForm
                └── DeleteButton
                    └── AlertDialog
```

---

## 6. Data Flow Diagrams

### Duty Creation Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                                │
└─────────────────────────────────────────────────────────────────────┘

User clicks "Create Duty"
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  1. Open DutyForm dialog                                            │
│  2. Load dropdown options:                                          │
│     ├─> GET /api/v1/users/ (for user select)                       │
│     ├─> GET /api/v1/duty-charts/ (for duty chart select)           │
│     └─> GET /api/v1/schedule/ (for schedule select)                │
│                                                                      │
│  3. User fills form:                                                │
│     ├─> Select User                                                 │
│     ├─> Select Duty Chart                                           │
│     ├─> Select Schedule                                             │
│     ├─> Pick Date                                                   │
│     └─> Set flags (is_completed, currently_available)              │
│                                                                      │
│  4. Form validation (Zod schema)                                    │
│     └─> If invalid: Show errors                                     │
│                                                                      │
│  5. Submit form                                                      │
│     └─> POST /api/v1/duties/                                        │
│         {                                                            │
│           "user": 1,                                                 │
│           "duty_chart": 1,                                           │
│           "schedule": 1,                                             │
│           "date": "2025-01-27",                                      │
│           "is_completed": false,                                     │
│           "currently_available": true                                │
│         }                                                            │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ HTTP POST
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Django + DRF)                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. DutyViewSet.create()                                            │
│     └─> Check permissions (AdminOrReadOnly)                         │
│         └─> If not admin: Return 403 Forbidden                      │
│                                                                      │
│  2. DutySerializer.validate()                                       │
│     ├─> Check user exists                                           │
│     ├─> Check duty_chart exists                                     │
│     ├─> Check schedule exists                                       │
│     ├─> Validate date is within duty_chart period                   │
│     └─> Check uniqueness (user, duty_chart, date, schedule)        │
│         └─> If duplicate: Return 400 Bad Request                    │
│                                                                      │
│  3. DutySerializer.create()                                         │
│     └─> Create Duty instance                                        │
│         ├─> Set user_id                                             │
│         ├─> Set duty_chart_id                                       │
│         ├─> Set schedule_id                                         │
│         ├─> Set office_id (from duty_chart)                         │
│         └─> Set date, flags                                         │
│                                                                      │
│  4. Duty.save()                                                     │
│     └─> Run model validation (clean())                              │
│         └─> If invalid: Raise ValidationError                       │
│                                                                      │
│  5. Database INSERT                                                  │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ SQL INSERT
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                             │
├─────────────────────────────────────────────────────────────────────┤
│  INSERT INTO duties_duty (                                          │
│    user_id, duty_chart_id, schedule_id, office_id,                 │
│    date, is_completed, currently_available                          │
│  ) VALUES (1, 1, 1, 1, '2025-01-27', false, true)                   │
│                                                                      │
│  RETURNING id;                                                       │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ Return created record
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Django + DRF)                            │
├─────────────────────────────────────────────────────────────────────┤
│  6. DutySerializer.to_representation()                              │
│     └─> Convert model to dict                                       │
│         ├─> Include user details                                    │
│         ├─> Include schedule details                                │
│         └─> Format date                                             │
│                                                                      │
│  7. Return Response                                                  │
│     └─> Status: 201 Created                                         │
│         Body: {                                                      │
│           "id": 123,                                                 │
│           "user": {...},                                             │
│           "duty_chart": 1,                                           │
│           "schedule": {...},                                         │
│           "date": "2025-01-27",                                      │
│           ...                                                        │
│         }                                                            │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ HTTP Response
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  8. Handle response                                                  │
│     ├─> Close dialog                                                │
│     ├─> Show success toast                                          │
│     ├─> Invalidate query cache (React Query)                        │
│     └─> Refetch duties list                                         │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      USER SEES UPDATED LIST                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Permission & Authorization Flow

### Permission Check Decision Tree

```
                    ┌─────────────────────┐
                    │  Request arrives    │
                    │  at protected view  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Is user            │
                    │  authenticated?     │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                   No                    Yes
                    │                     │
                    ▼                     ▼
            ┌──────────────┐   ┌─────────────────────┐
            │ Return 401   │   │ Check request       │
            │ Unauthorized │   │ method              │
            └──────────────┘   └──────────┬──────────┘
                                          │
                               ┌──────────┴──────────┐
                               │                     │
                        SAFE_METHODS          UNSAFE_METHODS
                        (GET, HEAD,           (POST, PUT,
                         OPTIONS)              PATCH, DELETE)
                               │                     │
                               ▼                     ▼
                    ┌─────────────────────┐   ┌─────────────────────┐
                    │ Allow (Read-only)   │   │ Check user role     │
                    └─────────────────────┘   └──────────┬──────────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          │              │              │
                                    SUPERADMIN    OFFICE_ADMIN        USER
                                          │              │              │
                                          ▼              ▼              ▼
                                  ┌──────────┐   ┌──────────────┐  ┌──────────┐
                                  │  Allow   │   │ Check office │  │ Deny 403 │
                                  │  All     │   │ scope        │  │ Forbidden│
                                  └──────────┘   └──────┬───────┘  └──────────┘
                                                        │
                                             ┌──────────┴──────────┐
                                             │                     │
                                        In scope              Out of scope
                                             │                     │
                                             ▼                     ▼
                                      ┌──────────┐         ┌──────────┐
                                      │  Allow   │         │ Deny 403 │
                                      └──────────┘         │ Forbidden│
                                                           └──────────┘
```

---

## 8. Bulk Upload Process Flow

### Excel Roster Upload

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USER UPLOADS FILE                               │
└─────────────────────────────────────────────────────────────────────┘

User selects roster.xlsx file
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                          │
│  POST /api/v1/roster-bulk-upload/                                   │
│  Content-Type: multipart/form-data                                  │
│  Body: {file: <binary data>}                                        │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND - RosterBulkUploadView                    │
├─────────────────────────────────────────────────────────────────────┤
│  Step 1: Validate file extension                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ if not file.name.endswith(('.xls', '.xlsx')):                 │ │
│  │     return 400 "Invalid file type"                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Step 2: Read Excel file                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ import pandas as pd                                            │ │
│  │ df = pd.read_excel(file)                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Step 3: Validate headers                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ REQUIRED_HEADERS = [                                           │ │
│  │   "Start Date", "End Date", "Employee Name",                   │ │
│  │   "Start Time", "End Time", "Shift",                           │ │
│  │   "Phone no.", "Office"                                        │ │
│  │ ]                                                               │ │
│  │                                                                 │ │
│  │ if not all(h in df.columns for h in REQUIRED_HEADERS):        │ │
│  │     return 400 "Missing required columns"                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Step 4: Process each row                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ created, skipped, errors = 0, 0, []                            │ │
│  │                                                                 │ │
│  │ for index, row in df.iterrows():                               │ │
│  │     try:                                                        │ │
│  │         # Map columns to model fields                          │ │
│  │         data = {                                                │ │
│  │             'start_date': parse_date(row['Start Date']),       │ │
│  │             'end_date': parse_date(row['End Date']),           │ │
│  │             'employee_name': row['Employee Name'],             │ │
│  │             'start_time': parse_time(row['Start Time']),       │ │
│  │             'end_time': parse_time(row['End Time']),           │ │
│  │             'shift': row['Shift'],                             │ │
│  │             'phone_number': row['Phone no.'],                  │ │
│  │             'office': row['Office']                            │ │
│  │         }                                                       │ │
│  │                                                                 │ │
│  │         # Validate and create                                  │ │
│  │         serializer = RosterAssignmentSerializer(data=data)     │ │
│  │         if serializer.is_valid():                              │ │
│  │             serializer.save()                                  │ │
│  │             created += 1                                        │ │
│  │         else:                                                   │ │
│  │             errors.append({                                     │ │
│  │                 'row': index + 2,  # Excel row (1-indexed + header)│ │
│  │                 'errors': serializer.errors                    │ │
│  │             })                                                  │ │
│  │             skipped += 1                                        │ │
│  │                                                                 │ │
│  │     except Exception as e:                                      │ │
│  │         errors.append({                                         │ │
│  │             'row': index + 2,                                   │ │
│  │             'error': str(e)                                     │ │
│  │         })                                                      │ │
│  │         skipped += 1                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Step 5: Return summary                                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ return Response({                                              │ │
│  │     'created': created,                                        │ │
│  │     'skipped': skipped,                                        │ │
│  │     'errors': errors                                           │ │
│  │ })                                                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                          │
│  Display summary:                                                    │
│  ✓ Created: 48 records                                              │
│  ⚠ Skipped: 2 records                                               │
│  ✗ Errors: [...]                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

**End of Architecture Diagrams**
