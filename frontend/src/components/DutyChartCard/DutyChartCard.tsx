import { createDutyChart, type DutyChart as DutyChartDTO, downloadImportTemplate, importDutyChartExcel } from "@/services/dutichart";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Building2, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { getOffices, Office } from "@/services/offices";
import { getSchedules, Schedule } from "@/services/schedule";
import NepaliDate from "nepali-date-converter";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import React from "react";

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
  const [internalDateMode, setInternalDateMode] = useState<"AD" | "BS">("BS");
  const dateMode = externalDateMode || internalDateMode;
  const setDateMode = setExternalDateMode || setInternalDateMode;
  const [formData, setFormData] = useState({
    name: "",
    effective_date: "",
    end_date: "",
    office: "",
    shiftIds: [] as string[],
  });

  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

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

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-200))] focus:border-[hsl(var(--inoc-blue))]";
  const errorInputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500";
  const labelClass = "text-sm font-medium text-[hsl(var(--title))]";
  const errorClass = "text-xs text-red-500 mt-1";

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Duty Chart name is required";
    if (!formData.effective_date) newErrors.effective_date = "Effective date is required";
    if (!formData.office) newErrors.office = "Office is required";
    if (formData.effective_date && formData.end_date && formData.effective_date > formData.end_date) {
      newErrors.end_date = "End date cannot be before effective date";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      if (importFile) {
        const formDataPayload = new FormData();
        formDataPayload.append("file", importFile);
        formDataPayload.append("office", formData.office);
        formDataPayload.append("name", formData.name);
        formDataPayload.append("effective_date", formData.effective_date);
        if (formData.end_date) formDataPayload.append("end_date", formData.end_date);
        formData.shiftIds.forEach((id) => formDataPayload.append("schedule_ids", id));

        await importDutyChartExcel(formDataPayload);
        toast.success("Duty Chart Imported Successfully from Excel");
      } else {
        const newChart = await createDutyChart({
          name: formData.name,
          office: parseInt(formData.office),
          effective_date: formData.effective_date,
          end_date: formData.end_date || undefined,
          schedules: formData.shiftIds.map((id) => parseInt(id)),
        });
        onCreated?.(newChart);
        toast.success("Duty Chart Created Successfully");
      }
      setFormData({ name: "", effective_date: "", end_date: "", office: "", shiftIds: [] });
      setImportFile(null);
    } catch (error: any) {
      console.error("Failed to process duty chart:", error);
      if (error.response?.data) {
        const apiErrors = error.response.data;
        const fieldErrors: Record<string, string> = {};
        Object.keys(apiErrors).forEach(key => {
          if (Array.isArray(apiErrors[key])) fieldErrors[key] = apiErrors[key][0];
          else fieldErrors[key] = apiErrors[key];
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: "Failed to process duty chart. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
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
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
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
              className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              AD
            </button>
          </div>
        </div>
      )}

      {errors.general && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{errors.general}</div>
      )}

      <form id="create-duty-chart-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Office *</label>
            <div className="relative">
              <select
                value={formData.office}
                onChange={(e) => handleInputChange("office", e.target.value)}
                className={errors.office ? errorInputClass : inputClass}
              >
                <option value="">Select Office</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>{office.name}</option>
                ))}
              </select>
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--gray-500))]" />
            </div>
            {errors.office && <div className={errorClass}>{errors.office}</div>}
          </div>

          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., March Rotation"
              className={errors.name ? errorInputClass : inputClass}
              disabled={!formData.office}
            />
            {errors.name && <div className={errorClass}>{errors.name}</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Effective Date *</label>
            {dateMode === "AD" ? (
              <GregorianDatePicker
                value={formData.effective_date}
                onChange={(val) => handleInputChange("effective_date", val)}
                className={errors.effective_date ? "border-red-500" : ""}
              />
            ) : (
              <NepaliDatePicker
                value={formData.effective_date}
                onChange={(val) => handleInputChange("effective_date", val)}
              />
            )}
            {errors.effective_date && <div className={errorClass}>{errors.effective_date}</div>}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>End Date</label>
            {dateMode === "AD" ? (
              <GregorianDatePicker
                value={formData.end_date}
                onChange={(val) => handleInputChange("end_date", val)}
                className={errors.end_date ? "border-red-500" : ""}
              />
            ) : (
              <NepaliDatePicker
                value={formData.end_date}
                onChange={(val) => handleInputChange("end_date", val)}
              />
            )}
            {errors.end_date && <div className={errorClass}>{errors.end_date}</div>}
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
                      ? "border-blue-500 bg-blue-100 text-blue-900"
                      : "border-[hsl(var(--gray-300))] hover:border-[hsl(var(--blue-300))] hover:bg-[hsl(var(--card))]"
                      }`}
                  >
                    <span>{s.name} – {s.start_time} to {s.end_time}</span>
                    {selected && <Check className="h-3 w-3 text-blue-600" />}
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
              className="px-6 py-2 bg-[hsl(var(--inoc-blue))] text-white rounded-md hover:bg-[hsl(var(--inoc-blue))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Duty Chart"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
};

export default DutyChartCard;
