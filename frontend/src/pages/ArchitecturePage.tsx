import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ArchitecturePage() {
    useEffect(() => {
        document.title = "Architecture - NT Duty Chart Management System";
    }, []);

    const diagrams = {
        overview: `
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
`,
        erd: `
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
`,
        apiFlow: `
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
`,
        authFlow: `
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
└──────┬───────────────────────────────┘
`
    };

    return (
        <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-primary">Architectural Diagrams</h1>
                <p className="text-muted-foreground">System architecture, database design, and component hierarchy</p>
            </div>

            <Card className="flex-1 h-full border-none shadow-sm flex flex-col overflow-hidden bg-white/50">
                <CardContent className="p-0 flex-1 flex flex-col h-full">
                    <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                        <div className="border-b px-6 py-2 bg-white sticky top-0 z-10 shrink-0">
                            <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="erd">Database (ERD)</TabsTrigger>
                                <TabsTrigger value="api">API Flow</TabsTrigger>
                                <TabsTrigger value="auth">Auth Flow</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 bg-white">
                            <div className="p-6">
                                <TabsContent value="overview" className="mt-0">
                                    <pre className="font-mono text-xs md:text-sm text-emerald-900 leading-relaxed whitespace-pre">
                                        {diagrams.overview}
                                    </pre>
                                </TabsContent>
                                <TabsContent value="erd" className="mt-0">
                                    <pre className="font-mono text-xs md:text-sm text-blue-900 leading-relaxed whitespace-pre">
                                        {diagrams.erd}
                                    </pre>
                                </TabsContent>
                                <TabsContent value="api" className="mt-0">
                                    <pre className="font-mono text-xs md:text-sm text-yellow-800 leading-relaxed whitespace-pre">
                                        {diagrams.apiFlow}
                                    </pre>
                                </TabsContent>
                                <TabsContent value="auth" className="mt-0">
                                    <pre className="font-mono text-xs md:text-sm text-purple-900 leading-relaxed whitespace-pre">
                                        {diagrams.authFlow}
                                    </pre>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
