import { createDutyChart, type DutyChart as DutyChartDTO, downloadImportTemplate, importDutyChartExcel } from "@/services/dutichart";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Building2, Check, Loader2, AlertCircle, ChevronsUpDown } from "lucide-react";
import { useEffect, useState, useRef } from "react";
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
import { getOffices, Office } from "@/services/offices";
import { getSchedules, Schedule } from "@/services/schedule";
import { useAuth } from "@/context/AuthContext";
import NepaliDate from "nepali-date-converter";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PreviewDuty {
  row: number;
  date: string;
  nepali_date: string;
  employee_id: string;
  employee_name: string;
  schedule: string;
  time: string;
  office: string;
}

interface DutyChartCardProps {
  onCreated?: (chart: DutyChartDTO) => void;
  dateMode?: "AD" | "BS";
  setDateMode?: (mode: "AD" | "BS") => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export const DutyChartCard: React.FC<DutyChartCardProps> = ({
  onCreated,
  dateMode: externalDateMode,
  setDateMode: setExternalDateMode,
  hideHeader,
  hideFooter
}) => {
  const { user, canManageOffice, hasPermission } = useAuth();
  const [internalDateMode, setInternalDateMode] = useState<"AD" | "BS">("BS");
  const dateMode = externalDateMode || internalDateMode;
  const setDateMode = setExternalDateMode || setInternalDateMode;
  const [openOffice, setOpenOffice] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    effective_date: "",
    end_date: "",
    office: "",
    shiftIds: [] as string[],
  });

  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Preview Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewDuty[]>([]);
  const [previewStats, setPreviewStats] = useState({ total: 0 });

  // Manual Confirmation State
  const [showManualConfirm, setShowManualConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync ref with state: if state is cleared, clear the input value so same file can be re-selected
  useEffect(() => {
    if (!importFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [importFile]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const officesData = await getOffices();
        setOffices(officesData);
        setSchedules([]);
      } catch (error) {
        console.error("Failed to load offices/schedules:", error);
      }
    };
    loadData();
  }, []);

  // Fetch office-filtered schedules when office changes
  useEffect(() => {
    const fetchByOffice = async () => {
      try {
        if (formData.office) {
          const officeId = parseInt(formData.office);
          const filtered = await getSchedules(officeId);
          setSchedules(filtered);
          setFormData(prev => ({ ...prev, shiftIds: [] }));
        } else {
          setSchedules([]);
        }
      } catch (e) {
        console.error("Failed to fetch schedules:", e);
      }
    };
    fetchByOffice();
  }, [formData.office]);

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const errorInputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500";
  const labelClass = "text-sm font-medium text-[hsl(var(--title))]";
  const errorClass = "text-xs text-red-500 mt-1";

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Duty Chart name is required");
      return false;
    }
    if (!formData.office) {
      toast.error("Office is required");
      return false;
    }
    if (!formData.effective_date) {
      toast.error("Effective date is required");
      return false;
    }
    if (formData.effective_date && formData.end_date && formData.effective_date > formData.end_date) {
      toast.error("End date cannot be before effective date");
      return false;
    }
    return true;
  };

  const processImport = async (isDryRun: boolean) => {
    setIsSubmitting(true);
    try {
      const formDataPayload = new FormData();
      formDataPayload.append("file", importFile!);
      formDataPayload.append("office", formData.office);
      formDataPayload.append("name", formData.name);
      formDataPayload.append("effective_date", formData.effective_date);
      if (formData.end_date) formDataPayload.append("end_date", formData.end_date);
      formData.shiftIds.forEach((id) => formDataPayload.append("schedule_ids", id));
      if (isDryRun) formDataPayload.append("dry_run", "true");

      const response = await importDutyChartExcel(formDataPayload);

      if (isDryRun) {
        setPreviewData(response.preview_data || []);
        setPreviewStats({ total: response.created_duties });
        setShowPreview(true);
        return;
      }

      if (response && response.chart_id) {
        onCreated?.({
          id: response.chart_id,
          office: parseInt(formData.office),
          effective_date: response.effective_date
        } as any);
      }
      toast.success("Duty Chart Imported Successfully from Excel");
      setFormData({ name: "", effective_date: "", end_date: "", office: "", shiftIds: [] });
      setImportFile(null);
      setShowPreview(false);
    } catch (error: any) {
      setImportFile(null);
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const processManualCreation = async () => {
    setIsSubmitting(true);
    try {
      const newChart = await createDutyChart({
        name: formData.name,
        office: parseInt(formData.office),
        effective_date: formData.effective_date,
        end_date: formData.end_date || undefined,
        schedules: formData.shiftIds.map((id) => parseInt(id)),
      });
      onCreated?.(newChart);
      toast.success("Duty Chart Created Successfully");
      setFormData({ name: "", effective_date: "", end_date: "", office: "", shiftIds: [] });
      setImportFile(null);
      setShowManualConfirm(false);
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApiError = (error: any) => {
    console.error("Failed to process duty chart:", error);
    if (error.response?.data) {
      const apiErrors = error.response.data;

      // If there are specific validation errors from the parser
      if (apiErrors.errors) {
        toast.error("Validation failed", {
          description: apiErrors.errors.slice(0, 3).join(", ") + (apiErrors.errors.length > 3 ? "..." : "")
        });
      } else if (apiErrors.detail) {
        toast.error(apiErrors.detail);
      } else if (apiErrors.non_field_errors) {
        toast.error(apiErrors.non_field_errors[0]);
      } else {
        // Handle field-specific errors if any
        const firstKey = Object.keys(apiErrors)[0];
        if (firstKey) {
          const msg = Array.isArray(apiErrors[firstKey]) ? apiErrors[firstKey][0] : apiErrors[firstKey];
          toast.error(`${firstKey}: ${msg}`);
        } else {
          toast.error("Failed to process duty chart. Please try again.");
        }
      }
    } else {
      toast.error("An unexpected error occurred. Please check your connection.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (importFile) {
      await processImport(true);
    } else {
      setShowManualConfirm(true);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!formData.office || !formData.effective_date || !formData.end_date || formData.shiftIds.length === 0) {
      toast.error("Please select Office, Dates, and at least one Shift first.");
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      await downloadImportTemplate({
        office_id: parseInt(formData.office),
        start_date: formData.effective_date,
        end_date: formData.end_date,
        schedule_ids: formData.shiftIds.map(id => parseInt(id))
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

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleShift = (id: string) => {
    setFormData(prev => {
      const exists = prev.shiftIds.includes(id);
      const next = exists ? prev.shiftIds.filter(sid => sid !== id) : [...prev.shiftIds, id];
      return { ...prev, shiftIds: next };
    });
  };

  return (
    <section className="bg-[hsl(var(--card-bg))] rounded-lg shadow-md p-6">
      {!hideHeader && externalDateMode === undefined && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--title))]">Create Duty Chart</h2>
            <p className="text-sm text-[hsl(var(--muted-text))]">Define an effective date range and select shifts for this chart.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setDateMode("BS")}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              BS
            </button>
            <button
              type="button"
              onClick={() => setDateMode("AD")}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
            >
              AD
            </button>
          </div>
        </div>
      )}

      {isSubmitting && importFile && !showPreview && (
        <>
          <style>
            {`
              @keyframes progress-loading {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(300%); }
              }
            `}
          </style>
          <div className="absolute top-0 left-0 w-full h-1 overflow-hidden rounded-t-lg bg-primary/10 z-10">
            <div
              className="h-full bg-primary"
              style={{
                width: '30%',
                animation: 'progress-loading 2s ease-in-out infinite'
              }}
            ></div>
          </div>
        </>
      )}

      <form id="create-duty-chart-form" onSubmit={handleSubmit} className="space-y-4 relative">
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
                  <CommandList>
                    <CommandEmpty>No office found.</CommandEmpty>
                    <CommandGroup>
                      {offices
                        .filter(office => user?.office_id ? office.id === user.office_id : canManageOffice(office.id))
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
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., March Rotation"
              className={inputClass}
              disabled={!formData.office}
            />
          </div>
        </div>

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

        <div>
          <label className={labelClass}>Shifts (from Schedules)</label>
          <div className="relative space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {schedules.map((s) => {
                const selected = formData.shiftIds.includes(String(s.id));
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleShift(String(s.id))}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-[hsl(var(--gray-300))] hover:border-primary/50 hover:bg-[hsl(var(--card))]"
                      }`}
                  >
                    <span>{s.name} – {s.start_time} to {s.end_time}</span>
                    {selected && <Check className="h-3 w-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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
              disabled={isDownloadingTemplate || !formData.office || !formData.effective_date || !formData.end_date || formData.shiftIds.length === 0}
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    {importFile ? "File selected - Click Create to import" : "Click to browse or drag and drop"}
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

        {!hideFooter && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importFile ? "Importing & Processing..." : "Creating..."}
                </>
              ) : (
                "Create Duty Chart"
              )}
            </button>
          </div>
        )}
      </form>

      {/* Import Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Import Preview
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-4 py-2">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-primary/90">
                  Ready to import {previewStats.total} duty assignments.
                </p>
                <p className="text-xs text-primary/70">
                  Please review the details below. No changes have been made to the database yet.
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
      </Dialog>

      {/* Manual Creation Confirmation Modal */}
      <Dialog open={showManualConfirm} onOpenChange={setShowManualConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              Confirm Duty Chart Creation
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
                <span className="text-xs text-muted-foreground block mb-2">Selected Shifts:</span>
                <div className="flex flex-wrap gap-2">
                  {formData.shiftIds.map(id => {
                    const s = schedules.find(sch => String(sch.id) === id);
                    return s ? (
                      <Badge key={id} variant="secondary" className="font-normal border-green-200 bg-green-50 text-green-700">
                        {s.name}
                      </Badge>
                    ) : null;
                  })}
                  {formData.shiftIds.length === 0 && (
                    <span className="text-sm italic text-muted-foreground">No specific shifts selected</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              By confirming, a new duty chart shell will be created. You can later assign specific employees to these shifts.
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
              onClick={processManualCreation}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Duty Chart"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default DutyChartCard;
