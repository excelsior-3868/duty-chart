import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Clock, CheckCircle, XCircle, Calendar, Filter, Download } from 'lucide-react';

const Attendance = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();

  const attendanceData = [
    {
      id: 1,
      employee: "Ram Sharma",
      employeeId: "EMP001",
      position: "Network Engineer",
      checkIn: "08:15 AM",
      checkOut: "05:30 PM",
      workHours: "9h 15m",
      status: "present",
      date: "2024-01-15"
    },
    {
      id: 2,
      employee: "Sita Karki",
      employeeId: "EMP002",
      position: "Customer Service",
      checkIn: "09:00 AM",
      checkOut: "06:00 PM",
      workHours: "9h 00m",
      status: "present",
      date: "2024-01-15"
    },
    {
      id: 3,
      employee: "Hari Thapa",
      employeeId: "EMP003",
      position: "Field Technician",
      checkIn: "-",
      checkOut: "-",
      workHours: "0h",
      status: "absent",
      date: "2024-01-15"
    },
    {
      id: 4,
      employee: "Maya Gurung",
      employeeId: "EMP004",
      position: "Supervisor",
      checkIn: "07:45 AM",
      checkOut: "-",
      workHours: "In Progress",
      status: "late",
      date: "2024-01-15"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-success text-success-foreground';
      case 'absent': return 'bg-destructive text-destructive-foreground';
      case 'late': return 'bg-warning text-warning-foreground';
      case 'early_leave': return 'bg-accent text-accent-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Attendance</h1>
          <p className="text-muted-foreground">Track employee attendance and work hours</p>
        </div>
        <div className="flex gap-2">
          <DatePicker
            date={selectedDate}
            onDateChange={setSelectedDate}
            placeholder="Select date"
            className="w-48"
          />
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <div className="text-2xl font-bold text-success">95</div>
                <p className="text-xs text-muted-foreground">Present Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <div className="text-2xl font-bold text-destructive">5</div>
                <p className="text-xs text-muted-foreground">Absent Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <div className="text-2xl font-bold text-warning">8</div>
                <p className="text-xs text-muted-foreground">Late Arrivals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">87.5%</div>
            <p className="text-xs text-muted-foreground">Overall Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
          <CardDescription>
            Real-time attendance tracking for {new Date().toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Employee</th>
                  <th className="text-left p-3 font-medium">Position</th>
                  <th className="text-left p-3 font-medium">Check In</th>
                  <th className="text-left p-3 font-medium">Check Out</th>
                  <th className="text-left p-3 font-medium">Work Hours</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{record.employee}</div>
                        <div className="text-sm text-muted-foreground">ID: {record.employeeId}</div>
                      </div>
                    </td>
                    <td className="p-3 text-sm">{record.position}</td>
                    <td className="p-3 text-sm">{record.checkIn}</td>
                    <td className="p-3 text-sm">{record.checkOut}</td>
                    <td className="p-3 text-sm">{record.workHours}</td>
                    <td className="p-3">
                      <Badge className={getStatusColor(record.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(record.status)}
                          {record.status}
                        </div>
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">View</Button>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Attendance Summary</CardTitle>
          <CardDescription>
            Attendance overview for the current week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-7">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
              const rate = [95, 92, 97, 89, 94, 88, 85][index];
              return (
                <div key={day} className="text-center p-3 rounded-lg border">
                  <div className="text-sm font-medium text-muted-foreground">{day}</div>
                  <div className="text-lg font-bold text-primary mt-1">{rate}%</div>
                  <div className="text-xs text-muted-foreground">attendance</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Attendance;