import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Plus, Phone, Mail, Download, Pencil, Check, ChevronsUpDown, Building2, User as UserIcon } from "lucide-react";
import NepaliDate from "nepali-date-converter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import QuickAssignModal from "./QuickAssignModal";
import CreateDutyChartModal from "./CreateDutyChartModal";
import CreateDutyModal from "./CreateDutyModal";
import ExportPreviewModal from "./ExportPreviewModal";
import api from "@/services/api";
import { getSchedules, type Schedule } from "@/services/schedule";
import { getDutiesFiltered, type Duty, deleteDuty } from "@/services/dutiesService";
import { getUser, type User } from "@/services/users";
import { getOffice, type Office as OfficeInfo } from "@/services/offices";
import { getDutyChartById, type DutyChart as DutyChartInfo } from "@/services/dutichart";
import EditDutyChartModal from "./EditDutyChartModal";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

// Types
export interface DutyAssignment {
  id: string;
  employee_name: string;
  role: string;
  start_time: string;
  end_time: string;
  date: Date;
  shift: string;
  phone_number: string;
  email: string;
  directorate: string;
  department: string;
  position: string;
  office: string;
  avatar: string;
  employee_id?: string;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
}

export interface Office {
  id: string;
  name: string;
}

export interface DutyChart {
  id: string;
  name: string;
}

// Helper function to generate shift colors
const generateShiftColor = (shiftName: string): string => {
  const colors = {
    "Morning": "bg-blue-500",
    "Afternoon": "bg-amber-500",
    "Evening": "bg-purple-500",
    "Night": "bg-indigo-500",
    "Day": "bg-green-500",
    "24 Hours": "bg-red-500",
  };

  return colors[shiftName as keyof typeof colors] || "bg-gray-500";
};





// Main component
export interface CalendarRosterHybridProps {
  offices: Office[];
  dutyCharts: DutyChart[];
  selectedOfficeId?: string;
  selectedDutyChartId?: string;
  onOfficeChange?: (officeId: number) => void;
  onDutyChartChange?: (dutyChartId: number) => void;
  onDutyChartCreated?: (chart: any) => void;
}

export const CalendarRosterHybrid: React.FC<CalendarRosterHybridProps> = ({
  offices,
  dutyCharts,
  selectedOfficeId = "",
  selectedDutyChartId = "",
  onOfficeChange,
  onDutyChartChange,
  onDutyChartCreated
}) => {
  // State - use props as source of truth
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");
  const [officeOpen, setOfficeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [showQuickAssign, setShowQuickAssign] = useState<boolean>(false);
  const [showCreateDutyChart, setShowCreateDutyChart] = useState<boolean>(false);
  const [showEditDutyChart, setShowEditDutyChart] = useState<boolean>(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);


  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Data sources
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState<boolean>(false);
  const [schedulesError, setSchedulesError] = useState<string>("");
  const [createDutyOpen, setCreateDutyOpen] = useState<boolean>(false);
  const [createDutyContext, setCreateDutyContext] = useState<{ dateISO: string; scheduleId: number } | null>(null);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [dutiesLoading, setDutiesLoading] = useState<boolean>(false);
  const [dutiesError, setDutiesError] = useState<string>("");
  const [usersCache, setUsersCache] = useState<Map<number, User>>(new Map());
  const [officesCache, setOfficesCache] = useState<Map<number, OfficeInfo>>(new Map());
  const [selectedDutyChartInfo, setSelectedDutyChartInfo] = useState<DutyChartInfo | null>(null);

  const { hasPermission, canManageOffice, user } = useAuth();

  const sortedOffices = useMemo(() => {
    if (!user?.office_id) return offices;
    return [...offices].sort((a, b) => {
      const isAAssigned = Number(a.id) === Number(user.office_id);
      const isBAssigned = Number(b.id) === Number(user.office_id);
      if (isAAssigned && !isBAssigned) return -1;
      if (!isAAssigned && isBAssigned) return 1;
      return 0;
    });
  }, [offices, user?.office_id]);

  // Fetch selected duty chart details (office, date range) for permission scoping
  useEffect(() => {
    const dutyChartIdNum = selectedDutyChartId ? parseInt(selectedDutyChartId) : undefined;
    if (!dutyChartIdNum) {
      setSelectedDutyChartInfo(null);
      return;
    }
    (async () => {
      try {
        const info = await getDutyChartById(dutyChartIdNum);
        setSelectedDutyChartInfo(info);
      } catch (e) {
        console.error("Failed to load duty chart info:", e);
        setSelectedDutyChartInfo(null);
      }
    })();
  }, [selectedDutyChartId]);

  // Remove old auto-select effects since parent handles it now


  useEffect(() => {
    const officeId = selectedOfficeId ? parseInt(selectedOfficeId) : undefined;
    const dutyChartId = selectedDutyChartId ? parseInt(selectedDutyChartId) : undefined;

    // Only fetch when a duty chart is selected; office is optional filter
    if (!dutyChartId) {
      setSchedules([]);
      return;
    }

    const fetchSchedules = async () => {
      try {
        setSchedulesLoading(true);
        setSchedulesError("");
        const res = await getSchedules(officeId, dutyChartId);
        setSchedules(res || []);
      } catch (err) {
        console.error("Error fetching schedules:", err);
        setSchedules([]);
        setSchedulesError("Failed to load schedules for selected duty chart.");
      } finally {
        setSchedulesLoading(false);
      }
    };

    fetchSchedules();
  }, [selectedOfficeId, selectedDutyChartId]);

  // Fetch duties tied to selected duty chart (optionally filtered by office)
  const fetchDuties = useCallback(async () => {
    const officeId = selectedOfficeId ? parseInt(selectedOfficeId) : undefined;
    const dutyChartId = selectedDutyChartId ? parseInt(selectedDutyChartId) : undefined;

    if (!dutyChartId) {
      setDuties([]);
      return;
    }

    try {
      setDutiesLoading(true);
      setDutiesError("");
      const res = await getDutiesFiltered({ duty_chart: dutyChartId, office: officeId });
      setDuties(res || []);
    } catch (err) {
      console.error("Error fetching duties:", err);
      setDuties([]);
      setDutiesError("Failed to load duties for selected duty chart.");
    } finally {
      setDutiesLoading(false);
    }
  }, [selectedOfficeId, selectedDutyChartId]);

  useEffect(() => {
    fetchDuties();
  }, [fetchDuties]);

  // Calculate if user can manage the currently selected chart
  const canManageSelectedChart = useMemo(() => {
    if (!selectedDutyChartInfo) return false;

    // 1. Must have general permission to edit charts
    if (!hasPermission('duties.edit_chart')) return false;

    // 2. Must have scope for this specific chart's office
    const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
      ? Number((selectedDutyChartInfo.office as any)?.id)
      : Number(selectedDutyChartInfo.office);

    return canManageOffice(chartOfficeId) || hasPermission("duties.assign_any_office_employee");
  }, [selectedDutyChartInfo, hasPermission, canManageOffice]);

  // Calculate if user can create duties for the currently selected chart
  const canCreateDutyForSelectedChart = useMemo(() => {
    if (!selectedDutyChartInfo) return false;

    // Check base permission
    if (!hasPermission('duties.create_duty')) return false;

    // Resolve chart office
    const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
      ? Number((selectedDutyChartInfo.office as any)?.id)
      : Number(selectedDutyChartInfo.office);

    // Security: Restrict to assigned office manager
    return canManageOffice(chartOfficeId);
  }, [selectedDutyChartInfo, hasPermission, canManageOffice]);

  // Enrich duties with user details (phone/email)
  useEffect(() => {
    const missingUserIds = new Set<number>();
    (duties || []).forEach((d) => {
      if (d.user && !usersCache.has(d.user)) missingUserIds.add(d.user);
    });
    if (missingUserIds.size === 0) return;
    const fetchUsers = async () => {
      const newCache = new Map(usersCache);
      await Promise.all(Array.from(missingUserIds).map(async (id) => {
        try {
          const u = await getUser(id);
          newCache.set(id, u);
        } catch (e) {
          console.error("Failed to fetch user detail:", e);
        }
      }));
      setUsersCache(newCache);
    };
    fetchUsers();
  }, [duties]);

  // Enrich duties with office details (directorate/department via office)
  useEffect(() => {
    const missingOfficeIds = new Set<number>();
    (duties || []).forEach((d) => {
      if (d.office && !officesCache.has(d.office)) missingOfficeIds.add(d.office);
      const u = d.user ? usersCache.get(d.user) : null;
      if (u?.office && !officesCache.has(u.office)) missingOfficeIds.add(u.office);
    });
    if (missingOfficeIds.size === 0) return;
    const fetchOffices = async () => {
      const newCache = new Map(officesCache);
      await Promise.all(Array.from(missingOfficeIds).map(async (id) => {
        try {
          const o = await getOffice(id);
          newCache.set(id, o);
        } catch (e) {
          console.error("Failed to fetch office detail:", e);
        }
      }));
      setOfficesCache(newCache);
    };
    fetchOffices();
  }, [duties, usersCache]);

  // Derive unique shifts from schedules (by name + time)
  const shifts = useMemo<Shift[]>(() => {
    const map = new Map<string, Shift>();
    schedules.forEach((s) => {
      const key = `${s.name ?? "Shift"}|${s.start_time}|${s.end_time}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: s.name || "Shift",
          start_time: s.start_time,
          end_time: s.end_time,
          color: generateShiftColor(s.name || ""),
        });
      }
    });
    return Array.from(map.values());
  }, [schedules]);

  const shiftToScheduleId = useMemo(() => {
    const m = new Map<string, number>();
    schedules.forEach((s) => {
      const key = `${s.name ?? "Shift"}|${s.start_time}|${s.end_time}`;
      if (!m.has(key)) m.set(key, s.id);
    });
    return m;
  }, [schedules]);

  // Map duties from backend to UI-friendly assignment blocks
  const assignments = useMemo<DutyAssignment[]>(() => {
    const resolveAvatar = (path: string | null | undefined) => {
      if (!path) return "";
      if (path.startsWith("http")) return path;
      const backend = import.meta.env.VITE_BACKEND_HOST || "http://localhost:8000";
      return `${backend}${path}`;
    };

    return (duties || []).map((d) => {
      const name = d.user_name || "Unknown";
      const userDetail = d.user ? usersCache.get(d.user) : undefined;
      const officeDetail = d.office ? officesCache.get(d.office) : undefined;
      return {
        id: String(d.id),
        employee_name: name,
        role: "",
        start_time: d.start_time || "",
        end_time: d.end_time || "",
        date: new Date(d.date),
        shift: d.schedule_name || "Shift",
        phone_number: d.phone_number || userDetail?.phone_number || "",
        email: d.email || userDetail?.email || "",
        directorate: d.user_directorate_name || (userDetail as any)?.directorate_name || officeDetail?.directorate_name || "",
        department: d.user_department_name || (userDetail as any)?.department_name || officeDetail?.department_name || "",
        position: d.position_name || userDetail?.position_name || "",
        office: d.user_office_name || (userDetail as any)?.office_name || d.office_name || "",
        avatar: resolveAvatar(userDetail?.image),
        employee_id: userDetail?.employee_id || "",
      } as DutyAssignment;
    });
  }, [duties, usersCache, officesCache]);

  const selectedProfile = useMemo(() =>
    assignments.find(a => a.id === selectedAssignmentId) || null
    , [assignments, selectedAssignmentId]);

  // Derived state
  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 0 }), [currentWeek]);
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Group assignments by day and shift for easier rendering
  const groupedAssignments = useMemo(() => {
    const grouped: Record<string, Record<string, DutyAssignment[]>> = {};

    weekDays.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      grouped[dateStr] = {};

      shifts.forEach(shift => {
        grouped[dateStr][shift.id] = assignments.filter(
          a => isSameDay(a.date, day) && a.shift === shift.name
        );
      });
    });

    return grouped;
  }, [assignments, weekDays, shifts]);

  // Handlers
  const handlePrevWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  const handleQuickAssign = () => {
    setShowQuickAssign(true);
  };

  const handleAssignmentClick = (assignment: DutyAssignment) => {
    setSelectedAssignmentId(assignment.id);
    setShowProfileModal(true);
  };

  const canDeleteDuty = useMemo(() => hasPermission('duties.delete'), [hasPermission]);

  const handleDeleteDuty = async () => {
    if (!selectedProfile?.id) return;
    try {
      await deleteDuty(parseInt(selectedProfile.id));
      toast.success("Duty deleted");
      setShowDeleteConfirm(false);
      setShowProfileModal(false);
      await fetchDuties();
    } catch (e: any) {
      toast.error("Failed to delete duty");
    }
  };

  const getShiftColor = (shiftName: string): string => {
    const shift = shifts.find(s => s.name === shiftName);
    return shift ? shift.color : "bg-gray-500";
  };

  const formatTime = (time: string): string => {
    // Convert 24-hour format to 12-hour format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Validate a given day against the selected duty chart's date range
  const isOutsideChartRange = (day: Date): boolean => {
    if (!selectedDutyChartInfo) return false;
    const start = selectedDutyChartInfo?.effective_date ? new Date(selectedDutyChartInfo.effective_date) : null;
    const end = selectedDutyChartInfo?.end_date ? new Date(selectedDutyChartInfo.end_date) : null;
    if (start && day < start) return true;
    if (end && day > end) return true;
    return false;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Popover open={officeOpen} onOpenChange={setOfficeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={officeOpen}
                className="w-full md:w-[250px] justify-between"
              >
                {selectedOfficeId
                  ? offices.find((office) => String(office.id) === String(selectedOfficeId))?.name
                  : "Select Office"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full md:w-[250px] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search office..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>No office found.</CommandEmpty>
                  <CommandGroup>
                    {searchQuery === "" && (
                      <CommandItem
                        value="Select Office"
                        onSelect={() => {
                          onOfficeChange?.(0);
                          setOfficeOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedOfficeId ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Select Office
                      </CommandItem>
                    )}
                    {sortedOffices
                      .filter(office =>
                        office.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((office) => {
                        const isAssigned = user?.office_id && Number(office.id) === Number(user.office_id);
                        return (
                          <CommandItem
                            key={office.id}
                            value={office.name}
                            onSelect={() => {
                              onOfficeChange?.(Number(office.id));
                              setOfficeOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    String(selectedOfficeId) === String(office.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {office.name}
                              </div>
                              {isAssigned && (
                                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                  My Office
                                </Badge>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Select
            value={selectedDutyChartId}
            onValueChange={(val) => onDutyChartChange?.(parseInt(val))}
          >
            <SelectTrigger className="w-full md:w-[200px] h-10 font-medium">
              <SelectValue placeholder="Select Duty Chart" />
            </SelectTrigger>
            <SelectContent>
              {dutyCharts.length === 0 && (
                <SelectItem value="none" disabled>
                  No charts available
                </SelectItem>
              )}
              {dutyCharts.map((chart) => (
                <SelectItem key={chart.id} value={chart.id}>
                  {chart.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            <button
              onClick={() => setDateMode("BS")}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              BS
            </button>
            <button
              onClick={() => setDateMode("AD")}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
            >
              AD
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center">
            {dateMode === "AD" ? (
              <>
                <div className="text-sm font-medium">
                  {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new NepaliDate(weekDays[0]).format("MMMM D, YYYY")} - {new NepaliDate(weekDays[6]).format("MMMM D, YYYY")}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-orange-600">
                  {new NepaliDate(weekDays[0]).format("MMMM D")} - {new NepaliDate(weekDays[6]).format("MMMM D, YYYY")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
                </div>
              </>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              className="pl-8"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {hasPermission('duties.create_chart') && (
            <Button
              variant="default"
              onClick={() => setShowCreateDutyChart(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Create Duty Chart
            </Button>
          )}
          {canManageSelectedChart && (
            <Button
              variant="outline"
              onClick={() => setShowEditDutyChart(true)}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit Duty Chart
            </Button>
          )}
          {selectedDutyChartId && hasPermission('duties.export_chart') && (
            <Button
              variant="outline"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          )}
        </div>
      </div>



      {/* Mobile hint */}
      <div className="md:hidden text-xs text-muted-foreground px-1">Swipe →</div>

      {/* Calendar Grid (Horizontally scrollable) */}
      {!selectedOfficeId || selectedOfficeId === "0" || selectedOfficeId === "" ? (
        <div className="flex flex-col items-center justify-center h-[400px] border rounded-md border-dashed bg-muted/20 text-muted-foreground">
          <p className="text-lg font-medium">No Office Selected</p>
          <p className="text-sm">Please select an office from the dropdown above to view the roster.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-2">
          <div className="min-w-full rounded-md border">
            {/* Header Row */}
            <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b">
              <div className="border-r p-2 text-center font-medium sticky left-0 z-10 bg-background min-w-[200px]">Shifts</div>
              {weekDays.map(day => (
                <div
                  key={day.toString()}
                  className="p-2 text-center font-medium border-l last:border-r min-w-[160px]"
                >
                  <div>{format(day, "EEE")}</div>
                  {dateMode === "AD" ? (
                    <>
                      <div className="text-sm text-muted-foreground">{format(day, "MMM d")}</div>
                      <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
                        {new NepaliDate(day).format("MMMM D")}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm text-orange-600 dark:text-orange-400">
                        {new NepaliDate(day).format("MMMM D")}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground">
                        {format(day, "MMM d")}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Shifts Rows */}
            {shifts.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                {schedulesLoading
                  ? "Loading schedules..."
                  : schedulesError || "No shifts found for the selected duty chart."
                }
              </div>
            )}
            {shifts.map((shift, shiftIndex) => (
              <div key={shift.id} className="grid grid-cols-[200px_repeat(7,1fr)] border-b last:border-b-0">
                {/* Shift Column */}
                <div className={`border-r p-2 bg-opacity-60 sticky left-0 z-10 min-w-[200px]`}
                  style={{
                    backgroundColor: (
                      [
                        '#fff5f5', '#fff7ed', '#fffbeb', '#f7fee7', '#ecfdf5',
                        '#f0fdf4', '#f0f9ff', '#eff6ff', '#eef2ff', '#f5f3ff'
                      ][shiftIndex % 10]
                    )
                  }}
                >
                  <div className="font-medium">{shift.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                  </div>
                </div>

                {/* Day columns */}
                {weekDays.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayAssignments = groupedAssignments[dateStr]?.[shift.id] || [];

                  return (
                    <div
                      key={day.toString()}
                      className={cn(
                        "p-2 min-h-[100px] border-l last:border-r transition-shadow overflow-hidden min-w-[160px]",
                        canCreateDutyForSelectedChart ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "cursor-default"
                      )}
                      style={{
                        backgroundColor: (
                          [
                            '#fff5f5', '#fff7ed', '#fffbeb', '#f7fee7', '#ecfdf5',
                            '#f0fdf4', '#f0f9ff', '#eff6ff', '#eef2ff', '#f5f3ff'
                          ][shiftIndex % 10]
                        )
                      }}
                      onClick={() => {
                        if (!selectedOfficeId || !selectedDutyChartId) return;
                        if (isOutsideChartRange(day)) {
                          toast.error(
                            selectedDutyChartInfo?.end_date
                              ? `Duty date must be on or before ${selectedDutyChartInfo.end_date}.`
                              : "Duty date is before chart start date."
                          );
                          return;
                        }
                        if (!canCreateDutyForSelectedChart) {
                          if (!hasPermission('duties.create_duty')) {
                            toast.error("You do not have permission to assign duties.");
                            return;
                          }
                          toast.error("Office Admin can only assign Duty for His Office");
                          return;
                        }
                        let scheduleId = shiftToScheduleId.get(shift.id);
                        if (!scheduleId) {
                          const match = schedules.find(
                            (s) => (s.name || "Shift") === shift.name && s.start_time === shift.start_time && s.end_time === shift.end_time
                          );
                          scheduleId = match?.id;
                        }
                        if (!scheduleId) return;
                        console.log('Roster cell click', { dateISO: dateStr, shiftId: shift.id, scheduleId });
                        setCreateDutyContext({ dateISO: dateStr, scheduleId });
                        setCreateDutyOpen(true);
                      }}
                    >
                      {dayAssignments.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {dayAssignments.map(assignment => (
                            <Tooltip key={assignment.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex items-center gap-2 p-2 rounded-md border bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow w-full max-w-full"
                                  onClick={(e) => { e.stopPropagation(); handleAssignmentClick(assignment); }}
                                >
                                  <div className={`w-1 h-full min-h-[40px] rounded-full ${getShiftColor(assignment.shift)}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-xs sm:text-sm truncate">{assignment.employee_name}</div>
                                    <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                                      {assignment.phone_number || "-"}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm font-medium">{assignment.employee_name}</div>
                                <div className="text-xs text-muted-foreground">{assignment.phone_number || "-"}</div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Duty Chart Modal */}
      <CreateDutyChartModal
        open={showCreateDutyChart}
        onOpenChange={setShowCreateDutyChart}
        onCreated={onDutyChartCreated}
      />

      {/* Edit Duty Chart Modal */}
      <EditDutyChartModal
        open={showEditDutyChart}
        onOpenChange={setShowEditDutyChart}
      />

      {/* Quick Assign Modal */}
      <QuickAssignModal
        open={showQuickAssign}
        onOpenChange={setShowQuickAssign}
        offices={offices}
        dutyCharts={dutyCharts}
        shifts={shifts}
      />
      {selectedDutyChartId && (
        <ExportPreviewModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          dutyChartId={parseInt(selectedDutyChartId)}
          startDateISO={format(weekDays[0], "yyyy-MM-dd")}
          endDateISO={format(weekDays[6], "yyyy-MM-dd")}
        />
      )}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader className="flex flex-col items-center justify-center pb-6 border-b">
            <div className="relative mb-3">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                <AvatarImage src={selectedProfile?.avatar} alt={selectedProfile?.employee_name} className="object-cover" />
                <AvatarFallback className="text-2xl">{selectedProfile?.employee_name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
            </div>
            <DialogTitle className="text-2xl font-bold text-center mb-2">
              {selectedProfile?.employee_name}
            </DialogTitle>
            {selectedProfile?.phone_number && (
              <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                <Phone className="h-3.5 w-3.5" />
                <span>{selectedProfile.phone_number}</span>
              </div>
            )}
            <DialogDescription className="sr-only">
              Profile Details
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs sm:text-sm">
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Directorate:</span>
              <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.directorate}</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Department:</span>
              <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.department}</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Office:</span>
              <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.office}</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Position:</span>
              <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.position || '-'}</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Phone:</span>
              <span className="col-span-2 md:col-span-3 font-semibold flex items-center gap-2">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">{selectedProfile?.phone_number}</span>
              </span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Email:</span>
              <span className="col-span-2 md:col-span-3 flex items-center gap-2 break-words">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">{selectedProfile?.email}</span>
              </span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
              <span className="md:text-right font-medium">Duty Time:</span>
              <span className="col-span-2 md:col-span-3">
                <span className="text-xs sm:text-sm">{selectedProfile?.start_time} - {selectedProfile?.end_time}</span>
              </span>
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setShowProfileModal(false)} className="w-full sm:w-auto">
              Close
            </Button>
            {canDeleteDuty && (
              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="w-full sm:w-auto">
                    Delete Duty
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this duty?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The selected duty will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteDuty}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="button" className="flex items-center gap-2 w-full sm:w-auto">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm">Call</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {createDutyContext && selectedOfficeId && selectedDutyChartId && (
        <CreateDutyModal
          open={createDutyOpen}
          onOpenChange={(open) => {
            setCreateDutyOpen(open);
            if (!open) {
              setCreateDutyContext(null);
            }
          }}
          officeId={parseInt(selectedOfficeId)}
          dutyChartId={parseInt(selectedDutyChartId)}
          dateISO={createDutyContext.dateISO}
          scheduleId={createDutyContext.scheduleId}
          onCreated={fetchDuties}
        />
      )}
    </div>
  );
};
