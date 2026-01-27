import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Clock, FileText, BarChart3 } from 'lucide-react';
import { useEffect, useMemo, useState } from "react";
import { getDutiesFiltered, Duty } from "@/services/dutiesService";
import { getUsers, User as AppUser } from "@/services/users";
import { getDutyCharts, DutyChart } from "@/services/dutichart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/constants";

const Dashboard = () => {
  // State
  const [duties, setDuties] = useState<Duty[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOffice, setExpandedOffice] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const todayLocalISODate = useMemo(() => {
    const dt = new Date();
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    document.title = "Dashboard - Duty Roster";
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getDutiesFiltered({ date: todayLocalISODate }),
      getUsers(),
      getDutyCharts()
    ])
      .then(([dutiesRes, usersRes, dutyChartsRes]) => {
        if (!mounted) return;
        setDuties(dutiesRes || []);
        setUsers(usersRes || []);
        setDutyCharts(dutyChartsRes || []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.detail || e?.message || "Failed to load Dashboard data");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [todayLocalISODate]);

  // Computations
  const activeDutyCharts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return dutyCharts.filter(dc => {
      // If end_date is present, check if it's in the future or today
      if (!dc.end_date) return true;
      const end = new Date(dc.end_date);
      // We compare dates. end_date string format usually YYYY-MM-DD
      // Parse safely
      return end >= now;
    });
  }, [dutyCharts]);

  const userById = useMemo(() => {
    const map = new Map<number, AppUser>();
    users.forEach((u) => {
      if (typeof u.id === "number") {
        map.set(u.id, u);
      }
    });
    return map;
  }, [users]);

  type NowRow = {
    id: number;
    full_name: string;
    phone_number?: string | null;
    schedule_name?: string | null;
    currently_available: boolean;
  };

  const groupedByOffice = useMemo(() => {
    const groups = new Map<string, { officeName: string; rows: NowRow[] }>();
    duties.forEach((d) => {
      const officeName = d.office_name || "Unknown Office";
      const user = userById.get(d.user);
      const fullName = user?.full_name || d.user_name || "Unknown";
      const phone = user?.phone_number || null;
      const row: NowRow = {
        id: d.id,
        full_name: fullName,
        phone_number: phone,
        schedule_name: d.schedule_name || null,
        currently_available: !!d.currently_available,
      };
      if (!groups.has(officeName)) {
        groups.set(officeName, { officeName, rows: [row] });
      } else {
        groups.get(officeName)!.rows.push(row);
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.officeName.localeCompare(b.officeName));
  }, [duties, userById]);

  // Chart Data
  const chartData = useMemo(() => {
    return groupedByOffice.map(group => ({
      name: group.officeName,
      count: group.rows.length
    }));
  }, [groupedByOffice]);

  const stats = [
    {
      title: "Total Employees",
      value: users.length.toString(),
      description: "Active staff members",
      icon: Users,
    },
    {
      title: "Today's Duties",
      value: duties.length.toString(),
      description: "Total duties across different offices",
      icon: Calendar,
    },
    {
      title: "Pending Approvals",
      value: "8",
      description: "Shift requests",
      icon: Clock,
      trend: "2 urgent"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Nepal Telecom Duty Chart Management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <IconComponent className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                {stat.trend && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {stat.trend}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Now Board */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Now Board</h2>
          <p className="text-sm text-muted-foreground">Current on-duty personnel grouped by office</p>
        </div>

        {loading && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground py-6">Loading current duties…</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent>
              <p className="text-sm text-destructive py-6">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && groupedByOffice.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground py-6">No duties found for today.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groupedByOffice.map((group) => {
            const onDutyRows = group.rows.filter((r) => r.currently_available);
            const expanded = !!expandedOffice[group.officeName];
            const visibleRows = expanded ? onDutyRows : onDutyRows.slice(0, 3);
            const hasMore = onDutyRows.length > 3;

            return (
              <Card key={group.officeName} className="rounded-xl hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{group.officeName}</CardTitle>
                  <CardDescription>{onDutyRows.length} on duty</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {visibleRows.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 rounded-md bg-primary/10 px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-primary">{row.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{row.phone_number || "N/A"}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 sm:mt-0">
                          <span className="text-xs text-muted-foreground">{row.schedule_name || "—"}</span>
                          {/* Status dot (slightly larger) */}
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-green-300"
                            title="On duty"
                            aria-label="On duty"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasMore && (
                    <div className="mt-4">
                      <button
                        type="button"
                        className="text-xs px-3 py-1 rounded-md border bg-muted hover:bg-muted/70 transition-colors"
                        onClick={() => setExpandedOffice((prev) => ({
                          ...prev,
                          [group.officeName]: !prev[group.officeName]
                        }))}
                      >
                        {expanded ? "See less" : "See more"}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Charts & Lists Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Active Duty Charts (3 cols) */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Active Duty Charts
            </CardTitle>
            <CardDescription>Currently active schedules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {activeDutyCharts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active duty charts found.</p>
              ) : (
                activeDutyCharts.map((chart) => (
                  <button
                    key={chart.id}
                    type="button"
                    className="w-full flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors text-left"
                    onClick={() =>
                      navigate(ROUTES.DUTY_CALENDAR, {
                        state: {
                          preselect: {
                            officeId: String(chart.office),
                            dutyChartId: String(chart.id),
                          },
                        },
                      })
                    }
                  >
                    <div>
                      <p className="font-medium text-sm">{chart.name}</p>
                      <p className="text-xs text-muted-foreground">{chart.office_name || `Office ${chart.office}`}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {chart.end_date ? `Ends ${chart.end_date}` : 'Ongoing'}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Office-wise Chart (4 cols) */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Office-wise Duty Counts
            </CardTitle>
            <CardDescription>Today's duty distribution</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
