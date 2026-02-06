import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Bell, Shield, Database, Lock, Loader2 } from 'lucide-react';
import { RBACAdmin } from "@/components/settings/RBACAdmin";
import { useEffect, useState } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const Settings = () => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    id: null,
    is_2fa_enabled: false,
    session_timeout: 60,
    auto_logout_idle: true
  });

  useEffect(() => {
    document.title = "Settings - NT Duty Chart Management System";
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("system-settings/");
      setSettings(data);
    } catch (err) {
      console.error("Failed to load security settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        await api.put(`system-settings/${settings.id}/`, settings);
      } else {
        await api.post("system-settings/", settings);
      }
      toast.success("Security settings updated successfully");
      // Refresh local storage values for immediate affect in MainLayout if needed
      localStorage.setItem('session_timeout', String(settings.session_timeout));
      localStorage.setItem('auto_logout_idle', String(settings.auto_logout_idle));
    } catch (err) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-muted-foreground">Configure system preferences and user settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          {hasPermission('system.manage_rbac') && (
            <TabsTrigger value="rbac" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              RBAC Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>Basic application configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input id="company-name" defaultValue="Nepal Telecom" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-zone">Time Zone</Label>
                  <Input id="time-zone" defaultValue="Asia/Kathmandu" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work-week">Work Week</Label>
                  <Input id="work-week" defaultValue="Sunday - Friday" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="24-hour">24-Hour Format</Label>
                  <Switch id="24-hour" defaultChecked />
                </div>
              </CardContent>
            </Card>

            {/* User Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Preferences
                </CardTitle>
                <CardDescription>Personal settings and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Input id="language" defaultValue="English" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Input id="theme" defaultValue="Light" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-refresh">Auto-refresh Dashboard</Label>
                  <Switch id="auto-refresh" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="compact-view">Compact View</Label>
                  <Switch id="compact-view" />
                </div>
              </CardContent>
            </Card>


            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
                <CardDescription>Global security and access control settings (Admin Only)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Enable system-wide SMS 2FA for all users</p>
                      </div>
                      <Switch
                        id="two-factor"
                        checked={settings.is_2fa_enabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, is_2fa_enabled: checked })}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                      <Input
                        id="session-timeout"
                        type="number"
                        value={settings.session_timeout}
                        onChange={(e) => setSettings({ ...settings, session_timeout: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-logout">Auto-logout on Idle</Label>
                        <p className="text-sm text-muted-foreground">Logout when no activity is detected</p>
                      </div>
                      <Switch
                        id="auto-logout"
                        checked={settings.auto_logout_idle}
                        onCheckedChange={(checked) => setSettings({ ...settings, auto_logout_idle: checked })}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* System Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Information
                </CardTitle>
                <CardDescription>Current system status and information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-sm font-medium">Version</Label>
                    <p className="text-sm text-muted-foreground">v2.1.0</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Last Updated</Label>
                    <p className="text-sm text-muted-foreground">January 15, 2024</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Database Status</Label>
                    <p className="text-sm text-success">Connected</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Active Users</Label>
                    <p className="text-sm text-muted-foreground">24</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">System Load</Label>
                    <p className="text-sm text-muted-foreground">Normal</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Uptime</Label>
                    <p className="text-sm text-muted-foreground">99.9%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Settings */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={fetchSettings} disabled={loading || saving}>Reset to Defaults</Button>
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {hasPermission('system.manage_rbac') && (
          <TabsContent value="rbac">
            <RBACAdmin />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;