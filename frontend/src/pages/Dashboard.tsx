import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Calendar, Clock, FileText, BarChart3, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from "react";
import { getDutiesFiltered, Duty } from "@/services/dutiesService";
import { getUsers, User as AppUser } from "@/services/users";
import { getDutyCharts, DutyChart } from "@/services/dutichart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/constants";
import NepaliDate from "nepali-date-converter";
import { useAuth } from "@/context/AuthContext";
import { addDays, isAfter, isBefore, startOfDay } from "date-fns";

const Dashboard = () => {
  // State
  const [duties, setDuties] = useState<Duty[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
  const [nextDuty, setNextDuty] = useState<Duty | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOffice, setExpandedOffice] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const navigate = useNavigate();

  const todayLocalISODate = useMemo(() => {
    const dt = new Date();
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const formattedDates = useMemo(() => {
    const now = new Date();
    const nd = new NepaliDate(now);
    return {
      ad: format(now, "MMMM d, yyyy"),
      bs: nd.format("MMMM D, YYYY")
    };
  }, []);

  useEffect(() => {
    document.title = "Dashboard - Duty Roster";
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getDutiesFiltered({ date: todayLocalISODate }),
      getUsers(),
      getDutyCharts(),
      user?.id ? getDutiesFiltered({ user: user.id }) : Promise.resolve([])
    ])
      .then(([dutiesRes, usersRes, dutyChartsRes, myDutiesRes]) => {
        if (!mounted) return;
        setDuties(dutiesRes || []);
        setUsers(usersRes || []);
        setDutyCharts(dutyChartsRes || []);

        if (myDutiesRes && myDutiesRes.length > 0) {
          const sorted = myDutiesRes
            .filter(d => d.date >= todayLocalISODate)
            .sort((a, b) => a.date.localeCompare(b.date));
          setNextDuty(sorted[0] || null);
        }
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
    return dutyCharts.filter(dc => {
      const start = dc.effective_date;
      const end = dc.end_date;

      // Must be after or on effective date
      const isStarted = start <= todayLocalISODate;
      // Must be before or on end date (if end date exists)
      const isNotEnded = !end || end >= todayLocalISODate;

      return isStarted && isNotEnded;
    });
  }, [dutyCharts, todayLocalISODate]);

  const expiringChartsCount = useMemo(() => {
    const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");
    return activeDutyCharts.filter(chart =>
      chart.end_date && chart.end_date <= nextWeek
    ).length;
  }, [activeDutyCharts]);

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
      title: "On Duty Today",
      value: duties.length.toString(),
      description: "Total staff across offices",
      icon: Calendar,
    },
    {
      title: "Expiring Charts",
      value: expiringChartsCount.toString(),
      description: "Charts ending within 7 days",
      icon: Clock,
      trend: expiringChartsCount > 0 ? `${expiringChartsCount} ending soon` : "All charts healthy",
      variant: expiringChartsCount > 0 ? "destructive" : "secondary"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Nepal Telecom Duty Chart Management</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border shadow-sm self-start md:self-auto">
          <CalendarDays className="h-5 w-5 text-blue-500" />
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-bold text-slate-900">{formattedDates.bs}</span>
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{formattedDates.ad}</span>
          </div>
        </div>
      </div>

      {/* Featured Header Section: Next Duty or Welcome */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          {nextDuty ? (
            <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-blue-100 mb-1">
                  <div className="p-1 rounded bg-blue-500/30">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">My Next Duty</span>
                </div>
                <CardTitle className="text-2xl font-bold">
                  {nextDuty.schedule_name || "Upcoming Shift"}
                </CardTitle>
                <CardDescription className="text-blue-100 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(nextDuty.date), "EEEE, MMMM do")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-50/80">Shift Time</p>
                    <p className="text-xl font-bold">
                      {nextDuty.start_time?.slice(0, 5) || "00:00"} - {nextDuty.end_time?.slice(0, 5) || "00:00"}
                    </p>
                  </div>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none px-4 py-1 text-sm">
                    {nextDuty.office_name}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col justify-center border-dashed border-2 bg-slate-50/50">
              <CardContent className="flex flex-col items-center py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">No upcoming duties scheduled</p>
                <p className="text-xs text-slate-400 mt-1">Check back later or contact your supervisor</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-tight">Active Duty Charts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="text-2xl font-bold text-slate-900 mb-2">{activeDutyCharts.length}</div>
            <p className="text-xs text-slate-500 font-medium text-center">Charts currently in operation across departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className="hover:border-blue-200 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{stat.title}</CardTitle>
                <div className="p-2 rounded-lg bg-slate-50">
                  <IconComponent className="h-5 w-5 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                <p className="text-xs text-slate-500 mt-1">{stat.description}</p>
                {stat.trend && (
                  <Badge variant={stat.variant as any || "secondary"} className="mt-2 text-[10px] font-bold">
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
                      {chart.end_date ? `Ends ${new NepaliDate(new Date(chart.end_date)).format("YYYY-MM-DD")}` : 'Ongoing'}
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
