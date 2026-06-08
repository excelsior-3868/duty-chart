import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getDutyCharts, getDutyChartById, patchDutyChart, deleteDutyChart, downloadImportTemplate, importDutyChartExcel, getMyEditableCharts, DutyChart as DutyChartDTO } from "@/services/dutichart";
import { getOffices, Office } from "@/services/offices";
import { getSchedules, Schedule } from "@/services/schedule";
import { getUsers, User } from "@/services/users";
import { getDutiesFiltered } from "@/services/dutiesService";
import { useAuth } from "@/context/AuthContext";
import { Building2, Calendar as CalendarIcon, Check, Download, Upload, FileSpreadsheet, Loader2, AlertCircle, Save, ChevronsUpDown, Plus, FileUp, Users as UsersIcon, X } from "lucide-react";
import { toast } from "sonner";
import NepaliDate from "nepali-date-converter";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

interface EditDutyChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSuccess?: (updatedChart?: Partial<DutyChartDTO>) => void;
}

export const EditDutyChartModal: React.FC<EditDutyChartModalProps> = ({
  open,
  onOpenChange,
  onUpdateSuccess,
}) => {
  const { user, canManageOffice, hasPermission } = useAuth();
  const [charts, setCharts] = useState<DutyChartDTO[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string>("");
  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [openOffice, setOpenOffice] = useState(false);
  const [officeSearch, setOfficeSearch] = useState("");
  const [myExtraOfficeIds, setMyExtraOfficeIds] = useState<Set<number>>(new Set());

  const visibleOffices = useMemo(() => {
    let list = offices.filter(office => {
      if (user?.role === 'SUPERADMIN') return true;
      const allowedIds = [user?.office_id, ...(user?.secondary_offices || [])].filter(Boolean).map(id => Number(id));
      return allowedIds.includes(Number(office.id)) || myExtraOfficeIds.has(Number(office.id));
    });

    if (officeSearch) {
      const lower = officeSearch.toLowerCase();
      list = list.filter((o) => o.name.toLowerCase().includes(lower));
    }

    list.sort((a, b) => {
      const isA = String(a.id) === String(user?.office_id);
      const isB = String(b.id) === String(user?.office_id);
      if (isA && !isB) return -1;
      if (!isA && isB) return 1;
      return a.id - b.id;
    });

    return list;
  }, [offices, officeSearch, user, myExtraOfficeIds]);

  const [formData, setFormData] = useState({
    name: "",
    effective_date: "",
    end_date: "",
    office: "",
    scheduleIds: [] as string[],
    status: "draft" as "draft" | "approved",
  });

  const [anusuchiFiles, setAnusuchiFiles] = useState<File[]>([]);
  const [existingAnusuchi, setExistingAnusuchi] = useState<any[]>([]);

  // Standby Pool state
  const [poolMemberIds, setPoolMemberIds] = useState<string[]>([]);
  const [initialPoolMemberIds, setInitialPoolMemberIds] = useState<string[]>([]);
  const [poolUsers, setPoolUsers] = useState<User[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [poolSearchOpen, setPoolSearchOpen] = useState(false);
  const [isSavingPool, setIsSavingPool] = useState(false);

  const [initialChart, setInitialChart] = useState<DutyChartDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");

  // Excel Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Holds the chart ID to auto-select after the office's chart list loads.
  // A ref is used so the async fetchByOffice closure can read the latest value.
  const pendingChartIdRef = React.useRef<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewStats, setPreviewStats] = useState({ total: 0 });

  // Confirmation for manual update (no excel)
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!importFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [importFile]);

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const officesRes = await getOffices();
          setOffices(officesRes);
          if (user?.role !== 'SUPERADMIN') {
            const myCharts = await getMyEditableCharts();
            setMyExtraOfficeIds(new Set(myCharts.map(c => Number(c.office))));
          }
        } catch (e) {
          console.error("Failed to load offices:", e);
        }
      };
      load();

      // Otherwise reset to empty.
      pendingChartIdRef.current = "";
      setSelectedChartId("");
      setFormData((prev) => ({ ...prev, office: "" }));

      // We also need to clear charts list initially until fetched by office selection
      setCharts([]);

    } else {
      // Cleanup / Reset State on Close
      setCharts([]);
      setSelectedChartId("");
      setOffices([]);
      setSchedules([]);
      setOpenOffice(false);
      setFormData({
        name: "",
        effective_date: "",
        end_date: "",
        office: "",
        scheduleIds: [],
        status: "draft",
      });
      setInitialChart(null);
      setAnusuchiFiles([]);
      setExistingAnusuchi([]);
      setPoolMemberIds([]);
      setInitialPoolMemberIds([]);
      setPoolUsers([]);
      setAssignedUserIds([]);
      setPoolSearchOpen(false);
      setIsSavingPool(false);
      setIsSubmitting(false);
      setErrors({});
      setImportFile(null);
      setIsDownloadingTemplate(false);
      setShowPreview(false);
      setPreviewData([]);
      setPreviewStats({ total: 0 });
      setShowManualConfirm(false);
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  }, [open]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (!selectedChartId) {
          setExistingAnusuchi([]);
          setAnusuchiFiles([]);
          setPoolMemberIds([]);
          setInitialPoolMemberIds([]);
          setAssignedUserIds([]);
          return;
        }
        setAnusuchiFiles([]);
        const chart = await getDutyChartById(parseInt(selectedChartId));
        setInitialChart(chart);
        const poolIds = (chart.pool_members || []).map(String);
        setPoolMemberIds(poolIds);
        setInitialPoolMemberIds(poolIds);
        // Employees already assigned anywhere in this chart are not "standby".
        try {
          const chartDuties = await getDutiesFiltered({ duty_chart: parseInt(selectedChartId) });
          const ids = Array.from(new Set(
            chartDuties.map((d: any) => d.user).filter((id: any): id is number => typeof id === "number")
          ));
          setAssignedUserIds(ids);
        } catch (e) {
          setAssignedUserIds([]);
        }
        setFormData({
          name: chart.name || "",
          effective_date: chart.effective_date || "",
          end_date: chart.end_date || "",
          office: String(chart.office || ""),
          scheduleIds: (chart.schedules || []).map(String),
          status: (chart.status as "draft" | "approved") || "draft",
        });
        setExistingAnusuchi((chart as any).anusuchi_documents || []);
        const officeId = chart.office ? chart.office : undefined;
        const scheds = await getSchedules(officeId);
        setSchedules(scheds);
      } catch (e) {
        console.error("Failed to load chart details:", e);
      }
    };
    fetchDetails();
  }, [selectedChartId]);

  useEffect(() => {
    const fetchByOffice = async () => {
      try {
        if (formData.office) {
          const officeId = parseInt(formData.office);
          const chartsRes = await getDutyCharts(officeId);

          // Backend already filters by allowed offices. We'll show all returned charts.
          const visibleCharts = chartsRes;

          setCharts(visibleCharts);

          // If there's a pending initial chart ID (from parent screen), apply it
          // after the chart list has loaded — this avoids the stale-closure reset.
          const pending = pendingChartIdRef.current;
          if (pending) {
            const match = visibleCharts.find(c => String(c.id) === String(pending));
            if (match) {
              setSelectedChartId(String(match.id));
              pendingChartIdRef.current = ""; // consumed
            }
          } else if (selectedChartId && visibleCharts.length > 0) {
            // Only clear if the currently selected chart is definitely NOT in the list for this office
            const match = visibleCharts.find(c => String(c.id) === String(selectedChartId));
            if (!match) {
              setSelectedChartId("");
            }
          }
          const filtered = await getSchedules(officeId);
          setSchedules(filtered);
        } else {
          setSchedules([]);
          setCharts([]);
          setSelectedChartId("");
        }
      } catch (e) {
        console.error("Failed to fetch schedules:", e);
      }
    };
    if (open) fetchByOffice();
  }, [formData.office, open]);

  // Load office employees eligible for the standby pool (office members only).
  useEffect(() => {
    if (!open || !formData.office) {
      setPoolUsers([]);
      return;
    }
    const loadPoolUsers = async () => {
      try {
        const res = await getUsers(parseInt(formData.office), true, undefined, 1000);
        setPoolUsers(res);
      } catch (e) {
        console.error("Failed to load pool candidates:", e);
      }
    };
    loadPoolUsers();
  }, [open, formData.office]);

  // Labels for currently-selected pool members. Prefer freshly loaded office
  // users; fall back to the chart's saved pool_members_detail for members not
  // present in the loaded page (e.g. secondary-office staff).
  const poolMemberLabels = useMemo(() => {
    const map = new Map<string, string>();
    poolUsers.forEach(u => {
      map.set(String(u.id), `${u.employee_id || u.username} - ${u.full_name || u.username}`);
    });
    (initialChart?.pool_members_detail || []).forEach(m => {
      if (!map.has(String(m.id))) {
        map.set(String(m.id), `${m.employee_id || m.id} - ${m.full_name || "Unknown"}`);
      }
    });
    return map;
  }, [poolUsers, initialChart]);

  // Only employees NOT already assigned in this chart are selectable for the
  // standby pool. Keep already-selected pool members visible so they stay
  // toggle-able even if they later get assigned.
  const poolCandidates = useMemo(() => {
    const assigned = new Set(assignedUserIds);
    return poolUsers.filter(u => !assigned.has(u.id) || poolMemberIds.includes(String(u.id)));
  }, [poolUsers, assignedUserIds, poolMemberIds]);

  const poolChanged = useMemo(() => {
    if (poolMemberIds.length !== initialPoolMemberIds.length) return true;
    const a = [...poolMemberIds].sort();
    const b = [...initialPoolMemberIds].sort();
    return a.some((id, i) => id !== b[i]);
  }, [poolMemberIds, initialPoolMemberIds]);

  const togglePoolMember = (id: string) => {
    setPoolMemberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSavePool = async () => {
    if (!selectedChartId) return;
    setIsSavingPool(true);
    try {
      const updated = await patchDutyChart(parseInt(selectedChartId), {
        pool_members: poolMemberIds.map(id => parseInt(id)),
      });
      setInitialPoolMemberIds([...poolMemberIds]);
      if (updated) setInitialChart(updated);
      toast.success("Standby pool updated");
      onUpdateSuccess?.(updated);
    } catch (error: any) {
      console.error("Failed to update pool:", error);
      const data = error.response?.data;
      const msg = data?.pool_members?.[0] || data?.detail || "Failed to update standby pool.";
      toast.error(msg);
    } finally {
      setIsSavingPool(false);
    }
  };


  const availableSchedules = useMemo(() => {
    const uniqueMap = new Map<string, Schedule>();
    schedules.forEach(s => {
      const key = `${s.name}-${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`;
      const existing = uniqueMap.get(key);
      const isSelected = formData.scheduleIds.includes(String(s.id));

      if (!existing) {
        uniqueMap.set(key, s);
      } else {
        const existingIsSelected = formData.scheduleIds.includes(String(existing.id));
        if (isSelected || (!existingIsSelected && s.office)) {
          uniqueMap.set(key, s);
        }
      }
    });

    // FILTER: "Dont show Template in the Shifts" (shifs where office is null)
    return Array.from(uniqueMap.values()).filter(s => {
      const isTemplate = !s.office;
      return !isTemplate;
    });
  }, [schedules, formData.scheduleIds]);

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const toggleSchedule = (id: string) => {
    setFormData(prev => {
      const exists = prev.scheduleIds.includes(id);
      const next = exists ? prev.scheduleIds.filter(sid => sid !== id) : [...prev.scheduleIds, id];
      return { ...prev, scheduleIds: next };
    });
  };

  const handleDownloadTemplate = async () => {
    if (!formData.office || !formData.effective_date || !formData.end_date || formData.scheduleIds.length === 0) {
      toast.error("Please select Office, Dates, and at least one Shift first.");
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      await downloadImportTemplate({
        office_id: parseInt(formData.office),
        start_date: formData.effective_date,
        end_date: formData.end_date,
        schedule_ids: formData.scheduleIds.map(id => parseInt(id)),
        chart_id: selectedChartId ? parseInt(selectedChartId) : undefined
      });
      toast.success("Template download started");
    } catch (error) {
      console.error("Failed to download template:", error);
      toast.error("Failed to download template");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const processImport = async (isDryRun: boolean) => {
    if (!selectedChartId || !importFile) return;
    setIsSubmitting(true);
    try {
      const formDataPayload = new FormData();
      formDataPayload.append("file", importFile);
      formDataPayload.append("office", formData.office);
      formDataPayload.append("name", formData.name);
      formDataPayload.append("effective_date", formData.effective_date);
      if (formData.end_date) formDataPayload.append("end_date", formData.end_date);
      formData.scheduleIds.forEach((id) => formDataPayload.append("schedule_ids", id));
      formDataPayload.append("chart_id", selectedChartId);
      formDataPayload.append("status", formData.status);
      
      if (!isDryRun) {
        anusuchiFiles.forEach((file) => {
          formDataPayload.append("anusuchi_documents", file);
        });
      }

      if (isDryRun) formDataPayload.append("dry_run", "true");

      const response = await importDutyChartExcel(formDataPayload);

      if (isDryRun) {
        setPreviewData(response.preview_data || []);
        setPreviewStats({ total: response.created_duties });
        setShowPreview(true);
        return;
      }

      toast.success("Duties Imported Successfully");
      setImportFile(null);
      setShowPreview(false);
      onOpenChange(false);
      onUpdateSuccess?.({
        id: parseInt(selectedChartId),
        office: parseInt(formData.office),
        effective_date: formData.effective_date
      });
    } catch (error: any) {
      setImportFile(null);
      console.error("Failed to import:", error);
      const data = error.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        // limit to first 5 errors to avoid huge toasts
        const displayErrors = data.errors.slice(0, 5);
        if (data.errors.length > 5) displayErrors.push(`...and ${data.errors.length - 5} more errors.`);

        toast.error("Validation Failed", {
          description: (
            <div className="flex flex-col gap-1 mt-1 text-xs">
              {displayErrors.map((err: string, i: number) => (
                <span key={i}>{err}</span>
              ))}
            </div>
          ),
          duration: 5000,
        });
      } else {
        const msg = data?.detail || "Import failed. Please check the Excel file and try again.";
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChartId) {
      setErrors(prev => ({ ...prev, general: "Select a duty chart to edit." }));
      return;
    }

    if (importFile) {
      await processImport(true);
      return;
    }

    // Check if new shifts are selected
    const initialSchedules = (initialChart?.schedules || []).map(String);
    const newScheduleIds = formData.scheduleIds.filter(id => !initialSchedules.includes(id));

    if (newScheduleIds.length === 0 && !importFile) {
      // Check if we are just updating status or other metadata
      if (formData.status === initialChart?.status && formData.name === initialChart?.name &&
          formData.effective_date === initialChart?.effective_date && formData.end_date === initialChart?.end_date &&
          anusuchiFiles.length === 0 && !poolChanged) {
        toast.error("No changes detected.");
        return;
      }
    }

    // Document validation removed as per user request

    setShowManualConfirm(true);
  };

  const handleRename = async () => {
    if (!selectedChartId || !formData.name) return;

    setIsSubmitting(true);
    try {
      await patchDutyChart(parseInt(selectedChartId), { name: formData.name });
      toast.success("Duty Chart Name updated");

      // Refresh the combo box list
      if (formData.office) {
        const officeId = parseInt(formData.office);
        const chartsRes = await getDutyCharts(officeId);
        setCharts(chartsRes);

        // Notify parent to refresh its list (e.g. for the navbar/sidebar dropdown)
        onUpdateSuccess?.({ id: parseInt(selectedChartId), name: formData.name });
      }
    } catch (error) {
      console.error("Failed to rename chart:", error);
      toast.error("Failed to update name");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteChart = async () => {
    if (!selectedChartId) return;
    setIsDeleting(true);
    try {
      await deleteDutyChart(parseInt(selectedChartId));
      toast.success("Duty Chart deleted successfully");
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onUpdateSuccess?.();
    } catch (error: any) {
      console.error("Failed to delete chart:", error);
      const msg = error.response?.data?.detail || "Failed to delete duty chart. Ensure no employees are assigned.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const processManualUpdate = async () => {
    if (!selectedChartId) return;
    setIsSubmitting(true);
    setErrors({});
    try {
      const payloadData: any = {
        name: formData.name || undefined,
        effective_date: formData.effective_date || undefined,
        end_date: formData.end_date || undefined,
        office: formData.office ? parseInt(formData.office) : undefined,
        schedules: formData.scheduleIds.map(id => parseInt(id)),
        pool_members: poolMemberIds.map(id => parseInt(id)),
        status: formData.status,
      };

      let payload: any = payloadData;
      if (anusuchiFiles.length > 0) {
        payload = new FormData();
        Object.keys(payloadData).forEach(key => {
          if (payloadData[key] !== undefined) {
            if ((key === 'schedules' || key === 'pool_members') && Array.isArray(payloadData[key])) {
              payloadData[key].forEach((id: number) => payload.append(key, String(id)));
            } else {
              payload.append(key, String(payloadData[key]));
            }
          }
        });
        anusuchiFiles.forEach(file => {
          payload.append('anusuchi_documents', file);
        });
      }

      const updatedChart = await patchDutyChart(parseInt(selectedChartId), payload);
      toast.success("Duty Chart updated successfully");
      setShowManualConfirm(false);
      onOpenChange(false);
      onUpdateSuccess?.(updatedChart);
    } catch (error: any) {
      console.error("Failed to update duty chart:", error);
      if (error.response?.data) {
        const apiErrors = error.response.data;
        const fieldErrors: Record<string, string> = {};
        Object.keys(apiErrors).forEach(key => {
          if (Array.isArray(apiErrors[key])) fieldErrors[key] = apiErrors[key][0];
          else fieldErrors[key] = apiErrors[key];
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: "Failed to update duty chart. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const labelClass = "text-sm font-medium text-[hsl(var(--title))]";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-3xl overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mr-6">
              <div>
                <DialogTitle>Edit Duty Chart</DialogTitle>
                <DialogDescription>
                  Select a duty chart and update its details.
                </DialogDescription>
              </div>
              <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setDateMode("BS")}
                  className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  BS (Nepali)
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("AD")}
                  className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
                >
                  AD (Gregorian)
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[75vh] overflow-y-auto px-6 py-4">
            <section className="bg-[hsl(var(--card-bg))] rounded-lg shadow-md p-6">
              <form id="edit-duty-chart-form" onSubmit={handleSubmit} className="space-y-4 relative">
                {errors.general && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                    {errors.general}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Office *</label>
                    <Popover open={openOffice} onOpenChange={setOpenOffice}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="default"
                          role="combobox"
                          aria-expanded={openOffice}
                          className={cn(
                            "w-full justify-between font-normal bg-primary text-primary-foreground hover:bg-primary/90",
                            !formData.office && "text-primary-foreground",
                          )}
                        >
                          {formData.office
                            ? offices.find((office) => String(office.id) === formData.office)?.name
                            : "Select Office"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-primary-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Search office..." 
                            value={officeSearch}
                            onValueChange={setOfficeSearch}
                          />
                          <CommandList>
                            <div
                              className="max-h-[300px] overflow-y-auto"
                              onWheel={(e) => e.stopPropagation()}
                            >
                              <CommandEmpty>No office found.</CommandEmpty>
                              <CommandGroup>
                                {visibleOffices.slice(0, 50).map((office) => (
                                  <CommandItem
                                    key={office.id}
                                    value={office.name}
                                    onSelect={() => {
                                      handleInputChange("office", String(office.id));
                                      setOpenOffice(false);
                                      setOfficeSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.office === String(office.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {office.name}
                                  </CommandItem>
                                ))}

                              </CommandGroup>
                            </div>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className={labelClass}>Duty Chart *</label>
                    <Select
                      key={`chart-select-${formData.office}-${charts.length}-${selectedChartId}`}
                      value={selectedChartId}
                      onValueChange={(val) => setSelectedChartId(val)}
                      disabled={!formData.office}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder={formData.office ? "Select a chart to edit" : "Select Office first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {charts.map((chart) => (
                          <SelectItem key={chart.id} value={String(chart.id)}>{chart.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedChartId && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>
                        Edit Duty Chart Name
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">(Click save to rename)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className={inputClass}
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          placeholder="Duty Chart Name"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={handleRename}
                          disabled={isSubmitting}
                          title="Update Name Only"
                          className="shrink-0 aspect-square"
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Status</label>
                        {initialChart?.status === "approved" ? (
                          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-emerald-50 border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-sm font-medium text-emerald-800">
                              Approved (Sends SMS)
                            </span>
                          </div>
                        ) : (
                          <Select
                            value={formData.status}
                            onValueChange={(val: any) =>
                              handleInputChange("status", val)
                            }
                          >
                            <SelectTrigger className={inputClass}>
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  Draft (No SMS)
                                </div>
                              </SelectItem>
                              {hasPermission("duties.approve_dutychart") && (
                                <SelectItem value="approved">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Approved (Sends SMS)
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedChartId && formData.status === "approved" && (
                  <div className="space-y-4 p-4 border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                          <FileUp className="h-4 w-4" />
                          स्वीकृत अनुसूची कागजातहरू
                        </h3>
                        <p className="text-xs text-emerald-600/80">
                          Upload multiple signed/approved documents for this chart.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 cursor-pointer transition-colors shadow-sm self-start">
                        <Plus className="h-3.5 w-3.5" />
                        Add File(s)
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              setAnusuchiFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {(existingAnusuchi.length > 0 || anusuchiFiles.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Existing Files */}
                        {existingAnusuchi.map((doc, idx) => (
                          <div key={`existing-${idx}`} className="flex items-center justify-between p-2 bg-white border border-emerald-100 rounded-md shadow-sm group">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] text-emerald-600 font-bold">अनुसूची - १</span>
                                <a href={doc.file} target="_blank" rel="noopener noreferrer" className="text-xs font-medium truncate text-blue-600 hover:underline">
                                  {doc.file.split('/').pop()}
                                </a>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 italic">Saved</span>
                          </div>
                        ))}
                        
                        {/* New Files */}
                        {anusuchiFiles.map((file, idx) => (
                          <div key={`new-${idx}`} className="flex items-center justify-between p-2 bg-white border border-emerald-100 rounded-md shadow-sm group">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] text-emerald-600 font-bold italic">अनुसूची - १</span>
                                <span className="text-xs font-medium truncate text-slate-700">{file.name}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAnusuchiFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="text-xs text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {existingAnusuchi.length === 0 && anusuchiFiles.length === 0 && (
                      <div className="text-center py-4 border border-emerald-100 border-dashed rounded-md bg-white/50">
                        <p className="text-xs text-emerald-600/60 italic">No documents added yet. (Optional)</p>
                      </div>
                    )}
                  </div>
                )}



                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={labelClass}>Effective Date *</label>
                    {dateMode === "AD" ? (
                      <GregorianDatePicker
                        value={formData.effective_date}
                        onChange={(val) => handleInputChange("effective_date", val)}
                      />
                    ) : (
                      <NepaliDatePicker
                        value={formData.effective_date}
                        onChange={(val) => handleInputChange("effective_date", val)}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={labelClass}>End Date</label>
                    {dateMode === "AD" ? (
                      <GregorianDatePicker
                        value={formData.end_date}
                        onChange={(val) => handleInputChange("end_date", val)}
                      />
                    ) : (
                      <NepaliDatePicker
                        value={formData.end_date}
                        onChange={(val) => handleInputChange("end_date", val)}
                      />
                    )}
                  </div>
                </div>

                {selectedChartId && (
                  <div>
                    <label className={labelClass}>Shifts (from Schedules)</label>
                    <div className="relative space-y-2 mt-2">
                      {availableSchedules.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2 italic border border-dashed rounded-md text-center">
                          All available shifts are already included in this chart.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {availableSchedules.map((s) => {
                            const selected = formData.scheduleIds.includes(String(s.id));
                            const isExisting = (initialChart?.schedules || []).map(String).includes(String(s.id));

                            return (
                              <button
                                type="button"
                                key={s.id}
                                onClick={() => toggleSchedule(String(s.id))}
                                className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${selected
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-[hsl(var(--gray-300))] hover:border-primary/50 hover:bg-[hsl(var(--card))]"
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{s.name} – {s.start_time.slice(0, 5)} to {s.end_time.slice(0, 5)}</span>
                                  {isExisting && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-blue-50 text-blue-600 border-blue-100 font-normal">
                                      Duty Added
                                    </Badge>
                                  )}
                                </div>
                                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedChartId && (
                  <div className="border-t border-[hsl(var(--gray-200))] pt-6 mt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[hsl(var(--title))] flex items-center gap-2">
                          <UsersIcon className="h-4 w-4 text-indigo-600" />
                          Standby Pool
                        </h3>
                        <p className="text-xs text-[hsl(var(--muted-text))]">
                          Curate reserve employees of this office. They become an extra source when assigning days.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSavePool}
                        disabled={isSavingPool || !poolChanged}
                        className="self-start shrink-0"
                        title="Save pool members only"
                      >
                        {isSavingPool ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Pool
                      </Button>
                    </div>

                    <div className="mt-3 space-y-2">
                      <Popover open={poolSearchOpen} onOpenChange={setPoolSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={poolSearchOpen}
                            className="w-full justify-between font-normal"
                          >
                            {poolMemberIds.length > 0
                              ? `${poolMemberIds.length} employee${poolMemberIds.length > 1 ? "s" : ""} in pool`
                              : "Add employees to pool"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search employee by name or ID..." />
                            <CommandList>
                              <div className="max-h-[300px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                <CommandEmpty>No unassigned employee found for this office.</CommandEmpty>
                                <CommandGroup>
                                  {poolCandidates.map((u) => {
                                    const selected = poolMemberIds.includes(String(u.id));
                                    return (
                                      <CommandItem
                                        key={u.id}
                                        value={`${u.username} ${u.employee_id} ${u.full_name}`}
                                        onSelect={() => togglePoolMember(String(u.id))}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <span className="font-medium">{u.employee_id || u.username} - {u.full_name || u.username}</span>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </div>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {poolMemberIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {poolMemberIds.map((id) => (
                            <Badge key={id} variant="secondary" className="pl-2 pr-1 py-0.5 gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {poolMemberLabels.get(id) || `#${id}`}
                              <button
                                type="button"
                                onClick={() => togglePoolMember(id)}
                                className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">No standby employees added yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {selectedChartId && (
                  <div className="border-t border-[hsl(var(--gray-200))] pt-6 mt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[hsl(var(--title))] flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          Excel Import (Optional)
                        </h3>
                        <p className="text-xs text-[hsl(var(--muted-text))]">
                          Download a template pre-filled with your selections, assign users, and upload.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isDownloadingTemplate || !formData.office || !formData.effective_date || !formData.end_date || formData.scheduleIds.length === 0}
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isDownloadingTemplate ? "Generating..." : "Download Template"}
                        <Download className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className="relative group cursor-pointer block">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className={`flex items-center justify-center gap-3 p-4 rounded-lg border-2 border-dashed transition-all ${importFile
                          ? "border-green-500 bg-green-50"
                          : "border-[hsl(var(--gray-300))] hover:border-[hsl(var(--inoc-blue))] hover:bg-slate-50"
                          }`}>
                          <Upload className={`h-5 w-5 ${importFile ? "text-green-600" : "text-[hsl(var(--gray-400))]"}`} />
                          <div className="text-left">
                            <p className="text-sm font-medium text-[hsl(var(--title))]">
                              {importFile ? importFile.name : "Select filled Excel file"}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-text))]">
                              {importFile ? "File selected - Click Update to import" : "Click to browse or drag and drop"}
                            </p>
                          </div>
                          {importFile && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setImportFile(null); }}
                              className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </form>
            </section >
          </div >

          <DialogFooter className="p-6 pt-0 gap-2">
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {selectedChartId && hasPermission("duties.delete_chart") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (initialChart && initialChart.duties_count && initialChart.duties_count > 0) {
                        toast.error(`Cannot delete duty chart. There are ${initialChart.duties_count} employee assignments.`, {
                          description: "Please remove all assignments before deleting the chart."
                        });
                        return;
                      }
                      setShowDeleteConfirm(true);
                    }}
                    disabled={isSubmitting || isDeleting}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 transition-all"
                  >
                    Delete Chart
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  form="edit-duty-chart-form"
                  disabled={isSubmitting || isDeleting}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    "Update"
                  )}
                </button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent >
      </Dialog >

      {/* Import Preview Modal */}
      < Dialog open={showPreview} onOpenChange={setShowPreview} >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Import Preview (Appending to {formData.name})
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-4 py-2">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-primary/90">
                  Ready to process {previewStats.total} duty assignments.
                </p>
                <p className="text-xs text-primary/70">
                  Please review the details below. Existing duties in this chart will be updated if modified, and new ones will be added.
                </p>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((duty, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-muted-foreground">{duty.row}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-orange-700">{duty.nepali_date}</span>
                          <span className="text-xs text-muted-foreground">{duty.date}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{duty.employee_name}</span>
                          <span className="text-xs text-muted-foreground">ID: {duty.employee_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {duty.schedule}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{duty.time}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={duty.action === "Update" ? "secondary" : "default"}
                          className={duty.action === "Update" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}
                        >
                          {duty.action || "Create"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => processImport(false)}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Confirm & Finalize Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
      {/* Manual Update Confirmation Dialog */}
      < Dialog open={showManualConfirm} onOpenChange={setShowManualConfirm} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              Confirm Duty Chart Update
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-3 text-sm">
                <span className="text-muted-foreground">Office:</span>
                <span className="col-span-2 font-medium">{offices.find(o => String(o.id) === formData.office)?.name}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-muted-foreground">Roster Name:</span>
                <span className="col-span-2 font-medium">{formData.name}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-muted-foreground">Period:</span>
                <span className="col-span-2 font-medium">
                  {formData.effective_date} to {formData.end_date || "Open-ended"}
                </span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-muted-foreground">Excel Import:</span>
                <span className="col-span-2 font-medium text-orange-600">
                  Excel File not selected
                </span>
              </div>
              <div className="pt-2">
                <span className="text-xs text-muted-foreground block mb-2">Newly Added Shifts:</span>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const initialIds = (initialChart?.schedules || []).map(String);
                    const newIds = formData.scheduleIds.filter(id => !initialIds.includes(id));

                    if (newIds.length === 0) {
                      return <span className="text-sm italic text-muted-foreground">No new shifts added</span>;
                    }

                    return newIds.map(id => {
                      const s = schedules.find(sch => String(sch.id) === id);
                      return s ? (
                        <Badge key={id} variant="secondary" className="font-normal border-green-200 bg-green-50 text-green-700">
                          {s.name}
                        </Badge>
                      ) : null;
                    });
                  })()}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You are updating the duty chart details without importing new assignments. Existing duties will remain unchanged.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowManualConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={(e) => { e.preventDefault(); processManualUpdate(); }}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Yes, Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the duty chart <strong>{formData.name}</strong>.
              This action cannot be undone and will only succeed if no employees are assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteChart(); }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete PERMANENTLY
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditDutyChartModal;
