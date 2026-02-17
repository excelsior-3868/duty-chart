import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import NepaliDate from "nepali-date-converter";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Download, ChevronsUpDown, Check, Pencil, Search, Phone, Mail, FileSpreadsheet, User as UserIcon } from "lucide-react";
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
    alias?: string;
    employee_office_id?: number | null;
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
    const [dutyChartOpen, setDutyChartOpen] = useState(false);

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
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // --- State: Schedules (Available Shifts) ---
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("all");
    const [activeTab, setActiveTab] = useState("calendar");

    // --- State: Day Detail Modal ---
    const [showDayDetailModal, setShowDayDetailModal] = useState(false);
    const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null);

    const { user, hasPermission, canManageOffice } = useAuth();
    const location = useLocation();
    const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

    // --- 0. Handle Preselection from Navigation State ---
    useEffect(() => {
        const state = location.state as { preselect?: { officeId: string; dutyChartId: string } };
        if (state?.preselect) {
            setSelectedOfficeId(state.preselect.officeId);
            setSelectedDutyChartId(state.preselect.dutyChartId);
        }
    }, [location.state]);


    // --- 1. Load Offices ---
    useEffect(() => {
        document.title = "Duty Calendar - NT Duty Chart Management System";
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
                const fetchedSchedules = res || [];
                setSchedules(fetchedSchedules);

                // --- Find shift of current time as default ---
                const now = new Date();
                const nowH = now.getHours();
                const nowM = now.getMinutes();
                const nMin = nowH * 60 + nowM;

                const activeShift = fetchedSchedules.find(s => {
                    if (!s.start_time || !s.end_time) return false;
                    const [sh, sm] = s.start_time.split(':').map(Number);
                    const [eh, em] = s.end_time.split(':').map(Number);
                    const sMin = sh * 60 + sm;
                    const eMin = eh * 60 + em;

                    if (eMin < sMin) { // Crosses midnight (e.g., 22:00 to 06:00)
                        return nMin >= sMin || nMin < eMin;
                    }
                    return nMin >= sMin && nMin < eMin;
                });

                if (activeShift) {
                    setSelectedScheduleId(String(activeShift.id));
                } else {
                    setSelectedScheduleId("all");
                }
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
        const resolveAvatar = (path: string | null | undefined) => {
            if (!path) return "";
            if (path.startsWith("http")) return path;
            const backend = import.meta.env.VITE_BACKEND_HOST || "http://localhost:8000";
            return `${backend}${path}`;
        };

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
                avatar: resolveAvatar(userDetail?.image),
                schedule_id: d.schedule,
                alias: d.alias,
                employee_id: userDetail?.employee_id || "",
                employee_office_id: userDetail?.office ?? null,
            } as DutyAssignment;
        });
    }, [duties, usersCache, officesCache]);

    const selectedProfile = useMemo(() =>
        assignments.find(a => a.id === selectedAssignmentId) || null
        , [assignments, selectedAssignmentId]);


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

    const canAssignDuties = useMemo(() => {
        // Must have an office and a chart selected
        if (!selectedOfficeId || !selectedDutyChartId || !selectedDutyChartInfo) return false;

        // Must have the base permission
        if (!hasPermission('duties.assign_employee')) return false;

        // If user has 'assign_any_office_employee', they skip the office ownership check
        if (hasPermission('duties.assign_any_office_employee')) return true;

        const viewingOfficeId = Number(selectedOfficeId);

        // Resolve the office ID from the chart info
        const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
            ? Number((selectedDutyChartInfo.office as any)?.id)
            : Number(selectedDutyChartInfo.office);

        // Security: Ensure the chart actually belongs to the office being viewed
        if (viewingOfficeId !== chartOfficeId) return false;

        // Check if the user manages THIS specific office
        return canManageOffice(chartOfficeId);
    }, [selectedDutyChartId, selectedOfficeId, selectedDutyChartInfo, canManageOffice, hasPermission]);

    const canManageSelectedChart = useMemo(() => {
        if (!selectedDutyChartInfo) return false;
        if (!hasPermission('duties.edit_dutychart')) return false;

        const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
            ? Number((selectedDutyChartInfo.office as any)?.id)
            : Number(selectedDutyChartInfo.office);

        // Allow if user manages this office OR has the global 'create_any_office_chart' permission
        if (hasPermission('duties.create_any_office_chart')) return true;

        // Security: Restrict editing to owners of the office
        return canManageOffice(chartOfficeId);
    }, [selectedDutyChartInfo, hasPermission, canManageOffice]);

    const canDeleteDuty = useMemo(() => {
        if (!selectedDutyChartInfo) return false;
        if (!hasPermission('duties.delete')) return false;

        const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
            ? Number((selectedDutyChartInfo.office as any)?.id)
            : Number(selectedDutyChartInfo.office);

        // Must be authorized to manage duties in this office
        if (!canManageOffice(chartOfficeId)) return false;

        // If we are looking at a specific assignment, check if employee is from another office
        if (selectedProfile) {
            const empOfficeId = selectedProfile.employee_office_id;
            const actorOfficeId = user?.office_id;

            // If employee belongs to a different office (or no office) than the logged-in User's office
            const isSameAsActorOffice = empOfficeId !== null && actorOfficeId !== undefined && actorOfficeId !== null && Number(empOfficeId) === Number(actorOfficeId);

            if (!isSameAsActorOffice) {
                // Strictly require specific permission for the cross-office employee deletion
                if (!hasPermission('duties.remove_other_office_employee')) {
                    return false;
                }
            }
        }

        return true;
    }, [selectedDutyChartInfo, hasPermission, canManageOffice, selectedProfile, user]);

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
        setSelectedAssignmentId(assignment.id);
        setShowProfileModal(true);
    };

    const sortedOffices = useMemo(() => {
        if (!offices.length) return [];
        // Create a copy to sort
        const sorted = [...offices].sort((a, b) => a.name.localeCompare(b.name));

        if (user?.office_id) {
            sorted.sort((a, b) => {
                const isA = a.id === user.office_id;
                const isB = b.id === user.office_id;
                if (isA && !isB) return -1;
                if (!isA && isB) return 1;
                return 0;
            });
        }
        return sorted;
    }, [offices, user]);

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
                        <TabsList className={cn("grid w-full", hasPermission('duties.view_available_shifts') ? "grid-cols-2" : "grid-cols-1")}>
                            <TabsTrigger value="calendar">Duty Calendar</TabsTrigger>
                            {hasPermission('duties.view_available_shifts') && (
                                <TabsTrigger value="shifts">Available Shift</TabsTrigger>
                            )}
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
                        {(hasPermission('duties.create_chart') || hasPermission('duties.create_any_office_chart')) && (
                            <Button className="gap-2 text-xs h-9 bg-primary" onClick={() => setShowCreateDutyChart(true)}>
                                <Plus className="w-3.5 h-3.5" /> Create Duty Chart
                            </Button>
                        )}
                        {hasPermission('duties.edit_dutychart') && (
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
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search office..." className="h-9" />
                                    <CommandList className="max-h-[300px] overflow-y-auto">
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
                                            {sortedOffices
                                                .filter(office => (user?.office_id && (!hasPermission('duties.view_any_office_chart') && !hasPermission('duties.create_any_office_chart'))) ? office.id === user.office_id : true)
                                                .map((office) => (
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
                        <Popover open={dutyChartOpen} onOpenChange={setDutyChartOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={dutyChartOpen}
                                    disabled={!selectedOfficeId}
                                    className="flex-1 min-w-0 justify-between h-9 text-xs bg-primary text-white hover:bg-primary-hover hover:text-white border-2 border-primary transition-colors"
                                >
                                    <span className="truncate">
                                        {selectedDutyChartId
                                            ? dutyCharts.find((c) => c.id === selectedDutyChartId)?.name
                                            : "Select Chart"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-100" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search chart..." className="h-9" />
                                    <CommandList className="max-h-[300px] overflow-y-auto">
                                        <CommandEmpty>No chart found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="Select Chart"
                                                onSelect={() => {
                                                    setSelectedDutyChartId("");
                                                    setDutyChartOpen(false);
                                                }}
                                                className={cn(
                                                    "flex items-center px-2 py-1.5 cursor-pointer text-sm rounded-sm",
                                                    !selectedDutyChartId
                                                        ? "bg-primary text-white"
                                                        : "text-slate-900 hover:bg-slate-100 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900"
                                                )}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", !selectedDutyChartId ? "opacity-100" : "opacity-0")} />
                                                Select Chart
                                            </CommandItem>
                                            {dutyCharts.map((chart) => (
                                                <CommandItem
                                                    key={chart.id}
                                                    value={chart.name}
                                                    onSelect={() => {
                                                        setSelectedDutyChartId(chart.id);
                                                        setDutyChartOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex items-center px-2 py-1.5 cursor-pointer text-sm rounded-sm",
                                                        selectedDutyChartId === chart.id
                                                            ? "bg-primary text-white"
                                                            : "text-slate-900 hover:bg-slate-100 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900"
                                                    )}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedDutyChartId === chart.id ? "opacity-100" : "opacity-0")} />
                                                    {chart.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {/* Shift Filter - Only in Calendar Tab */}
                        {activeTab === "calendar" && (
                            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId} disabled={!selectedDutyChartId}>
                                <SelectTrigger className="flex-1 min-w-0 h-9 text-xs border-primary/20 bg-primary/5">
                                    <SelectValue placeholder="All Shifts" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Shifts</SelectItem>
                                    {schedules.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>
                                            {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Display Chart Dates */}
                        {selectedDutyChartInfo && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-primary px-3 py-1.5 rounded-lg border border-primary shadow-sm transition-all animate-in fade-in zoom-in duration-300 shrink-0">
                                <CalendarIcon className="w-3.5 h-3.5 text-white" />
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
                                            ).map(a => {
                                                const now = new Date();
                                                const isOnShift = (() => {
                                                    if (!isSameDay(a.date, now)) return false;
                                                    if (!a.start_time || !a.end_time) return false;
                                                    const [sh, sm] = a.start_time.split(':').map(Number);
                                                    const [eh, em] = a.end_time.split(':').map(Number);
                                                    const nowH = now.getHours();
                                                    const nowM = now.getMinutes();
                                                    const sMin = sh * 60 + sm;
                                                    const eMin = eh * 60 + em;
                                                    const nMin = nowH * 60 + nowM;
                                                    if (eMin < sMin) return nMin >= sMin || nMin < eMin;
                                                    return nMin >= sMin && nMin < eMin;
                                                })();
                                                return { ...a, isOnShift };
                                            }).sort((a, b) => {
                                                if (a.isOnShift !== b.isOnShift) return a.isOnShift ? -1 : 1;
                                                return (a.start_time || "").localeCompare(b.start_time || "");
                                            });
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
                                                        {dayAssignments.map((assignment: any) => {
                                                            const shiftColor = getShiftColor(assignment.schedule_id);
                                                            const isOnShift = assignment.isOnShift;

                                                            return (
                                                                <div
                                                                    key={assignment.id}
                                                                    className={cn(
                                                                        "flex items-center gap-1.5 p-1 rounded-md border shadow-sm transition-all hover:shadow-md",
                                                                        shiftColor.border,
                                                                        shiftColor.bg
                                                                    )}
                                                                >
                                                                    {isOnShift && (
                                                                        <span className="relative flex h-2 w-2 shrink-0">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                        </span>
                                                                    )}
                                                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                                                        <span className={cn("text-[10px] font-bold truncate leading-tight", shiftColor.text)}>
                                                                            {assignment.employee_name}
                                                                        </span>
                                                                        {assignment.alias && (
                                                                            <span className={cn("text-[8px] font-black opacity-60 uppercase shrink-0 ml-1", shiftColor.text)}>
                                                                                {assignment.alias}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Add Button on Hover */}
                                                    {(() => {
                                                        const dateStr = format(date, "yyyy-MM-dd");
                                                        const isDateInChartRange = selectedDutyChartInfo &&
                                                            dateStr >= selectedDutyChartInfo.effective_date &&
                                                            (!selectedDutyChartInfo.end_date || dateStr <= selectedDutyChartInfo.end_date);

                                                        if (canAssignDuties && dateStr >= todayStr && isDateInChartRange) {
                                                            return (
                                                                <Button
                                                                    variant="secondary"
                                                                    size="icon"
                                                                    className="absolute bottom-1 right-1 h-6 w-6 rounded-full shadow-sm bg-primary text-white hover:bg-primary-hover opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCreateDutyContext({ dateISO: dateStr });
                                                                        setShowCreateDuty(true);
                                                                    }}
                                                                >
                                                                    <Plus className="h-3.5 w-3.5" />
                                                                </Button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </TabsContent>

                            {hasPermission('duties.view_available_shifts') && (
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
                                                        <TableHead className="w-16">Theme</TableHead>
                                                        <TableHead>Shift Name</TableHead>
                                                        <TableHead className="text-center">Alias</TableHead>
                                                        <TableHead className="text-center">Type</TableHead>
                                                        <TableHead>Start Time</TableHead>
                                                        <TableHead>End Time</TableHead>
                                                        <TableHead>Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {schedules.map((s) => {
                                                        const shiftColor = getShiftColor(s.id);
                                                        return (
                                                            <TableRow key={s.id} className="hover:bg-slate-50/50">
                                                                <TableCell>
                                                                    <div className={cn("w-5 h-5 rounded border shadow-sm", shiftColor.bg, shiftColor.border)} />
                                                                </TableCell>
                                                                <TableCell className="font-semibold">
                                                                    <span className={cn("text-xs", shiftColor.text)}>
                                                                        {s.name}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-slate-500 text-xs text-center">
                                                                    {s.alias || "-"}
                                                                </TableCell>
                                                                <TableCell className="text-slate-500 text-xs text-center">
                                                                    {s.shift_type || "-"}
                                                                </TableCell>
                                                                <TableCell className="text-slate-700 text-xs font-medium">{s.start_time.slice(0, 5)}</TableCell>
                                                                <TableCell className="text-slate-700 text-xs font-medium">{s.end_time.slice(0, 5)}</TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className={cn(
                                                                            "capitalize text-[10px] font-medium px-2 py-0 h-5",
                                                                            s.status === 'office_schedule' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                                                s.status === 'template' ? "bg-amber-50 text-amber-600 border-amber-100" : ""
                                                                        )}
                                                                    >
                                                                        {(s.status || 'Active').replace('_', ' ')}
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </TabsContent>
                            )}
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
                    onUpdateSuccess={(updatedChart) => {
                        if (updatedChart?.office && String(updatedChart.office) !== selectedOfficeId) {
                            setSelectedOfficeId(String(updatedChart.office));
                        } else {
                            // Refresh current view
                            fetchDutyCharts();
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
                        scheduleId={selectedScheduleId}
                    />
                )}

                {/* Profile Modal */}
                <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
                    <DialogContent className="sm:max-w-md md:max-w-lg">
                        <DialogHeader className="flex flex-col items-center justify-center pb-6 border-b">
                            <div className="relative mb-3">
                                <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                                    <AvatarImage src={selectedProfile?.avatar} alt={selectedProfile?.employee_name} className="object-cover" />
                                    <AvatarFallback className="text-2xl">{selectedProfile?.employee_name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                            </div>
                            <DialogTitle className="text-2xl font-bold text-center mb-2">
                                {selectedProfile?.employee_name}
                            </DialogTitle>
                            {selectedProfile?.phone_number && (
                                <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{selectedProfile.phone_number}</span>
                                </div>
                            )}
                            <DialogDescription className="sr-only">
                                Profile Details
                            </DialogDescription>
                        </DialogHeader>


                        <div className="grid gap-4 py-4 text-xs sm:text-sm">
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
                                <span className="md:text-right font-medium">Duty Time:</span>
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
                                .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
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
