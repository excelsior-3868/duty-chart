import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Calendar, Clock, FileText, BarChart3, CalendarDays, Plus, X, LayoutDashboard, Loader2, Search, Shield, Briefcase, Building2 } from 'lucide-react';
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { reorderDashboardOffices } from "@/services/dashboardService";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableOfficeCardProps {
  id: number;
  group: { officeName: string; officeId: number; rows: any[] };
  expanded: boolean;
  onToggleExpand: (officeName: string) => void;
  onRemove: (officeId: number) => void;
}

const SortableOfficeCard = ({ id, group, expanded, onToggleExpand, onRemove }: SortableOfficeCardProps) => {
  const [activeTab, setActiveTab] = useState<"Shift" | "Regular">("Shift");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const filteredRows = group.rows.filter((r) => {
    if (!r.currently_available) return false;
    const type = (r.shift_type || "").toLowerCase();
    if (activeTab.toLowerCase() === "shift") return type === "shift";
    if (activeTab.toLowerCase() === "regular") return type === "regular";
    return true;
  });

  const visibleRows = expanded ? filteredRows : filteredRows.slice(0, 3);
  const hasMore = filteredRows.length > 3;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative group/card flex-none w-[300px] sm:w-[350px] md:w-[calc((100%-32px)/2)] lg:w-[calc((100%-48px)/3)] xl:w-[calc((100%-64px)/4)] snap-start touch-none`}
    >
      <Card
        className="rounded-xl hover:shadow-md transition-shadow h-full"
      >
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag start when clicking remove
            onRemove(group.officeId);
          }}
          // Keep the remove button interactive, use data-no-dnd if needed, accessing with pointer-events might be tricky if parent has listeners.
          // dnd-kit listeners are on the parent div. Button clicks propagate. 
          // We can stop propagation on mousedown/touchstart/pointerdown to prevent drag.
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 p-1 rounded-md opacity-0 group-hover/card:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all z-10"
          title="Remove from board"
        >
          <X className="h-4 w-4" />
        </button>

        <CardHeader className="p-4 pb-2 pr-10 cursor-grab active:cursor-grabbing">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base whitespace-normal leading-tight">{group.officeName}</CardTitle>
              <CardDescription className="text-[11px] mt-0.5">
                {filteredRows.length > 0 ? (
                  <span className="text-emerald-600 font-semibold">{filteredRows.length} active</span>
                ) : (
                  "No active duty"
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg mt-3 w-fit" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setActiveTab("Shift")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${activeTab === "Shift" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Shift
            </button>
            <button
              onClick={() => setActiveTab("Regular")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${activeTab === "Regular" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Regular
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            {visibleRows.map((row: any) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/50 border border-emerald-100/50 px-2.5 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-emerald-900 leading-tight">{row.full_name}</p>
                  <p className="text-[10px] text-emerald-700/70">{row.phone_number || "No contact"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[10px] text-emerald-800 font-semibold">{row.schedule_name || "—"}</span>
                    {row.start_time && row.end_time && (
                      <span className="text-[9px] text-emerald-600/60 font-medium">
                        {row.start_time.substring(0, 5)}-{row.end_time.substring(0, 5)}
                      </span>
                    )}
                  </div>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    title="On duty"
                  />
                </div>
              </div>
            ))}
            {filteredRows.length === 0 && (
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
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag on button click
                onClick={() => onToggleExpand(group.officeName)}
              >
                {expanded ? "See less" : "See more"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Dashboard = () => {
  const [expandedOffice, setExpandedOffice] = useState<Record<string, boolean>>({});
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [selectedForAdd, setSelectedForAdd] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { todayLocalISODate, yesterdayLocalISODate } = useMemo(() => {
    const dt = new Date();
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");

    const ydt = new Date(dt);
    ydt.setDate(dt.getDate() - 1);
    const yYear = ydt.getFullYear();
    const yMonth = String(ydt.getMonth() + 1).padStart(2, "0");
    const yDay = String(ydt.getDate()).padStart(2, "0");

    return {
      todayLocalISODate: `${year}-${month}-${day}`,
      yesterdayLocalISODate: `${yYear}-${yMonth}-${yDay}`
    };
  }, []);

  const formattedDates = useMemo(() => {
    const now = new Date();
    const nd = new NepaliDate(now);
    return {
      ad: format(now, "MMMM d, yyyy"),
      bs: nd.format("MMMM D, YYYY")
    };
  }, []);

  // Set document title
  useEffect(() => {
    document.title = "Dashboard - NT Duty Chart Managment System";
  }, []);

  const checkIsActive = (d: Duty) => {
    if (d.start_time && d.end_time && d.date) {
      const [sH, sM] = d.start_time.split(":").map(Number);
      const [eH, eM] = d.end_time.split(":").map(Number);

      const now = new Date();
      const shiftStartDate = new Date(d.date);
      shiftStartDate.setHours(sH, sM, 0, 0);

      let shiftEndDate = new Date(d.date);
      if (eH < sH || (eH === sH && eM < sM)) {
        // Ends next day
        shiftEndDate.setDate(shiftEndDate.getDate() + 1);
      }
      shiftEndDate.setHours(eH, eM, 0, 0);

      return now >= shiftStartDate && now <= shiftEndDate;
    }
    return false;
  };

  /* ==================== QUERIES ==================== */
  // Stale time of 5 minutes to avoid refetching on every navigation

  const { data: duties = [], isLoading: dutiesLoading } = useQuery({
    queryKey: ['duties', 'dashboard-board', todayLocalISODate],
    queryFn: async () => {
      // Fetch both today and yesterday to handle night shifts
      const [todayResult, yesterdayResult] = await Promise.all([
        getDutiesFiltered({ date: todayLocalISODate }),
        getDutiesFiltered({ date: yesterdayLocalISODate })
      ]);
      return [...todayResult, ...yesterdayResult];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dutyCharts = [], isLoading: chartsLoading } = useQuery({
    queryKey: ['dutyCharts', 'all'],
    queryFn: () => getDutyCharts(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: offices = [], isLoading: officesLoading } = useQuery({
    queryKey: ['offices', 'all'],
    queryFn: () => getOffices(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: selectedOffices = [], isLoading: selectedOfficesLoading } = useQuery({
    queryKey: ['dashboard-offices'],
    queryFn: () => getDashboardOffices(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: myDuties = [], isLoading: myDutiesLoading } = useQuery({
    queryKey: ['duties', 'my', user?.id],
    queryFn: () => user?.id ? getDutiesFiltered({ user: user.id }) : Promise.resolve([]),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: officeDuties = [], isLoading: officeDutiesLoading } = useQuery({
    queryKey: ['duties', 'office', user?.office_id],
    queryFn: () => user?.office_id ? getDutiesFiltered({ office: user.office_id }) : Promise.resolve([]),
    enabled: !!user?.office_id,
    staleTime: 5 * 60 * 1000,
  });

  const loading = dutiesLoading || usersLoading || chartsLoading || officesLoading || selectedOfficesLoading || myDutiesLoading || officeDutiesLoading;

  // Memoize selectedOfficeIds from the query data
  const selectedOfficeIds = useMemo(() => selectedOffices.map((so: DashboardOffice) => so.office), [selectedOffices]);

  /* ==================== COMPUTATIONS ==================== */

  const activeDutyCharts = useMemo(() => {
    return dutyCharts.filter((dc: DutyChart) => {
      // Must be one of the selected offices
      if (!selectedOfficeIds.includes(dc.office)) return false;

      const start = dc.effective_date;
      const end = dc.end_date;
      const isStarted = start <= todayLocalISODate;
      const isNotEnded = !end || end >= todayLocalISODate;
      return isStarted && isNotEnded;
    });
  }, [dutyCharts, todayLocalISODate, selectedOfficeIds]);

  const userById = useMemo(() => {
    const map = new Map<number, AppUser>();
    users.forEach((u: AppUser) => {
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
    start_time?: string | null;
    end_time?: string | null;
    currently_available: boolean;
    shift_type?: string | null;
  };

  const groupedByOffice = useMemo(() => {
    const groups = new Map<number, { officeName: string; officeId: number; rows: NowRow[] }>();

    // First, initialize with selected offices if any, to show empty cards if they have no duties
    selectedOfficeIds.forEach((id: number) => {
      const off = offices.find((o: Office) => o.id === id);
      if (off) {
        groups.set(id, { officeName: off.name, officeId: id, rows: [] });
      }
    });

    duties.forEach((d: Duty) => {
      const officeId = d.office;
      if (!selectedOfficeIds.includes(officeId)) return;

      const officeName = d.office_name || "Unknown Office";
      const userObj = userById.get(d.user);
      // Skip if user is deactivated
      if (userObj && userObj.is_activated === false) return;

      const fullName = userObj?.full_name || d.user_name || "Unknown";
      const phone = userObj?.phone_number || d.phone_number || null;

      // --- Time Check Logic ---
      const isActive = checkIsActive(d);

      const row: NowRow = {
        id: d.id,
        full_name: fullName,
        phone_number: phone,
        schedule_name: d.schedule_name || null,
        start_time: d.start_time || null,
        end_time: d.end_time || null,
        currently_available: isActive,
        shift_type: d.shift_type || "Regular",
      };

      if (!groups.has(officeId)) {
        groups.set(officeId, { officeName, officeId, rows: [row] });
      } else {
        groups.get(officeId)!.rows.push(row);
      }
    });

    return Array.from(groups.values());
  }, [duties, userById, selectedOfficeIds, offices]);


  const chartData = useMemo(() => {
    return groupedByOffice.map(group => {
      // Filter active duty charts for this office
      const officeCharts = activeDutyCharts.filter(dc => dc.office === group.officeId);
      // Sum active schedules (shifts) in those charts
      const activeShiftsCount = officeCharts.reduce((acc, dc) => acc + (dc.schedules?.length || 0), 0);

      return {
        name: group.officeName,
        "Active Shifts": activeShiftsCount
      };
    });
  }, [groupedByOffice, activeDutyCharts]);

  const myCurrentDuty = useMemo(() => {
    if (!myDuties || myDuties.length === 0) return null;
    return myDuties.find((d: Duty) => checkIsActive(d));
  }, [myDuties]);

  const myNextDuty = useMemo(() => {
    if (!myDuties || myDuties.length === 0) return null;

    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // specific helper to parse "HH:MM:SS" -> minutes
    const parseTime = (t: string) => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    // 1. Future date (strictly after today)
    // 2. Today, but start time is in the future AND it is NOT the current active duty
    const futureDuties = myDuties.filter((d: Duty) => {
      if (myCurrentDuty && d.id === myCurrentDuty.id) return false;

      if (d.date > todayLocalISODate) return true;
      if (d.date === todayLocalISODate && d.start_time) {
        const start = parseTime(d.start_time);
        return start > currentMinutes;
      }
      return false;
    });

    // Sort by date then start_time
    futureDuties.sort((a: Duty, b: Duty) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const startA = parseTime(a.start_time || "00:00");
      const startB = parseTime(b.start_time || "00:00");
      return startA - startB;
    });

    return futureDuties.length > 0 ? futureDuties[0] : null;
  }, [myDuties]);

  const currentBSMonthInfo = useMemo(() => {
    const nd = new NepaliDate(new Date());
    return {
      month: nd.getMonth(),
      year: nd.getYear(),
      name: nd.format("MMMM")
    };
  }, []);

  const myDutiesThisMonth = useMemo(() => {
    if (!myDuties || myDuties.length === 0) return 0;
    const { month, year } = currentBSMonthInfo;

    return myDuties.filter((d: Duty) => {
      try {
        const dBS = new NepaliDate(new Date(d.date));
        return dBS.getMonth() === month && dBS.getYear() === year;
      } catch (e) {
        return false;
      }
    }).length;
  }, [myDuties, currentBSMonthInfo]);

  const officeDutiesThisMonth = useMemo(() => {
    if (!officeDuties || officeDuties.length === 0) return 0;
    const { month, year } = currentBSMonthInfo;

    return officeDuties.filter((d: Duty) => {
      try {
        const dBS = new NepaliDate(new Date(d.date));
        return dBS.getMonth() === month && dBS.getYear() === year;
      } catch (e) {
        return false;
      }
    }).length;
  }, [officeDuties, currentBSMonthInfo]);

  const officeDutiesTodayCount = useMemo(() => {
    // Count duties that are either active right now OR scheduled for today
    return officeDuties.filter((d: Duty) => d.date === todayLocalISODate || checkIsActive(d)).length;
  }, [officeDuties, todayLocalISODate]);

  const stats = [
    {
      title: "My Current Duty",
      value: myCurrentDuty ? (myCurrentDuty.schedule_name || "On Duty") : "No Active Duty",
      description: myCurrentDuty ? `${myCurrentDuty.office_name || 'Office'}` : "Not scheduled currently",
      icon: LayoutDashboard,
      trend: myCurrentDuty ? (myCurrentDuty.start_time && myCurrentDuty.end_time ? `${myCurrentDuty.start_time.substring(0, 5)} - ${myCurrentDuty.end_time.substring(0, 5)}` : "") : "Free",
      variant: myCurrentDuty ? "success" : "secondary",
      isDuty: true
    },
    {
      title: "Upcoming Duty",
      value: myNextDuty ? (myNextDuty.schedule_name || "Duty") : "No Upcoming Duty",
      description: myNextDuty ? `${myNextDuty.office_name || 'Office'}` : "Relax",
      icon: Clock,
      trend: myNextDuty ? `${new NepaliDate(new Date(myNextDuty.date)).format("MMMM DD")} (${format(new Date(myNextDuty.date), "MMM d")}) | ${myNextDuty.start_time?.substring(0, 5)} - ${myNextDuty.end_time?.substring(0, 5)}` : "",
      variant: "secondary",
      isDuty: false
    },
    {
      title: `My Duties (${currentBSMonthInfo.name})`,
      value: myDutiesThisMonth.toString(),
      description: "",
      icon: CalendarDays,
      trend: "Your shifts this month",
      colorClass: "bg-slate-100 text-slate-600 hover:bg-slate-200 border-none"
    },
    {
      title: `Office Duties (${currentBSMonthInfo.name})`,
      value: officeDutiesThisMonth.toString(),
      description: "",
      icon: Building2,
      trend: "Total office shifts",
      colorClass: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-none"
    },
    {
      title: "On Duty Today",
      value: officeDutiesTodayCount.toString(),
      description: "",
      icon: Calendar,
      trend: `Staffs on duty in ${user?.office_name || 'Office'}`,
      colorClass: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-none"
    },
  ];

  /* ==================== ACTIONS ==================== */

  const handleAddOffice = async (id: number) => {
    if (selectedOfficeIds.includes(id)) return;
    try {
      await addDashboardOffice(id);
      queryClient.invalidateQueries({ queryKey: ['dashboard-offices'] });
      toast.success("Office added to board");
    } catch (e) {
      toast.error("Failed to add office to board");
    }
  };

  const handleAddMultipleOffices = async () => {
    if (selectedForAdd.length === 0) return;

    setActionLoading(true);
    try {
      await Promise.all(selectedForAdd.map(id => addDashboardOffice(id)));
      queryClient.invalidateQueries({ queryKey: ['dashboard-offices'] });
      toast.success(`${selectedForAdd.length} office(s) added to board`);
      setIsAddCardOpen(false);
      setSelectedForAdd([]);
      setSearchTerm("");
    } catch (e) {
      toast.error("Failed to add some offices to board");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveOffice = async (officeId: number) => {
    const pref = selectedOffices.find((so: DashboardOffice) => so.office === officeId);
    if (!pref) return;
    try {
      await removeDashboardOffice(pref.id);
      queryClient.invalidateQueries({ queryKey: ['dashboard-offices'] });
      toast.success("Office removed from board");
    } catch (e) {
      toast.error("Failed to remove office from board");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      // Find indices
      const oldIndex = selectedOffices.findIndex((item: DashboardOffice) => item.id === active.id);
      const newIndex = selectedOffices.findIndex((item: DashboardOffice) => item.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(selectedOffices, oldIndex, newIndex);

        // Optimistic Update
        queryClient.setQueryData(['dashboard-offices'], newOrder);

        // Call API
        // We need to send { id, order } pairs.
        // The order should be their new index + 1 (1-based or 0-based, backend auto-assigns max+1, so 1-based is safe usually, but let's stick to 0-based or index)
        const reorderPayload = newOrder.map((item: DashboardOffice, index: number) => ({
          id: item.id,
          order: index
        }));

        reorderDashboardOffices(reorderPayload).catch(() => {
          toast.error("Failed to update order");
          queryClient.invalidateQueries({ queryKey: ['dashboard-offices'] });
        });
      }
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Nepal Telecom Duty Chart Management</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border shadow-sm self-start md:self-auto">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-bold text-slate-900">{formattedDates.bs}</span>
            <span className="text-[11px] text-muted-foreground font-medium">{formattedDates.ad}</span>
          </div>
        </div>
      </div>

      {/* Hero Section: Stats Grid with 5 Columns */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className={`hover:border-primary/30 transition-colors border border-slate-200 shadow-sm ${stat.isDuty && myCurrentDuty ? 'bg-emerald-50/30 border-emerald-100' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                <CardTitle className="text-[11px] font-semibold text-slate-500">{stat.title}</CardTitle>
                <div className={`p-1.5 rounded-md ${stat.isDuty && myCurrentDuty ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                  <IconComponent className={`h-3.5 w-3.5 ${stat.isDuty && myCurrentDuty ? 'text-emerald-600' : 'text-primary'}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className={`text-xl font-bold ${stat.isDuty && myCurrentDuty ? 'text-emerald-900' : 'text-slate-900'} truncate`} title={stat.value}>
                  {stat.value}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{stat.description}</p>
                {stat.trend && (
                  <Badge
                    variant={stat.variant as any || "secondary"}
                    className={`mt-1.5 px-1.5 py-0 text-[9px] font-bold ${stat.isDuty && myCurrentDuty ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none' : ''} ${(stat as any).colorClass || ''}`}
                  >
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

          <div className="flex items-center gap-4">

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
                    Select one or more offices to monitor on your dashboard.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search offices..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <ScrollArea className="mt-4 h-[300px] pr-4">
                  <div className="space-y-2">
                    {offices
                      .filter((o: Office) => !selectedOfficeIds.includes(o.id))
                      .filter((o: Office) =>
                        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (o.directorate_name && o.directorate_name.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .sort((a: Office, b: Office) => a.name.localeCompare(b.name))
                      .map((office: Office) => (
                        <div
                          key={office.id}
                          className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between group cursor-pointer ${selectedForAdd.includes(office.id)
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:bg-slate-50 border-slate-100"
                            }`}
                          onClick={() => {
                            const isSelecting = !selectedForAdd.includes(office.id);
                            setSelectedForAdd(prev =>
                              isSelecting
                                ? [...prev, office.id]
                                : prev.filter(id => id !== office.id)
                            );
                            if (isSelecting) {
                              setSearchTerm("");
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedForAdd.includes(office.id)
                              ? "bg-primary border-primary text-white"
                              : "border-slate-300 bg-white"
                              }`}>
                              {selectedForAdd.includes(office.id) && <Plus className="h-3.5 w-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-900">{office.name}</p>
                              <p className="text-[10px] text-slate-500">{office.directorate_name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    {offices.filter((o: Office) => !selectedOfficeIds.includes(o.id)).length === 0 && (
                      <p className="text-center py-8 text-sm text-muted-foreground">All offices are already on your board.</p>
                    )}
                  </div>
                </ScrollArea>

                <div className="mt-6 flex justify-between items-center bg-slate-50 -mx-6 -mb-6 p-4 border-t">
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedForAdd.length > 0 ? `${selectedForAdd.length} selected` : "Select offices to add"}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setIsAddCardOpen(false);
                      setSelectedForAdd([]);
                      setSearchTerm("");
                    }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={selectedForAdd.length === 0 || actionLoading}
                      onClick={handleAddMultipleOffices}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Selected
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {!loading && selectedOfficeIds.length === 0 && (
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

        <div className="flex gap-4 overflow-x-auto snap-x pb-2 scrollbar-visible">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedOffices.map((so: DashboardOffice) => so.id)}
              strategy={horizontalListSortingStrategy}
            >
              {groupedByOffice.map((group) => {
                const dashboardOffice = selectedOffices.find((so: DashboardOffice) => so.office === group.officeId);
                if (!dashboardOffice) return null;

                return (
                  <SortableOfficeCard
                    key={dashboardOffice.id}
                    id={dashboardOffice.id}
                    group={group}
                    expanded={!!expandedOffice[group.officeName]}
                    onToggleExpand={(name) => setExpandedOffice((prev) => ({ ...prev, [name]: !prev[name] }))}
                    onRemove={handleRemoveOffice}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Active Duty Charts
            </CardTitle>
            <CardDescription>Currently active schedules of your selected offices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {activeDutyCharts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active duty charts found.</p>
              ) : (
                activeDutyCharts.map((chart: DutyChart) => (
                  <button
                    key={chart.id}
                    type="button"
                    className="w-full flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-primary hover:text-white hover:border-primary transition-all text-left group"
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
                      <p className="text-xs text-muted-foreground group-hover:text-blue-100 transition-colors">{chart.office_name || `Office ${chart.office}`}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] group-hover:border-white/30 group-hover:text-white transition-colors">
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
              Office-wise Active Shifts
            </CardTitle>
            <CardDescription>Today's active shift distribution of your selected offices</CardDescription>
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
                <Bar dataKey="Active Shifts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
