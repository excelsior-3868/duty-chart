import { useEffect, useState } from "react";
import { DutyHoursCard } from "@/components/DutyHoursCard";
import {
  WeekScheduleTable,
  Assignment,
  NetworkKey,
} from "@/components/WeekScheduleTable";
import { AddAssignmentForm } from "@/components/WeekScheduleTable/AddAssignmentForm";
import { BulkUpload } from "@/components/WeekScheduleTable/Bulkupload";
import { getSchedules } from "@/services/schedule";
import { getOffices } from "@/services/offices";
import { useAuth } from "@/context/AuthContext";
import { updateSchedule } from "@/services/schedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { toast } from "sonner";

interface Schedule {
  id: number;
  name: string;
  shift?: string;
  start_time: string;
  end_time: string;
  office?: number;
  office_name?: string;
  status?: string;
}

interface Office {
  id: number;
  name: string;
}

const Schedule = () => {
  const { hasPermission, canManageOffice, refreshUser, isLoading } = useAuth();
  const [assignments, setAssignments] = useState<
    Record<string, Record<string, Assignment>>
  >({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    name: "",
    start_time: "",
    end_time: "",
    office: "",
    status: "office_schedule",
  });

  useEffect(() => {
    // Ensure we have the latest auth/user state when entering this page
    refreshUser().catch(() => { });
  }, []);

  const canManageSelectedOffice =
    selectedOffice !== null ? canManageOffice(selectedOffice) : false;
  const canCreateSchedule =
    hasPermission("schedules.create") && canManageSelectedOffice;
  const canViewSchedules = hasPermission("schedules.view");
  const canEditSchedules =
    hasPermission("schedules.edit") && canManageSelectedOffice;

  const visibleSchedules = schedules.filter(
    (s) => selectedOffice ? s.office === selectedOffice : true
  );

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [schedulesData, officesData] = await Promise.all([
          getSchedules(),
          getOffices(),
        ]);

        setSchedules(schedulesData);
        setOffices(officesData);

        // Set default office to first one if available
        if (officesData.length > 0) {
          setSelectedOffice(officesData[0].id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load schedules when office changes
  useEffect(() => {
    const fetchSchedulesForOffice = async () => {
      if (selectedOffice) {
        try {
          const schedulesData = await getSchedules();
          // Filter schedules by selected office
          const filteredSchedules = schedulesData.filter(
            schedule => schedule.office === selectedOffice
          );
          setSchedules(filteredSchedules);
        } catch (error) {
          console.error("Error fetching schedules for office:", error);
        }
      }
    };

    fetchSchedulesForOffice();
  }, [selectedOffice]);

  useEffect(() => {
    document.title = "Schedule Management | INOC Duty Roster";
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content =
        "Modify shift times and assign personnel for the upcoming week.";
      document.head.appendChild(m);
    } else {
      meta.setAttribute(
        "content",
        "Modify shift times and assign personnel for the upcoming week."
      );
    }
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Office Schedule</h1>
        <p className="text-muted-foreground">Modify shift times and assign personnel for the upcoming week.</p>
      </div>

      {/* Sections: Office Filter, Schedules List & Create Form in two columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {canViewSchedules && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schedules</CardTitle>
                    <CardDescription>Existing shifts for the selected office</CardDescription>
                  </div>
                </div>
                <div className="mt-4">
                  <Select
                    value={selectedOffice ? String(selectedOffice) : ""}
                    onValueChange={(v) => setSelectedOffice(parseInt(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Office" />
                    </SelectTrigger>
                    <SelectContent>
                      {offices.map((office) => (
                        <SelectItem key={office.id} value={String(office.id)}>
                          {office.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {(loading || isLoading) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating data...
                  </div>
                )}
                {visibleSchedules.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded-lg bg-muted/30">
                    No schedules found for the selected office.
                  </div>
                ) : (
                  <div className="divide-y max-h-[400px] overflow-y-auto pr-2">
                    {visibleSchedules.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-2 text-sm">
                            {s.name}
                            {s.status && s.status !== 'template' && (
                              <Badge
                                variant={s.status === 'expired' ? 'destructive' : 'default'}
                                className="text-[10px] h-4"
                              >
                                {s.status === 'expired' ? 'expired' : 'office schedule'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.start_time} - {s.end_time}
                          </div>
                        </div>
                        {canEditSchedules && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingSchedule(s);
                              setEditForm({
                                name: s.name || "",
                                start_time: s.start_time || "",
                                end_time: s.end_time || "",
                                office: s.office ? String(s.office) : "",
                                status: s.status || "template",
                              });
                              setEditOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Create Schedule Card */}
          {canCreateSchedule && (
            <DutyHoursCard
              onScheduleAdded={() => {
                if (selectedOffice) {
                  getSchedules().then((all) => {
                    const filtered = all.filter((s) => s.office === selectedOffice);
                    setSchedules(filtered);
                  });
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Schedule Modal */}
      {editingSchedule && canEditSchedules && (
        <Dialog open={editOpen} onOpenChange={(o) => setEditOpen(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Schedule Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-md border text-sm px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        start_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border text-sm px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        end_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border text-sm px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full rounded-md border text-sm px-3 py-2"
                >
                  <option value="office_schedule">Office Schedule</option>
                  <option value="template">Template</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditingSchedule(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!editingSchedule?.id) return;
                  try {
                    await updateSchedule(editingSchedule.id, {
                      name: editForm.name,
                      start_time: editForm.start_time,
                      end_time: editForm.end_time,
                      status: editForm.status,
                      office:
                        editingSchedule.office ??
                        (selectedOffice ?? undefined),
                    });
                    if (selectedOffice) {
                      const all = await getSchedules();
                      const filtered = all.filter(
                        (s) => s.office === selectedOffice
                      );
                      setSchedules(filtered);
                    }
                    setEditOpen(false);
                    setEditingSchedule(null);
                    toast.success("Schedule updated successfully");
                  } catch (error: any) {
                    const data = error.response?.data;
                    let errorMessage = "Failed to update schedule";
                    if (data?.detail) errorMessage = data.detail;
                    else if (data?.non_field_errors) errorMessage = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : String(data.non_field_errors);
                    toast.error(errorMessage);
                  }
                }}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}




      {/* Section 4: Assignment Management (Merged Add & Bulk) */}
      {canCreateSchedule && (
        <Card>
          <CardHeader>
            <CardTitle>Assignment Management</CardTitle>
            <CardDescription>Assign personnel to shifts manually or via bulk upload.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="manual">Manual Assignment</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4">
                <AddAssignmentForm
                  onAdd={(assignment) => {
                    setAssignments((prev) => {
                      const updated = { ...prev };
                      if (!updated[assignment.date]) updated[assignment.date] = {};
                      updated[assignment.date][assignment.shift] = {
                        employee: assignment.employee,
                        network: assignment.network,
                      };
                      return updated;
                    });
                  }}
                />
              </TabsContent>

              <TabsContent value="bulk">
                <BulkUpload
                  onUpload={(bulkAssignments) => {
                    setAssignments((prev) => {
                      const updated = { ...prev };
                      bulkAssignments.forEach(({ employee, network, shift, date }) => {
                        const formattedDate = new Date(date).toISOString().slice(0, 10);
                        const networkKey = network as NetworkKey;
                        const shiftKey = shift.toLowerCase() as "morning" | "afternoon" | "night";
                        if (!updated[formattedDate]) updated[formattedDate] = {};
                        updated[formattedDate][shiftKey] = { employee, network: networkKey };
                      });
                      return updated;
                    });
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}


    </div>
  );
};

export default Schedule;
