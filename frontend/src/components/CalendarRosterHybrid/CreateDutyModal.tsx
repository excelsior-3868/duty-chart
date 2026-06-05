import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUsers, getUser, type User } from "@/services/users";
import { getOffice, type Office } from "@/services/offices";
import { bulkUpsertDuties, createDuty, getDutiesFiltered } from "@/services/dutiesService";
import { getSchedules, getScheduleById, type Schedule } from "@/services/schedule";
import { type DutyChart } from "@/services/dutichart";
import { toast } from "sonner";
import NepaliDate from "nepali-date-converter";
import { Calendar as CalendarIcon, Hash, Plus, SwitchCamera, CalendarRange, Search, Check, ChevronsUpDown, Loader2, X, ListFilter } from "lucide-react";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import { addDays, eachDayOfInterval, format, parseISO, isSameDay } from "date-fns";
import { useAuth } from "@/context/AuthContext";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";


interface CreateDutyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: number;
  dutyChartId: number;
  dutyChartInfo?: DutyChart | null;
  dateISO: string; // yyyy-MM-dd
  scheduleId?: number; // resolved schedule id for the clicked shift
  onCreated?: () => void; // callback to refresh duties after successful create
}

export const CreateDutyModal: React.FC<CreateDutyModalProps> = ({
  open,
  onOpenChange,
  officeId,
  dutyChartId,
  dutyChartInfo,
  dateISO: initialDateISO,
  scheduleId: initialScheduleId,
  onCreated,
}) => {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [officeDetail, setOfficeDetail] = useState<Office | null>(null);
  const [scheduleDetail, setScheduleDetail] = useState<Schedule | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

  const [dateISO, setDateISO] = useState(initialDateISO);
  const [endDateISO, setEndDateISO] = useState(initialDateISO);
  const [selectedDates, setSelectedDates] = useState<string[]>([initialDateISO]);
  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");
  const [selectionMode, setSelectionMode] = useState<"single" | "range" | "multiple">("single");
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeSource, setEmployeeSource] = useState<"all" | "pool">("all");
  const [assignedOnDate, setAssignedOnDate] = useState<number[]>([]);

  const minDate = dutyChartInfo?.effective_date || "";
  const maxDate = dutyChartInfo?.end_date || "";

  const formatDisplayDate = (iso: string) => {
    if (!iso) return "—";
    if (dateMode === "BS") {
      const nd = new NepaliDate(new Date(iso));
      return `${(nd.getMonth() + 1).toString().padStart(2, '0')}/${nd.getDate().toString().padStart(2, '0')}/${nd.getYear()}`;
    }
    return format(parseISO(iso), "MM/dd/yyyy");
  };


  useEffect(() => {
    if (initialDateISO) {
      setDateISO(initialDateISO);
      setEndDateISO(initialDateISO);
      setSelectedDates([initialDateISO]);
    }
  }, [initialDateISO]);


  useEffect(() => {
    if (initialScheduleId) {
      setSelectedScheduleId(String(initialScheduleId));
    } else {
      setSelectedScheduleId("");
    }
  }, [initialScheduleId]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        setLoading(true);
        const canAssignAny = hasPermission("duties.assign_any_office_employee");
        const res = await getUsers(canAssignAny ? undefined : officeId, true, searchQuery, 100);
        setUsers(res);
      } catch (e) {
        console.error("Failed to load users:", e);
        toast.error("Failed to load employees.");
      } finally {
        setLoading(false);
      }
    };
    
    // Immediate load for initial or cleared search, otherwise debounce
    if (searchQuery === "") {
        load();
        return;
    }

    const timer = setTimeout(() => {
        load();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [open, officeId, hasPermission, searchQuery]);

  // For the Pool source we exclude employees already assigned on the focused
  // date (per-day exclusivity). Refetch whenever the date or chart changes.
  useEffect(() => {
    if (!open || employeeSource !== "pool" || !dateISO) {
      return;
    }
    let cancelled = false;
    const loadAssigned = async () => {
      try {
        const existing = await getDutiesFiltered({ duty_chart: dutyChartId, date: dateISO });
        if (!cancelled) {
          setAssignedOnDate(existing.map((d: any) => d.user).filter((id: any): id is number => typeof id === "number"));
        }
      } catch (e) {
        if (!cancelled) setAssignedOnDate([]);
      }
    };
    loadAssigned();
    return () => { cancelled = true; };
  }, [open, employeeSource, dateISO, dutyChartId]);

  // Normalized employee options for the selector, driven by the chosen source.
  const employeeOptions = useMemo(() => {
    if (employeeSource === "pool") {
      const pool = dutyChartInfo?.pool_members_detail || [];
      const q = searchQuery.trim().toLowerCase();
      return pool
        .filter(m => !assignedOnDate.includes(m.id))
        .filter(m => {
          if (!q) return true;
          return `${m.employee_id || ""} ${m.full_name || ""}`.toLowerCase().includes(q);
        })
        .map(m => ({
          id: m.id,
          label: `${m.employee_id || m.id} - ${m.full_name || "Unknown"}`,
          office_name: m.office_name || "N/A",
        }));
    }
    return users.map(u => ({
      id: u.id,
      label: `${u.employee_id || u.username} - ${u.full_name || u.username}`,
      office_name: u.office_name || "N/A",
    }));
  }, [employeeSource, users, dutyChartInfo, assignedOnDate, searchQuery]);

  // If the selected employee is no longer in the active source's list, clear it.
  useEffect(() => {
    if (selectedUserId && !employeeOptions.some(o => String(o.id) === selectedUserId)) {
      setSelectedUserId("");
    }
  }, [employeeOptions, selectedUserId]);

  useEffect(() => {
    if (!open) return;
    const loadOffice = async () => {
      try {
        const info = await getOffice(officeId);
        setOfficeDetail(info);
      } catch (e) { }
    };
    loadOffice();
  }, [open, officeId]);

  useEffect(() => {
    if (!open || !selectedScheduleId) {
      setScheduleDetail(null);
      return;
    }
    const loadSchedule = async () => {
      try {
        const s = await getScheduleById(parseInt(selectedScheduleId));
        setScheduleDetail(s);
      } catch (e) { }
    };
    loadSchedule();
  }, [open, selectedScheduleId]);

  useEffect(() => {
    if (!open || initialScheduleId) return;
    const loadSchedules = async () => {
      try {
        const res = await getSchedules(officeId, dutyChartId);
        setSchedules(res);
      } catch (e) {
        console.error("Failed to load schedules:", e);
      }
    };
    loadSchedules();
  }, [open, initialScheduleId, officeId, dutyChartId]);

  useEffect(() => {
    if (!open || !selectedUserId) {
      setSelectedUserDetail(null);
      return;
    }
    const found = users.find(u => String(u.id) === selectedUserId);
    if (found) {
      setSelectedUserDetail(found);
    } else {
      const loadUser = async () => {
        try {
          const detail = await getUser(parseInt(selectedUserId));
          setSelectedUserDetail(detail);
        } catch (e) { }
      };
      loadUser();
    }
  }, [open, selectedUserId, users]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Please select an employee");
      return;
    }

    if (selectionMode === "single") {
        if (minDate && dateISO < minDate) {
            toast.error(`Date cannot be before Duty Chart start date (${formatDisplayDate(minDate)})`);
            return;
        }
        if (maxDate && dateISO > maxDate) {
            toast.error(`Date cannot be after Duty Chart end date (${formatDisplayDate(maxDate)})`);
            return;
        }
    } else if (selectionMode === "range") {
        if (minDate && dateISO < minDate) {
            toast.error(`Start date cannot be before Duty Chart start date (${formatDisplayDate(minDate)})`);
            return;
        }
        if (maxDate && endDateISO > maxDate) {
            toast.error(`End date cannot be after Duty Chart end date (${formatDisplayDate(maxDate)})`);
            return;
        }
        if (new Date(endDateISO) < new Date(dateISO)) {
            toast.error("End date cannot be before start date");
            return;
        }
    } else if (selectionMode === "multiple") {
        if (selectedDates.length === 0) {
            toast.error("Please select at least one date");
            return;
        }
        for (const d of selectedDates) {
            if ((minDate && d < minDate) || (maxDate && d > maxDate)) {
                toast.error(`Some dates are outside the chart range (${formatDisplayDate(minDate)} - ${formatDisplayDate(maxDate)})`);
                return;
            }
        }
    }

    const finalScheduleId = initialScheduleId || parseInt(selectedScheduleId);
    if (!finalScheduleId) {
      toast.error("Please select a shift");
      return;
    }

    const timeToMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const isOverlap = (start1: string, end1: string, start2: string, end2: string) => {
      const s1 = timeToMinutes(start1);
      const e1 = timeToMinutes(end1);
      const s2 = timeToMinutes(start2);
      const e2 = timeToMinutes(end2);
      return s1 < e2 && e1 > s2;
    };

    try {
      setLoading(true);

      let datesToCheck: string[] = [];
      if (selectionMode === "single") {
        datesToCheck = [dateISO];
      } else if (selectionMode === "range") {
        datesToCheck = eachDayOfInterval({ start: parseISO(dateISO), end: parseISO(endDateISO) }).map(d => format(d, "yyyy-MM-dd"));
      } else {
        datesToCheck = selectedDates;
      }

      if (selectionMode === "single") {
        const existing = await getDutiesFiltered({ user: parseInt(selectedUserId), date: dateISO });
        let currentSchedule = scheduleDetail;
        if (!currentSchedule && finalScheduleId) {
          currentSchedule = schedules.find(s => s.id === finalScheduleId) || null;
          if (!currentSchedule && initialScheduleId) {
            currentSchedule = await getScheduleById(initialScheduleId);
          }
        }

        if (currentSchedule && existing.length > 0) {
          for (const d of existing) {
            if (d.start_time && d.end_time && currentSchedule.start_time && currentSchedule.end_time) {
              if (isOverlap(currentSchedule.start_time, currentSchedule.end_time, d.start_time, d.end_time)) {
                const offName = d.office_name || "another office";
                toast.error(`Time overlap detected! User already is assigned to ${d.schedule_name} at ${offName} (${d.start_time} - ${d.end_time}) on this date.`);
                setLoading(false);
                return;
              }
            }
          }
        }
      }

      if (selectionMode !== "single") {
        const duties = datesToCheck.map(d => ({
          date: d,
          user: parseInt(selectedUserId),
          office: officeId,
          schedule: finalScheduleId,
          duty_chart: dutyChartId,
          is_completed: false,
          currently_available: true,
        }));

        const res = await bulkUpsertDuties(duties);
        toast.success(`Successfully assigned ${res.created + res.updated} duties`);
      } else {
        await createDuty({
          date: dateISO,
          user: parseInt(selectedUserId),
          office: officeId,
          schedule: finalScheduleId,
          duty_chart: dutyChartId,
          is_completed: false,
          currently_available: true,
        });
        toast.success("Duty created successfully");
      }

      onCreated?.();
      onOpenChange(false);
      setSelectedUserId("");
    } catch (error: any) {
      console.error("Error creating duty:", error);
      let msg = "Failed to create duty.";
      const data = error?.response?.data;
      if (data) {
        if (typeof data === 'string') {
          msg = "Internal Server Error (500). Please check backend logs.";
        } else if (data.non_field_errors) {
          msg = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else if (data.detail) {
          msg = data.detail;
        } else {
          const keys = Object.keys(data);
          if (keys.length > 0) {
            const firstKey = keys[0];
            const firstError = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
            msg = typeof firstError === 'string' ? `${firstKey}: ${firstError}` : JSON.stringify(firstError);
          }
        }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between mr-6">
            <div>
              <DialogTitle>Create Duty</DialogTitle>
              <DialogDescription>
                Assign an employee to this schedule for a specific date.
                {dutyChartInfo && (
                  <span className="block mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 w-fit shadow-sm">
                    Effective: {formatDisplayDate(minDate)} — {formatDisplayDate(maxDate)}
                  </span>
                )}
              </DialogDescription>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setDateMode("BS")}
                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
              >
                BS
              </button>
              <button
                type="button"
                onClick={() => setDateMode("AD")}
                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
              >
                AD
              </button>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="text-xs sm:text-sm flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Employee *</label>
                  <div className="flex bg-gray-100 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setEmployeeSource("all")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all ${employeeSource === "all" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      All employees
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployeeSource("pool")}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all ${employeeSource === "pool" ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Pool ({(dutyChartInfo?.pool_members_detail || []).length})
                    </button>
                  </div>
                </div>
              <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeSearchOpen}
                    className="w-full justify-between font-normal bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                  >
                    {selectedUserId
                      ? (() => {
                        const o = employeeOptions.find((opt) => String(opt.id) === selectedUserId);
                        return o ? `${o.label} (${o.office_name})` : "Select Employee";
                      })()
                      : "Select Employee"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search employee by name, ID or email..." 
                      onValueChange={setSearchQuery}
                    />
                    <CommandList className="max-h-[350px]">
                        {loading && employeeSource === "all" && (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                          </div>
                        )}
                        {!(loading && employeeSource === "all") && employeeOptions.length === 0 && (
                          <div className="py-6 text-center text-sm text-slate-500">
                            {employeeSource === "pool"
                              ? "No standby employees available for this date."
                              : "No employee found."}
                          </div>
                        )}
                        <CommandGroup>
                          {employeeOptions.map((o) => (
                            <CommandItem
                              key={o.id}
                              value={`${o.label} ${o.office_name}`}
                              onSelect={() => {
                                setSelectedUserId(String(o.id));
                                setEmployeeSearchOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center">
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedUserId === String(o.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-medium">{o.label}</span>
                                </div>
                                <div className="ml-6 flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border text-slate-600 font-semibold text-[10px]">{o.office_name}</span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {!initialScheduleId && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Shift *</label>
                <Select
                  value={selectedScheduleId}
                  onValueChange={setSelectedScheduleId}
                  disabled={loading}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.start_time} - {s.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col p-2 bg-slate-50 rounded-lg border border-slate-200 gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium">Assignment Mode</span>
                </div>
                <div className="flex bg-white border rounded-md p-1 items-center">
                  {(["single", "range", "multiple"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectionMode(mode)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all capitalize ${selectionMode === mode ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >{mode}</button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight italic">
                {selectionMode === "single" && "Assign to a specific date."}
                {selectionMode === "range" && "Assign to a continuous range of dates."}
                {selectionMode === "multiple" && "Pick multiple specific dates from the calendar."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {selectionMode !== "multiple" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{selectionMode === "range" ? "Start Date *" : "Date *"}</label>
                    {dateMode === "AD" ? (
                      <GregorianDatePicker
                        value={dateISO}
                        onChange={setDateISO}
                        minDate={minDate ? parseISO(minDate) : undefined}
                        maxDate={maxDate ? parseISO(maxDate) : undefined}
                      />
                    ) : (
                      <NepaliDatePicker
                        value={dateISO}
                        onChange={setDateISO}
                        minDate={minDate}
                        maxDate={maxDate}
                      />
                    )}
                  </div>

                  {selectionMode === "range" && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">End Date *</label>
                      {dateMode === "AD" ? (
                        <GregorianDatePicker
                          value={endDateISO}
                          onChange={setEndDateISO}
                          minDate={minDate ? parseISO(minDate) : undefined}
                          maxDate={maxDate ? parseISO(maxDate) : undefined}
                        />
                      ) : (
                        <NepaliDatePicker
                          value={endDateISO}
                          onChange={setEndDateISO}
                          minDate={minDate}
                          maxDate={maxDate}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Dates *</label>
                  <div className="border rounded-md p-3 bg-slate-50/50">
                    <MultipleDateSelector
                      minDate={minDate}
                      maxDate={maxDate}
                      selectedDates={selectedDates}
                      onDatesChange={setSelectedDates}
                      dateMode={dateMode}
                    />
                    
                    <div className="mt-3 flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {selectedDates.length === 0 && <span className="text-[10px] text-muted-foreground italic">No dates selected yet...</span>}
                      {selectedDates.map(d => (
                        <Badge key={d} variant="secondary" className="pl-2 pr-1 py-0.5 gap-1 text-[10px] font-bold">
                          {formatDisplayDate(d)}
                          <button 
                            type="button" 
                            onClick={() => setSelectedDates(selectedDates.filter(x => x !== d))}
                            className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center gap-3 px-1">
              <span className="font-bold text-slate-700 text-sm">Shift:</span>
              {scheduleDetail ? (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold shadow-sm transition-all animate-in zoom-in-95 duration-200">
                  {scheduleDetail.name} ({scheduleDetail.start_time} – {scheduleDetail.end_time})
                </div>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>

            {selectedUserDetail && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-primary/5 p-3 border-b border-primary/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-primary font-bold text-[10px] mb-0.5">Phone Number</span>
                      <span className="text-slate-800 text-xs font-medium">{selectedUserDetail.phone_number || "—"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-primary font-bold text-[10px] mb-0.5">Email ID</span>
                      <span className="text-slate-800 text-xs font-medium truncate">{selectedUserDetail.email || "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50/80 p-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-slate-600 font-bold text-[10px] mb-0.5">Office Name</span>
                      <span className="text-slate-800 text-xs font-medium">{(selectedUserDetail as any)?.office_name || officeDetail?.name || "—"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-600 font-bold text-[10px] mb-0.5">Responsibility</span>
                      <span className="text-slate-800 text-xs font-medium truncate">{(selectedUserDetail as any)?.responsibility_name || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-2 border-t bg-slate-50/50 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface MultipleDateSelectorProps {
  minDate: string;
  maxDate: string;
  selectedDates: string[];
  onDatesChange: (dates: string[]) => void;
  dateMode: "AD" | "BS";
}

const MultipleDateSelector = ({ minDate, maxDate, selectedDates, onDatesChange, dateMode }: MultipleDateSelectorProps) => {
  const [open, setOpen] = useState(false);
  const allDatesInRange = React.useMemo(() => {
    if (!minDate || !maxDate) return [];
    try {
      const start = parseISO(minDate);
      const end = parseISO(maxDate);
      return eachDayOfInterval({ start, end }).map(d => format(d, "yyyy-MM-dd"));
    } catch (e) {
      return [];
    }
  }, [minDate, maxDate]);

  const toggleDate = (date: string) => {
    if (selectedDates.includes(date)) {
      onDatesChange(selectedDates.filter(d => d !== date));
    } else {
      onDatesChange([...selectedDates, date].sort());
    }
  };

  const selectAll = () => onDatesChange(allDatesInRange);
  const clearAll = () => onDatesChange([]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button" className="w-full flex items-center gap-2 h-9">
          <ListFilter className="w-4 h-4" />
          Select Multiple Dates ({selectedDates.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Pick Dates for Assignment
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Showing all available dates between {minDate} and {maxDate}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-y my-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {selectedDates.length} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={selectAll} className="h-7 text-[10px] px-2 font-bold">Select All</Button>
            <Button variant="ghost" size="sm" type="button" onClick={clearAll} className="h-7 text-[10px] px-2 font-bold text-red-500 hover:text-red-600">Clear</Button>
          </div>
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-1">
            {allDatesInRange.map((dateStr) => {
              const isSelected = selectedDates.includes(dateStr);
              const d = new Date(dateStr);
              const nd = new NepaliDate(d);
              const bsStr = `${nd.getYear()}-${(nd.getMonth() + 1).toString().padStart(2, '0')}-${nd.getDate().toString().padStart(2, '0')}`;
              const dayName = format(d, "EEEE");
              const isSaturday = d.getDay() === 6;

              return (
                <div 
                  key={dateStr}
                  className={cn(
                    "flex items-center space-x-3 p-2 rounded-md transition-colors cursor-pointer hover:bg-slate-50",
                    isSelected ? "bg-primary/5" : ""
                  )}
                  onClick={() => toggleDate(dateStr)}
                >
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleDate(dateStr)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold", isSaturday ? "text-red-500" : "text-slate-800")}>
                        {dateMode === "AD" ? format(d, "MMM dd, yyyy") : bsStr}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400">{dayName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {dateMode === "AD" ? bsStr : format(d, "MMM dd, yyyy")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button type="button" className="w-full font-bold" onClick={() => setOpen(false)}>
            Done Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDutyModal;