# Duty Chart Management System - Technical Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Models](#database-models)
4. [API Endpoints](#api-endpoints)
5. [Code Flow](#code-flow)
6. [Authentication & Authorization](#authentication--authorization)
7. [Frontend Architecture](#frontend-architecture)
8. [Deployment](#deployment)

---

## 1. System Overview

**DutyChart** is a comprehensive web application designed to manage and streamline duty scheduling and administrative tasks for Nepal Telecom Company Limited. The system allows administrators to create duty charts, assign employees to shifts, manage organizational hierarchies, and generate reports.

### Key Features
- **User Management**: Role-based access control (RBAC) with SuperAdmin, Office Admin, and User roles
- **Organizational Hierarchy**: Three-tier structure (Directorate → Department → Office)
- **Duty Scheduling**: Create and manage duty charts with shift assignments
- **Bulk Operations**: Excel-based bulk upload for roster assignments
- **Reporting**: Generate duty reports in DOCX format (अनुसूची-१)
- **Document Management**: Upload and manage documents with deduplication

### Technology Stack

**Backend:**
- Django 5.0.2
- Django REST Framework (DRF)
- PostgreSQL Database
- JWT Authentication (Simple JWT)
- Swagger/OpenAPI Documentation (drf-yasg)

**Frontend:**
- React 18.3.1
- TypeScript
- Vite (Build Tool)
- TailwindCSS + shadcn/ui
- React Router v6
- TanStack Query (React Query)
- Axios

---

## 2. Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Pages    │  │ Components │  │  Services  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTP/REST API (JWT)
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Django + DRF)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Views    │  │Serializers │  │Permissions │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Models   │  │    URLs    │  │   Admin    │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            │
                    PostgreSQL Database
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Database Schema                         │
│  Users | Org | Duties | Reports | Documents                 │
└─────────────────────────────────────────────────────────────┘
```

### Django Apps Structure

```
backend/
├── config/              # Project settings and main URLs
├── users/               # User management and RBAC
├── org/                 # Organizational hierarchy
├── duties/              # Duty chart and scheduling
├── reports/             # Report generation
└── authentication/      # JWT authentication endpoints
```

---

## 3. Database Models

### 3.1 Users App Models

#### **User Model** (Custom User)
Extends Django's `AbstractUser` with additional fields.

```python
class User(AbstractUser):
    employee_id: CharField (unique)
    full_name: CharField
    email: EmailField (unique, USERNAME_FIELD)
    phone_number: CharField
    image: ImageField (optional)
    role: CharField (SUPERADMIN | OFFICE_ADMIN | USER)
    
    # Foreign Keys
    office: ForeignKey → Office
    secondary_offices: ManyToManyField → Office
    department: ForeignKey → Department
    directorate: ForeignKey → Directorate
    position: ForeignKey → Position
```

**Relationships:**
- One-to-Many with Office (primary office)
- Many-to-Many with Office (secondary offices)
- One-to-Many with Department
- One-to-Many with Directorate
- One-to-Many with Position

**Validation:**
- Department must belong to selected Directorate
- Office must belong to selected Department

---

#### **Position Model**
Defines employee positions with hierarchy levels.

```python
class Position(models.Model):
    name: CharField
    level: IntegerField (1-12)
```

---

#### **Permission Model** (RBAC)
Defines granular permissions for the system.

```python
class Permission(models.Model):
    slug: CharField (unique)
    name: CharField
    description: TextField
    is_active: BooleanField
    created_at: DateTimeField
    updated_at: DateTimeField
```

---

#### **Role Model** (RBAC)
Defines user roles with associated permissions.

```python
class Role(models.Model):
    slug: CharField (unique)
    name: CharField
    is_active: BooleanField
    created_at: DateTimeField
    updated_at: DateTimeField
```

---

#### **RolePermission Model**
Many-to-Many relationship between Roles and Permissions.

```python
class RolePermission(models.Model):
    role: ForeignKey → Role
    permission: ForeignKey → Permission
    created_at: DateTimeField
    
    # Unique constraint: (role, permission)
```

---

#### **UserPermission Model**
Direct permission assignments to users (overrides role permissions).

```python
class UserPermission(models.Model):
    user: ForeignKey → User
    permission: ForeignKey → Permission
    created_at: DateTimeField
    
    # Unique constraint: (user, permission)
```

---

### 3.2 Org App Models

#### **Directorate Model**
Top-level organizational unit.

```python
class Directorate(models.Model):
    name: CharField
```

---

#### **Department Model**
Mid-level organizational unit under Directorate.

```python
class Department(models.Model):
    name: CharField
    directorate: ForeignKey → Directorate
```

---

#### **Office Model**
Lowest-level organizational unit under Department.

```python
class Office(models.Model):
    name: CharField
    department: ForeignKey → Department
```

**Organizational Hierarchy:**
```
Directorate (1)
    └── Department (N)
            └── Office (N)
```

---

### 3.3 Duties App Models

#### **DutyChart Model**
Represents a duty chart for an office covering a specific period.

```python
class DutyChart(models.Model):
    office: ForeignKey → Office
    effective_date: DateField
    end_date: DateField (optional)
    name: CharField (optional)
    schedules: ManyToManyField → Schedule
```

**Validation:**
- `end_date` must be after `effective_date`

**String Representation:**
```
"Kathmandu Office – 2025-01-01 to 2025-03-31 (Incident Response)"
```

---

#### **Schedule Model**
Defines shift schedules (e.g., Morning Shift, Night Duty).

```python
class Schedule(models.Model):
    name: CharField
    office: ForeignKey → Office (optional)
    start_time: TimeField
    end_time: TimeField
    status: CharField (default: "pending")
    created_at: DateTimeField
    updated_at: DateTimeField
    
    # Unique constraint: (name, office, start_time, end_time)
```

**Validation:**
- `end_time` must be after `start_time`

---

#### **Duty Model**
Individual duty assignment for a user on a specific date.

```python
class Duty(models.Model):
    user: ForeignKey → User
    office: ForeignKey → Office
    schedule: ForeignKey → Schedule
    duty_chart: ForeignKey → DutyChart
    date: DateField
    is_completed: BooleanField (default: False)
    currently_available: BooleanField (default: True)
    
    # Unique constraint: (user, duty_chart, date, schedule)
```

**Validation:**
- Duty date must be within duty_chart's effective period
- Date must be >= `duty_chart.effective_date`
- Date must be <= `duty_chart.end_date` (if set)

---

#### **RosterAssignment Model**
Temporary storage for bulk-uploaded roster data.

```python
class RosterAssignment(models.Model):
    status: CharField (default: "pending")
    start_date: DateField (optional)
    end_date: DateField (optional)
    start_time: TimeField
    end_time: TimeField
    shift: CharField
    employee_name: CharField
    phone_number: CharField (optional)
    office: CharField (optional)
    created_at: DateTimeField
    updated_at: DateTimeField
    
    # Unique constraint: (employee_name, office, start_date, 
    #                     end_date, start_time, end_time, shift)
```

**Validation:**
- `end_date` cannot be before `start_date`
- `end_time` must be after `start_time` on same day
- Phone number must match Nepal format: `+977XXXXXXXXXX`

---

#### **RosterShift Model**
Predefined shift names.

```python
class RosterShift(models.Model):
    name: CharField (unique)
```

---

#### **Document Model**
File uploads with deduplication via SHA-256 checksum.

```python
class Document(models.Model):
    id: UUIDField (primary key)
    file: FileField
    filename: CharField
    content_type: CharField
    size: PositiveIntegerField
    checksum: CharField (unique, SHA-256)
    uploaded_by: ForeignKey → User
    uploaded_at: DateTimeField
    description: TextField
```

**Features:**
- Automatic checksum calculation
- Deduplication based on checksum
- File size validation (max 50MB by default)

---

### 3.4 Reports App Models

The reports app reuses models from `org` app (Directorate, Department, Office) for organizational filtering in reports.

---

## 4. API Endpoints

### Base URL
- **Development**: `http://localhost:8000/api/v1/`
- **Production**: `http://10.26.204.149:8000/api/v1/`

### 4.1 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token/` | Obtain JWT access & refresh tokens |
| POST | `/api/token/refresh/` | Refresh access token |
| POST | `/api/token/verify/` | Verify token validity |
| GET | `/api/v1/auth/me/` | Get current user details |

**Token Obtain Request:**
```json
{
  "email": "admin-dutychart@ntc.net.np",
  "password": "pass123pass"
}
```

**Token Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Me Endpoint Response:**
```json
{
  "id": 1,
  "full_name": "Buddhi Krishna Thapa",
  "email": "admin-dutychart@ntc.net.np",
  "employee_id": "7816",
  "is_staff": true,
  "role": "SUPERADMIN",
  "office_id": 1,
  "secondary_offices": [2, 3],
  "permissions": ["system.manage_rbac", "duty.create", ...]
}
```

---

### 4.2 User Management Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/users/` | List all users | Authenticated |
| POST | `/api/v1/users/` | Create user | Admin |
| GET | `/api/v1/users/{id}/` | Get user details | Authenticated |
| PUT/PATCH | `/api/v1/users/{id}/` | Update user | Admin |
| DELETE | `/api/v1/users/{id}/` | Delete user | Admin |

**Query Parameters:**
- `office={office_id}` - Filter by office (includes secondary offices)

---

### 4.3 Organization Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/directorates/` | List directorates | Authenticated |
| POST | `/api/v1/directorates/` | Create directorate | SuperAdmin |
| GET | `/api/v1/departments/` | List departments | Authenticated |
| GET | `/api/v1/departments/?directorate={id}` | Filter by directorate | Authenticated |
| GET | `/api/v1/offices/` | List offices | Authenticated |
| GET | `/api/v1/offices/?department={id}` | Filter by department | Authenticated |

---

### 4.4 Duty Management Endpoints

#### Duty Charts

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/duty-charts/` | List duty charts | Authenticated |
| POST | `/api/v1/duty-charts/` | Create duty chart | Admin |
| GET | `/api/v1/duty-charts/{id}/` | Get duty chart | Authenticated |
| PUT/PATCH | `/api/v1/duty-charts/{id}/` | Update duty chart | Admin |
| DELETE | `/api/v1/duty-charts/{id}/` | Delete duty chart | Admin |

**Query Parameters:**
- `office={office_id}` - Filter by office

---

#### Duties

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/duties/` | List duties | Authenticated |
| POST | `/api/v1/duties/` | Create duty | Admin |
| POST | `/api/v1/duties/bulk_upsert/` | Bulk create/update | Admin |
| POST | `/api/v1/duties/generate_rotation/` | Generate rotation | Admin |

**Query Parameters:**
- `duty_chart={id}` - Filter by duty chart
- `date={YYYY-MM-DD}` - Filter by date
- `date_from={YYYY-MM-DD}` - Filter from date
- `date_to={YYYY-MM-DD}` - Filter to date
- `user={user_id}` - Filter by user
- `schedule={schedule_id}` - Filter by schedule

**Bulk Upsert Request:**
```json
{
  "duties": [
    {
      "user": 1,
      "duty_chart": 1,
      "schedule": 1,
      "date": "2025-01-27",
      "is_completed": false
    }
  ]
}
```

**Generate Rotation Request:**
```json
{
  "duty_chart_id": 1,
  "schedule_id": 1,
  "user_ids": [1, 2, 3],
  "start_date": "2025-01-27",
  "end_date": "2025-02-27"
}
```

---

#### Schedules

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/schedule/` | List schedules | Authenticated |
| POST | `/api/v1/schedule/` | Create schedule | Admin |
| POST | `/api/v1/schedule/sync_from_roster/` | Sync from roster | Admin |

**Query Parameters:**
- `office={office_id}` - Filter by office
- `shift={shift_name}` - Filter by shift name

---

### 4.5 Bulk Upload Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/v1/bulk-upload/` | Upload documents | Admin |
| POST | `/api/v1/roster-bulk-upload/` | Upload roster Excel | Admin |

**Roster Bulk Upload:**
- Accepts `.xls` or `.xlsx` files
- Required columns: Start Date, End Date, Employee Name, Start Time, End Time, Shift, Phone no., Office
- Creates `RosterAssignment` records

---

### 4.6 Export Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/export/duty-chart/preview/` | Preview export (JSON) | Authenticated |
| GET | `/api/v1/export/duty-chart/file/` | Export to Excel/PDF | Authenticated |

**Query Parameters:**
- `duty_chart_id={id}` - Duty chart to export
- `date_from={YYYY-MM-DD}` - Start date
- `date_to={YYYY-MM-DD}` - End date
- `format={excel|pdf}` - Export format

---

### 4.7 Reports Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/reports/duties/options/` | Get duty chart options | Authenticated |
| GET | `/api/v1/reports/duties/preview/` | Preview report (JSON) | Authenticated |
| GET | `/api/v1/reports/duties/file/` | Download DOCX report | Authenticated |

**Preview Query Parameters:**
- `date_from={YYYY-MM-DD}`
- `date_to={YYYY-MM-DD}`
- `user_id[]={id}` or `user_id={id1,id2}`
- `duty_id={id}`
- `all_users=1` - Include all users

**File Download Query Parameters:**
- Same as preview
- Returns DOCX file (अनुसूची-१ format)

---

### 4.8 RBAC Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/v1/roles/` | List roles | Authenticated |
| POST | `/api/v1/roles/` | Create role | RBAC Manager |
| GET | `/api/v1/roles/{id}/permissions/` | Get role permissions | Authenticated |
| PUT | `/api/v1/roles/{id}/permissions/` | Update role permissions | RBAC Manager |
| GET | `/api/v1/permissions/` | List permissions | Authenticated |

---

## 5. Code Flow

### 5.1 User Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/token/
       │    {email, password}
       ▼
┌─────────────────────────┐
│  TokenObtainPairView    │
│  (Simple JWT)           │
└──────┬──────────────────┘
       │ 2. Validate credentials
       │    against User model
       ▼
┌─────────────────────────┐
│   User.objects.get()    │
│   (email=...)           │
└──────┬──────────────────┘
       │ 3. Generate JWT tokens
       │    (access + refresh)
       ▼
┌─────────────────────────┐
│  Return tokens to       │
│  client                 │
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Client stores tokens   │
│  (localStorage)         │
└─────────────────────────┘
       │
       │ 4. Subsequent requests
       │    Authorization: Bearer <token>
       ▼
┌─────────────────────────┐
│  JWTAuthentication      │
│  middleware validates   │
└─────────────────────────┘
```

---

### 5.2 Duty Chart Creation Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/v1/duty-charts/
       │    {office, effective_date, end_date, schedules}
       ▼
┌─────────────────────────────────┐
│  DutyChartViewSet.create()      │
│  Permission: AdminOrReadOnly    │
└──────┬──────────────────────────┘
       │ 2. Check permissions
       │    (SuperAdmin or OfficeAdmin)
       ▼
┌─────────────────────────────────┐
│  DutyChartSerializer.validate() │
│  - Check office exists          │
│  - Validate dates               │
└──────┬──────────────────────────┘
       │ 3. Validation passed
       ▼
┌─────────────────────────────────┐
│  DutyChartSerializer.create()   │
│  - Create DutyChart instance    │
│  - Set schedules (M2M)          │
└──────┬──────────────────────────┘
       │ 4. Save to database
       ▼
┌─────────────────────────────────┐
│  DutyChart.save()               │
│  - Run model validation         │
│  - Insert into DB               │
└──────┬──────────────────────────┘
       │ 5. Return serialized data
       ▼
┌─────────────────────────────────┐
│  Response with DutyChart JSON   │
└─────────────────────────────────┘
```

---

### 5.3 Bulk Roster Upload Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/v1/roster-bulk-upload/
       │    multipart/form-data: {file: roster.xlsx}
       ▼
┌─────────────────────────────────────┐
│  RosterBulkUploadView.post()        │
└──────┬──────────────────────────────┘
       │ 2. Validate file extension
       │    (.xls or .xlsx)
       ▼
┌─────────────────────────────────────┐
│  pandas.read_excel()                │
│  - Read Excel file                  │
│  - Parse into DataFrame             │
└──────┬──────────────────────────────┘
       │ 3. Validate headers
       │    (ALLOWED_HEADERS)
       ▼
┌─────────────────────────────────────┐
│  Iterate rows                       │
│  - Map columns using HEADER_MAP     │
│  - Parse dates and times            │
└──────┬──────────────────────────────┘
       │ 4. Create RosterAssignment
       │    for each row
       ▼
┌─────────────────────────────────────┐
│  RosterAssignmentSerializer         │
│  .create()                          │
│  - Validate data                    │
│  - Check uniqueness                 │
│  - Save to DB                       │
└──────┬──────────────────────────────┘
       │ 5. Return summary
       ▼
┌─────────────────────────────────────┐
│  Response:                          │
│  {created: 50, skipped: 2,          │
│   errors: [...]}                    │
└─────────────────────────────────────┘
```

---

### 5.4 Duty Generation (Rotation) Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/v1/duties/generate_rotation/
       │    {duty_chart_id, schedule_id, user_ids, 
       │     start_date, end_date}
       ▼
┌─────────────────────────────────────┐
│  DutyViewSet.generate_rotation()    │
└──────┬──────────────────────────────┘
       │ 2. Validate inputs
       │    - DutyChart exists
       │    - Schedule exists
       │    - Users exist
       ▼
┌─────────────────────────────────────┐
│  Generate date range                │
│  (start_date to end_date)           │
└──────┬──────────────────────────────┘
       │ 3. Iterate dates
       ▼
┌─────────────────────────────────────┐
│  For each date:                     │
│  - Rotate through user_ids          │
│  - Create Duty instance             │
│  - user = users[date_index % len]   │
└──────┬──────────────────────────────┘
       │ 4. Bulk create duties
       ▼
┌─────────────────────────────────────┐
│  Duty.objects.bulk_create()         │
│  - Insert all duties at once        │
└──────┬──────────────────────────────┘
       │ 5. Return created duties
       ▼
┌─────────────────────────────────────┐
│  Response: {created: 30, duties: []}│
└─────────────────────────────────────┘
```

---

### 5.5 Report Generation Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. GET /api/v1/reports/duties/file/
       │    ?duty_id=1&date_from=...&date_to=...
       ▼
┌─────────────────────────────────────┐
│  DutyReportFileView.get()           │
└──────┬──────────────────────────────┘
       │ 2. Parse query params
       │    - Get DutyChart
       │    - Get date range
       ▼
┌─────────────────────────────────────┐
│  Query Duty records                 │
│  Duty.objects.filter(               │
│    duty_chart_id=...,               │
│    date__range=[from, to]           │
│  )                                  │
└──────┬──────────────────────────────┘
       │ 3. Order by date, schedule
       ▼
┌─────────────────────────────────────┐
│  Create DOCX document               │
│  - Add header (अनुसूची-१)          │
│  - Add metadata                     │
│  - Create table                     │
└──────┬──────────────────────────────┘
       │ 4. Populate table rows
       │    For each duty:
       │    - Position, Name, Phone
       │    - Date
       ▼
┌─────────────────────────────────────┐
│  Add footer text                    │
│  - Instructions                     │
│  - Signature section                │
└──────┬──────────────────────────────┘
       │ 5. Save to BytesIO
       ▼
┌─────────────────────────────────────┐
│  Return FileResponse                │
│  Content-Type: application/vnd...   │
│  Filename: Duty_Chart_...docx       │
└─────────────────────────────────────┘
```

---

### 5.6 Permission Check Flow

```
┌─────────────────────────────────────┐
│  Request arrives at ViewSet         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  DRF checks permission_classes      │
│  e.g., AdminOrReadOnly              │
└──────┬──────────────────────────────┘
       │
       ├─ If SAFE_METHODS (GET, HEAD, OPTIONS)
       │  └─> Check IsAuthenticated
       │      └─> Allow
       │
       └─ If UNSAFE_METHODS (POST, PUT, DELETE)
          │
          ├─> Check IsSuperAdmin
          │   └─> user.role == 'SUPERADMIN'
          │       └─> Allow
          │
          └─> Check IsOfficeAdmin
              └─> user.role == 'OFFICE_ADMIN'
                  └─> Check office scope
                      └─> Allow if office matches
```

**Permission Hierarchy:**
1. **SUPERADMIN**: Full access to all resources
2. **OFFICE_ADMIN**: Full access to their office(s) resources
3. **USER**: Read-only access to their office resources

---

## 6. Authentication & Authorization

### 6.1 JWT Token Structure

**Access Token Lifetime**: 60 minutes  
**Refresh Token Lifetime**: 1 day

**Token Payload:**
```json
{
  "token_type": "access",
  "exp": 1706345678,
  "iat": 1706342078,
  "jti": "abc123...",
  "user_id": 1
}
```

### 6.2 Permission System

#### Built-in Permissions

| Permission Slug | Description |
|----------------|-------------|
| `system.manage_rbac` | Manage roles and permissions |
| `duty.create` | Create duty charts |
| `duty.edit` | Edit duty charts |
| `duty.delete` | Delete duty charts |
| `user.manage` | Manage users |

#### Permission Resolution

```python
def user_has_permission(user, permission_slug):
    # 1. SuperAdmin has all permissions
    if user.role == 'SUPERADMIN':
        return True
    
    # 2. Check role permissions
    role_permissions = RolePermission.objects.filter(
        role__slug=user.role,
        permission__slug=permission_slug
    ).exists()
    
    # 3. Check direct user permissions
    user_permissions = UserPermission.objects.filter(
        user=user,
        permission__slug=permission_slug
    ).exists()
    
    return role_permissions or user_permissions
```

### 6.3 Office Scoping

Users can be assigned to:
- **Primary Office**: Main office assignment
- **Secondary Offices**: Additional office memberships

**Scope Resolution:**
```python
def get_allowed_office_ids(user):
    office_ids = []
    if user.office_id:
        office_ids.append(user.office_id)
    office_ids.extend(user.secondary_offices.values_list('id', flat=True))
    return set(office_ids)
```

---

## 7. Frontend Architecture

### 7.1 Directory Structure

```
frontend/src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── ...             # Custom components
├── pages/              # Page components
├── services/           # API service layer
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── layouts/            # Layout components
├── routes/             # Route definitions
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── lib/                # Third-party library configs
```

### 7.2 Key Technologies

- **State Management**: React Context + TanStack Query
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: TailwindCSS

### 7.3 API Service Layer

Located in `src/services/`, each service handles API calls for a specific domain:

- `authService.ts` - Authentication
- `userService.ts` - User management
- `dutyService.ts` - Duty operations
- `orgService.ts` - Organization hierarchy
- `reportService.ts` - Report generation

**Example Service:**
```typescript
// src/services/dutyService.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const dutyService = {
  getDutyCharts: (params) => 
    axios.get(`${API_URL}/duty-charts/`, { params }),
  
  createDutyChart: (data) => 
    axios.post(`${API_URL}/duty-charts/`, data),
  
  bulkUpsertDuties: (duties) => 
    axios.post(`${API_URL}/duties/bulk_upsert/`, { duties }),
};
```

### 7.4 Authentication Context

Manages user authentication state globally:

```typescript
// src/context/AuthContext.tsx
const AuthContext = createContext({
  user: null,
  login: (email, password) => {},
  logout: () => {},
  isAuthenticated: false,
});
```

---

## 8. Deployment

### 8.1 Production Environment

**Server**: `10.26.204.149`

**Access URLs:**
- Frontend: `http://10.26.204.149`
- Backend API: `http://10.26.204.149:8000`
- Django Admin: `http://10.26.204.149/admin/`
- Swagger Docs: `http://10.26.204.149/swagger/`

### 8.2 Environment Variables

**Backend (.env):**
```env
SECRET_KEY=<django-secret-key>
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,10.26.204.149
CORS_ALLOWED_ORIGINS=http://10.26.204.149

# Database
POSTGRES_DB=duty_chart_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password>
DB_HOST=db
DB_PORT=5432

# Email
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=<email>
EMAIL_HOST_PASSWORD=<password>
DEFAULT_FROM_EMAIL=<email>
```

**Frontend (.env):**
```env
VITE_API_URL=http://10.26.204.149:8000/api/v1
```

### 8.3 Docker Deployment

Both backend and frontend include Dockerfiles:

**Backend Dockerfile:**
```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: duty_chart_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - db
    environment:
      DB_HOST: db
  
  frontend:
    build: ./frontend
    ports:
      - "80:80"
```

### 8.4 Database Migrations

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

### 8.5 Static Files

```bash
# Collect static files for production
python manage.py collectstatic --noinput
```

---

## 9. Key Features Implementation

### 9.1 Bulk Upload (Excel)

**Required Excel Format:**

| Start Date | End Date | Employee Name | Start Time | End Time | Shift | Phone no. | Office |
|------------|----------|---------------|------------|----------|-------|-----------|--------|
| 2025-01-27 | 2025-01-27 | John Doe | 09:00 | 17:00 | Morning | +9779841234567 | Kathmandu |

**Processing:**
1. Validate file extension (.xls/.xlsx)
2. Read Excel using pandas
3. Validate headers match exactly
4. Parse each row into RosterAssignment
5. Validate uniqueness constraints
6. Return summary (created, skipped, errors)

### 9.2 Duty Rotation Generation

**Algorithm:**
```python
def generate_rotation(duty_chart, schedule, users, start_date, end_date):
    duties = []
    date_range = [start_date + timedelta(days=i) 
                  for i in range((end_date - start_date).days + 1)]
    
    for i, date in enumerate(date_range):
        user = users[i % len(users)]  # Round-robin rotation
        duties.append(Duty(
            user=user,
            duty_chart=duty_chart,
            schedule=schedule,
            date=date
        ))
    
    Duty.objects.bulk_create(duties)
    return duties
```

### 9.3 Report Generation (DOCX)

Uses `python-docx` library to generate formatted reports:

1. Create document with Nepali headers
2. Add metadata (office, department, dates)
3. Create table with merged cells
4. Populate rows with duty data
5. Add footer with instructions
6. Return as downloadable file

---

## 10. Security Considerations

### 10.1 Authentication
- JWT tokens with short expiration (60 min)
- Refresh token rotation
- Password hashing (Django default PBKDF2)

### 10.2 Authorization
- Role-based access control (RBAC)
- Office-scoped permissions
- Object-level permissions

### 10.3 Input Validation
- Django model validation
- DRF serializer validation
- Zod schema validation (frontend)

### 10.4 CORS
- Configured allowed origins
- Credentials support
- Specific allowed headers/methods

### 10.5 File Upload Security
- File type validation
- Size limits (50MB default)
- SHA-256 checksum for deduplication
- Secure file storage

---

## 11. Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS APP                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │   User   │────────▶│ Position │         │   Role   │        │
│  └────┬─────┘         └──────────┘         └────┬─────┘        │
│       │                                          │              │
│       │ M:N (secondary)                          │ M:N          │
│       │                                          │              │
│       ▼                                          ▼              │
│  ┌──────────┐                            ┌──────────────┐      │
│  │  Office  │                            │ Permission   │      │
│  └────┬─────┘                            └──────────────┘      │
│       │                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────────────────────────────┐
│       │                    ORG APP                               │
├───────┼─────────────────────────────────────────────────────────┤
│       │                                                          │
│  ┌────▼─────┐         ┌──────────────┐         ┌──────────────┐│
│  │  Office  │◀────────│  Department  │◀────────│ Directorate  ││
│  └────┬─────┘         └──────────────┘         └──────────────┘│
│       │                                                          │
└───────┼──────────────────────────────────────────────────────────┘
        │
┌───────┼──────────────────────────────────────────────────────────┐
│       │                   DUTIES APP                              │
├───────┼──────────────────────────────────────────────────────────┤
│       │                                                           │
│  ┌────▼────────┐         ┌──────────┐                           │
│  │  DutyChart  │────────▶│ Schedule │                           │
│  └────┬────────┘   M:N   └────┬─────┘                           │
│       │                        │                                 │
│       │                        │                                 │
│       ▼                        ▼                                 │
│  ┌─────────────────────────────────┐                            │
│  │            Duty                 │                            │
│  │  - user (FK)                    │                            │
│  │  - duty_chart (FK)              │                            │
│  │  - schedule (FK)                │                            │
│  │  - date                         │                            │
│  └─────────────────────────────────┘                            │
│                                                                  │
│  ┌──────────────────┐         ┌──────────┐                     │
│  │ RosterAssignment │         │ Document │                     │
│  └──────────────────┘         └──────────┘                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. API Response Formats

### Success Response
```json
{
  "id": 1,
  "field1": "value1",
  "field2": "value2"
}
```

### List Response
```json
[
  {"id": 1, "name": "Item 1"},
  {"id": 2, "name": "Item 2"}
]
```

### Error Response
```json
{
  "detail": "Error message",
  "field_name": ["Field-specific error"]
}
```

### Validation Error
```json
{
  "email": ["This field is required."],
  "password": ["This field may not be blank."]
}
```

---

## 13. Testing

### Backend Testing
```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test users
python manage.py test duties

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

### Frontend Testing
```bash
# Run tests (if configured)
npm test

# Type checking
npm run type-check
```

---

## 14. Common Workflows

### 14.1 Creating a New Duty Chart

1. **Login** as SuperAdmin or Office Admin
2. **Navigate** to Duty Charts page
3. **Click** "Create Duty Chart"
4. **Fill** form:
   - Select Office
   - Set Effective Date
   - Set End Date (optional)
   - Select Schedules
5. **Submit** form
6. **System** creates DutyChart record

### 14.2 Assigning Duties

**Option 1: Manual Assignment**
1. Navigate to Duties page
2. Click "Create Duty"
3. Select User, Duty Chart, Schedule, Date
4. Submit

**Option 2: Bulk Upload**
1. Prepare Excel file with roster data
2. Navigate to Bulk Upload page
3. Upload Excel file
4. Review summary
5. System creates RosterAssignment records

**Option 3: Generate Rotation**
1. Navigate to Duty Chart
2. Click "Generate Rotation"
3. Select Schedule, Users, Date Range
4. System creates duties in round-robin fashion

### 14.3 Generating Reports

1. Navigate to Reports page
2. Select Duty Chart or Date Range
3. Select Users (or "All Users")
4. Click "Preview" to see JSON
5. Click "Download" to get DOCX file
6. System generates अनुसूची-१ format report

---

## 15. Troubleshooting

### Common Issues

**Issue**: JWT token expired
**Solution**: Use refresh token to get new access token

**Issue**: Permission denied
**Solution**: Check user role and office scope

**Issue**: Bulk upload fails
**Solution**: Verify Excel headers match exactly

**Issue**: Duty validation error
**Solution**: Ensure date is within duty_chart period

---

## 16. Future Enhancements

- [ ] Email notifications for duty assignments
- [ ] Mobile app for duty tracking
- [ ] Real-time duty status updates
- [ ] Advanced reporting with charts
- [ ] Duty swap/exchange functionality
- [ ] Leave management integration
- [ ] Attendance tracking
- [ ] Performance analytics

---

## 17. Appendix

### A. Useful Commands

```bash
# Backend
python manage.py runserver
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py shell

# Frontend
npm run dev
npm run build
npm run preview

# Docker
docker-compose up -d
docker-compose down
docker-compose logs -f
```

### B. Contact Information

**Development Team**: Nepal Telecom IT Department  
**Support Email**: support@ntc.net.np  
**Documentation Version**: 1.0  
**Last Updated**: January 2025

---

**End of Technical Documentation**
