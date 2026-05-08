import React, { useState, useEffect } from "react";
import api from "@/services/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    BarChart3, 
    Calendar, 
    Building2, 
    Users, 
    Clock, 
    Search, 
    FileSpreadsheet, 
    Loader2, 
    TrendingUp,
    ShieldCheck,
    FileText
} from "lucide-react";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { getOffices, type Office } from "@/services/offices";
import { Badge } from "@/components/ui/badge";

import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import NepaliDate from "nepali-date-converter";

const getNepaliDayName = (englishDay: string) => {
    const dayMap: Record<string, string> = {
        "sunday": "आइतबार",
        "monday": "सोमबार",
        "tuesday": "मंगलबार",
        "wednesday": "बुधबार",
        "thursday": "बिहीबार",
        "friday": "शुक्रबार",
        "saturday": "शनिबार"
    };
    return dayMap[englishDay.toLowerCase()] || englishDay;
};

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface User {
    id: number;
    full_name: string;
    employee_id?: string;
    office_name?: string;
    phone?: string;
}

interface SummaryData {
    user_id: number;
    full_name: string;
    employee_id: string;
    office_name: string;
    total_duties: number;
    total_hours: number;
    chart_breakdown: Record<string, {
        total_duties: number;
        total_hours: number;
        shifts: Record<string, number>;
    }>;
    dates: {
        date: string;
        chart: string;
        shift: string;
        day: string;
    }[];
}

