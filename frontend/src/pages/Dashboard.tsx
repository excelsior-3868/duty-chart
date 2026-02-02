import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Calendar, Clock, FileText, BarChart3, CalendarDays, Plus, X, LayoutDashboard } from 'lucide-react';
import { useEffect, useMemo, useState } from "react";
import { getDutiesFiltered, Duty } from "@/services/dutiesService";
import { getUsers, User as AppUser } from "@/services/users";
import { getDutyCharts, DutyChart } from "@/services/dutichart";
import { getOffices, Office } from "@/services/offices";
import { getDashboardOffices, addDashboardOffice, removeDashboardOffice, DashboardOffice } from "@/services/dashboardService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/constants";
import NepaliDate from "nepali-date-converter";
import { useAuth } from "@/context/AuthContext";
import { addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const Dashboard = () => {
  // State
  const [duties, setDuties] = useState<Duty[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<DashboardOffice[]>([]);
  const [nextDuty, setNextDuty] = useState<Duty | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOffice, setExpandedOffice] = useState<Record<string, boolean>>({});
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

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

  const selectedOfficeIds = useMemo(() => selectedOffices.map(so => so.office), [selectedOffices]);

  useEffect(() => {
    document.title = "Dashboard - Duty Roster";
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getDutiesFiltered({ date: todayLocalISODate }),
      getUsers(),
      getDutyCharts(),
      getOffices(),
      getDashboardOffices(),
      user?.id ? getDutiesFiltered({ user: user.id }) : Promise.resolve([])
    ])
      .then(([dutiesRes, usersRes, dutyChartsRes, officesRes, selectedRes, myDutiesRes]) => {
        if (!mounted) return;
        setDuties(dutiesRes || []);
        setUsers(usersRes || []);
        setDutyCharts(dutyChartsRes || []);
        setOffices(officesRes || []);
        setSelectedOffices(selectedRes || []);

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
  }, [todayLocalISODate, user?.id]);

  // Computations
  const activeDutyCharts = useMemo(() => {
    return dutyCharts.filter(dc => {
      const start = dc.effective_date;
      const end = dc.end_date;
      const isStarted = start <= todayLocalISODate;
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
    const groups = new Map<number, { officeName: string; officeId: number; rows: NowRow[] }>();

    // First, initialize with selected offices if any, to show empty cards if they have no duties
    selectedOfficeIds.forEach(id => {
      const off = offices.find(o => o.id === id);
      if (off) {
        groups.set(id, { officeName: off.name, officeId: id, rows: [] });
      }
    });

    duties.forEach((d) => {
      const officeId = d.office;
      if (!selectedOfficeIds.includes(officeId)) return;

      const officeName = d.office_name || "Unknown Office";
      const userObj = userById.get(d.user);
      const fullName = userObj?.full_name || d.user_name || "Unknown";
      const phone = userObj?.phone_number || null;
      const row: NowRow = {
        id: d.id,
        full_name: fullName,
        phone_number: phone,
        schedule_name: d.schedule_name || null,
        currently_available: !!d.currently_available,
      };

      if (!groups.has(officeId)) {
        groups.set(officeId, { officeName, officeId, rows: [row] });
      } else {
        groups.get(officeId)!.rows.push(row);
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.officeName.localeCompare(b.officeName));
  }, [duties, userById, selectedOfficeIds, offices]);

  const chartData = useMemo(() => {
    const groups = new Map<string, number>();
    duties.forEach(d => {
      const name = d.office_name || "Unknown";
      groups.set(name, (groups.get(name) || 0) + 1);
    });
    return Array.from(groups.entries()).map(([name, count]) => ({ name, count }));
  }, [duties]);

  const stats = [
    {
      title: "Active Duty Charts",
      value: activeDutyCharts.length.toString(),
      description: "Charts currently in operation",
      icon: FileText,
    },
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

  const handleAddOffice = async (id: number) => {
    if (selectedOfficeIds.includes(id)) return;
    try {
      const res = await addDashboardOffice(id);
      setSelectedOffices(prev => [...prev, res]);
      toast.success("Office added to board");
    } catch (e) {
      toast.error("Failed to add office to board");
    }
  };

  const handleRemoveOffice = async (officeId: number) => {
    const pref = selectedOffices.find(so => so.office === officeId);
    if (!pref) return;
    try {
      await removeDashboardOffice(pref.id);
      setSelectedOffices(prev => prev.filter(so => so.id !== pref.id));
      toast.success("Office removed from board");
    } catch (e) {
      toast.error("Failed to remove office from board");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Nepal Telecom Duty Chart Management</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border shadow-sm self-start md:self-auto">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-bold text-slate-900">{formattedDates.bs}</span>
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{formattedDates.ad}</span>
          </div>
        </div>
      </div>

      {/* Featured Header: My Next Duty (Only if exists) */}
      {nextDuty && (
        <Card className="bg-gradient-to-br from-primary to-primary-hover text-white border-none shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-blue-100 mb-1">
              <div className="p-1 rounded bg-white/20">
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
      )}

      {/* Stats Grid - 4 cards in a row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className="hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{stat.title}</CardTitle>
                <div className="p-2 rounded-lg bg-slate-50">
                  <IconComponent className="h-5 w-5 text-primary" />
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              Now Board
            </h2>
            <p className="text-sm text-muted-foreground">Current on-duty personnel in your selected offices</p>
          </div>

          <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                <Plus className="h-4 w-4" />
                Add Office Card
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Office Card</DialogTitle>
                <DialogDescription>
                  Select an office to monitor on your dashboard.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="mt-4 h-[300px] pr-4">
                <div className="space-y-2">
                  {offices
                    .filter(o => !selectedOfficeIds.includes(o.id))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(office => (
                      <button
                        key={office.id}
                        onClick={() => {
                          handleAddOffice(office.id);
                          setIsAddCardOpen(false);
                        }}
                        className="w-full text-left p-3 rounded-lg border hover:bg-slate-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-medium text-sm">{office.name}</p>
                          <p className="text-xs text-muted-foreground">{office.department_name}</p>
                        </div>
                        <Plus className="h-4 w-4 text-slate-400 group-hover:text-primary" />
                      </button>
                    ))}
                  {offices.filter(o => !selectedOfficeIds.includes(o.id)).length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">All offices are already on your board.</p>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse bg-slate-50 h-48 border-none" />
            ))}
          </div>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent>
              <p className="text-sm text-destructive py-6 text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && selectedOfficeIds.length === 0 && (
          <Card className="border-dashed border-2 bg-slate-50/50">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <p className="text-slate-600 font-medium">Your Now Board is empty</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Add the offices you want to monitor in real-time</p>
              <Button size="sm" onClick={() => setIsAddCardOpen(true)}>
                Add Your First Office
              </Button>
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
              <Card key={group.officeId} className="rounded-xl hover:shadow-md transition-shadow relative group/card">
                <button
                  onClick={() => handleRemoveOffice(group.officeId)}
                  className="absolute top-4 right-4 p-1 rounded-md opacity-0 group-hover/card:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all z-10"
                  title="Remove from board"
                >
                  <X className="h-4 w-4" />
                </button>

                <CardHeader className="pb-3 pr-10">
                  <CardTitle className="text-lg">{group.officeName}</CardTitle>
                  <CardDescription>
                    {onDutyRows.length > 0 ? (
                      <span className="text-green-600 font-medium">{onDutyRows.length} on duty</span>
                    ) : (
                      "No one on duty"
                    )}
                  </CardDescription>
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
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-green-300"
                            title="On duty"
                            aria-label="On duty"
                          />
                        </div>
                      </div>
                    ))}
                    {onDutyRows.length === 0 && (
                      <div className="py-4 text-center border rounded-lg bg-slate-50/50">
                        <p className="text-xs text-muted-foreground">No personnel currently active</p>
                      </div>
                    )}
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
                  fontSize={10}
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
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
