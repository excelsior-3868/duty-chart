import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, Landmark, Save, HelpCircle, RefreshCw, Check, ChevronsUpDown, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface Office {
  id: number;
  name: string;
}

interface OfficeNotificationSetting {
  office: number;
  enable_advance_reminder: boolean;
  advance_reminder_days: number;
  advance_reminder_time: string;
  advance_reminder_template: string;
  allowed_shifts: number[];
  allowed_duty_charts: number[];
}

const PLACEHOLDERS = [
  "{{employee_name}}",
  "{{shift_name}}",
  "{{chart_name}}",
  "{{start_time}}",
  "{{end_time}}",
  "{{date_bs}}",
  "{{date_ad}}",
  "{{office_name}}",
  "{{advance_days}}",
  "{{dispatch_time}}",
];

// ---------------------------------------------------------------------------
// Cache helpers — keyed by office ID, stored in sessionStorage
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(officeId: string, type: "settings" | "schedules") {
  return `notif_cache_${type}_${officeId}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage full — ignore silently
  }
}

function bustCache(officeId: string) {
  sessionStorage.removeItem(cacheKey(officeId, "settings"));
  sessionStorage.removeItem(cacheKey(officeId, "schedules"));
}

// ---------------------------------------------------------------------------

export const NotificationSettings = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
  
  const displayedOffices = user?.office_id
    ? [
        ...offices.filter((o) => o.id === user.office_id),
        ...offices.filter((o) => o.id !== user.office_id)
      ]
    : offices;
  
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const [officeSettings, setOfficeSettings] = useState<OfficeNotificationSetting>({
    office: 0,
    enable_advance_reminder: true,
    advance_reminder_days: 1,
    advance_reminder_time: "18:00:00",
    advance_reminder_template: "",
    allowed_shifts: [],
    allowed_duty_charts: [],
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [officeComboOpen, setOfficeComboOpen] = useState(false);
  const configCardRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [schIdToDelete, setSchIdToDelete] = useState("");
  const [schConfigDraft, setSchConfigDraft] = useState<any>(null);

  // Sync selected shift config to local draft state
  useEffect(() => {
    if (!selectedScheduleId) {
      setSchConfigDraft(null);
      return;
    }
    const savedConfig = (officeSettings.schedule_configs as any)?.[selectedScheduleId];
    if (savedConfig) {
      setSchConfigDraft({ ...savedConfig });
    } else {
      setSchConfigDraft({
        enabled: false,
        advance_reminder_days: 1,
        advance_reminder_time: "18:00:00",
        advance_reminder_template: "Dear {{employee_name}}, your duty \"{{shift_name}}\" at \"{{office_name}}\" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details."
      });
    }
  }, [selectedScheduleId, officeSettings.schedule_configs]);

  // Load Offices (offices list is stable — cache for session lifetime)
  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const cached = readCache<Office[]>(cacheKey("all", "schedules")); // reuse key for offices
        let data: Office[];

        if (cached) {
          data = cached;
        } else {
          const res = await api.get("/offices/");
          data = res.data;
          writeCache(cacheKey("all", "schedules"), data);
        }

        setOffices(data);
        
        if (user?.office_id) {
          setSelectedOfficeId(String(user.office_id));
        } else if (data.length > 0) {
          setSelectedOfficeId(String(data[0].id));
        }
      } catch (err) {
        console.error("Failed to load offices:", err);
        toast.error("Failed to load offices");
      } finally {
        setLoadingOffices(false);
      }
    };

    fetchOffices();
  }, [isSuperAdmin, user]);

  // Load Settings and Schedules for Selected Office (cached per office)
  useEffect(() => {
    if (!selectedOfficeId) return;

    const fetchSettingsAndSchedules = async (forceRefresh = false) => {
      setLoadingSettings(true);
      try {
        const settingsKey = cacheKey(selectedOfficeId, "settings");
        const schedulesKey = cacheKey(selectedOfficeId, "schedules");

        let settingsData = forceRefresh ? null : readCache<any>(settingsKey);
        let schedulesData = forceRefresh ? null : readCache<any[]>(schedulesKey);

        if (!settingsData || !schedulesData) {
          const [settingsRes, schedulesRes] = await Promise.all([
            api.get(`/notifications/office-settings/${selectedOfficeId}/`),
            api.get(`/schedule/?office=${selectedOfficeId}`)
          ]);
          
          settingsData = settingsRes.data;
          if (!settingsData.schedule_configs) settingsData.schedule_configs = {};

          schedulesData = schedulesRes.data?.results || schedulesRes.data || [];

          // Write to cache
          writeCache(settingsKey, settingsData);
          writeCache(schedulesKey, schedulesData);
        }

        setOfficeSettings(settingsData);
        setSchedules(schedulesData);
        setSelectedScheduleId("");
      } catch (err) {
        console.error("Failed to load configuration data:", err);
        toast.error("Failed to load configuration details for this office");
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettingsAndSchedules();
  }, [selectedOfficeId]);

  // Placeholder insertion helper
  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value || "";
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newVal = before + placeholder + after;

    updateScheduleConfig('advance_reminder_template', newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const updateScheduleConfig = (field: string, value: any) => {
    setSchConfigDraft(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };

  const triggerDeleteConfig = (schId: string) => {
    setSchIdToDelete(schId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteConfig = async () => {
    if (!schIdToDelete || !selectedOfficeId) return;
    
    // Create new configs dictionary without the deleted key
    const updatedConfigs = { ...(officeSettings.schedule_configs as any) || {} };
    delete updatedConfigs[schIdToDelete];
    
    const updatedSettings = {
      ...officeSettings,
      schedule_configs: updatedConfigs,
      office: parseInt(selectedOfficeId),
    };
    
    setLoadingSettings(true); // show loader during save
    try {
      await api.put(`/notifications/office-settings/${selectedOfficeId}/`, updatedSettings);
      
      // Bust cache & update local state
      bustCache(selectedOfficeId);
      writeCache(cacheKey(selectedOfficeId, "settings"), updatedSettings);
      
      setOfficeSettings(updatedSettings);
      
      if (selectedScheduleId === schIdToDelete) {
        setSelectedScheduleId("");
      }
      toast.success("Shift configuration deleted successfully.");
    } catch (err) {
      console.error("Failed to delete configuration:", err);
      toast.error("Failed to delete configuration");
    } finally {
      setLoadingSettings(false);
      setDeleteConfirmOpen(false);
      setSchIdToDelete("");
    }
  };

  const handleSave = async () => {
    if (!selectedOfficeId || !selectedScheduleId || !schConfigDraft) return;
    setSaving(true);
    try {
      const updatedConfigs = {
        ...(officeSettings.schedule_configs as any) || {},
        [selectedScheduleId]: schConfigDraft
      };
      
      const payload = {
        ...officeSettings,
        schedule_configs: updatedConfigs,
        office: parseInt(selectedOfficeId),
      };
      await api.put(`/notifications/office-settings/${selectedOfficeId}/`, payload);

      // Bust the cache for this office so the next fetch reflects saved data
      bustCache(selectedOfficeId);
      // Update cache with latest saved data immediately
      writeCache(cacheKey(selectedOfficeId, "settings"), payload);

      setOfficeSettings(payload);
      setSelectedScheduleId("");
      toast.success("Notification settings updated successfully");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Force-refresh from server, bypassing cache
  const handleRefresh = async () => {
    if (!selectedOfficeId) return;
    bustCache(selectedOfficeId);
    setLoadingSettings(true);
    try {
      const [settingsRes, schedulesRes] = await Promise.all([
        api.get(`/notifications/office-settings/${selectedOfficeId}/`),
        api.get(`/schedule/?office=${selectedOfficeId}`)
      ]);

      const data = settingsRes.data;
      if (!data.schedule_configs) data.schedule_configs = {};
      const fetchedSchedules = schedulesRes.data?.results || schedulesRes.data || [];

      writeCache(cacheKey(selectedOfficeId, "settings"), data);
      writeCache(cacheKey(selectedOfficeId, "schedules"), fetchedSchedules);

      setOfficeSettings(data);
      setSchedules(fetchedSchedules);
      setSelectedScheduleId("");
      toast.success("Settings refreshed from server");
    } catch (e) {
      toast.error("Failed to refresh settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  if (loadingOffices) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 font-semibold text-slate-600">Loading Configuration...</span>
      </div>
    );
  }

  const schConfig = schConfigDraft || {
    enabled: false,
    advance_reminder_days: 1,
    advance_reminder_time: "18:00:00",
    advance_reminder_template: "Dear {{employee_name}}, your duty \"{{shift_name}}\" at \"{{office_name}}\" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details."
  };

  return (
    <div className="space-y-6">
      {/* Office Selection Card */}
      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="py-4 bg-slate-50/50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Landmark className="h-4 w-4" />
              Office Selection
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-slate-500 hover:text-slate-800"
              onClick={handleRefresh}
              disabled={loadingSettings || !selectedOfficeId}
              title="Refresh from server (bypass cache)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingSettings ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label className="text-slate-700 font-bold whitespace-nowrap">Select Office</Label>
            <div className="flex-1">
              <Popover open={officeComboOpen && isSuperAdmin} onOpenChange={(v) => isSuperAdmin && setOfficeComboOpen(v)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={officeComboOpen}
                    disabled={!isSuperAdmin}
                    className="w-full justify-between bg-white border-slate-200 h-9 font-medium text-slate-800 hover:bg-slate-50 hover:text-slate-800"
                  >
                    {selectedOfficeId
                      ? (offices.find((o) => String(o.id) === selectedOfficeId)?.name ?? "Select office...")
                      : "Select office..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search office..." className="h-9" />
                    <CommandList className="max-h-56 overflow-y-auto">
                      <CommandEmpty>No office found.</CommandEmpty>
                      <CommandGroup>
                        {displayedOffices.map((office) => (
                          <CommandItem
                            key={office.id}
                            value={office.name}
                            onSelect={() => {
                              setSelectedOfficeId(String(office.id));
                              setOfficeComboOpen(false);
                            }}
                            className="font-medium"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedOfficeId === String(office.id) ? "opacity-100" : "opacity-0"
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
          </div>
        </CardContent>
      </Card>

      {loadingSettings ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 font-semibold text-slate-600">Loading Office Settings...</span>
        </div>
      ) : (
        selectedOfficeId && (
          <div className="space-y-6">
            {/* Saved Configurations Overview */}
            {Object.keys((officeSettings.schedule_configs as any) || {}).length > 0 && (
              <Card className="border-slate-100 shadow-sm flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <Save className="h-4 w-4 text-emerald-500" />
                    Configured Shifts Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {Object.entries((officeSettings.schedule_configs as any) || {}).map(([schId, conf]: [string, any]) => {
                      const sch = schedules.find(s => String(s.id) === schId);
                      if (!sch) return null;
                      return (
                        <div key={schId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              {sch.name}
                              {conf.enabled ? (
                                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-[10px] px-1.5 py-0">Enabled</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-slate-500">Disabled</Badge>
                              )}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {sch.start_time} - {sch.end_time}
                            </p>
                          </div>
                          {conf.enabled && (
                            <div className="flex gap-4 text-xs text-slate-600">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Offset</span>
                                <span className="font-bold text-slate-800">{conf.advance_reminder_days} days before</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Time</span>
                                <span className="font-bold text-slate-800">{conf.advance_reminder_time?.substring(0, 5) || "18:00"}</span>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setSelectedScheduleId(schId);
                                setTimeout(() => {
                                  configCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 50);
                              }}
                              title="Edit Settings"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => triggerDeleteConfig(schId)}
                              title="Delete Settings"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shift Notification Configuration Card */}
            <Card ref={configCardRef} className="border-slate-100 shadow-sm flex flex-col">
              <CardHeader className="py-4 bg-slate-50/50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    {selectedScheduleId 
                      ? `Configuration for ${schedules.find(s => String(s.id) === selectedScheduleId)?.name || ""}` 
                      : "Shift Notification Configuration"}
                  </CardTitle>
                  {selectedScheduleId && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-slate-600">Enable SMS for this Shift</Label>
                      <Switch
                        id="enable-shift-sms"
                        checked={schConfig.enabled}
                        onCheckedChange={(checked) => updateScheduleConfig('enabled', checked)}
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-5 flex flex-col gap-5">
                {/* Selector Row */}
                <div className={cn(
                  "flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4",
                  selectedScheduleId && "border-b border-slate-100"
                )}>
                  <div className="space-y-1">
                    <Label htmlFor="shift-select" className="text-slate-700 font-bold">Shift to Configure</Label>
                    <p className="text-xs text-slate-500 leading-normal">
                      Only employees assigned to configured and enabled shifts will receive automated SMS reminders.
                    </p>
                  </div>
                  <div className="w-full md:w-80">
                    <Select
                      value={selectedScheduleId}
                      onValueChange={(val) => {
                        if (val === "none") {
                          setSelectedScheduleId("");
                        } else {
                          setSelectedScheduleId(val);
                        }
                      }}
                      disabled={schedules.length === 0}
                    >
                      <SelectTrigger id="shift-select" className="bg-white border-slate-200 h-10 font-medium text-slate-800">
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="font-medium text-slate-500">
                          Select Shift
                        </SelectItem>
                        {schedules
                          .filter((schedule) => {
                            const isConfigured = !!(officeSettings.schedule_configs as any)?.[String(schedule.id)];
                            const isSelected = selectedScheduleId === String(schedule.id);
                            return !isConfigured || isSelected;
                          })
                          .map((schedule) => (
                            <SelectItem key={schedule.id} value={String(schedule.id)} className="font-medium">
                              {schedule.name} ({schedule.start_time} - {schedule.end_time})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Configuration form loaded dynamically */}
                {selectedScheduleId && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Reminder Days Offset */}
                      <div className="space-y-2">
                        <Label htmlFor="advance-days" className="text-slate-700 font-bold">Reminder Day Offset</Label>
                        <Input
                          id="advance-days"
                          type="number"
                          min={0}
                          max={30}
                          value={schConfig.advance_reminder_days}
                          onChange={(e) => updateScheduleConfig('advance_reminder_days', parseInt(e.target.value) || 0)}
                          className="bg-white border-slate-200 font-medium h-10 text-slate-800"
                        />
                        <p className="text-[10px] text-slate-500">
                          E.g. 1 for day before, 2 for two days before, 0 for same day.
                        </p>
                      </div>

                      {/* Dispatch Time */}
                      <div className="space-y-2">
                        <Label htmlFor="advance-time" className="text-slate-700 font-bold">Dispatch Time</Label>
                        <Input
                          id="advance-time"
                          type="time"
                          value={schConfig.advance_reminder_time ? schConfig.advance_reminder_time.substring(0, 5) : "18:00"}
                          onChange={(e) => updateScheduleConfig('advance_reminder_time', e.target.value ? `${e.target.value}:00` : "18:00:00")}
                          className="bg-white border-slate-200 font-medium h-10 text-slate-800"
                        />
                        <p className="text-[10px] text-slate-500">
                          Time of day when alerts are dispatched.
                        </p>
                      </div>
                    </div>

                    {/* Custom SMS Template */}
                    <div className="space-y-2 flex flex-col">
                      <Label htmlFor="advance-template" className="text-slate-700 font-bold">SMS Message Template</Label>
                      <Textarea
                        id="advance-template"
                        ref={textareaRef}
                        placeholder="Write your custom SMS template here..."
                        value={schConfig.advance_reminder_template || ""}
                        onChange={(e) => updateScheduleConfig('advance_reminder_template', e.target.value)}
                        className="min-h-[160px] bg-white border-slate-200 font-medium text-slate-800 leading-relaxed resize-none focus-visible:ring-1"
                      />
                    </div>

                    {/* Available Placeholders */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <HelpCircle className="h-3 w-3" /> Placeholders (Click to insert)
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PLACEHOLDERS.map((ph) => (
                          <Badge
                            key={ph}
                            variant="secondary"
                            className="cursor-pointer hover:bg-indigo-50 border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 font-mono"
                            onClick={() => insertPlaceholder(ph)}
                          >
                            {ph}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Cancel & Save Buttons inside Configuration card */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedScheduleId("")}
                        className="h-10 font-bold px-6"
                        disabled={saving || loadingSettings}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        className="h-10 font-bold px-6 bg-primary hover:bg-primary/95 text-white shadow-sm transition-colors"
                        disabled={saving || loadingSettings}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Configuration
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )
      )}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-xl border shadow-lg max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Configuration?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-sm">
              Are you sure you want to delete the configuration for this shift? This will remove all customized reminder offsets, times, and templates for this shift.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="h-9 rounded-lg text-xs font-medium border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={confirmDeleteConfig}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
