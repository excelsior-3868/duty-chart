// import { createBrowserRouter } from "react-router-dom";
// import { MainLayout } from "@/layouts/MainLayout";
// import { ScheduleLayout } from "@/layouts/ScheduleLayout";
// import { ROUTES } from "@/utils/constants";

// // Pages
// import Dashboard from "@/pages/Dashboard";
// import DutyChart from "@/pages/DutyChart";
// import Employees from "@/pages/Employees";
// import Attendance from "@/pages/Attendance";
// import Schedule from "@/pages/Schedule";
// import Reports from "@/pages/Reports";
// import Settings from "@/pages/Settings";
// import Login from "@/pages/Login";
// import Register from "@/pages/Register";
// import NotFound from "@/pages/NotFound";
// import { ProtectedRoute } from "@/routes/ProtectedRoute";

// export const router = createBrowserRouter([
//   {
//     path: "/",
//     children: [
//       {
//         index: true,
//         element: <Login />,
//       },
//       {
//         path: ROUTES.LOGIN,
//         element: <Login />,
//       },
//       {
//         element: <MainLayout />,
//         children: [
//           {
//             path: ROUTES.DASHBOARD,
//             element: (
//               <ProtectedRoute>
//                 <Dashboard />
//               </ProtectedRoute>
//             ),
//           },
//           {
//             path: ROUTES.DUTY_CHART,
//             element: <DutyChart />,
//           },
//           {
//             path: ROUTES.EMPLOYEES,
//             element: <Employees />,
//           },
//           {
//             path: ROUTES.ATTENDANCE,
//             element: <Attendance />,
//           },
//           {
//             path: ROUTES.REPORTS,
//             element: <Reports />,
//           },
//           {
//             path: ROUTES.SETTINGS,
//             element: <Settings />,
//           },
//         ],
//       },
//       {
//         path: ROUTES.SCHEDULE,
//         element: (
//           <ScheduleLayout>
//             <Schedule />
//           </ScheduleLayout>
//         ),
//       },
//       {
//         path: ROUTES.REGISTER,
//         element: <Register />,
//       },
//       {
//         path: "*",
//         element: <NotFound />,
//       },
//     ],
//   },
// ]);

// File: src/routes/index.tsx
import { createBrowserRouter } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { ScheduleLayout } from "@/layouts/ScheduleLayout";
import { ROUTES } from "@/utils/constants";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

// Pages
import Dashboard from "@/pages/Dashboard";
import DutyChart from "@/pages/DutyChart";
import Employees from "@/pages/Employees";
import Attendance from "@/pages/Attendance";
import Schedule from "@/pages/Schedule";
import Reports from "@/pages/Reports";
import UserWiseReport from "@/pages/reports/UserWiseReport";
import UserWiseReportNew from "@/pages/reports/UserWiseReportNew";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import ChangePassword from "@/pages/ChangePassword";
import TemplateSchedule from "@/pages/TemplateSchedule";
import DutyCalendar from "@/pages/DutyCalendar";
import AuditLogPage from "@/pages/AuditLogPage";
import SMSLogsPage from "@/pages/SMSLogsPage";
import DirectoratePage from "@/pages/DirectoratePage";
import AccountingOfficesPage from "@/pages/AccountingOfficesPage";
import CCOfficesPage from "@/pages/CCOfficesPage";
import ApiDocsPage from "@/pages/ApiDocsPage";
import ArchitecturePage from "@/pages/ArchitecturePage";
import ScrollToTop from "@/components/ScrollToTop";
import { Outlet } from "react-router-dom";


export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: [
      {
        index: true,
        element: <Login />,
      },
      {
        path: ROUTES.LOGIN,
        element: <Login />,
      },
      {
        path: ROUTES.CHANGE_PASSWORD,
        element: (
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        ),
      },

      {
        element: <MainLayout />,
        children: [
          {
            path: ROUTES.DASHBOARD,
            element: (
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            ),
          },

          {
            path: ROUTES.PROFILE,
            element: (
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            ),
          },

          {
            path: ROUTES.DUTY_CHART,
            element: (
              <ProtectedRoute requiredPermission="duties.view_chart">
                <DutyChart />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.DUTY_CALENDAR,
            element: (
              <ProtectedRoute requiredPermission="duties.view_chart">
                <DutyCalendar />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.EMPLOYEES,
            element: (
              <ProtectedRoute requiredPermission="users.view_employee">
                <Employees />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.ATTENDANCE,
            element: (
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.REPORTS,
            element: (
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            ),
          },
          {
            // 👇 NEW USER WISE REPORT ROUTE
            path: "/reports/userwise",
            element: (
              <ProtectedRoute>
                <UserWiseReport />
              </ProtectedRoute>
            ),
          },
          {
            // 👇 ANNEX 2 REPORT ROUTE
            path: "/reports/userwise-new",
            element: (
              <ProtectedRoute>
                <UserWiseReportNew />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.SETTINGS,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <Settings />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.AUDIT_LOGS,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <AuditLogPage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.SMS_LOGS,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <SMSLogsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.DIRECTORATES,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <DirectoratePage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.ACCOUNTING_OFFICES,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <AccountingOfficesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.CC_OFFICES,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <CCOfficesPage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.API_DOCS,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <ApiDocsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.ARCHITECTURE,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <ArchitecturePage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.TEMPLATE_SCHEDULE,
            element: (
              <ProtectedRoute requiredRole="SUPERADMIN">
                <ScheduleLayout>
                  <TemplateSchedule />
                </ScheduleLayout>
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.DUTY_SCHEDULE,
            element: (
              <ProtectedRoute requiredPermission="schedules.view_office_schedule">
                <ScheduleLayout>
                  <Schedule />
                </ScheduleLayout>
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: ROUTES.REGISTER,
        element: <Register />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
], {
  future: {
    // @ts-ignore: These flags are available in the runtime but missing from outdated type definitions
    v7_startTransition: true,
    // @ts-ignore
    v7_relativeSplatPath: true,
    // @ts-ignore
    v7_fetcherPersist: true,
    // @ts-ignore
    v7_normalizeFormMethod: true,
    // @ts-ignore
    v7_partialHydration: true,
    // @ts-ignore
    v7_skipActionErrorRevalidation: true,
  }
});
