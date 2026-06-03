import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { 
  Info, 
  Building, 
  Terminal, 
  UserCheck, 
  Users, 
  Cpu, 
  Server, 
  Activity,
  Heart
} from "lucide-react";
import api from "@/services/api";

function About() {
  const [appVersion, setAppVersion] = React.useState<string>(
    localStorage.getItem("app_version") || import.meta.env.VITE_APP_VERSION || "v1.0.0-dev"
  );

  React.useEffect(() => {
    api.get("system-settings/")
      .then(res => {
        if (res.data.image_version) {
          setAppVersion(res.data.image_version);
          localStorage.setItem("app_version", res.data.image_version);
        }
      })
      .catch(err => console.error("Failed to fetch system version in About", err));
  }, []);

  const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP 
    ? (() => {
        const val = import.meta.env.VITE_BUILD_TIMESTAMP;
        if (val.length === 14) {
          // Format YYYYMMDDHHMMSS to M/D/YYYY, H:MM:SS AM/PM
          const year = val.substring(0, 4);
          const month = parseInt(val.substring(4, 6), 10);
          const day = parseInt(val.substring(6, 8), 10);
          const hour = parseInt(val.substring(8, 10), 10);
          const minute = val.substring(10, 12);
          const second = val.substring(12, 14);
          const ampm = hour >= 12 ? "PM" : "AM";
          const formattedHour = hour % 12 || 12;
          return `${month}/${day}/${year}, ${formattedHour}:${minute}:${second} ${ampm}`;
        }
        return val;
      })()
    : new Date().toLocaleString();

  const isProduction = import.meta.env.PROD;

  const team = {
    deputyManagers: [
      { name: "Kiran Acharya", initials: "KA", role: "Deputy Manager" },
      { name: "Prashant Adhikari", initials: "PA", role: "Deputy Manager" }
    ],
    seniorEngineer: [
      { name: "Subin Bajracharya", initials: "SB", role: "Senior Engineer" }
    ],
    engineers: [
      { name: "Rabi Raj Yadav", initials: "RRY", role: "Engineer" },
      { name: "Murari Sharma", initials: "MS", role: "Engineer" },
      { name: "Buddhi Krishna Thapa", initials: "BKT", role: "Engineer" }
    ]
  };

  return (
    <div className="p-6 space-y-6 flex flex-col min-h-[calc(100vh-4rem)] justify-between">
      <div className="space-y-6">
        <PageHeader 
          title="About System" 
          subtitle="Detailed application metadata and deployment parameters" 
          icon={Info} 
          iconColor="text-blue-500"
        />

        <div className="grid gap-6 md:grid-cols-5">
          {/* Left Columns - Metadata & Operational info */}
          <div className="md:col-span-3 space-y-6">
            
            {/* System Overview */}
            <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                  <Info className="h-4 w-4" /> System Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">
                  Duty Chart Management System (DCMS) is a comprehensive enterprise platform designed for Nepal Telecom to streamline and automate shift scheduling, duty rotations, and implementation reporting. It provides unified tracking for office rosters, holidays, and employee availability, while offering real-time implementation reports and automated SMS notifications.
                </p>
              </CardContent>
            </Card>

            {/* Version & Environment Grid */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-blue-500" /> App Version
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900 leading-none">{appVersion}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-normal">Currently deployed application version</p>
                </CardContent>
              </Card>

              <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-emerald-500" /> Environment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900 leading-none">
                    {isProduction ? "Production" : "Development"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-normal">Active server deployment environment</p>
                </CardContent>
              </Card>
            </div>

            {/* Build Details */}
            <Card className="shadow-md border-slate-100">
              <CardContent className="p-5 space-y-4">
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Build Details
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-500">Build Timestamp</span>
                    <span className="font-mono font-semibold text-slate-900">{buildTimestamp}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-500">Application Name</span>
                    <span className="font-semibold text-slate-900">NT-DCMS (Duty Chart Management System)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-800">System Operational</p>
                <p className="text-xs text-emerald-600 font-normal">All services are functional.</p>
              </div>
            </div>

          </div>

          {/* Right Column - Team & Org Structure */}
          <div className="md:col-span-2">
            <Card className="shadow-md border-slate-100 h-full">
              <CardContent className="p-6 space-y-6">
                
                {/* Org node */}
                <div className="flex gap-4 items-start">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100">
                    <Building className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-500">Organization</p>
                    <p className="text-sm font-bold text-slate-900">Nepal Telecom</p>
                  </div>
                </div>

                {/* Dept node */}
                <div className="flex gap-4 items-start border-b pb-5">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm border border-indigo-100">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-500">Department</p>
                    <p className="text-sm font-bold text-slate-900">ITD, Software and Security Wing</p>
                  </div>
                </div>

                {/* Team Hierarchy */}
                <div className="space-y-5">
                  
                  {/* Deputy Managers */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-blue-500" /> Deputy Managers
                    </p>
                    <div className="space-y-2.5 pl-5 border-l-2 border-slate-100">
                      {team.deputyManagers.map((member) => (
                        <div key={member.name} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-sm select-none">
                            {member.initials}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{member.name}</p>
                            <p className="text-[10px] text-amber-600 font-medium">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Senior Engineer */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-500" /> Senior Engineer
                    </p>
                    <div className="space-y-2.5 pl-5 border-l-2 border-slate-100">
                      {team.seniorEngineer.map((member) => (
                        <div key={member.name} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm select-none">
                            {member.initials}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{member.name}</p>
                            <p className="text-[10px] text-blue-600 font-medium">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Engineers */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-500" /> Engineers
                    </p>
                    <div className="space-y-2.5 pl-5 border-l-2 border-slate-100">
                      {team.engineers.map((member) => (
                        <div key={member.name} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center shadow-sm select-none">
                            {member.initials}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{member.name}</p>
                            <p className="text-[10px] text-sky-600 font-medium">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t pt-4 text-center space-y-1 mt-6">
        <p className="text-[10px] text-slate-400 font-semibold">
          © {new Date().getFullYear()} Duty Chart Management System - Nepal Telecom. All rights reserved.
        </p>
        <p className="text-[9px] text-slate-400 font-bold">
          Developed By: <span className="text-blue-700">ITD, Software and Security Wing</span>
        </p>
      </footer>
    </div>
  );
}

export default About;
