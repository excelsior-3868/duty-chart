import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUsers, getUser, type User } from "@/services/users";
import { getOffice, type Office } from "@/services/offices";
import { bulkUpsertDuties, createDuty, getDutiesFiltered } from "@/services/dutiesService";
import { getSchedules, getScheduleById, type Schedule } from "@/services/schedule";
import { toast } from "sonner";
import NepaliDate from "nepali-date-converter";
import { Calendar as CalendarIcon, Hash, Plus, SwitchCamera, CalendarRange, Search, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
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


interface CreateDutyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: number;
  dutyChartId: number;
  dateISO: string; // yyyy-MM-dd
  scheduleId?: number; // resolved schedule id for the clicked shift
  onCreated?: () => void; // callback to refresh duties after successful create
}

export const CreateDutyModal: React.FC<CreateDutyModalProps> = ({
  open,
  onOpenChange,
  officeId,
  dutyChartId,
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
  const [isRange, setIsRange] = useState(false);
  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);


  useEffect(() => {
    if (initialDateISO) {
      setDateISO(initialDateISO);
      setEndDateISO(initialDateISO);
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
        // If can assign any, fetch all users. Otherwise, fetch for this office.
        const res = await getUsers(canAssignAny ? undefined : officeId);
        setUsers(res);
      } catch (e) {
        console.error("Failed to load users:", e);
        toast.error("Failed to load employees.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, officeId, hasPermission]);

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

  // Load schedule details if ID provided (or selected)
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

  // Fetch all schedules if no scheduleId provided
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

    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (dateISO < todayStr) {
      toast.error("Backdated assignment not allowed", {
        description: "Employee assignment in the past is not allowed."
      });
      return;
    }

    const finalScheduleId = initialScheduleId || parseInt(selectedScheduleId);
    if (!finalScheduleId) {
      toast.error("Please select a shift");
      return;
    }

    // Helper to get time in minutes for comparison
    const timeToMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const isOverlap = (start1: string, end1: string, start2: string, end2: string) => {
      const s1 = timeToMinutes(start1);
      const e1 = timeToMinutes(end1);
      const s2 = timeToMinutes(start2);
      const e2 = timeToMinutes(end2);
      // (StartA < EndB) and (EndA > StartB)
      return s1 < e2 && e1 > s2;
    };

    try {
      setLoading(true);

      // Validate Time Overlap on Frontend before sending
      // Ideally we fetch user's duties for this date range
      // We know the date(s) we are assigning.

      const datesToCheck = isRange
        ? eachDayOfInterval({ start: parseISO(dateISO), end: parseISO(endDateISO) }).map(d => format(d, "yyyy-MM-dd"))
        : [dateISO];

      // For each date, check existing duties
      // We can optimize by fetching range or loop. 
      // Since users won't usually select huge ranges, 1-by-1 or smart filter is fine.
      // The `getDutiesFiltered` doesn't support date__in or range yet via simple params without backend changes or multiple calls.
      // But wait, the user *approved* backend validation. Frontend validation is " nice to have " but backend is CRITICAL.
      // To provide immediate feedback, let's just make a best-effort check or rely on backend error message.
      // Actually, the user specifically asked for "validation where User cant be assigned...".
      // If I do strictly backend, it matches the request "Just implement this validation".
      // However, a frontend pre-check is better UX.
      // Let's do a fetch for the specific single date if not range, or just rely on backend if range is complex.

      if (!isRange) {
        const existing = await getDutiesFiltered({ user: parseInt(selectedUserId), date: dateISO });
        // Check overlap with requested schedule
        let currentSchedule = scheduleDetail;
        if (!currentSchedule && finalScheduleId) {
          // If we don't have detail (e.g. from props only id), find it in 'schedules' list
          currentSchedule = schedules.find(s => s.id === finalScheduleId) || null;
          // If still null (maybe because it was passed as initialScheduleId but not loaded in list),
          // we might skip frontend check or fetch it.
          if (!currentSchedule && initialScheduleId) {
            currentSchedule = await getScheduleById(initialScheduleId);
          }
        }

        if (currentSchedule && existing.length > 0) {
          for (const d of existing) {
            if (d.start_time && d.end_time && currentSchedule.start_time && currentSchedule.end_time) {
              if (isOverlap(currentSchedule.start_time, currentSchedule.end_time, d.start_time, d.end_time)) {
                // Found overlap
                toast.error(`Time overlap detected! User already is assigned to ${d.schedule_name} (${d.start_time} - ${d.end_time}) on this date.`);
                setLoading(false);
                return;
              }
            }
          }
        }
      }


      if (isRange) {
        if (isRange && new Date(endDateISO) < new Date(dateISO)) {
          toast.error("End date cannot be before start date");
          setLoading(false);
          return;
        }

        const dates = eachDayOfInterval({
          start: parseISO(dateISO),
          end: parseISO(endDateISO)
        });

        const duties = dates.map(d => ({
          date: format(d, "yyyy-MM-dd"),
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
          // It's probably an HTML 500 page
          msg = "Internal Server Error (500). Please check backend logs.";
        } else if (data.non_field_errors) {
          msg = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else if (data.detail) {
          msg = data.detail;
        } else {
          // If it's a field-specific error (like {date: ["..."]}), show the first one
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


  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-200))] focus:border-[hsl(var(--inoc-blue))]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mr-6">
            <div>
              <DialogTitle>Create Duty</DialogTitle>
              <DialogDescription>
                Assign an employee to this schedule for a specific date.
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
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Employee *</label>
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
                        const u = users.find((user) => String(user.id) === selectedUserId);
                        return u ? `${u.employee_id || u.username} - ${u.full_name || u.username} (${u.office_name || "N/A"})` : "Select Employee";
                      })()
                      : "Select Employee"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search employee by name, ID or email..." />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.username} ${u.employee_id} ${u.full_name} ${u.office_name}`}
                            onSelect={() => {
                              setSelectedUserId(String(u.id));
                              setEmployeeSearchOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedUserId === String(u.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-medium">{u.employee_id || u.username} - {u.full_name || u.username}</span>
                              </div>
                              <div className="ml-6 flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border text-slate-600 font-semibold text-[10px]">{u.office_name || "N/A"}</span>
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

            {/* If no initialScheduleId, allow selection */}
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

            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">Date Range Mode</span>
              </div>
              <div className="flex bg-white border rounded-md p-1 items-center">
                <button
                  type="button"
                  onClick={() => setIsRange(false)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${!isRange ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >Single</button>
                <button
                  type="button"
                  onClick={() => setIsRange(true)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all ${isRange ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >Range</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{isRange ? "Start Date *" : "Date *"}</label>
                {dateMode === "AD" ? (
                  <GregorianDatePicker
                    value={dateISO}
                    onChange={setDateISO}
                  />
                ) : (
                  <NepaliDatePicker
                    value={dateISO}
                    onChange={setDateISO}
                  />
                )}
              </div>

              {isRange && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">End Date *</label>
                  {dateMode === "AD" ? (
                    <GregorianDatePicker
                      value={endDateISO}
                      onChange={setEndDateISO}
                    />
                  ) : (
                    <NepaliDatePicker
                      value={endDateISO}
                      onChange={setEndDateISO}
                    />
                  )}
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
                {/* Contact Section */}
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

                {/* Organization Section */}
                <div className="bg-slate-50/80 p-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-slate-600 font-bold text-[10px] mb-0.5">Office Name</span>
                      <span className="text-slate-800 text-xs font-medium">{(selectedUserDetail as any)?.office_name || officeDetail?.name || "—"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-600 font-bold text-[10px] mb-0.5">Department</span>
                      <span className="text-slate-800 text-xs font-medium truncate">{(selectedUserDetail as any)?.department_name || officeDetail?.department_name || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
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

export default CreateDutyModal;