import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, Landmark, Save, HelpCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { toast } from "sonner";

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

export const NotificationSettings = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";
  
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
  
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

  // Load Offices
  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const { data } = await api.get("/offices/");
        setOffices(data);
        
        if (isSuperAdmin) {
          if (data.length > 0) {
            setSelectedOfficeId(String(data[0].id));
          }
        } else if (user?.office_id) {
          setSelectedOfficeId(String(user.office_id));
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

  // Load Settings and Schedules for Selected Office
  useEffect(() => {
    if (!selectedOfficeId) return;

    const fetchSettingsAndSchedules = async () => {
      setLoadingSettings(true);
      try {
        const [settingsRes, schedulesRes] = await Promise.all([
          api.get(`/notifications/office-settings/${selectedOfficeId}/`),
          api.get(`/schedule/?office=${selectedOfficeId}`)
        ]);
        
        const data = settingsRes.data;
        if (!data.schedule_configs) data.schedule_configs = {};
        
        setOfficeSettings(data);
        const fetchedSchedules = schedulesRes.data?.results || schedulesRes.data || [];
        setSchedules(fetchedSchedules);
        if (fetchedSchedules.length > 0) {
          setSelectedScheduleId(String(fetchedSchedules[0].id));
        } else {
          setSelectedScheduleId("");
        }
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
    if (!selectedScheduleId) return;
    setOfficeSettings(prev => {
      const configs = { ...(prev.schedule_configs as any) || {} };
      if (!configs[selectedScheduleId]) {
        configs[selectedScheduleId] = {
          enabled: false,
          advance_reminder_days: 1,
          advance_reminder_time: "18:00:00",
          advance_reminder_template: "Dear {{employee_name}}, your duty \"{{shift_name}}\" at \"{{office_name}}\" is scheduled for {{date_ad}}. Please visit https://dutychart.ntc.net.np for details."
        };
      }
      configs[selectedScheduleId][field] = value;
      return { ...prev, schedule_configs: configs };
    });
  };

  const handleSave = async () => {
    if (!selectedOfficeId) return;
    setSaving(true);
    try {
      const payload = {
        ...officeSettings,
        office: parseInt(selectedOfficeId),
      };
      await api.put(`/notifications/office-settings/${selectedOfficeId}/`, payload);
      toast.success("Notification settings updated successfully");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
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

  const schConfig = selectedScheduleId && (officeSettings.schedule_configs as any)?.[selectedScheduleId] 
    ? (officeSettings.schedule_configs as any)[selectedScheduleId] 
    : {
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
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
            <Landmark className="h-4 w-4" />
            Office Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="office-select" className="text-slate-700 font-bold">Select Office</Label>
              <p className="text-xs text-slate-500 leading-normal">
                {isSuperAdmin
                  ? "Choose the branch to configure notification rules."
                  : "Configure the notification settings for your assigned office."}
              </p>
            </div>
            <div className="w-full md:w-80">
              <Select
                value={selectedOfficeId}
                onValueChange={setSelectedOfficeId}
                disabled={!isSuperAdmin}
              >
                <SelectTrigger id="office-select" className="bg-white border-slate-200 h-10 font-medium text-slate-800">
                  <SelectValue placeholder="Choose office..." />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={String(office.id)} className="font-medium">
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {/* Shift Selection Card */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="py-4 bg-slate-50/50 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  Select Shift (Schedule)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="shift-select" className="text-slate-700 font-bold">Shift to Configure</Label>
                    <p className="text-xs text-slate-500 leading-normal">
                      Only employees assigned to configured and enabled shifts will receive automated SMS reminders.
                    </p>
                  </div>
                  <div className="w-full md:w-80">
                    <Select
                      value={selectedScheduleId}
                      onValueChange={setSelectedScheduleId}
                      disabled={schedules.length === 0}
                    >
                      <SelectTrigger id="shift-select" className="bg-white border-slate-200 h-10 font-medium text-slate-800">
                        <SelectValue placeholder="Choose shift..." />
                      </SelectTrigger>
                      <SelectContent>
                        {schedules.map((schedule) => (
                          <SelectItem key={schedule.id} value={String(schedule.id)} className="font-medium">
                            {schedule.name} ({schedule.start_time} - {schedule.end_time})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shift-Specific Settings Form */}
            {selectedScheduleId && (
              <Card className="border-slate-100 shadow-sm flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                      Configuration for {schedules.find(s => String(s.id) === selectedScheduleId)?.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-slate-600">Enable SMS for this Shift</Label>
                      <Switch
                        id="enable-shift-sms"
                        checked={schConfig.enabled}
                        onCheckedChange={(checked) => updateScheduleConfig('enabled', checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                
                {schConfig.enabled ? (
                  <CardContent className="p-5 flex-1 flex flex-col gap-4">
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
                    <div className="space-y-2 flex-1 flex flex-col">
                      <Label htmlFor="advance-template" className="text-slate-700 font-bold">SMS Message Template</Label>
                      <Textarea
                        id="advance-template"
                        ref={textareaRef}
                        placeholder="Write your custom SMS template here..."
                        value={schConfig.advance_reminder_template || ""}
                        onChange={(e) => updateScheduleConfig('advance_reminder_template', e.target.value)}
                        className="flex-1 min-h-[160px] bg-white border-slate-200 font-medium text-slate-800 leading-relaxed resize-none focus-visible:ring-1"
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
                  </CardContent>
                ) : (
                  <CardContent className="p-8 text-center text-slate-500">
                    <p className="text-sm">SMS Reminders are disabled for this shift.</p>
                    <p className="text-xs mt-1">Enable them using the switch in the top right to configure the template and schedule.</p>
                  </CardContent>
                )}
              </Card>
            )}

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
                                <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Offset</span>
                                <span>{conf.advance_reminder_days} days before</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Time</span>
                                <span>{conf.advance_reminder_time?.substring(0, 5) || "18:00"}</span>
                              </div>
                            </div>
                          )}
                          <div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs font-medium"
                              onClick={() => {
                                setSelectedScheduleId(schId);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              Edit Settings
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Save Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="h-10 font-bold"
                onClick={async () => {
                  setLoadingSettings(true);
                  try {
                    const { data } = await api.get(`/notifications/office-settings/${selectedOfficeId}/`);
                    if (!data.schedule_configs) data.schedule_configs = {};
                    setOfficeSettings(data);
                    toast.success("Settings reset to current database values");
                  } catch (e) {
                    toast.error("Failed to reset settings");
                  } finally {
                    setLoadingSettings(false);
                  }
                }}
                disabled={saving || loadingSettings}
              >
                Reset to Current
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
        )
      )}
    </div>
  );
};
