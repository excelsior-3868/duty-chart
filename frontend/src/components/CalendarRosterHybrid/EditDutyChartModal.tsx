import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getDutyCharts, getDutyChartById, patchDutyChart, DutyChart as DutyChartDTO } from "@/services/dutichart";
import { getOffices, Office } from "@/services/offices";
import { getSchedules, Schedule } from "@/services/schedule";
import { Building2, Calendar as CalendarIcon, Check } from "lucide-react";
import { toast } from "sonner";
import NepaliDate from "nepali-date-converter";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";

interface EditDutyChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditDutyChartModal: React.FC<EditDutyChartModalProps> = ({ open, onOpenChange }) => {
  const [charts, setCharts] = useState<DutyChartDTO[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string>("");
  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

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

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const officesRes = await getOffices();
        setOffices(officesRes);
        setCharts([]);
        setSelectedChartId("");
      } catch (e) {
        console.error("Failed to load offices:", e);
      }
    };
    load();
  }, [open]);

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
    fetchByOffice();
  }, [formData.office]);

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
    return Array.from(uniqueMap.values());
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChartId) {
      setErrors(prev => ({ ...prev, general: "Select a duty chart to edit." }));
      return;
    }
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
      await patchDutyChart(parseInt(selectedChartId), payload);
      toast.success("Duty Chart updated successfully");
      onOpenChange(false);
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

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-200))] focus:border-[hsl(var(--inoc-blue))]";
  const labelClass = "text-sm font-medium text-[hsl(var(--title))]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mr-6">
            <div>
              <DialogTitle>Edit Duty Chart</DialogTitle>
              <DialogDescription>Select a duty chart and update its details.</DialogDescription>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
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

        <form id="edit-duty-chart-form" onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="mb-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{errors.general}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Office</label>
              <div className="relative">
                <select
                  value={formData.office}
                  onChange={(e) => handleInputChange("office", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select Office</option>
                  {offices.map((office) => (
                    <option key={office.id} value={office.id}>{office.name}</option>
                  ))}
                </select>
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--gray-500))]" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Duty Chart</label>
              <select
                value={selectedChartId}
                onChange={(e) => setSelectedChartId(e.target.value)}
                className={inputClass}
                disabled={!formData.office}
              >
                <option value="">Select Duty Chart</option>
                {charts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || `Duty Chart ${c.id}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={inputClass}
              disabled={!formData.office}
              placeholder="e.g., Rotation Name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Effective Date</label>
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
              <div className="flex items-center gap-2 mb-2">
                <label className={labelClass}>Shifts (Schedules)</label>

              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableSchedules.map((s) => {
                    const selected = formData.scheduleIds.includes(String(s.id));
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggleSchedule(String(s.id))}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-left text-sm transition-all ${selected
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                          : "border-[hsl(var(--gray-300))] hover:border-primary/50 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-[10px] opacity-80">
                            {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!s.office && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${selected ? "bg-primary/20 text-primary" : "bg-orange-100 text-orange-600"
                                }`}
                            >
                              Template
                            </span>
                          )}
                          {selected && <Check className="h-4 w-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <button
            type="submit"
            form="edit-duty-chart-form"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Edit Duty Chart"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditDutyChartModal;
