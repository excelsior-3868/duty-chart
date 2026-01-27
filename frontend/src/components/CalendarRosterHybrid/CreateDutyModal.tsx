import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUsers, getUser, type User } from "@/services/users";
import { getOffice, type Office } from "@/services/offices";
import { bulkUpsertDuties, createDuty } from "@/services/dutiesService";
import { getSchedules, getScheduleById, type Schedule } from "@/services/schedule";
import { toast } from "sonner";
import NepaliDate from "nepali-date-converter";
import { Calendar as CalendarIcon, Hash, Plus, SwitchCamera, CalendarRange } from "lucide-react";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";


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
        const res = await getUsers(officeId);
        setUsers(res);
      } catch (e) {
        console.error("Failed to load users:", e);
        toast.error("Failed to load employees for office.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, officeId]);

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
    const idNum = parseInt(selectedUserId);
    if (!open || !idNum) {
      setSelectedUserDetail(null);
      return;
    }
    const loadUser = async () => {
      try {
        const detail = await getUser(idNum);
        setSelectedUserDetail(detail);
      } catch (e) { }
    };
    loadUser();
  }, [open, selectedUserId]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Please select an employee");
      return;
    }

    const finalScheduleId = initialScheduleId || parseInt(selectedScheduleId);
    if (!finalScheduleId) {
      toast.error("Please select a shift");
      return;
    }

    try {
      setLoading(true);
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
        if (data.non_field_errors) {
          msg = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else if (data.detail) {
          msg = data.detail;
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
                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                BS
              </button>
              <button
                type="button"
                onClick={() => setDateMode("AD")}
                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
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
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={inputClass}
                disabled={loading}
                required
              >
                <option value="">Select Employee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {/* If no initialScheduleId, allow selection */}
            {!initialScheduleId && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Shift *</label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className={inputClass}
                  disabled={loading}
                  required
                >
                  <option value="">Select Shift</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time} - {s.end_time})
                    </option>
                  ))}
                </select>
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

          <div className="space-y-2 pt-2 border-t">
            <div className="text-muted-foreground flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Shift:</span>
                <span>{scheduleDetail ? `${scheduleDetail.name} (${scheduleDetail.start_time}–${scheduleDetail.end_time})` : "-"}</span>
              </div>
            </div>
            {selectedUserDetail && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div className="flex flex-col">
                  <span className="font-semibold">Phone:</span>
                  <span>{selectedUserDetail.phone_number || "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Email:</span>
                  <span className="truncate">{selectedUserDetail.email || "-"}</span>
                </div>
              </div>
            )}
            {officeDetail && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-gray-50 p-2 rounded">
                <div className="flex flex-col">
                  <span className="font-semibold">Office:</span>
                  <span>{officeDetail.name || "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Department:</span>
                  <span className="truncate">{officeDetail.department_name || "-"}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">Assign</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDutyModal;