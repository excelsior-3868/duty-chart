import { Clock, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { createSchedule, updateSchedule, getSchedules, type Schedule as ScheduleType } from "@/services/schedule";
import { getOffices, Office } from "@/services/offices";
import { useAuth } from "@/context/AuthContext";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AddScheduleCardProps {
  onScheduleAdded?: () => void;
  onCancelEdit?: () => void;
  initialSchedule?: ScheduleType | null;
  mode?: "create" | "edit";
  activeOfficeId?: number | null;
  userOfficeName?: string;
}

export const DutyHoursCard: React.FC<AddScheduleCardProps> = ({
  onScheduleAdded,
  onCancelEdit,
  initialSchedule = null,
  mode = "create",
  activeOfficeId,
  userOfficeName,
}) => {
  const { user, canManageOffice } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    start_time: "",
    end_time: "",
    office: activeOfficeId ? String(activeOfficeId) : "",
    shift_type: "",
    alias: "",
  });

  const [offices, setOffices] = useState<Office[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleType[]>([]);
  const [existingSchedules, setExistingSchedules] = useState<ScheduleType[]>([]); // Store all schedules for validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCustomSchedule, setIsCustomSchedule] = useState(false);
  const [openOffice, setOpenOffice] = useState(false);

  // Load offices and schedule templates on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [officesData, allSchedules] = await Promise.all([
          getOffices(),
          getSchedules()
        ]);
        setOffices(officesData);
        setExistingSchedules(allSchedules); // Store for validation

        const templateSchedules = allSchedules.filter(s => s.status === 'template' || (!s.office && !s.status));

        if (templateSchedules.length > 0) {
          setScheduleTemplates(templateSchedules);
        } else {
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

  // Prefill form when editing or when selectedOffice changes
  useEffect(() => {
    if (initialSchedule) {
      setFormData({
        name: initialSchedule.name || "",
        start_time: initialSchedule.start_time || "",
        end_time: initialSchedule.end_time || "",
        office: initialSchedule.office ? String(initialSchedule.office) : "",
        shift_type: initialSchedule.shift_type || "",
        alias: initialSchedule.alias || "",
      });
      if (mode === "edit") {
        setIsCustomSchedule(true);
      }
    } else {
      setFormData({
        name: "",
        start_time: "",
        end_time: "",
        office: activeOfficeId ? String(activeOfficeId) : "",
        shift_type: "",
        alias: "",
      });
      setIsCustomSchedule(false);
    }
  }, [initialSchedule, mode, activeOfficeId]);

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const errorInputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500";
  const labelClass = "text-sm font-medium text-[hsl(var(--title))]";
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

    // Duplicate Check
    if (formData.name && formData.start_time && formData.end_time && formData.office) {
      const cleanTime = (t: string) => t ? t.slice(0, 5) : "";

      const isDuplicate = existingSchedules.some(s =>
        // Same Office
        String(s.office) === String(formData.office) &&
        // Same Name
        s.name.toLowerCase() === formData.name.toLowerCase() &&
        // Same Times
        cleanTime(s.start_time) === cleanTime(formData.start_time) &&
        cleanTime(s.end_time) === cleanTime(formData.end_time) &&
        // Exclude current if editing
        (mode === 'edit' && initialSchedule ? s.id !== initialSchedule.id : true)
      );

      if (isDuplicate) {
        const msg = `A schedule named "${formData.name}" with the same time (${formData.start_time} - ${formData.end_time}) already exists for this office.`;
        toast.error(msg);
        newErrors.general = msg; // Keep this to block submission
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleCustomSchedule = () => {
    const newIsCustom = !isCustomSchedule;
    setIsCustomSchedule(newIsCustom);
    setFormData(prev => ({
      ...prev,
      name: "",
      start_time: "",
      end_time: "",
      shift_type: "",
      alias: ""
    }));
    setErrors({});
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isCustomSchedule) {
      const template = scheduleTemplates.find(s => s.name === formData.name);
      if (template) {
        const cleanTime = (t: string) => t ? t.slice(0, 5) : "";

        if (cleanTime(template.start_time) !== cleanTime(formData.start_time) ||
          cleanTime(template.end_time) !== cleanTime(formData.end_time)) {
          setShowConfirmDialog(true);
          return;
        }
      }
    }

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
          shift_type: formData.shift_type,
          alias: formData.alias,
          status: initialSchedule.status || "office_schedule",
        });
        toast.success("Duty Schedule Updated Successfully");
      } else {
        await createSchedule({
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          office: parseInt(formData.office),
          shift_type: formData.shift_type,
          alias: formData.alias,
          status: "office_schedule",
        });
        toast.success("Duty Schedule Created Successfully");
        setFormData({
          name: "",
          start_time: "",
          end_time: "",
          office: "",
          shift_type: "",
          alias: "",
        });
      }
      onScheduleAdded?.();
    } catch (error: any) {
      console.error("Failed to save schedule:", error);
      if (error.response?.data) {
        const apiErrors = error.response.data;
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
        const genericError = "Failed to save schedule. Please try again.";
        toast.error(genericError);
        setErrors({ general: genericError });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            {mode === "edit" ? "Edit Duty Schedule" : "Add Duty Schedule for Office"}
          </CardTitle>
          <CardDescription>
            Define duty hours and assign them to specific offices.
          </CardDescription>
        </CardHeader>
        <CardContent>


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
                          end_time: templateData ? templateData.end_time?.slice(0, 5) : prev.end_time,
                          shift_type: templateData ? (templateData.shift_type || "") : prev.shift_type,
                          alias: templateData ? (templateData.alias || "") : prev.alias,
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
                    {isCustomSchedule ? "Select from Templates" : "+ Add New Schedule"}
                  </button>
                </div>
              </div>

              {/* Office Selection */}
              <div className="space-y-2">
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
                        errors.office && "border-destructive ring-destructive"
                      )}
                    >
                      {formData.office
                        ? (offices.find((office) => String(office.id) === formData.office)?.name || (formData.office === String(activeOfficeId) ? userOfficeName : "Loading..."))
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
                              handleInputChange("office", "");
                              setOpenOffice(false);
                            }}
                            className="font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !formData.office ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Select Office
                          </CommandItem>
                          {offices
                            .filter(office => canManageOffice(office.id))
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
                {errors.office && <div className={errorClass}>{errors.office}</div>}
              </div>
            </div>

            {/* Shift Type and Alias */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Shift Alias / Code</label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => handleInputChange("alias", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. MS"
                  disabled={!isCustomSchedule && mode !== 'edit'}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Shift Type</label>
                <Select
                  value={formData.shift_type}
                  onValueChange={(v) => handleInputChange("shift_type", v)}
                  disabled={!isCustomSchedule && mode !== 'edit'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Shift">Shift</SelectItem>
                    <SelectItem value="OnCall">OnCall</SelectItem>
                  </SelectContent>
                </Select>
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

            <div className="flex justify-end pt-2 gap-2">
              {mode === "edit" && onCancelEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel Edit
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-8"
              >
                {isSubmitting
                  ? mode === "edit" ? "Updating..." : "Creating..."
                  : mode === "edit" ? "Update Duty Schedule" : "Create Duty Schedule"}
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
                  <span className="font-bold text-primary">
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
              className="bg-primary text-white hover:bg-primary-hover"
            >
              {isSubmitting ? "Saving..." : "Create Schedule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
