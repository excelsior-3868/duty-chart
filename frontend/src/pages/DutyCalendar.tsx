import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import NepaliDate from "nepali-date-converter";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Download, ChevronsUpDown, Check, Pencil, Search, Phone, Mail, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getOffices, type Office } from "@/services/offices";
import { getDutyCharts, getDutyChartById, type DutyChart as DutyChartInfo } from "@/services/dutichart";
import { getDutiesFiltered, type Duty, deleteDuty } from "@/services/dutiesService";
import { getUser, type User } from "@/services/users";
import { getOffice as getOfficeDetail, type Office as OfficeInfo } from "@/services/offices";
import { useAuth } from "@/context/AuthContext";
import CreateDutyModal from "@/components/CalendarRosterHybrid/CreateDutyModal";
import CreateDutyChartModal from "@/components/CalendarRosterHybrid/CreateDutyChartModal";
import EditDutyChartModal from "@/components/CalendarRosterHybrid/EditDutyChartModal";
import ExportPreviewModal from "@/components/CalendarRosterHybrid/ExportPreviewModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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
import { getSchedules, type Schedule } from "@/services/schedule";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2 } from "lucide-react";

// Interface for Duty Chart (simplified)
interface DutyChart {
    id: string;
    name: string;
}

// Interface for Assignments (UI model)
export interface DutyAssignment {
    id: string;
    employee_name: string;
    role: string;
    start_time: string;
    end_time: string;
    date: Date;
    shift: string;
    phone_number: string;
    email: string;
    directorate: string;
    department: string;
    position: string;
    office: string;
    avatar: string;
    schedule_id: number;
}


