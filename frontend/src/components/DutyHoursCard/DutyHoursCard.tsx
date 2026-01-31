import { Clock, Calendar, Building2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { createSchedule, updateSchedule, getSchedules, type Schedule as ScheduleType } from "@/services/schedule";
import { getOffices, Office } from "@/services/offices";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AddScheduleCardProps {
  onScheduleAdded?: () => void;
  initialSchedule?: ScheduleType | null;
  mode?: "create" | "edit";
}

export const DutyHoursCard: React.FC<AddScheduleCardProps> = ({
  onScheduleAdded,
  initialSchedule = null,
  mode = "create",
}) => {
  const [formData, setFormData] = useState({
    name: "",
    start_time: "",
    end_time: "",
    office: "",
  });

  const [offices, setOffices] = useState<Office[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleType[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCustomSchedule, setIsCustomSchedule] = useState(false);

  // Load offices and schedule templates on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [officesData, allSchedules] = await Promise.all([
          getOffices(),
          getSchedules()
        ]);
        setOffices(officesData);

        // Extract unique templates from existing schedules
        // Strategy: Prefer schedules explicitly marked as 'template'
        // Fallback: Schedules with no office (global templates)
        const templateSchedules = allSchedules.filter(s => s.status === 'template' || (!s.office && !s.status));

        if (templateSchedules.length > 0) {
          setScheduleTemplates(templateSchedules);
        } else {
          // Fallback: unique by name from global/unassigned schedules if any, or just unique names
          const uniqueMap = new Map();
          allSchedules.forEach(s => {
            if (s.name && !uniqueMap.has(s.name) && !s.office) {
              uniqueMap.set(s.name, s);
            }
          });
          setScheduleTemplates(Array.from(uniqueMap.values()));
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    loadData();
  }, []);

  // Prefill form when editing
  useEffect(() => {
    if (initialSchedule) {
      setFormData({
        name: initialSchedule.name || "",
        start_time: initialSchedule.start_time || "",
        end_time: initialSchedule.end_time || "",
        office: initialSchedule.office ? String(initialSchedule.office) : "",
      });
      // If editing, assume custom schedule to allow edits unless we want to enforce templates there too.
      // For now, enabling custom mode for edit ensures backward compatibility.
      if (mode === "edit") {
        setIsCustomSchedule(true);
      }
    }
  }, [initialSchedule, mode]);

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-200))] focus:border-[hsl(var(--inoc-blue))]";
  const errorInputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500";
  const labelClass = "text-sm font-medium text-[hsl(var(--title))]";
  const sublabelClass = "text-xs text-[hsl(var(--muted-text))]";
  const errorClass = "text-xs text-red-500 mt-1";

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Schedule name is required";
    }

    if (!formData.start_time) {
      newErrors.start_time = "Start time is required";
    }

    if (!formData.end_time) {
      newErrors.end_time = "End time is required";
    }

    if (!formData.office) {
      newErrors.office = "Office is required";
    }

    // Time validation
    // Note: Removed simple comparison because Night shift might cross midnight (e.g. 22:00 to 06:00)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTemplateName = e.target.value;
    const templateData = scheduleTemplates.find(s => s.name === selectedTemplateName);

    setFormData(prev => ({
      ...prev,
      name: selectedTemplateName,
      start_time: templateData ? templateData.start_time?.slice(0, 5) : prev.start_time,
      end_time: templateData ? templateData.end_time?.slice(0, 5) : prev.end_time
    }));

    // Clear name error if any
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: "" }));
    }
  };

  const toggleCustomSchedule = () => {
    const newIsCustom = !isCustomSchedule;
    setIsCustomSchedule(newIsCustom);
    setFormData(prev => ({
      ...prev,
      name: "",
      start_time: "",
      end_time: ""
    }));
    setErrors({});
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check if times differ from template defaults ONLY if not custom schedule
    // (Actually if it's not custom, times are disabled so they can't differ, 
    // but we keep this logic just in case we allow edits later)
    if (!isCustomSchedule) {
      const template = scheduleTemplates.find(s => s.name === formData.name);
      if (template) {
        // Normalize times for comparison (HH:MM)
        const cleanTime = (t: string) => t ? t.slice(0, 5) : "";

        if (cleanTime(template.start_time) !== cleanTime(formData.start_time) ||
          cleanTime(template.end_time) !== cleanTime(formData.end_time)) {
          setShowConfirmDialog(true);
          return;
        }
      }
    }

    // If custom name or times match, proceed directly
    submitData();
  };

  const submitData = async () => {
    setIsSubmitting(true);
    setErrors({});
    setShowConfirmDialog(false);

    try {
      if (mode === "edit" && initialSchedule?.id) {
        await updateSchedule(initialSchedule.id, {
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          office: parseInt(formData.office),
          status: initialSchedule.status || "office_schedule",
        });
        toast.success("Schedule Template Updated Successfully");
      } else {
        await createSchedule({
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          office: parseInt(formData.office),
          status: "office_schedule",
        });
        toast.success("Schedule Template Created Successfully");
        setFormData({
          name: "",
          start_time: "",
          end_time: "",
          office: "",
        });
      }
      onScheduleAdded?.();
    } catch (error: any) {
      console.error("Failed to save template:", error);
      if (error.response?.data) {
        const apiErrors = error.response.data;

        // Show detail or non_field_errors in toast
        if (apiErrors.detail) {
          toast.error(apiErrors.detail);
        } else if (apiErrors.non_field_errors) {
          toast.error(Array.isArray(apiErrors.non_field_errors) ? apiErrors.non_field_errors[0] : String(apiErrors.non_field_errors));
        }

        const fieldErrors: Record<string, string> = {};

        Object.keys(apiErrors).forEach(key => {
          if (Array.isArray(apiErrors[key])) {
            fieldErrors[key] = apiErrors[key][0];
          } else {
            fieldErrors[key] = apiErrors[key];
          }
        });

        setErrors(fieldErrors);
      } else {
        const genericError = "Failed to save schedule template. Please try again.";
        toast.error(genericError);
        setErrors({ general: genericError });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {mode === "edit" ? "Edit Shift Schedule" : "Add Shift Schedule for Office"}
          </CardTitle>
          <CardDescription>
            Define duty hours and assign them to specific offices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handlePreSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Schedule Name */}
              <div className="space-y-2">
                <label className={labelClass}>Schedule Name *</label>
                <div className="relative">
                  {isCustomSchedule ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className={errors.name ? errorInputClass : inputClass}
                      placeholder="Enter custom schedule name"
                    />
                  ) : (
                    <Select
                      value={formData.name}
                      onValueChange={(val) => {
                        const templateData = scheduleTemplates.find(s => s.name === val);
                        setFormData(prev => ({
                          ...prev,
                          name: val,
                          start_time: templateData ? templateData.start_time?.slice(0, 5) : prev.start_time,
                          end_time: templateData ? templateData.end_time?.slice(0, 5) : prev.end_time
                        }));
                        if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                      }}
                    >
                      <SelectTrigger className={errors.name ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select Schedule from Template" />
                      </SelectTrigger>
                      <SelectContent>
                        {scheduleTemplates.map((template) => (
                          <SelectItem key={template.id || template.name} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                        {formData.name && !scheduleTemplates.some(s => s.name === formData.name) && (
                          <SelectItem value={formData.name}>{formData.name}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {errors.name && <div className={errorClass}>{errors.name}</div>}

                <div className="mt-1">
                  <button
                    type="button"
                    onClick={toggleCustomSchedule}
                    className="text-xs text-primary hover:underline focus:outline-none"
                  >
                    {isCustomSchedule ? "Select from Templates" : "+ Add New Template"}
                  </button>
                </div>
              </div>

              {/* Office Selection */}
              <div className="space-y-2">
                <label className={labelClass}>Office *</label>
                <Select
                  value={formData.office}
                  onValueChange={(v) => handleInputChange("office", v)}
                >
                  <SelectTrigger className={errors.office ? "border-destructive" : ""}>
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
                {errors.office && <div className={errorClass}>{errors.office}</div>}
              </div>
            </div>

            {/* Time Section */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="space-y-2">
                <label className={labelClass}>Start Time *</label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange("start_time", e.target.value)}
                    disabled={!isCustomSchedule && mode !== 'edit'}
                    className={`${errors.start_time ? errorInputClass : inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ colorScheme: 'light' }}
                  />
                </div>
                {errors.start_time && <div className={errorClass}>{errors.start_time}</div>}
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <label className={labelClass}>End Time *</label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange("end_time", e.target.value)}
                    disabled={!isCustomSchedule && mode !== 'edit'}
                    className={`${errors.end_time ? errorInputClass : inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ colorScheme: 'light' }}
                  />
                </div>
                {errors.end_time && <div className={errorClass}>{errors.end_time}</div>}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-8"
              >
                {isSubmitting
                  ? mode === "edit" ? "Updating..." : "Creating..."
                  : mode === "edit" ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              Schedule Time Modified
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-base">
                You have changed the standard time for <strong>{formData.name}</strong>.
              </p>
              <div className="bg-slate-50 p-4 rounded-md text-base">
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-muted-foreground font-bold">Standard:</span>
                  <span className="font-bold text-slate-700">
                    {(() => {
                      const t = scheduleTemplates.find(s => s.name === formData.name);
                      return t ? `${t.start_time?.slice(0, 5)} - ${t.end_time?.slice(0, 5)}` : "N/A";
                    })()}
                  </span>
                  <span className="text-muted-foreground font-bold">New:</span>
                  <span className="font-bold text-blue-600">
                    {formData.start_time} - {formData.end_time}
                  </span>
                </div>
              </div>
              <p className="text-base font-bold text-slate-900">
                Are you sure you want to proceed with this custom schedule?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isSubmitting} className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitData}
              disabled={isSubmitting}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSubmitting ? "Saving..." : "Create Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
