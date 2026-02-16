import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getDutyCharts, getDutyChartById, patchDutyChart, deleteDutyChart, downloadImportTemplate, importDutyChartExcel, DutyChart as DutyChartDTO } from "@/services/dutichart";
import { getOffices, Office } from "@/services/offices";
import { getSchedules, Schedule } from "@/services/schedule";
import { useAuth } from "@/context/AuthContext";
import { Building2, Calendar as CalendarIcon, Check, Download, Upload, FileSpreadsheet, Loader2, AlertCircle, Save, ChevronsUpDown } from "lucide-react";
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
  initialOfficeId?: string;
  initialChartId?: string;
  onUpdateSuccess?: (updatedChart?: Partial<DutyChartDTO>) => void;
}

export const EditDutyChartModal: React.FC<EditDutyChartModalProps> = ({
  open,
  onOpenChange,
  initialOfficeId,
  initialChartId,
  onUpdateSuccess
}) => {
  const { user, canManageOffice, hasPermission } = useAuth();
  const [charts, setCharts] = useState<DutyChartDTO[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string>("");
  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [openOffice, setOpenOffice] = useState(false);


  const [formData, setFormData] = useState({
    name: "",
    effective_date: "",
    end_date: "",
    office: "",
    scheduleIds: [] as string[],
  });

  const [initialChart, setInitialChart] = useState<DutyChartDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");

  // Excel Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
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
          // Only reset these if not provided by props (though usually they are handled by logic below)
          // Actually, we should allow the prop-setting logic to govern these. 
          // But to be safe and match previous behavior (which cleared them AFTER fetch), 
          // we can leave them or trust the initial prop overrides. 
          // Given the structure, let's keep it clean.
        } catch (e) {
          console.error("Failed to load offices:", e);
        }
      };
      load();

      // Set initial state based on props or default empty
      if (initialOfficeId) {
        setFormData((prev) => ({ ...prev, office: initialOfficeId }));
      } else {
        // Reset if no initial prop (though cleanup handles this, safety check)
      }

      if (initialChartId) {
        setSelectedChartId(initialChartId);
      } else {
        setSelectedChartId("");
      }

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
      });
      setInitialChart(null);
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
  }, [open, initialOfficeId, initialChartId]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (!selectedChartId) return;
        const chart = await getDutyChartById(parseInt(selectedChartId));
        setInitialChart(chart);
        setFormData({
          name: chart.name || "",
          effective_date: chart.effective_date || "",
          end_date: chart.end_date || "",
          office: String(chart.office || ""),
          scheduleIds: (chart.schedules || []).map(String),
        });
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
          setCharts(chartsRes);
          if (!chartsRes.find(c => String(c.id) === selectedChartId)) {
            setSelectedChartId("");
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
      // EXCLUDE existing shifts from the template
      const initialSchedules = (initialChart?.schedules || []).map(String);
      const newScheduleIds = formData.scheduleIds.filter(id => !initialSchedules.includes(id));

      if (newScheduleIds.length === 0) {
        toast.error("All selected shifts are already in this chart. Please select at least one new shift to download a template.");
        setIsDownloadingTemplate(false);
        return;
      }

      await downloadImportTemplate({
        office_id: parseInt(formData.office),
        start_date: formData.effective_date,
        end_date: formData.end_date,
        schedule_ids: newScheduleIds.map(id => parseInt(id))
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

    if (newScheduleIds.length === 0) {
      toast.error("No new schedules have been selected.");
      return;
    }

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
      const payload: Partial<DutyChartDTO> = {
        name: formData.name || undefined,
        effective_date: formData.effective_date || undefined,
        end_date: formData.end_date || undefined,
        office: formData.office ? parseInt(formData.office) : undefined,
        schedules: formData.scheduleIds.map(id => parseInt(id)),
      };
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
                        <Command>
                          <CommandInput placeholder="Search office..." />
                          <CommandList className="max-h-[300px] overflow-y-auto">
                            <CommandEmpty>No office found.</CommandEmpty>
                            <CommandGroup>
                              {offices
                                .filter(office => {
                                  if (hasPermission('duties.create_any_office_chart')) return true;
                                  const allowedIds = [user?.office_id, ...(user?.secondary_offices || [])].filter(Boolean).map(id => Number(id));
                                  return allowedIds.includes(Number(office.id));
                                })
                                .map((office) => (
                                  <CommandItem
                                    key={office.id}
                                    value={office.name}
                                    onSelect={() => {
                                      handleInputChange("office", String(office.id));
                                      setOpenOffice(false);
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
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className={labelClass}>Duty Chart *</label>
                    <Select
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
                  <div>
                    <label className={labelClass}>
                      Duty Chart Name
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
                                onClick={() => !isExisting && toggleSchedule(String(s.id))}
                                disabled={isExisting}
                                className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${selected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-[hsl(var(--gray-300))] hover:border-primary/50 hover:bg-[hsl(var(--card))]"
                                  } ${isExisting ? "opacity-70 cursor-not-allowed bg-slate-50" : ""}`}
                                title={isExisting ? "Existing shifts cannot be removed" : ""}
                              >
                                <span>{s.name} – {s.start_time} to {s.end_time}</span>
                                {selected && <Check className={`h-3 w-3 ${isExisting ? "text-primary/50" : "text-primary"}`} />}
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
                  Ready to append {previewStats.total} duty assignments.
                </p>
                <p className="text-xs text-primary/70">
                  Please review the details below. Assignments will be added to the existing duty chart.
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