const SummaryReport = () => {
    const [loading, setLoading] = useState(false);
    const [offices, setOffices] = useState<Office[]>([]);
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");
    const [reportData, setReportData] = useState<SummaryData[]>([]);

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [officeSearchOpen, setOfficeSearchOpen] = useState(false);

    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("all");

    useEffect(() => {
        document.title = "Summary Duty Report - NT Duty Chart";
        fetchOffices();
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchSchedules();
    }, [selectedOfficeId]);

    const fetchOffices = async () => {
        try {
            const data = await getOffices();
            setOffices(data);
        } catch (err) {
            console.error("Failed to fetch offices", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const params: any = { 
                page_size: 1000,
                is_activated: true
            };
            if (selectedOfficeId !== "all") {
                params.office_id = selectedOfficeId;
            }
            const res = await api.get("/users/", { params });
            setUsers(res.data.results || res.data);
            setSelectedUsers([]);
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    };

    const fetchSchedules = async () => {
        try {
            const params: any = {};
            if (selectedOfficeId !== "all") {
                params.office = selectedOfficeId;
            }
            const res = await api.get("/schedule/", { params });
            setSchedules(res.data || []);
            setSelectedScheduleId("all");
        } catch (err) {
            console.error("Failed to fetch schedules", err);
        }
    };

    const handleFetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get("/reports/summary/", {
                params: {
                    office_id: selectedOfficeId !== "all" ? selectedOfficeId : undefined,
                    date_from: dateFrom,
                    date_to: dateTo,
                    user_ids: selectedUsers.length > 0 ? selectedUsers.join(",") : undefined,
                    schedule_id: selectedScheduleId !== "all" ? selectedScheduleId : undefined
                }
            });
            setReportData(res.data);
            if (res.data.length === 0) {
                toast.info("No duty records found for the selected criteria.");
            }
        } catch (err) {
            console.error("Failed to fetch report", err);
            toast.error("Failed to generate report");
        } finally {
            setLoading(false);
        }
    };

    const totalHours = reportData.reduce((acc, curr) => acc + curr.total_hours, 0);
    const handleExportCSV = () => {
        if (reportData.length === 0) {
            toast.error("No data available to export");
            return;
        }

        // CSV Headers
        const headers = ["E.ID", "Employee Name", "Working Office", "Duty Breakdown", "Total Duties", "Total Hours"];
        
        // CSV Rows
        const rows = reportData.map(row => {
            // Format breakdown: Chart1 (Shift1: 2, Shift2: 1); Chart2 (Shift1: 1)
            const breakdown = Object.entries(row.chart_breakdown || {})
                .map(([chart, data]) => {
                    const shiftDetails = Object.entries(data.shifts)
                        .map(([name, count]) => `${name}: ${count}`)
                        .join(", ");
                    return `${chart} [${data.total_hours.toFixed(1)}h] (${shiftDetails})`;
                })
                .join("; ");

            return [
                `"${row.employee_id || ""}"`,
                `"${row.full_name}"`,
                `"${row.office_name}"`,
                `"${breakdown}"`,
                row.total_duties,
                row.total_hours.toFixed(1)
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Summary_Report_${dateFrom}_to_${dateTo}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Report exported successfully");
    };

    const totalDuties = reportData.reduce((acc, row) => acc + row.total_duties, 0);
    const uniqueEmployees = reportData.length;

    const getNepaliDate = (isoDate: string) => {
        try {
            const d = new Date(isoDate);
            const nepali = new NepaliDate(d);
            return nepali.format("YYYY-MM-DD");
        } catch {
            return isoDate;
        }
    };

    return (
        <div className="p-6 space-y-4">
            <PageHeader 
                title="Total Duty Analysis Report" 
                subtitle="Analyze employee-wise and office-wise duty distribution and total hours." 
                icon={BarChart3} 
                iconColor="text-primary"
            />

            {/* Filters Section */}
            <Card className="border-primary/20 shadow-lg overflow-hidden">
                <CardHeader className="py-3 border-b bg-primary">
                    <CardTitle className="text-base flex items-center gap-2 text-white">
                        <BarChart3 className="h-4 w-4 text-white/80" />
                        Report Criteria
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-4 w-full">
                        {/* Office Selection */}
                        <div className="flex-1 min-w-[200px] space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center gap-1.5 text-slate-500">
                                <Building2 className="h-3 w-3" />
                                Working Office
                            </Label>
                            <Popover open={officeSearchOpen} onOpenChange={setOfficeSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between h-10 bg-white border-slate-200 text-sm font-medium shadow-sm"
                                    >
                                        <span className="truncate">
                                            {selectedOfficeId === "all" ? "All Offices" : offices.find(o => String(o.id) === selectedOfficeId)?.name}
                                        </span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search office..." className="h-9" />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty>No office found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="all"
                                                    onSelect={() => {
                                                        setSelectedOfficeId("all");
                                                        setOfficeSearchOpen(false);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4 text-primary", selectedOfficeId === "all" ? "opacity-100" : "opacity-0")} />
                                                    All Offices
                                                </CommandItem>
                                                {offices.map((office) => (
                                                    <CommandItem
                                                        key={office.id}
                                                        value={office.name}
                                                        onSelect={() => {
                                                            setSelectedOfficeId(String(office.id));
                                                            setOfficeSearchOpen(false);
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4 text-primary", selectedOfficeId === String(office.id) ? "opacity-100" : "opacity-0")} />
                                                        {office.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date Range Selection - Compact Width */}
                        <div className="w-auto space-y-2">
                            <div className="flex items-center gap-4">
                                <Label className="text-[12px] font-bold tracking-wider flex items-center gap-1.5 text-slate-500">
                                    <Calendar className="h-3 w-3" />
                                    Date Range
                                </Label>
                                <div className="flex bg-slate-100 border rounded p-0.5 items-center">
                                    <button
                                        onClick={() => setDateMode("BS")}
                                        className={cn("px-1.5 py-0.5 text-[11px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
                                    >BS</button>
                                    <button
                                        onClick={() => setDateMode("AD")}
                                        className={cn("px-1.5 py-0.5 text-[11px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
                                    >AD</button>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                {dateMode === "BS" ? (
                                    <>
                                        <NepaliDatePicker value={dateFrom} onChange={setDateFrom} className="h-10 text-sm w-[115px] px-2" />
                                        <NepaliDatePicker value={dateTo} onChange={setDateTo} className="h-10 text-sm w-[115px] px-2" />
                                    </>
                                ) : (
                                    <>
                                        <GregorianDatePicker value={dateFrom} onChange={setDateFrom} className="h-10 text-sm w-[115px] px-2" />
                                        <GregorianDatePicker value={dateTo} onChange={setDateTo} className="h-10 text-sm w-[115px] px-2" />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Shift Selection */}
                        <div className="flex-1 min-w-[180px] space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center gap-1.5 text-slate-500">
                                <Clock className="h-3 w-3" />
                                Shift
                            </Label>
                            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                                <SelectTrigger className="w-full h-10 bg-white border-slate-200 text-sm font-medium shadow-sm">
                                    <SelectValue placeholder="All Shifts" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Shifts</SelectItem>
                                    {schedules.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>
                                            {s.name} ({s.start_time.slice(0, 5)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Employee Selection */}
                        <div className="flex-1 min-w-[220px] space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center gap-1.5 text-slate-500">
                                <Users className="h-3 w-3" />
                                Employee Selection
                            </Label>
                            <div className="relative">
                                <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full h-10 justify-between bg-white text-sm font-medium border-slate-200 hover:bg-slate-50/50"
                                        >
                                            <div className="flex items-center gap-2 truncate flex-1">
                                                <Users className={cn("h-4 w-4 shrink-0 transition-colors", selectedUsers.length > 0 ? "text-primary" : "text-slate-400")} />
                                                <span className={cn("truncate font-semibold", selectedUsers.length > 0 ? "text-primary" : "text-slate-600")}>
                                                    {selectedUsers.length > 0 ? (
                                                        <span className="flex items-center gap-1.5">
                                                            {selectedUsers.length === 1 
                                                                ? users.find(u => u.id === selectedUsers[0])?.full_name 
                                                                : `${selectedUsers.length} selected`
                                                            }
                                                        </span>
                                                    ) : (
                                                        "Select Employees"
                                                    )}
                                                </span>
                                            </div>
                                            <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 transition-transform duration-200", dropdownOpen && "rotate-180 opacity-100", selectedUsers.length > 0 ? "text-primary opacity-100" : "opacity-50")} />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/20" align="start">
                                        <Command className="border-none">
                                            <CommandInput
                                                placeholder="Search employees..."
                                                className="h-10 text-sm"
                                                value={searchTerm}
                                                onValueChange={setSearchTerm}
                                            />
                                            <CommandList className="max-h-64 custom-scrollbar">
                                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-50 bg-slate-50/30">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Results</span>
                                                    {selectedUsers.length > 0 && (
                                                        <button 
                                                            onClick={() => setSelectedUsers([])}
                                                            className="text-[10px] font-bold text-primary hover:underline"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                                    No employees found.
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {users.filter(u => {
                                                        const search = searchTerm.toLowerCase();
                                                        return (
                                                            u.full_name.toLowerCase().includes(search) ||
                                                            (u.employee_id && u.employee_id.toLowerCase().includes(search)) ||
                                                            (u.phone && u.phone.includes(search))
                                                        );
                                                    }).map((u) => {
                                                        const isSelected = selectedUsers.includes(u.id);
                                                        return (
                                                            <CommandItem
                                                                key={u.id}
                                                                value={`${u.full_name} ${u.employee_id || ""} ${u.phone || ""}`}
                                                                onSelect={() => {
                                                                    setSelectedUsers(prev =>
                                                                        isSelected
                                                                            ? prev.filter(id => id !== u.id)
                                                                            : [...prev, u.id]
                                                                    );
                                                                }}
                                                                className={cn(
                                                                    "text-sm cursor-pointer flex items-center px-3 py-2 rounded-sm transition-all duration-200",
                                                                    isSelected
                                                                        ? "bg-primary/5 text-primary font-bold"
                                                                        : "text-slate-700 hover:bg-slate-50"
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex flex-col">
                                                                            <span className="truncate font-semibold text-[13px]">{u.full_name}</span>
                                                                            <span className="text-[10px] text-slate-400">ID: {u.employee_id || "N/A"}</span>
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-200" />}
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    }).slice(0, 100)}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="min-w-[140px] md:w-[160px]">
                            <Button 
                                onClick={handleFetchReport} 
                                disabled={loading}
                                className="bg-primary hover:bg-primary-hover text-white font-bold h-10 px-4 text-sm shadow-md transition-all w-full"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                Generate
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4 pt-1">
                <h3 className="text-xl font-bold text-primary">
                    Report Preview
                </h3>

                {reportData.length > 0 ? (
                    <>
                        {/* Stats Summary Cards */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                                <CardContent className="p-5 flex items-center gap-5">
                                    <div className="bg-primary/10 p-3 rounded-xl transition-colors group-hover:bg-primary group-hover:text-white text-primary">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400">Total Employees</p>
                                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{uniqueEmployees}</h3>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                                <CardContent className="p-5 flex items-center gap-5">
                                    <div className="bg-emerald-500/10 p-3 rounded-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white text-emerald-600">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400">Total Duties</p>
                                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{totalDuties}</h3>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                                <CardContent className="p-5 flex items-center gap-5">
                                    <div className="bg-amber-500/10 p-3 rounded-xl transition-colors group-hover:bg-amber-500 group-hover:text-white text-amber-600">
                                        <Clock className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400">Total Man-Hours</p>
                                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{totalHours.toFixed(1)} hrs</h3>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <Card className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden overflow-x-auto transition-all">
                            <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                                <span className="text-[12px] font-bold text-slate-500 flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Detailed Statistics
                                </span>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleExportCSV}
                                    className="h-9 text-xs font-bold border-primary text-primary hover:bg-primary/10 shadow-sm"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                            </div>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-primary hover:bg-primary">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="py-3 text-white font-bold text-sm tracking-wider">E.ID</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Employee Name</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Working Office</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Duty Breakdown</TableHead>
                                            <TableHead className="text-center py-3 text-white font-bold text-sm tracking-wider">Duties</TableHead>
                                            <TableHead className="text-center py-3 text-white font-bold text-sm tracking-wider">Hours</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm tracking-wider text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.map((row) => (
                                            <TableRow key={row.user_id} className="hover:bg-slate-50/80 transition-colors border-slate-100 group">
                                                <TableCell className="font-bold text-primary text-sm uppercase">{row.employee_id || "N/A"}</TableCell>
                                                <TableCell className="font-semibold text-slate-800 text-sm whitespace-nowrap">{row.full_name}</TableCell>
                                                <TableCell className="text-slate-600 text-[12px]">{row.office_name}</TableCell>
                                                <TableCell className="py-3">
                                                    <div className="space-y-4">
                                                        {Object.entries(row.chart_breakdown).map(([chartName, chartData]) => (
                                                            <div key={chartName} className="space-y-2 border-l-2 border-slate-200 pl-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-sm font-bold text-slate-700">{chartName}</h4>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                                            {chartData.total_hours.toFixed(1)} Hours
                                                                        </span>
                                                                        <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                                            {chartData.total_duties} Duties
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {Object.entries(chartData.shifts).map(([shiftName, count]) => (
                                                                        <div key={shiftName} className="inline-flex items-center border rounded-md px-2 py-1 bg-white shadow-sm">
                                                                            <span className="text-[11px] text-slate-500 mr-2">{shiftName}</span>
                                                                            <span className="text-[12px] font-bold text-primary border-l pl-2">{count}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(!row.chart_breakdown || Object.keys(row.chart_breakdown).length === 0) && (
                                                            <span className="text-slate-400 italic text-[11px]">No data</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary font-bold border-none text-[11px]">
                                                        {row.total_duties}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-emerald-600 text-sm">
                                                    {row.total_hours.toFixed(1)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-primary/20 text-primary hover:bg-primary/5 transition-all">
                                                                View Dates
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl">
                                                            <DialogHeader className="p-6 border-b">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="space-y-1">
                                                                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                                                            <Calendar className="h-5 w-5 text-primary" />
                                                                            Duty History: {row.full_name}
                                                                        </DialogTitle>
                                                                        <DialogDescription className="text-slate-500 text-sm font-medium">
                                                                            ID: {row.employee_id} | Office: {row.office_name}
                                                                        </DialogDescription>
                                                                    </div>
                                                                    <Badge variant="outline" className="text-primary border-primary/20 text-sm px-3 py-1">
                                                                        Total: {row.dates?.length || 0}
                                                                    </Badge>
                                                                </div>
                                                            </DialogHeader>
                                                            
                                                            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                                                <Table className="border rounded-lg overflow-hidden">
                                                                    <TableHeader className="bg-primary hover:bg-primary">
                                                                        <TableRow className="hover:bg-transparent border-none">
                                                                            <TableHead className="w-[50px] font-bold text-white">S.N.</TableHead>
                                                                            <TableHead className="font-bold text-white">Nepali (BS)</TableHead>
                                                                            <TableHead className="font-bold text-white">English (AD)</TableHead>
                                                                            <TableHead className="font-bold text-white">Day</TableHead>
                                                                            <TableHead className="font-bold text-white">Duty Chart</TableHead>
                                                                            <TableHead className="font-bold text-white text-right">Shift</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {row.dates?.map((item: any, idx: number) => (
                                                                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                                                                <TableCell className="text-[12px] font-bold text-slate-400">{idx + 1}</TableCell>
                                                                                <TableCell className="text-[13px] font-bold text-slate-800">{getNepaliDate(item.date)}</TableCell>
                                                                                <TableCell className="text-[12px] font-medium text-slate-500">{item.date}</TableCell>
                                                                                <TableCell className="text-[11px] font-bold tracking-tight">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-slate-800 text-[12px]">{getNepaliDayName(item.day)}</span>
                                                                                        <span className="text-slate-400 font-medium lowercase">({item.day})</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-[12px] font-semibold text-slate-700">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <FileText className="h-3 w-3 text-primary/60" />
                                                                                        {item.chart}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                    <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary bg-primary/5">
                                                                                        {item.shift}
                                                                                    </Badge>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <div className="p-16 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/5 text-center transition-all">
                        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground/60" />
                        </div>
                        <h4 className="text-xl font-medium text-muted-foreground">Ready to generate report</h4>
                        <p className="text-muted-foreground max-w-md mx-auto mt-2">
                            Configure your report criteria above and click "Generate Report" to see the results.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SummaryReport;

const Download = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
);
