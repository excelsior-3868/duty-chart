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
import { updateSchedule, deleteSchedule } from "@/services/schedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Loader2, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    // Ensure we have the latest auth/user state when entering this page
    refreshUser().catch(() => { });
  }, []);

  const canCreateAtAll = hasPermission("duties.manage_schedule") || hasPermission("schedules.create");
  const canViewSchedules = hasPermission("duties.view_schedule") || hasPermission("schedules.view") || hasPermission("schedules.view_office_schedule");

  const canManageSelectedOffice =
    selectedOffice !== null ? canManageOffice(selectedOffice) : false;
  const canEditSchedules =
    (hasPermission("duties.manage_schedule") || hasPermission("schedules.edit")) && canManageSelectedOffice;
  const canDeleteSchedules =
    (hasPermission("duties.manage_schedule") || hasPermission("schedules.delete")) && canManageSelectedOffice;

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
    document.title = "Duty Schedule | INOC Duty Roster";
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
        <h1 className="text-2xl font-bold text-primary">Duty Schedule</h1>
        <p className="text-muted-foreground">Define shift times and assign them to specific offices.</p>
      </div>

      {/* Sections: Office Filter, Schedules List & Create Form in two columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* Create Schedule Card - Always visible if user has creation permission */}
          {canCreateAtAll && (
            <DutyHoursCard
              mode={editingSchedule ? "edit" : "create"}
              initialSchedule={editingSchedule}
              onCancelEdit={() => setEditingSchedule(null)}
              onScheduleAdded={() => {
                // When a schedule is added or updated, refresh the list if the added office 
                // matches the one we are currently viewing in the right panel.
                if (editingSchedule) {
                  setEditingSchedule(null);
                }
                getSchedules().then((all) => {
                  if (selectedOffice) {
                    const filtered = all.filter((s) => s.office === selectedOffice);
                    setSchedules(filtered);
                  }
                });
              }}
            />
          )}
        </div>

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
                      {offices
                        .filter(office => canManageOffice(office.id) || hasPermission("duties.assign_any_office_employee"))
                        .map((office) => (
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
                  <div className="flex justify-center mb-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
                                {s.status === 'expired' ? 'expired' : 'duty schedule'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.start_time} - {s.end_time}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditSchedules && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingSchedule(s);
                                // Scroll to top to show the edit form
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {canDeleteSchedules && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setScheduleToDelete(s);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>





      {/* Section 4: Assignment Management (Merged Add & Bulk) - HIDDEN AS PER USER REQUEST
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
      */}


      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the schedule <strong>{scheduleToDelete?.name}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (scheduleToDelete) {
                  try {
                    await deleteSchedule(scheduleToDelete.id);
                    toast.success("Schedule deleted successfully");
                    // Refresh schedules
                    if (selectedOffice) {
                      const all = await getSchedules();
                      const filtered = all.filter(
                        (s) => s.office === selectedOffice
                      );
                      setSchedules(filtered);
                    }
                  } catch (error: any) {
                    toast.error("Failed to delete schedule");
                  }
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div >
  );
};

export default Schedule;