// Shift Color Mapping Helper
const SHIFT_COLORS = [
    { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", accent: "bg-blue-400" },
    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", accent: "bg-emerald-400" },
    { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", accent: "bg-amber-400" },
    { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", accent: "bg-purple-400" },
    { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", accent: "bg-rose-400" },
    { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-100", accent: "bg-cyan-400" },
    { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", accent: "bg-indigo-400" },
];

const getShiftColor = (id: number) => {
    return SHIFT_COLORS[id % SHIFT_COLORS.length];
};

const DutyCalendar = () => {
    // --- State: Calendar View ---
    const [currentDate, setCurrentDate] = useState(new Date()); // View navigation date
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");

    // --- State: Data & Selection ---
    const [offices, setOffices] = useState<Office[]>([]);
    const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
    const [selectedDutyChartId, setSelectedDutyChartId] = useState<string>("");
    const [officeOpen, setOfficeOpen] = useState(false);

    // --- State: Data Loading ---
    const [duties, setDuties] = useState<Duty[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [usersCache, setUsersCache] = useState<Map<number, User>>(new Map());
    const [officesCache, setOfficesCache] = useState<Map<number, OfficeInfo>>(new Map());
    const [selectedDutyChartInfo, setSelectedDutyChartInfo] = useState<DutyChartInfo | null>(null);

    // --- State: Modals ---
    const [showCreateDutyChart, setShowCreateDutyChart] = useState(false);
    const [showEditDutyChart, setShowEditDutyChart] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showCreateDuty, setShowCreateDuty] = useState(false);
    const [createDutyContext, setCreateDutyContext] = useState<{ dateISO: string } | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<DutyAssignment | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // --- State: Schedules (Available Shifts) ---
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("all");
    const [activeTab, setActiveTab] = useState("calendar");

    // --- State: Day Detail Modal ---
    const [showDayDetailModal, setShowDayDetailModal] = useState(false);
    const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null);

    const { hasPermission, canManageOffice } = useAuth();
    const location = useLocation();

    // --- 0. Handle Preselection from Navigation State (Removed to keep "Select Office" as default) ---
    /*
    useEffect(() => {
        const state = location.state as { preselect?: { officeId: string; dutyChartId: string } };
        if (state?.preselect) {
            setSelectedOfficeId(state.preselect.officeId);
            setSelectedDutyChartId(state.preselect.dutyChartId);
        }
    }, [location.state]);
    */

    // --- 1. Load Offices ---
    useEffect(() => {
        document.title = "Duty Calendar - INOC Duty Roster";
        const load = async () => {
            try {
                const res = await getOffices();
                setOffices(res.map((o: any) => ({
                    ...o,
                    id: o.id
                })));
            } catch (e) {
                console.error("Failed to load offices", e);
            }
        };
        load();
    }, []);

    // --- 2. Load Duty Charts when Office Changes ---
    const fetchDutyCharts = useCallback(async (autoSelectId?: string) => {
        if (!selectedOfficeId || selectedOfficeId === "0") {
            setDutyCharts([]);
            setSelectedDutyChartId("");
            return;
        }
        try {
            const res = await getDutyCharts(parseInt(selectedOfficeId));
            const formattedCharts = res.map((c: any) => ({
                id: String(c.id),
                name: c.name
            }));
            setDutyCharts(formattedCharts);

            if (autoSelectId) {
                setSelectedDutyChartId(autoSelectId);
            } else {
                // Only auto-select first chart if current selectedDutyChartId 
                // is NOT in the new list (or is empty)
                const isCurrentChartValid = formattedCharts.some(c => c.id === selectedDutyChartId);
                if (!isCurrentChartValid) {
                    if (formattedCharts.length > 0) {
                        setSelectedDutyChartId(formattedCharts[0].id);
                    } else {
                        setSelectedDutyChartId("");
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load charts", e);
            setDutyCharts([]);
        }
    }, [selectedOfficeId, selectedDutyChartId]);

    useEffect(() => {
        fetchDutyCharts();
    }, [fetchDutyCharts]);

    // --- 3. Load Duties when Chart Changes ---
    const fetchDuties = useCallback(async () => {
        if (!selectedDutyChartId) {
            setDuties([]);
            return;
        }
        try {
            setLoading(true);
            const res = await getDutiesFiltered({ duty_chart: parseInt(selectedDutyChartId) });
            setDuties(res || []);
        } catch (e) {
            console.error("Failed to fetch duties", e);
        } finally {
            setLoading(false);
        }
    }, [selectedDutyChartId]);

    useEffect(() => {
        fetchDuties();
    }, [fetchDuties]);

    useEffect(() => {
        if (!selectedDutyChartId) {
            setSelectedDutyChartInfo(null);
            setSchedules([]);
            setSelectedScheduleId("all");
            return;
        }

        (async () => {
            try {
                const info = await getDutyChartById(parseInt(selectedDutyChartId));
                setSelectedDutyChartInfo(info);

                // --- Automatically focus calendar on the chart's effective date ---
                if (info.effective_date) {
                    const effDate = new Date(info.effective_date);
                    setCurrentDate(effDate);
                }
            } catch (e) {
                console.error("Failed to load duty chart info:", e);
                setSelectedDutyChartInfo(null);
            }
        })();

        // Load schedules for this chart
        const loadSchedules = async () => {
            try {
                const res = await getSchedules(undefined, parseInt(selectedDutyChartId));
                setSchedules(res || []);
                setSelectedScheduleId("all");
            } catch (e) {
                console.error("Failed to load schedules", e);
            }
        };
        loadSchedules();
    }, [selectedDutyChartId]);


    // --- 5. Enrich Duties with User/Office Info ---
    useEffect(() => {
        const missingUserIds = new Set<number>();
        (duties || []).forEach((d) => {
            if (d.user && !usersCache.has(d.user)) missingUserIds.add(d.user);
        });
        if (missingUserIds.size === 0) return;
        const fetchUsers = async () => {
            const newCache = new Map(usersCache);
            await Promise.all(Array.from(missingUserIds).map(async (id) => {
                try {
                    const u = await getUser(id);
                    newCache.set(id, u);
                } catch (e) { }
            }));
            setUsersCache(newCache);
        };
        fetchUsers();
    }, [duties]);

    useEffect(() => {
        const missingOfficeIds = new Set<number>();
        (duties || []).forEach((d) => {
            if (d.office && !officesCache.has(d.office)) missingOfficeIds.add(d.office);
        });
        if (missingOfficeIds.size === 0) return;
        const fetchOffices = async () => {
            const newCache = new Map(officesCache);
            await Promise.all(Array.from(missingOfficeIds).map(async (id) => {
                try {
                    const o = await getOfficeDetail(id);
                    newCache.set(id, o);
                } catch (e) { }
            }));
            setOfficesCache(newCache);
        };
        fetchOffices();
    }, [duties]);


    // --- 6. Transform Duties to Assignments UI Model ---
    const assignments = useMemo<DutyAssignment[]>(() => {
        return (duties || []).map((d) => {
            const name = d.user_name || "Unknown";
            const userDetail = d.user ? usersCache.get(d.user) : undefined;
            const officeDetail = d.office ? officesCache.get(d.office) : undefined;
            return {
                id: String(d.id),
                employee_name: name,
                role: "",
                start_time: d.start_time || "",
                end_time: d.end_time || "",
                date: new Date(d.date),
                shift: d.schedule_name || "Shift",
                phone_number: userDetail?.phone_number || "",
                email: userDetail?.email || "",
                directorate: officeDetail?.directorate_name || "",
                department: officeDetail?.department_name || "",
                position: userDetail?.position_name || d.position_name || "",
                office: d.office_name || "",
                avatar: "",
                schedule_id: d.schedule,
            } as DutyAssignment;
        });
    }, [duties, usersCache, officesCache]);


    // --- 7. Calendar Grid Logic ---
    const currentNepaliDate = useMemo(() => new NepaliDate(currentDate), [currentDate]);
    const yearBS = currentNepaliDate.getYear();
    const monthBS = currentNepaliDate.getMonth();

    const nepaliMonths = [
        "Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin",
        "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
    ];
    const englishMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const nepaliDays = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
    const englishDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const calendarDays = useMemo(() => {
        const startOfBSMonth = new NepaliDate(yearBS, monthBS, 1);
        const startAD = startOfBSMonth.toJsDate();

        let nextMonthYear = yearBS;
        let nextMonth = monthBS + 1;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextMonthYear++;
        }
        const startOfNextBSMonth = new NepaliDate(nextMonthYear, nextMonth, 1);
        const endAD = new Date(startOfNextBSMonth.toJsDate().getTime() - 24 * 60 * 60 * 1000);

        const startGrid = startOfWeek(startAD);
        const endGrid = endOfWeek(endAD);

        const days = [];
        let day = startGrid;
        while (day <= endGrid) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [yearBS, monthBS]);


    // --- Handlers ---
    const handlePrevMonth = () => {
        let newMonth = monthBS - 1;
        let newYear = yearBS;
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        }
        setCurrentDate(new NepaliDate(newYear, newMonth, 1).toJsDate());
    };

    const handleNextMonth = () => {
        let newMonth = monthBS + 1;
        let newYear = yearBS;
        if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        setCurrentDate(new NepaliDate(newYear, newMonth, 1).toJsDate());
    };

    const handleYearChange = (val: string) => setCurrentDate(new NepaliDate(parseInt(val), monthBS, 1).toJsDate());
    const handleMonthChange = (val: string) => setCurrentDate(new NepaliDate(yearBS, nepaliMonths.indexOf(val), 1).toJsDate());
    const handleToday = () => setCurrentDate(new Date());

    const years = Array.from({ length: 11 }, (_, i) => yearBS - 5 + i);

    const canManageSelectedChart = useMemo(() => {
        if (!selectedDutyChartInfo) return false;
        if (!hasPermission('duties.edit_chart')) return false;
        const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
            ? Number((selectedDutyChartInfo.office as any)?.id)
            : Number(selectedDutyChartInfo.office);
        return canManageOffice(chartOfficeId);
    }, [selectedDutyChartInfo, hasPermission, canManageOffice]);

    const canDeleteDuty = useMemo(() => hasPermission('duties.delete'), [hasPermission]);

    const handleDeleteDuty = async () => {
        if (!selectedProfile?.id) return;
        try {
            await deleteDuty(parseInt(selectedProfile.id));
            toast.success("Duty deleted");
            setShowDeleteConfirm(false);
            setShowProfileModal(false);
            await fetchDuties();
        } catch (e: any) {
            toast.error("Failed to delete duty");
        }
    };

    const handleAssignmentClick = (assignment: DutyAssignment) => {
        setSelectedProfile(assignment);
        setShowProfileModal(true);
    };

    return (
        <div className="p-4 space-y-4 bg-background min-h-screen">
            {/* Header: Title + Controls */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Duty Calendar</h1>
                        <p className="text-muted-foreground">Manage events and duty schedules.</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="calendar">Duty Calendar</TabsTrigger>
                            <TabsTrigger value="shifts">Available Shift</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-3">

                        <div className="flex bg-slate-100/50 border rounded-md p-1 items-center shrink-0">
                            <button onClick={() => setDateMode("BS")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>BS</button>
                            <button onClick={() => setDateMode("AD")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>AD</button>
                        </div>
                        {selectedDutyChartId && (
                            <Button variant="outline" className="gap-2 text-xs h-9" onClick={() => setShowExportModal(true)}>
                                <Download className="w-3.5 h-3.5" /> Export
                            </Button>
                        )}
                        {hasPermission('duties.create_chart') && (
                            <Button className="gap-2 text-xs h-9 bg-primary" onClick={() => setShowCreateDutyChart(true)}>
                                <Plus className="w-3.5 h-3.5" /> Create Duty Chart
                            </Button>
                        )}
                        {hasPermission('duties.edit_chart') && (
                            <Button variant="outline" className="gap-2 text-xs h-9" onClick={() => setShowEditDutyChart(true)}>
                                <Pencil className="w-3.5 h-3.5" /> Edit Chart
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filters & Navigation */}
                <div className="flex items-center justify-between gap-1 bg-white p-1.5 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                        {/* Office Selector */}
                        <Popover open={officeOpen} onOpenChange={setOfficeOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={officeOpen} className="flex-1 min-w-0 justify-between h-9 text-xs bg-primary text-white hover:bg-primary-hover hover:text-white border-2 border-primary transition-colors">
                                    <span className="truncate">{selectedOfficeId ? offices.find((o) => o.id === Number(selectedOfficeId))?.name : "Select Office"}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-100" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[220px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search office..." className="h-9" />
                                    <CommandList>
                                        <CommandEmpty>No office found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="Select Office"
                                                onSelect={() => {
                                                    setSelectedOfficeId("");
                                                    setOfficeOpen(false);
                                                }}
                                                className={cn(
                                                    "flex items-center px-2 py-1.5 cursor-pointer text-sm rounded-sm",
                                                    !selectedOfficeId
                                                        ? "bg-primary text-white"
                                                        : "text-slate-900 hover:bg-slate-100 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900"
                                                )}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", !selectedOfficeId ? "opacity-100" : "opacity-0")} />
                                                Select Office
                                            </CommandItem>
                                            {offices.map((office) => (
                                                <CommandItem
                                                    key={office.id}
                                                    value={office.name}
                                                    onSelect={() => {
                                                        setSelectedOfficeId(String(office.id));
                                                        setOfficeOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex items-center px-2 py-1.5 cursor-pointer text-sm rounded-sm",
                                                        selectedOfficeId === String(office.id)
                                                            ? "bg-primary text-white"
                                                            : "text-slate-900 hover:bg-slate-100 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900"
                                                    )}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedOfficeId === String(office.id) ? "opacity-100" : "opacity-0")} />
                                                    {office.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {/* Duty Chart Selector */}
                        <Select value={selectedDutyChartId} onValueChange={setSelectedDutyChartId} disabled={!selectedOfficeId}>
                            <SelectTrigger className="flex-1 min-w-0 h-9 text-xs">
                                <SelectValue placeholder="Select Chart" />
                            </SelectTrigger>
                            <SelectContent>
                                {dutyCharts.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Shift Filter - Only in Calendar Tab */}
                        {activeTab === "calendar" && (
                            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId} disabled={!selectedDutyChartId}>
                                <SelectTrigger className="flex-1 min-w-0 h-9 text-xs border-primary/20 bg-primary/5">
                                    <SelectValue placeholder="All Shifts" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Shifts</SelectItem>
                                    {schedules.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Display Chart Dates */}
                        {selectedDutyChartInfo && (
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-all animate-in fade-in zoom-in duration-300 shrink-0">
                                <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                                <span className="flex items-center gap-1.5">
                                    {dateMode === "BS"
                                        ? `${new NepaliDate(new Date(selectedDutyChartInfo.effective_date)).format("YYYY/MM/DD")} - ${selectedDutyChartInfo.end_date ? new NepaliDate(new Date(selectedDutyChartInfo.end_date)).format("YYYY/MM/DD") : "Open"}`
                                        : `${format(new Date(selectedDutyChartInfo.effective_date), "MMM d, yyyy")} - ${selectedDutyChartInfo.end_date ? format(new Date(selectedDutyChartInfo.end_date), "MMM d, yyyy") : "Open"}`
                                    }
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">

                        <div className="flex items-center gap-2">
                            {dateMode === "BS" ? (
                                <>
                                    <Select value={nepaliMonths[monthBS]} onValueChange={handleMonthChange}>
                                        <SelectTrigger className="w-[100px] h-9 text-xs font-medium border-none bg-slate-50 hover:bg-slate-100 focus:ring-0">
                                            <SelectValue>{nepaliMonths[monthBS]}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {nepaliMonths.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={String(yearBS)} onValueChange={handleYearChange}>
                                        <SelectTrigger className="w-[70px] h-9 text-xs font-medium border-none bg-slate-50 hover:bg-slate-100 focus:ring-0">
                                            <SelectValue>{yearBS}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <>
                                    <Select value={englishMonths[currentDate.getMonth()]} onValueChange={(val) => {
                                        const newMonth = englishMonths.indexOf(val);
                                        const newDate = new Date(currentDate.getFullYear(), newMonth, 1);
                                        setCurrentDate(newDate);
                                    }}>
                                        <SelectTrigger className="w-[110px] h-9 text-xs font-medium border-none bg-slate-50 hover:bg-slate-100 focus:ring-0">
                                            <SelectValue>{englishMonths[currentDate.getMonth()]}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {englishMonths.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={String(currentDate.getFullYear())} onValueChange={(val) => {
                                        const newDate = new Date(parseInt(val), currentDate.getMonth(), 1);
                                        setCurrentDate(newDate);
                                    }}>
                                        <SelectTrigger className="w-[80px] h-9 text-xs font-medium border-none bg-slate-50 hover:bg-slate-100 focus:ring-0">
                                            <SelectValue>{currentDate.getFullYear()}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 11 }, (_, i) => currentDate.getFullYear() - 5 + i).map((y) => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}

                            <div className="flex items-center border-l pl-2 gap-0.5">
                                <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" onClick={handleToday} className="h-8 text-xs px-2">Today</Button>
                                <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Content Tabs */}
                {!selectedOfficeId ? (
                    <div className="flex flex-col items-center justify-center h-[400px] border rounded-md border-dashed bg-muted/20 text-muted-foreground">
                        <p className="text-lg font-medium">No Office Selected</p>
                        <p className="text-sm">Please select an office to view the calendar.</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Loading Overlay */}
                        {loading && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-lg transition-all duration-300">
                                <div className="flex flex-col items-center gap-2 bg-white p-4 rounded-xl shadow-lg border border-slate-100 animate-in fade-in zoom-in duration-300">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    <span className="text-xs font-medium text-slate-600">Loading Roster...</span>
                                </div>
                            </div>
                        )}

                        <Tabs value={activeTab} className={cn("w-full transition-all duration-500", loading && "blur-[2px] opacity-60")}>
                            <TabsContent value="calendar" className="mt-0">
                                <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                                    {/* Header Row */}
                                    <div className="grid grid-cols-7 border-b bg-slate-50">
                                        {(dateMode === "BS" ? nepaliDays : englishDays).map((day, idx) => (
                                            <div key={day} className={cn("py-3 text-center text-sm font-semibold text-slate-600", idx === 6 ? "text-red-500" : "")}>
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Days Grid */}
                                    <div className="grid grid-cols-7 auto-rows-[130px]">
                                        {calendarDays.map((date, idx) => {
                                            const nd = new NepaliDate(date);
                                            const isCurrentMonth = nd.getMonth() === monthBS;
                                            const isTodayDate = isSameDay(date, new Date());
                                            const dayAssignments = assignments.filter(a =>
                                                isSameDay(a.date, date) &&
                                                (selectedScheduleId === "all" || String(a.schedule_id) === selectedScheduleId)
                                            );
                                            const isSaturday = date.getDay() === 6;

                                            return (
                                                <div
                                                    key={date.toString()}
                                                    className={cn(
                                                        "border-b border-r p-2 relative transition-colors hover:bg-slate-50 group",
                                                        !isCurrentMonth ? "bg-slate-50/50" : "bg-white",
                                                        (idx + 1) % 7 === 0 ? "border-r-0" : ""
                                                    )}
                                                    onClick={() => {
                                                        if (selectedDutyChartId && selectedOfficeId) {
                                                            setSelectedDateForDetail(date);
                                                            setShowDayDetailModal(true);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex justify-between items-start mb-0.5 pointer-events-none">
                                                        <span className={cn(
                                                            "text-base font-bold select-none",
                                                            !isCurrentMonth ? "text-slate-400" : "text-slate-900",
                                                            isSaturday && isCurrentMonth ? "text-red-500" : "",
                                                            isTodayDate ? "text-white bg-primary rounded-full w-8 h-8 flex items-center justify-center -ml-1 -mt-1" : ""
                                                        )}>
                                                            {dateMode === "BS" ? nd.getDate() : format(date, "d")}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium select-none">
                                                            {dateMode === "BS" ? format(date, "d") : nd.getDate()}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1 overflow-y-auto max-h-[90px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                                        {dayAssignments.map((assignment) => {
                                                            // Generate distinctive color based on employee name
                                                            const getUserColor = (name: string) => {
                                                                let hash = 0;
                                                                for (let i = 0; i < name.length; i++) {
                                                                    hash = name.charCodeAt(i) + ((hash << 5) - hash);
                                                                }
                                                                const index = Math.abs(hash % SHIFT_COLORS.length);
                                                                return SHIFT_COLORS[index];
                                                            };

                                                            const userColor = getUserColor(assignment.employee_name || "Unknown");

                                                            return selectedScheduleId === "all" ? (
                                                                <div
                                                                    key={assignment.id}
                                                                    className={cn(
                                                                        "flex items-center p-1 bg-white rounded-md border shadow-sm transition-all hover:shadow-md",
                                                                        userColor.border,
                                                                        userColor.bg
                                                                    )}
                                                                >
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={cn("text-[10px] font-bold truncate leading-tight", userColor.text)}>
                                                                            {assignment.employee_name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    key={assignment.id}
                                                                    className={cn(
                                                                        "flex items-center p-1 rounded-md border shadow-sm transition-all",
                                                                        userColor.bg,
                                                                        userColor.border
                                                                    )}
                                                                >
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={cn("text-[10px] font-bold truncate leading-tight", userColor.text)}>
                                                                            {assignment.employee_name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Add Button on Hover */}
                                                    {selectedDutyChartId && selectedOfficeId && (
                                                        <Button
                                                            variant="secondary"
                                                            size="icon"
                                                            className="absolute bottom-1 right-1 h-6 w-6 rounded-full shadow-sm bg-primary text-white hover:bg-primary-hover opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                                                            onClick={(e) => {
                                                                e.stopPropagation();

                                                                // --- Validate if date is within chart range ---
                                                                if (selectedDutyChartInfo) {
                                                                    const dateStr = format(date, "yyyy-MM-dd");
                                                                    const eff = selectedDutyChartInfo.effective_date;
                                                                    const end = selectedDutyChartInfo.end_date;

                                                                    if (dateStr < eff || (end && dateStr > end)) {
                                                                        toast.error("Employee Cant be assigned", {
                                                                            description: "The selected date is outside the duty chart's effective range."
                                                                        });
                                                                        return;
                                                                    }
                                                                }

                                                                setCreateDutyContext({ dateISO: format(date, "yyyy-MM-dd") });
                                                                setShowCreateDuty(true);
                                                            }}
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="shifts" className="mt-0">
                                <div className="border rounded-lg bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-primary" />
                                            Available Shifts
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{schedules.length} shifts defined in this chart</p>
                                    </div>

                                    {schedules.length === 0 ? (
                                        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                            No schedules found for this chart.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Shift Name</TableHead>
                                                    <TableHead>Start Time</TableHead>
                                                    <TableHead>End Time</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {schedules.map((s) => (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="font-medium">{s.name}</TableCell>
                                                        <TableCell>{s.start_time.slice(0, 5)}</TableCell>
                                                        <TableCell>{s.end_time.slice(0, 5)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                                                                {s.status || 'Active'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                {/* Modals */}
                <CreateDutyChartModal
                    open={showCreateDutyChart}
                    onOpenChange={setShowCreateDutyChart}
                    onCreated={(newChart) => {
                        // 1. If office is different, switch it
                        if (newChart.office && String(newChart.office) !== selectedOfficeId) {
                            setSelectedOfficeId(String(newChart.office));
                        }
                        // 2. Refresh charts and select the new one
                        fetchDutyCharts(String(newChart.id));
                        // 3. Jump to the effective date
                        if (newChart.effective_date) {
                            setCurrentDate(new Date(newChart.effective_date));
                        }
                    }}
                />
                <EditDutyChartModal
                    open={showEditDutyChart}
                    onOpenChange={setShowEditDutyChart}
                    initialOfficeId={selectedOfficeId}
                    initialChartId={selectedDutyChartId}
                    onUpdateSuccess={(updatedChart) => {
                        if (updatedChart?.office && String(updatedChart.office) !== selectedOfficeId) {
                            setSelectedOfficeId(String(updatedChart.office));
                        } else {
                            // Refresh current view
                            fetchDutyCharts(selectedDutyChartId);
                            fetchDuties();
                        }
                    }}
                />

                {showCreateDuty && selectedOfficeId && selectedDutyChartId && createDutyContext && (
                    <CreateDutyModal
                        open={showCreateDuty}
                        onOpenChange={(open) => {
                            setShowCreateDuty(open);
                            if (!open) setCreateDutyContext(null);
                        }}
                        officeId={parseInt(selectedOfficeId)}
                        dutyChartId={parseInt(selectedDutyChartId)}
                        dateISO={createDutyContext.dateISO}
                        scheduleId={0} // 0 tells modal to ask for schedule
                        onCreated={fetchDuties}
                    />
                )}

                {selectedDutyChartId && (
                    <ExportPreviewModal
                        open={showExportModal}
                        onOpenChange={setShowExportModal}
                        dutyChartId={parseInt(selectedDutyChartId)}
                        startDateISO={format(calendarDays[0], "yyyy-MM-dd")}
                        endDateISO={format(calendarDays[calendarDays.length - 1], "yyyy-MM-dd")}
                    />
                )}

                {/* Profile Modal */}
                <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
                    <DialogContent className="sm:max-w-md md:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={selectedProfile?.avatar} alt={selectedProfile?.employee_name} />
                                    <AvatarFallback>{selectedProfile?.employee_name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <span className="text-sm sm:text-base">{selectedProfile?.employee_name}</span>
                                </div>
                            </DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                                {selectedProfile?.phone_number}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4 text-xs sm:text-sm">
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Directorate:</span>
                                <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.directorate}</span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Department:</span>
                                <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.department}</span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Office:</span>
                                <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.office}</span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Position:</span>
                                <span className="col-span-2 md:col-span-3 break-words">{selectedProfile?.position || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Phone:</span>
                                <span className="col-span-2 md:col-span-3 font-semibold flex items-center gap-2">
                                    <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="text-xs sm:text-sm">{selectedProfile?.phone_number}</span>
                                </span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Email:</span>
                                <span className="col-span-2 md:col-span-3 flex items-center gap-2 break-words">
                                    <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="text-xs sm:text-sm">{selectedProfile?.email}</span>
                                </span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 items-center gap-2">
                                <span className="md:text-right font-medium">Duty Times:</span>
                                <span className="col-span-2 md:col-span-3">
                                    <span className="text-xs sm:text-sm">{selectedProfile?.start_time} - {selectedProfile?.end_time}</span>
                                </span>
                            </div>
                        </div>

                        <DialogFooter className="sm:justify-between gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowProfileModal(false)} className="w-full sm:w-auto">Close</Button>
                            {canDeleteDuty && (
                                <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="destructive" className="w-full sm:w-auto">Delete Duty</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this duty?</AlertDialogTitle>
                                            <AlertDialogDescription>This action cannot be undone. The selected duty will be permanently removed.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteDuty}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <Button type="button" className="flex items-center gap-2 w-full sm:w-auto">
                                <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="text-xs sm:text-sm">Call</span>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Day Detail Modal */}
                <Dialog open={showDayDetailModal} onOpenChange={setShowDayDetailModal}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-blue-600" />
                                <span>Assignments for {selectedDateForDetail ? (dateMode === "BS" ? new NepaliDate(selectedDateForDetail).format("MMMM D, YYYY") : format(selectedDateForDetail, "MMMM d, yyyy")) : ""}</span>
                            </DialogTitle>
                            <DialogDescription>
                                Total {selectedDateForDetail ? assignments.filter(a => isSameDay(a.date, selectedDateForDetail) && (selectedScheduleId === "all" || String(a.schedule_id) === selectedScheduleId)).length : 0} employees assigned.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="max-h-[60vh] overflow-y-auto space-y-3 py-4 pr-2 scrollbar-thin">
                            {selectedDateForDetail && assignments
                                .filter(a => isSameDay(a.date, selectedDateForDetail) && (selectedScheduleId === "all" || String(a.schedule_id) === selectedScheduleId))
                                .map((a) => {
                                    const shiftColor = getShiftColor(a.schedule_id);
                                    return (
                                        <div
                                            key={a.id}
                                            className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm hover:border-blue-400 cursor-pointer transition-all"
                                            onClick={() => {
                                                handleAssignmentClick(a);
                                                setShowDayDetailModal(false);
                                            }}
                                        >
                                            <div className={cn("w-1.5 h-10 rounded-full shrink-0", shiftColor.accent)} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="font-bold text-slate-800 text-sm truncate">{a.employee_name}</div>
                                                    <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5 h-4 font-semibold capitalize whitespace-nowrap", shiftColor.text, shiftColor.border, shiftColor.bg)}>
                                                        {a.shift}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}</span>
                                                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {a.phone_number}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDayDetailModal(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default DutyCalendar;
