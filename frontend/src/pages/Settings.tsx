import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Bell, Shield, Database, Lock } from 'lucide-react';
import { RBACAdmin } from "@/components/settings/RBACAdmin";
import { useEffect } from "react";

const Settings = () => {
  useEffect(() => {
    document.title = "Settings - INOC Duty Roster";
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#005a9c]">Settings</h1>
        <p className="text-muted-foreground">Configure system preferences and user settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="rbac" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            RBAC Admin
          </TabsTrigger>
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

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>Configure notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch id="email-notifications" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="duty-reminders">Duty Reminders</Label>
                    <p className="text-sm text-muted-foreground">30 minutes before shifts</p>
                  </div>
                  <Switch id="duty-reminders" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="schedule-changes">Schedule Changes</Label>
                    <p className="text-sm text-muted-foreground">When duties are modified</p>
                  </div>
                  <Switch id="schedule-changes" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="system-alerts">System Alerts</Label>
                    <p className="text-sm text-muted-foreground">Important system messages</p>
                  </div>
                  <Switch id="system-alerts" defaultChecked />
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
                <CardDescription>Security and access control settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Enhanced account security</p>
                  </div>
                  <Switch id="two-factor" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input id="session-timeout" type="number" defaultValue="60" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-logout">Auto-logout on Idle</Label>
                    <p className="text-sm text-muted-foreground">Logout when inactive</p>
                  </div>
                  <Switch id="auto-logout" defaultChecked />
                </div>
                <Button variant="outline" className="w-full">
                  Change Password
                </Button>
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
            <Button variant="outline">Reset to Defaults</Button>
            <Button>Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="rbac">
          <RBACAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;