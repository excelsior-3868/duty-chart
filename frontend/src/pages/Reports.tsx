// File: src/pages/Reports.tsx

import { useState, useEffect } from "react";
import api from "@/services/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

function Reports() {
  const [reportStats, setReportStats] = useState({
    activeDuties: 0,
    completedDuties: 0,
    onLeave: 0,
    attendanceRate: 0,
  });

  // Temporary fixed window; could be made dynamic with date pickers
  const date_from = "2025-11-01";
  const date_to = "2025-11-06";

  useEffect(() => {
    document.title = "Reports - INOC Duty Roster";
    const fetchStats = async () => {
      try {
        const res = await api.get("/reports/duties/preview/", {
          params: { date_from, date_to },
        });

        const groups = res.data.groups || [];
        const rows = groups.flatMap((g: any) => g.rows || []);
        const total = rows.length;
        const completed = rows.filter((r: any) => r.is_completed).length;

        setReportStats({
          activeDuties: total,
          completedDuties: completed,
          onLeave: 3,
          attendanceRate: total ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#005a9c]">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights and performance metrics
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Prominent User Wise Report card placed first */}
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>User Wise Report</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Analyze duties by user across a selected period. View detailed schedules, availability, and completion status.
            </p>
            <Button onClick={() => (window.location.href = "/reports/userwise")}>Open Report</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Duties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reportStats.activeDuties}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Duties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {reportStats.completedDuties}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>On Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">
              {reportStats.onLeave}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {reportStats.attendanceRate}%
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;