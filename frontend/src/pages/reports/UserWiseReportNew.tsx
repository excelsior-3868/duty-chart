import React, { useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Loader2, Download, FileText, Calendar, Users, Info, Search, Check, ChevronDown, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import NepaliDate from "nepali-date-converter";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ===================== TYPES ===================== */

interface DutyRow {
    id: number;
    date: string;
    weekday: string;
    schedule: string;
    start_time: string;
    end_time: string;
    is_completed: boolean;
    currently_available: boolean;
    employee_name: string;
    employee_id: string;
}

interface User {
    id: number;
    full_name: string;
}

interface DutyOption {
    id: number;
    name: string;
    effective_date: string;
    end_date: string;
    office_id: number;
    office_name: string;
}

interface Schedule {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
}

/* ===================== COMPONENT ===================== */

function UserWiseReportNew() {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [selectAllUsers, setSelectAllUsers] = useState(true);


    const [duties, setDuties] = useState<DutyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [firstLoad, setFirstLoad] = useState(true);

    const [me, setMe] = useState<any>(null);

    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [dutyOptions, setDutyOptions] = useState<DutyOption[]>([]);
    const [selectedDuty, setSelectedDuty] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<string>("all");
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");

    // Set document title
    useEffect(() => {
        document.title = "Duty Report (Annex 2) - NT Duty Chart Management System";
    }, []);

    /* ================= Outside click ================= */

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /* ================= Fetch me ================= */

    useEffect(() => {
        async function fetchMe() {
            try {
                const res = await api.get("/auth/me/");
                setMe(res.data);
                if (!res.data.is_staff) {
                    setSelectedUsers([res.data.id]);
                }
            } catch (err) {
                console.error("Failed to fetch /me/", err);
            }
        }
        fetchMe();
    }, []);

    /* ================= Fetch users ================= */

    async function fetchUsers(dutyId?: string) {
        if (!me) return;
        try {
            const params: any = {};
            if (dutyId && dutyId !== "none") {
                params.duty_chart_id = dutyId;
            }
            const res = await api.get("/users/", { params });
            setUsers(res.data.results || res.data); // Handle both paginated and non-paginated
        } catch (err) {
            console.error("User fetch failed", err);
        }
    }

    useEffect(() => {
        if (me) {
            if (selectedDuty && selectedDuty !== "none") {
                fetchUsers(selectedDuty);
            } else {
                setUsers([]);
                setSelectedUsers([]);
                setSelectAllUsers(true);
            }
        }
    }, [me, selectedDuty]);
    /* ================= Fetch duty options ================= */

    useEffect(() => {
        async function fetchDuties() {
            try {
                const res = await api.get("/reports/duties/options/");
                setDutyOptions(res.data || []);
            } catch (err) {
                console.error("Failed to fetch duty options", err);
            }
        }
        fetchDuties();
    }, []);


    /* ================= Fetch schedules when duty changes ================= */

    useEffect(() => {
        if (selectedDuty && selectedDuty !== "none") {
            async function fetchSchedules() {
                try {
                    const res = await api.get("/schedule/", {
                        params: { duty_chart: selectedDuty }
                    });
                    setSchedules(res.data || []);
                    setSelectedSchedule("all");
                } catch (err) {
                    console.error("Failed to fetch schedules", err);
                }
            }
            fetchSchedules();
        } else {
            setSchedules([]);
            setSelectedSchedule("all");
        }
    }, [selectedDuty]);

    /* ================= Handle Duty Change ================= */

    const handleDutyChange = (val: string) => {
        setSelectedDuty(val);
        if (val && val !== "none") {
            const selected = dutyOptions.find(d => d.id.toString() === val);
            if (selected) {
                setDateFrom(selected.effective_date);
                setDateTo(selected.end_date);
            }
        } else {
            // Reset to current month if "none" is selected
            setDateFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
            setDateTo(format(endOfMonth(new Date()), "yyyy-MM-dd"));
        }
    };

    /* ================= Load preview ================= */

    async function loadReport() {
        if (!selectedDuty || selectedDuty === "none") {
            toast.error("Please select a Duty Chart first.");
            return;
        }
        if (!selectedSchedule) {
            toast.error("Please select a Shift.");
            return;
        }
        if (!selectAllUsers && selectedUsers.length === 0) {
            toast.warning("Please select an employee or enable 'All'.");
            return;
        }
        setLoading(true);
        setFirstLoad(false);
        try {
            const res = await api.get("/reports/duties/preview/", {
                params: {
                    date_from: dateFrom,
                    date_to: dateTo,
                    user_id: selectAllUsers ? undefined : selectedUsers.join(","),
                    all_users: selectAllUsers ? "1" : "0",
                    duty_id: selectedDuty || undefined,
                    schedule_id: selectedSchedule !== "all" ? selectedSchedule : undefined,
                },
            });

            if (res.data && res.data.groups) {
                const allRows = res.data.groups.flatMap((g: any) => {
                    // Normalize group header info
                    const name = g.user_name || g.full_name || g.name || "-";
                    const eid = g.employee_id || g.user_id || "-";

                    return (g.rows || []).map((r: any) => ({
                        ...r,
                        employee_name: name,
                        employee_id: eid,
                    }));
                });
                // Sort by date DESC
                allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setDuties(allRows);
            } else if (Array.isArray(res.data)) {
                // Fallback for flat array response
                const flattened = res.data.map((r: any) => ({
                    ...r,
                    employee_name: r.employee_name || r.user_name || r.name || "-",
                    employee_id: r.employee_id || r.user_id || "-",
                }));
                // Sort by date DESC
                flattened.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setDuties(flattened);
            } else {
                setDuties([]);
            }
        } catch (err) {
            console.error(err);
            setDuties([]);
        } finally {
            setLoading(false);
        }
    }

    function clearPreview() {
        setDuties([]);
        setFirstLoad(true);
        setSelectedDuty("");
        setSelectedSchedule("all");
    }

    /* ================= Download DOCX ================= */

    /* ================= Helpers ================= */

    const getNepaliWeekday = (englishWeekday: string) => {
        const map: { [key: string]: string } = {
            "Sunday": "आईतबार",
            "Monday": "सोमबार",
            "Tuesday": "मंगलबार",
            "Wednesday": "बुधबार",
            "Thursday": "बिहिवार",
            "Friday": "शुक्रबार",
            "Saturday": "शनिबार"
        };
        return map[englishWeekday] || englishWeekday;
    };

    const getFormattedDate = (isoDate: string) => {
        try {
            const ad = new Date(isoDate);
            const bs = new NepaliDate(ad);
            return {
                ad: format(ad, "MMM dd, yyyy"),
                bs: bs.format("YYYY-MM-DD")
            };
        } catch {
            return { ad: isoDate, bs: isoDate };
        }
    };

    async function downloadReport() {
        if (!selectedDuty || selectedDuty === "none") {
            toast.error("Please select a Duty Chart first.");
            return;
        }
        if (!selectedSchedule) {
            toast.error("Please select a Shift.");
            return;
        }
        if (!selectAllUsers && selectedUsers.length === 0) {
            toast.warning("No employees selected!");
            return;
        }

        try {
            setDownloading(true);
            const params: any = {
                date_from: dateFrom,
                date_to: dateTo,
            };

            if (selectAllUsers) {
                params["user_id[]"] = users.map((u) => u.id);
            } else if (selectedUsers.length > 0) {
                params["user_id[]"] = selectedUsers;
            }

            if (selectedDuty) {
                params["duty_id"] = selectedDuty;
            }

            if (selectedSchedule !== "all") {
                params["schedule_id"] = selectedSchedule;
            }

            const response = await api.get("/reports/duties/file-new/", {
                params,
                responseType: "blob",
            });

            const url = window.URL.createObjectURL(
                new Blob([response.data], {
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                })
            );

            const selectedDutyName = dutyOptions.find(d => d.id.toString() === selectedDuty)?.name || "Report";
            const safeDutyName = selectedDutyName.replace(/[/\\?%*:|"<>]/g, '-');

            const link = document.createElement("a");
            link.href = url;
            link.download = `DutyCompletion_Report_अनुसूची-2_${safeDutyName}_${dateFrom}_${dateTo}.docx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed", err);
            toast.error("Failed to download report");
        } finally {
            setDownloading(false);
        }
    }

    /* ================= Render ================= */

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        Duty Report (अनुसूची - २)
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Generate and export report in अनुसूची - २ format.
                    </p>
                </div>
            </div>

            <Card className="border-primary/20 shadow-lg overflow-hidden">
                <CardHeader className="bg-primary py-3 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Report Criteria
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[240px_240px_minmax(210px,0.8fr)_1.2fr] items-end">

                        {/* 1. Duty Selection */}
                        <div className="space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center gap-1.5 text-slate-500 ">
                                <Calendar className="h-3 w-3" />
                                Duty Chart
                            </Label>
                            <Select value={selectedDuty} onValueChange={setSelectedDuty}>
                                <SelectTrigger className="w-full bg-white h-10 text-sm font-medium border-slate-200">
                                    <SelectValue placeholder="Select Duty Chart" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-sm">-- Select Chart --</SelectItem>
                                    {dutyOptions.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.id.toString()} className="text-sm">
                                            {opt.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 2. Shift (Schedule) Selection */}
                        <div className="space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center gap-1.5 text-slate-500 ">
                                <Clock className="h-3 w-3" />
                                Shift
                            </Label>
                            <Select value={selectedSchedule} onValueChange={setSelectedSchedule} disabled={!selectedDuty || selectedDuty === "none"}>
                                <SelectTrigger className="w-full bg-white h-10 text-sm font-medium border-slate-200">
                                    <SelectValue placeholder="-- All Shifts --" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-sm">-- All Shifts --</SelectItem>
                                    {schedules.map((s) => (
                                        <SelectItem key={s.id} value={s.id.toString()} className="text-sm">
                                            {s.name} ({s.start_time.slice(0, 5)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 3. Date Range */}
                        <div className="space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center justify-between text-slate-500 w-full">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" />
                                    Date Range
                                </span>
                                <div className="flex bg-slate-100 border rounded p-0.5 items-center">
                                    <button
                                        onClick={() => setDateMode("BS")}
                                        className={cn("px-1.5 py-0.5 text-[12px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
                                    >BS</button>
                                    <button
                                        onClick={() => setDateMode("AD")}
                                        className={cn("px-1.5 py-0.5 text-[12px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
                                    >AD</button>
                                </div>
                            </Label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {dateMode === "BS" ? (
                                    <>
                                        <NepaliDatePicker
                                            value={dateFrom}
                                            onChange={setDateFrom}
                                            className="h-10 !min-h-[40px] text-sm"
                                        />
                                        <NepaliDatePicker
                                            value={dateTo}
                                            onChange={setDateTo}
                                            className="h-10 !min-h-[40px] text-sm"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <GregorianDatePicker
                                            value={dateFrom}
                                            onChange={setDateFrom}
                                            className="h-10 !min-h-[40px] text-sm"
                                        />
                                        <GregorianDatePicker
                                            value={dateTo}
                                            onChange={setDateTo}
                                            className="h-10 !min-h-[40px] text-sm"
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 4. Employee Selection */}
                        <div className="space-y-2">
                            <Label className="text-[12px] font-bold tracking-wider flex items-center justify-between text-slate-500">
                                <span className="flex items-center gap-1.5 ">
                                    <Users className="h-3 w-3" />
                                    Employee
                                </span>
                                <div className="flex items-center space-x-2 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                    <Checkbox
                                        id="selectAll"
                                        checked={selectAllUsers}
                                        onCheckedChange={(checked) => setSelectAllUsers(!!checked)}
                                        disabled={!selectedDuty || selectedDuty === "none"}
                                        className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                    <label htmlFor="selectAll" className="text-[9px] font-black cursor-pointer text-slate-600 uppercase">
                                        All
                                    </label>
                                </div>
                            </Label>
                            <div className="relative">
                                <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            disabled={selectAllUsers || !selectedDuty || selectedDuty === "none"}
                                            className="w-full h-10 justify-between bg-white text-sm font-medium border-slate-200 hover:bg-slate-50/50"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Users className="h-4 w-4 text-slate-400 shrink-0" />
                                                <span className="truncate">
                                                    {selectedUsers.length > 0
                                                        ? `${selectedUsers.length} selected`
                                                        : "Select Employee"}
                                                </span>
                                            </div>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Search..."
                                                className="h-8 text-[11px]"
                                                value={searchTerm}
                                                onValueChange={setSearchTerm}
                                            />
                                            <CommandList className="max-h-52 custom-scrollbar">
                                                <CommandEmpty className="py-4 text-center text-[11px] text-muted-foreground">
                                                    Empty.
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {users.filter(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map((u) => {
                                                        const isSelected = selectedUsers.includes(u.id);
                                                        return (
                                                            <CommandItem
                                                                key={u.id}
                                                                value={u.full_name}
                                                                onSelect={() => {
                                                                    setSelectedUsers(prev =>
                                                                        isSelected
                                                                            ? prev.filter(id => id !== u.id)
                                                                            : [...prev, u.id]
                                                                    );
                                                                }}
                                                                className="text-sm cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                                                                        isSelected ? "bg-primary border-primary" : "border-slate-300 bg-white"
                                                                    )}>
                                                                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                                                    </div>
                                                                    <span>{u.full_name}</span>
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-end">
                        <Button
                            size="default"
                            onClick={loadReport}
                            disabled={loading}
                            className="min-w-[140px] h-9 text-xs font-bold"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Loader2 className="h-4 w-4 mr-2 opacity-50" />}
                            Load Preview
                        </Button>

                        <Button
                            size="default"
                            onClick={clearPreview}
                            variant="ghost"
                            className="min-w-[140px] h-9 text-xs font-bold text-slate-500 hover:text-destructive hover:bg-destructive/5"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Preview
                        </Button>

                        <Button
                            size="default"
                            onClick={downloadReport}
                            disabled={downloading}
                            variant="outline"
                            className="min-w-[140px] h-9 text-xs font-bold border-primary text-primary hover:bg-primary/10 shadow-sm"
                        >
                            {downloading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Download DOCX
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4 pt-1">
                <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
                    Report Preview
                </h3>

                {firstLoad ? (
                    <div className="p-16 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/5 text-center transition-all">
                        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground/60" />
                        </div>
                        <h4 className="text-xl font-medium text-muted-foreground">Ready to generate report</h4>
                        <p className="text-muted-foreground max-w-md mx-auto mt-2">
                            Configure your report criteria above and click "Load Preview" to see the results.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : duties.length === 0 ? (
                    <div className="p-16 border-2 border-dashed border-destructive/20 rounded-xl bg-destructive/5 text-center transition-all shadow-inner">
                        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                            <Info className="h-8 w-8 text-destructive/60" />
                        </div>
                        <h4 className="text-xl font-semibold text-destructive/80">No data found</h4>
                        <p className="text-destructive/60 max-w-md mx-auto mt-2">
                            We couldn't find any duty assignments matching your selected criteria.
                            Please adjust the date range or personnel selection.
                        </p>
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-primary hover:bg-primary">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider">ID</TableHead>
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Employee</TableHead>
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Date (BS / AD)</TableHead>
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Weekday</TableHead>
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider">Schedule</TableHead>
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider text-center">Time</TableHead>
                                    <TableHead className="py-3 text-white font-bold text-sm tracking-wider text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {duties.map((d) => {
                                    const dateInfo = getFormattedDate(d.date);
                                    const nepaliWeekday = getNepaliWeekday(d.weekday);
                                    return (
                                        <TableRow key={d.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                                            <TableCell className="py-4">
                                                <span className="text-xm font-mono text-primary font-bold uppercase whitespace-nowrap">{d.employee_id}</span>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <span className="font-medium text-slate-800 text-sm whitespace-nowrap">{d.employee_name}</span>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-sm font-bold text-slate-700">{dateInfo.bs}</span>
                                                    <span className="text-[12px] text-slate-400 font-medium">{dateInfo.ad}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-700">{nepaliWeekday}</span>
                                                    <span className="text-[11px] text-slate-400 italic">({d.weekday})</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <span className="text-sm font-semibold text-primary/80">{d.schedule}</span>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded border border-slate-100 font-mono text-xs font-bold text-slate-700">
                                                    <Clock className="h-3 w-3 text-slate-400" />
                                                    {d.start_time.slice(0, 5)} - {d.end_time.slice(0, 5)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <Badge
                                                    variant={d.is_completed ? "default" : "secondary"}
                                                    className={cn(
                                                        "text-[12px] font-bold px-3 py-0.5  tracking-tighter",
                                                        d.is_completed ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-100 text-rose-700 hover:bg-rose-200 border-none"
                                                    )}
                                                >
                                                    {d.is_completed ? "Completed" : "Not Finished"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserWiseReportNew;
