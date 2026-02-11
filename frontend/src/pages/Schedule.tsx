import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DutyHoursCard } from "@/components/DutyHoursCard";
import {
  Assignment,
} from "@/components/WeekScheduleTable";
import { getSchedules } from "@/services/schedule";
import { getOffices } from "@/services/offices";
import { useAuth } from "@/context/AuthContext";
import { deleteSchedule } from "@/services/schedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Loader2, Trash2 } from "lucide-react";
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
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  const { user, hasPermission, canManageOffice, isLoading: authLoading, activeOffice, activeOfficeName, setActiveOffice } = useAuth();
  const queryClient = useQueryClient();

  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

  // Queries
  const { data: offices = [], isLoading: officesLoading } = useQuery({
    queryKey: ['offices', 'all'],
    queryFn: () => getOffices(),
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', 'office', activeOffice],
    queryFn: () => activeOffice ? getSchedules(activeOffice) : Promise.resolve([]),
    enabled: !!activeOffice && !authLoading,
  });

  const loading = authLoading || officesLoading || (!!activeOffice && schedulesLoading);

  const canCreateAtAll = hasPermission("duties.manage_schedule") || hasPermission("schedules.create");
  const canViewSchedules = hasPermission("duties.view_schedule") || hasPermission("schedules.view") || hasPermission("schedules.view_office_schedule");

  const canManageSelectedOffice =
    activeOffice !== null ? canManageOffice(activeOffice) : false;
  const canEditSchedules =
    (hasPermission("duties.manage_schedule") || hasPermission("schedules.edit")) && canManageSelectedOffice;
  const canDeleteSchedules =
    (hasPermission("duties.manage_schedule") || hasPermission("schedules.delete")) && canManageSelectedOffice;

  const visibleSchedules = activeOffice
    ? schedules.filter((s) => s.office === activeOffice || s.office === null)
    : [];

  useEffect(() => {
    document.title = "Duty Schedule - NT Duty Chart Management System";
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

  const initializedRef = useRef(false);

  // Reset active office to user's home office ONLY ONCE when the page loads
  useEffect(() => {
    if (!initializedRef.current && user?.office_id) {
      setActiveOffice(user.office_id, user.office_name);
      initializedRef.current = true;
    }
  }, [user, setActiveOffice]);



  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Duty Schedule</h1>
        <p className="text-muted-foreground">Define shift times and assign them to specific offices.</p>
      </div>

      {/* Immediate Render: Removed isInitializing check to show UI instantly */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {(canCreateAtAll || editingSchedule) && (
          <div className="space-y-6">
            <DutyHoursCard
              mode={editingSchedule ? "edit" : "create"}
              initialSchedule={editingSchedule}
              activeOfficeId={user?.office_id} // FIXED: Always default to user's home office, ignoring filter changes
              userOfficeName={user?.office_name}
              onCancelEdit={() => setEditingSchedule(null)}
              onScheduleAdded={() => {
                if (editingSchedule) {
                  setEditingSchedule(null);
                }
                queryClient.invalidateQueries({ queryKey: ['schedules', 'office', activeOffice] });
              }}
            />
          </div>
        )}

        <div className="space-y-6">

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Schedules</CardTitle>
                  <CardDescription>Existing shifts for the selected office</CardDescription>
                </div>
              </div>
              <div className="mt-4">
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="default"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {/* INSTANT LOAD: Use global activeOfficeName */}
                      {activeOffice
                        ? (activeOfficeName || offices.find((o) => o.id === activeOffice)?.name || "Loading Office...")
                        : "Select Office"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-primary-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search office..." />
                      <CommandList>
                        <CommandEmpty>No office found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Select Office"
                            onSelect={() => {
                              setActiveOffice(null);
                              setOpen(false);
                            }}
                            className="font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !activeOffice ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Select Office
                          </CommandItem>
                          {offices
                            .map((office) => (
                              <CommandItem
                                key={office.id}
                                value={office.name}
                                onSelect={() => {
                                  setActiveOffice(office.id, office.name);
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    activeOffice === office.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {office.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : visibleSchedules.length === 0 ? (
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

        </div>
      </div>

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
                    queryClient.invalidateQueries({ queryKey: ['schedules', 'office', activeOffice] });
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
