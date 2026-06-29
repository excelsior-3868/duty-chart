import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import {
    Clock,
    Calendar as CalendarIcon,
    Loader2,
    Building2,
    LayoutList,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
} from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getDutiesFiltered } from "@/services/dutiesService";
import { getDutyCharts } from "@/services/dutichart";
import { getSchedules } from "@/services/schedule";
import NepaliDate from "nepali-date-converter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";

// Helper to convert string to Titlecase
const toTitleCase = (str?: string) => {
    if (!str) return "";
    return str
        .toLowerCase()
        .replace(/\b[a-z]/g, letter => letter.toUpperCase());
};

// Shift Color Mapping — using inline CSS hex styles so they render 100% reliably in any build/cache environment
const SHIFT_COLORS = [
    { bg: "#eff6ff", border: "#dbeafe", text: "#1d4ed8", accent: "#3b82f6" }, // blue (Morning)
    { bg: "#ecfdf5", border: "#d1fae5", text: "#047857", accent: "#10b981" }, // emerald (Evening)
    { bg: "#fffbeb", border: "#fef3c7", text: "#b45309", accent: "#f59e0b" }, // amber
    { bg: "#faf5ff", border: "#f3e8ff", text: "#7e22ce", accent: "#8b5cf6" }, // purple
    { bg: "#fff1f2", border: "#ffe4e6", text: "#be123c", accent: "#ef4444" }, // rose
    { bg: "#ecfeff", border: "#cffafe", text: "#0e7490", accent: "#06b6d4" }, // cyan (WFH Late Evening)
    { bg: "#eef2ff", border: "#e0e7ff", text: "#4338ca", accent: "#6366f1" }, // indigo (WFH Night)
];

const getShiftColor = (id: number, name?: string, alias?: string) => {
    const normName = (name || "").toLowerCase();
    const normAlias = (alias || "").toLowerCase();

    if (normAlias === "ms" || normName.includes("morning")) return SHIFT_COLORS[0]; // blue (Morning)
    if (normAlias === "es" || normName.includes("evening")) return SHIFT_COLORS[1]; // emerald (Evening)
    if (normAlias === "ds" || normName.includes("day")) return SHIFT_COLORS[2]; // amber
    if (normAlias === "hd" || normName.includes("holiday")) return SHIFT_COLORS[3]; // purple
    if (normAlias === "wfh-le" || normName.includes("late evening")) return SHIFT_COLORS[5]; // cyan (WFH Late Evening)
    if (normAlias === "wfh-n" || normName.includes("wfh night") || normName.includes("night")) return SHIFT_COLORS[6]; // indigo (WFH Night)

    return SHIFT_COLORS[id % SHIFT_COLORS.length];
};





// --- Nepali Month Names ---
const BS_MONTHS = [
    "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

// Days in each BS month per year (2079–2085)
const BS_MONTH_DAYS: Record<number, number[]> = {
    2079: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2080: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2081: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2084: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2085: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
};

const getBsDaysInMonth = (year: number, month: number): number => {
    // month is 1-indexed
    return BS_MONTH_DAYS[year]?.[month - 1] ?? 30;
};

// Convert BS date string (YYYY-MM-DD) to AD Date object via NepaliDate
const bsToAdDate = (bsYear: number, bsMonth: number, bsDay: number): Date => {
    try {
        const nd = new NepaliDate(bsYear, bsMonth - 1, bsDay);
        return nd.toJsDate();
    } catch {
        return new Date();
    }
};

// =====================================================================
// CalendarView Component
// =====================================================================
interface CalendarViewProps {
    filteredDuties: import("@/services/dutiesService").Duty[];
    dateMode: "BS" | "AD";
    calendarAdMonth: Date;
    setCalendarAdMonth: (d: Date) => void;
    calendarBsYear: number;
    setCalendarBsYear: (y: number) => void;
    calendarBsMonth: number;
    setCalendarBsMonth: (m: number) => void;
    formatBSDate: (dateStr: string) => string;
    formatADDate: (dateStr: string) => string;
}

const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_NP = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"];

const CalendarView: React.FC<CalendarViewProps> = ({
    filteredDuties,
    dateMode,
    calendarAdMonth,
    setCalendarAdMonth,
    calendarBsYear,
    setCalendarBsYear,
    calendarBsMonth,
    setCalendarBsMonth,
    formatBSDate,
    formatADDate,
}) => {
    // Build a lookup: dateStr (yyyy-MM-dd) -> Duty[]
    const dutyByDate = useMemo(() => {
        const map = new Map<string, import("@/services/dutiesService").Duty[]>();
        filteredDuties.forEach(d => {
            if (!map.has(d.date)) map.set(d.date, []);
            map.get(d.date)!.push(d);
        });
        return map;
    }, [filteredDuties]);

    const todayStr = format(new Date(), "yyyy-MM-dd");

    // ---- AD Calendar logic ----
    const adDays = useMemo(() => {
        if (dateMode !== "AD") return [];
        const first = startOfMonth(calendarAdMonth);
        const last = endOfMonth(calendarAdMonth);
        return eachDayOfInterval({ start: first, end: last });
    }, [dateMode, calendarAdMonth]);

    const adStartDow = useMemo(() => {
        if (dateMode !== "AD") return 0;
        return getDay(startOfMonth(calendarAdMonth));
    }, [dateMode, calendarAdMonth]);

    // ---- BS Calendar logic ----
    const bsDays = useMemo(() => {
        if (dateMode !== "BS") return [];
        const totalDays = getBsDaysInMonth(calendarBsYear, calendarBsMonth);
        return Array.from({ length: totalDays }, (_, i) => i + 1);
    }, [dateMode, calendarBsYear, calendarBsMonth]);

    const bsStartDow = useMemo(() => {
        if (dateMode !== "BS") return 0;
        // Find the weekday of BS month day 1
        const adDate = bsToAdDate(calendarBsYear, calendarBsMonth, 1);
        return getDay(adDate);
    }, [dateMode, calendarBsYear, calendarBsMonth]);

    // Navigation handlers
    const goToPrevMonth = () => {
        if (dateMode === "AD") {
            setCalendarAdMonth(subMonths(calendarAdMonth, 1));
        } else {
            if (calendarBsMonth === 1) {
                setCalendarBsYear(calendarBsYear - 1);
                setCalendarBsMonth(12);
            } else {
                setCalendarBsMonth(calendarBsMonth - 1);
            }
        }
    };

    const goToNextMonth = () => {
        if (dateMode === "AD") {
            setCalendarAdMonth(addMonths(calendarAdMonth, 1));
        } else {
            if (calendarBsMonth === 12) {
                setCalendarBsYear(calendarBsYear + 1);
                setCalendarBsMonth(1);
            } else {
                setCalendarBsMonth(calendarBsMonth + 1);
            }
        }
    };

    const goToToday = () => {
        if (dateMode === "AD") {
            setCalendarAdMonth(startOfMonth(new Date()));
        } else {
            try {
                const nd = new NepaliDate(new Date());
                setCalendarBsYear(nd.getYear());
                setCalendarBsMonth(nd.getMonth() + 1);
            } catch {
                // fallback
            }
        }
    };

    const monthTitle = dateMode === "AD"
        ? format(calendarAdMonth, "MMMM yyyy")
        : `${BS_MONTHS[calendarBsMonth - 1]} ${calendarBsYear}`;

    const startDow = dateMode === "AD" ? adStartDow : bsStartDow;

    // Build cell list: nulls for leading blanks, then day numbers
    const cells: (number | null)[] = [
        ...Array(startDow).fill(null),
        ...(dateMode === "AD" ? adDays.map((_, i) => i + 1) : bsDays),
    ];

    // Derive date string for a given cell day number
    const getDateStr = (dayNum: number): string => {
        if (dateMode === "AD") {
            const y = calendarAdMonth.getFullYear();
            const m = calendarAdMonth.getMonth(); // 0-indexed
            return format(new Date(y, m, dayNum), "yyyy-MM-dd");
        } else {
            try {
                const adDate = bsToAdDate(calendarBsYear, calendarBsMonth, dayNum);
                return format(adDate, "yyyy-MM-dd");
            } catch {
                return "";
            }
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-primary">
                <button
                    onClick={goToPrevMonth}
                    className="flex items-center justify-center h-6 w-6 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all duration-200 cursor-pointer"
                >
                    <ChevronLeft className="h-3 w-3" />
                </button>
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-white tracking-wide">{monthTitle}</h2>
                    <button
                        onClick={goToToday}
                        className="text-[9px] font-semibold text-white/60 hover:text-white transition-colors cursor-pointer border border-white/20 rounded px-1.5 py-0.5"
                    >
                        Today
                    </button>
                </div>
                <button
                    onClick={goToNextMonth}
                    className="flex items-center justify-center h-6 w-6 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all duration-200 cursor-pointer"
                >
                    <ChevronRight className="h-3 w-3" />
                </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-slate-200">
                {(dateMode === "BS" ? DAY_LABELS_NP : DAY_LABELS_EN).map((d, i) => (
                    <div key={d} className={cn(
                        "py-2 text-center text-xs font-bold border-r border-slate-100 last:border-r-0",
                        i === 6 ? "text-rose-600" : "text-slate-900"
                    )}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 border-l border-t border-slate-200">
                {cells.map((dayNum, idx) => {
                    const colIdx = idx % 7;
                    const isSatCol = colIdx === 6;

                    if (dayNum === null) {
                        return (
                            <div
                                key={`blank-${idx}`}
                                className={cn(
                                    "min-h-[110px] border-b border-r border-slate-200 bg-slate-50/60",
                                    isSatCol && "bg-rose-50/20"
                                )}
                            />
                        );
                    }

                    const dateStr = getDateStr(dayNum);
                    const duties = dutyByDate.get(dateStr) || [];
                    const isToday = dateStr === todayStr;

                    // Compute the alternate date to show in top-right corner
                    let altDayNum: number | null = null;
                    try {
                        if (dateMode === "BS") {
                            const adDate = bsToAdDate(calendarBsYear, calendarBsMonth, dayNum);
                            altDayNum = adDate.getDate();
                        } else {
                            const nd = new NepaliDate(new Date(calendarAdMonth.getFullYear(), calendarAdMonth.getMonth(), dayNum));
                            altDayNum = nd.getDate();
                        }
                    } catch { /* ignore */ }

                    return (
                        <div
                            key={dateStr || idx}
                            className={cn(
                                "min-h-[110px] border-b border-r border-slate-200 flex flex-col transition-colors",
                                isSatCol && !isToday && "bg-rose-50/30",
                                isToday && "bg-blue-50/40",
                                !isToday && !isSatCol && "hover:bg-slate-50/80"
                            )}
                        >
                            {/* Day Number Row */}
                            <div className="flex items-start justify-between px-2 pt-1.5 pb-1">
                                <span className={cn(
                                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all",
                                    isToday
                                        ? "bg-primary text-white shadow-sm"
                                        : isSatCol
                                            ? "text-rose-600"
                                            : "text-slate-900"
                                )}>
                                    {dayNum}
                                </span>
                                {altDayNum !== null && (
                                    <span className="text-[10px] font-bold text-slate-500 leading-none mt-1.5">
                                        {altDayNum}
                                    </span>
                                )}
                            </div>

                            {/* Duty Cards */}
                            <div className="flex flex-col gap-1 px-1.5 pb-1.5">
                                {duties.slice(0, 3).map(duty => {
                                    const sc = getShiftColor(duty.schedule, duty.schedule_name, duty.alias);
                                    const isCompleted = duty.is_completed || duty.date < todayStr;
                                    return (
                                        <div
                                            key={duty.id}
                                            style={{ backgroundColor: sc.bg, borderColor: sc.border, color: sc.text, opacity: isCompleted ? 0.75 : 1 }}
                                            className="flex flex-col gap-1 px-2.5 py-2 rounded-md border shadow-sm hover:shadow-md transition-all cursor-default text-left"
                                        >
                                            {/* Duty Chart Name */}
                                            {duty.duty_chart_name && (
                                                <span style={{ color: sc.text }} className="text-[10px] font-bold truncate leading-none">
                                                    {toTitleCase(duty.duty_chart_name)}
                                                </span>
                                            )}
                                            {/* Schedule Name + Alias */}
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span style={{ color: sc.text }} className="text-xs font-extrabold truncate leading-tight">
                                                    {toTitleCase(duty.schedule_name || "Duty")}
                                                </span>
                                                {duty.alias && (
                                                    <span style={{ borderColor: sc.border, color: sc.text, backgroundColor: "rgba(255, 255, 255, 0.4)" }} className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border leading-none uppercase">
                                                        {toTitleCase(duty.alias)}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Time */}
                                            {(duty.start_time || duty.end_time) && (
                                                <span style={{ color: sc.text }} className="text-[10px] font-bold leading-none">
                                                    {duty.start_time?.substring(0, 5)} – {duty.end_time?.substring(0, 5)}
                                                </span>
                                            )}
                                            {/* Office */}
                                            {duty.office_name && (
                                                <span style={{ color: sc.text }} className="text-[10px] font-bold truncate leading-tight">
                                                    {toTitleCase(duty.office_name)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                                {duties.length > 3 && (
                                    <span className="text-[10px] font-bold text-slate-900 pl-1">
                                        +{duties.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>


        </div>
    );
};


const MyDuties = () => {
    const { user } = useAuth();
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");
    const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");

    // Calendar navigation month state
    const [calendarAdMonth, setCalendarAdMonth] = useState<Date>(() => startOfMonth(new Date()));
    const [calendarBsYear, setCalendarBsYear] = useState<number>(() => {
        try { return new NepaliDate(new Date()).getYear(); } catch { return 2082; }
    });
    const [calendarBsMonth, setCalendarBsMonth] = useState<number>(() => {
        try { return new NepaliDate(new Date()).getMonth() + 1; } catch { return 1; }
    });

    // Filters
    const [selectedChartId, setSelectedChartId] = useState<string>("all");
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
    const [shiftFilterOpen, setShiftFilterOpen] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 15;

    // Fetch Duty Charts
    const { data: dutyCharts = [] } = useQuery({
        queryKey: ['dutyCharts', user?.office_id],
        queryFn: () => user?.office_id ? getDutyCharts(user.office_id) : Promise.resolve([]),
        enabled: !!user?.office_id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Derived selected duty chart
    const selectedChart = useMemo(() => {
        if (selectedChartId === "all") return null;
        return dutyCharts.find(c => String(c.id) === selectedChartId);
    }, [dutyCharts, selectedChartId]);

    // Date Range filters for List View
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");

    // Auto-update date range filters when duty chart changes, and reset selected shifts
    React.useEffect(() => {
        setSelectedShiftIds([]);
        if (selectedChart) {
            setDateFrom(selectedChart.effective_date);
            setDateTo(selectedChart.end_date || "");
        } else {
            setDateFrom("");
            setDateTo("");
        }
    }, [selectedChart]);


    // Fetch Duties
    const { data: duties = [], isLoading } = useQuery({
        queryKey: ['duties', 'my', user?.id],
        queryFn: () => user?.id ? getDutiesFiltered({ user: user.id }) : Promise.resolve([]),
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Fetch Schedules for selected Duty Chart
    const { data: chartSchedules = [] } = useQuery({
        queryKey: ['schedules', 'chart', selectedChartId],
        queryFn: () => selectedChartId !== "all" ? getSchedules(undefined, parseInt(selectedChartId)) : Promise.resolve([]),
        enabled: selectedChartId !== "all",
        staleTime: 5 * 60 * 1000,
    });

    // Auto-select latest chart for which user has assignments
    React.useEffect(() => {
        if (!isFirstLoad) return;
        if (dutyCharts.length > 0 && !isLoading) {
            // Find unique chart IDs from user's duties
            const assignedChartIds = new Set(duties.map(d => String(d.duty_chart)));
            
            // dutyCharts is ordered by -id (latest first)
            // Find the first chart that has at least one assignment
            const latestAssignedChart = dutyCharts.find(c => assignedChartIds.has(String(c.id)));
            
            const targetChart = latestAssignedChart || dutyCharts[0];
            
            if (targetChart) {
                setSelectedChartId(String(targetChart.id));
            }
            setIsFirstLoad(false);
        }
    }, [dutyCharts, duties, isFirstLoad, isLoading]);

    // Derived filtered duties (chart + shift + date filters)
    const filteredDuties = useMemo(() => {
        let result = [...duties];
        if (selectedChartId !== "all") {
            result = result.filter(d => String(d.duty_chart) === selectedChartId);
        }
        if (selectedShiftIds.length > 0) {
            result = result.filter(d => selectedShiftIds.includes(String(d.schedule)));
        }
        if (dateFrom) {
            result = result.filter(d => d.date >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(d => d.date <= dateTo);
        }
        return result;
    }, [duties, selectedChartId, selectedShiftIds, dateFrom, dateTo]);

    const sortedDuties = useMemo(() =>
        [...filteredDuties].sort((a, b) => b.date.localeCompare(a.date))
        , [filteredDuties]);

    const totalCount = sortedDuties.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
    const paginatedDuties = useMemo(() =>
        sortedDuties.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
        , [sortedDuties, currentPage, PAGE_SIZE]);

    // Unique shifts for filter
    const uniqueShifts = useMemo(() => {
        if (selectedChartId !== "all") {
            return chartSchedules.map(s => ({ id: s.id, name: s.name }));
        }
        const shifts = new Map<number, { id: number; name: string }>();
        duties.forEach(d => {
            if (d.schedule && d.schedule_name) {
                shifts.set(d.schedule, { id: d.schedule, name: d.schedule_name });
            }
        });
        return Array.from(shifts.values());
    }, [duties, selectedChartId, chartSchedules]);

    const formatADDate = (dateStr: string) => {
        try { return format(new Date(dateStr), "MMM d, yyyy"); } catch (e) { return dateStr; }
    };

    const formatBSDate = (dateStr: string) => {
        try {
            const nd = new NepaliDate(new Date(dateStr));
            return nd.format("MMMM D, YYYY");
        } catch (e) { return ""; }
    };

    if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="p-4 md:p-6 space-y-4 w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageHeader 
                    title="My Duties" 
                    subtitle="Manage and view your assigned shifts across all offices." 
                    icon={Clock} 
                    iconColor="text-orange-500"
                />
            </div>

            {/* Consolidated Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <Select value={selectedChartId} onValueChange={setSelectedChartId}>
                        <SelectTrigger className="h-9 text-xs w-[220px] bg-primary text-white font-semibold border-2 border-primary hover:bg-primary/90">
                            <SelectValue placeholder="All Duty Charts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Duty Charts</SelectItem>
                            {dutyCharts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Popover open={shiftFilterOpen} onOpenChange={setShiftFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="h-9 text-xs w-[220px] justify-between border-primary/20 bg-primary/5 font-normal"
                            >
                                <span className="truncate">
                                    {selectedShiftIds.length === 0
                                        ? "All Shifts"
                                        : selectedShiftIds.length === 1
                                            ? uniqueShifts.find(s => String(s.id) === selectedShiftIds[0])?.name ?? "1 Shift"
                                            : `${selectedShiftIds.length} Shifts`}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
                            <div className="space-y-0.5">
                                <div
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-slate-100 cursor-pointer text-sm"
                                    onClick={() => setSelectedShiftIds([])}
                                >
                                    <Checkbox checked={selectedShiftIds.length === 0} className="pointer-events-none" />
                                    <span className="font-medium">All Shifts</span>
                                </div>
                                {uniqueShifts.map(s => {
                                    const id = String(s.id);
                                    const checked = selectedShiftIds.includes(id);
                                    return (
                                        <div
                                            key={s.id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-slate-100 cursor-pointer text-sm"
                                            onClick={() => setSelectedShiftIds(prev =>
                                                checked ? prev.filter(x => x !== id) : [...prev, id]
                                            )}
                                        >
                                            <Checkbox checked={checked} className="pointer-events-none" />
                                            <span className="truncate">{s.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {viewMode === "list" && (
                        <>
                        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                        {/* Date Filter (From/To Pickers) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-bold text-slate-500">From:</span>
                            {dateMode === "BS" ? (
                                <NepaliDatePicker value={dateFrom} onChange={setDateFrom} className="h-9 text-xs w-[115px] px-2 bg-slate-50 hover:bg-slate-100 border rounded" />
                            ) : (
                                <GregorianDatePicker value={dateFrom} onChange={setDateFrom} className="h-9 text-xs w-[115px] px-2 bg-slate-50 hover:bg-slate-100 border rounded" />
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-bold text-slate-500">To:</span>
                            {dateMode === "BS" ? (
                                <NepaliDatePicker value={dateTo} onChange={setDateTo} className="h-9 text-xs w-[115px] px-2 bg-slate-50 hover:bg-slate-100 border rounded" />
                            ) : (
                                <GregorianDatePicker value={dateTo} onChange={setDateTo} className="h-9 text-xs w-[115px] px-2 bg-slate-50 hover:bg-slate-100 border rounded" />
                            )}
                        </div>
                        {(dateFrom || dateTo) && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { setDateFrom(""); setDateTo(""); }}
                                className="h-8 text-[10px] font-bold text-red-500 hover:text-red-600 px-2"
                            >
                                Clear
                            </Button>
                        )}

                        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
                        </>
                    )}

                    {/* BS/AD Toggle */}
                    <div className="flex bg-slate-100/50 border rounded-md p-1 items-center shrink-0">
                        <button onClick={() => setDateMode("BS")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>BS</button>
                        <button onClick={() => setDateMode("AD")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>AD</button>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-slate-100/50 border rounded-md p-1 items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => setViewMode("calendar")}
                        className={cn("flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all",
                            viewMode === "calendar" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
                    >
                        <LayoutGrid className="h-3 w-3" />
                        Calendar
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={cn("flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all",
                            viewMode === "list" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}
                    >
                        <LayoutList className="h-3 w-3" />
                        List
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === "list" ? (
            <div className="space-y-1">
                {/* Pagination Controls (Top) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2 py-1">
                    <p className="text-xs text-slate-500 font-medium">
                        Showing {totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline" size="sm"
                            className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            &laquo; Prev
                        </Button>
                        {(() => {
                            const pages = [];
                            const maxVisible = 5;
                            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                            let end = Math.min(totalPages, start + maxVisible - 1);
                            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                            for (let i = start; i <= end; i++) {
                                pages.push(
                                    <Button key={i} variant={currentPage === i ? "default" : "outline"} size="sm"
                                        className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${currentPage === i ? "bg-primary text-white hover:bg-primary/90 border-primary" : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"}`}
                                        onClick={() => setCurrentPage(i)}
                                    >{i}</Button>
                                );
                            }
                            return pages;
                        })()}
                        <Button
                            variant="outline" size="sm"
                            className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next &raquo;
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-primary hover:bg-primary">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-[50px] py-3 px-4 text-white font-medium text-sm text-center">#</TableHead>
                                <TableHead className="w-[180px] py-3 px-4 text-white font-medium text-sm">Date (BS/AD)</TableHead>
                                <TableHead className="w-[100px] py-3 px-4 text-white font-medium text-sm">Day</TableHead>
                                <TableHead className="py-3 px-4 text-white font-medium text-sm">Shift / Duty</TableHead>
                                <TableHead className="w-[100px] py-3 px-4 text-white font-medium text-sm text-center">Alias</TableHead>
                                <TableHead className="py-3 px-4 text-white font-medium text-sm">Office</TableHead>
                                <TableHead className="w-[150px] py-3 px-4 text-white font-medium text-sm">Time</TableHead>
                                <TableHead className="w-[120px] py-3 px-4 text-white font-medium text-sm text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedDuties.length > 0 ? paginatedDuties.map((duty, index) => {
                                const sc = getShiftColor(duty.schedule, duty.schedule_name, duty.alias);
                                const todayStr = format(new Date(), "yyyy-MM-dd");
                                const isCompleted = duty.is_completed || duty.date < todayStr;
                                const dayName = format(new Date(duty.date), "EEEE");

                                return (
                                    <TableRow key={duty.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="p-4 text-center text-xs font-bold text-slate-900">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                                        <TableCell className="p-4">
                                            {dateMode === "BS" ? (
                                                <span className="font-bold text-slate-900 text-sm">{formatBSDate(duty.date)}</span>
                                            ) : (
                                                <span className="font-bold text-slate-900 text-sm">{formatADDate(duty.date)}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-4 font-bold text-slate-900 text-xs">
                                            {dayName}
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <div style={{ backgroundColor: sc.bg, borderColor: sc.border, color: sc.text }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border w-fit shadow-sm">
                                                <Clock style={{ color: sc.text }} className="h-3 w-3" />
                                                <span style={{ color: sc.text }} className="font-bold text-xs">{toTitleCase(duty.schedule_name)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4 text-center">
                                            {duty.alias ? (
                                                <span style={{ borderColor: sc.border, color: sc.text, backgroundColor: "rgba(255, 255, 255, 0.4)" }} className="text-[10px] font-black px-2 py-0.5 rounded border">
                                                    {toTitleCase(duty.alias)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-900 text-[10px] font-bold">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <div className="flex items-center gap-2 text-slate-900">
                                                <Building2 className="h-3.5 w-3.5 opacity-80" />
                                                <span className="text-xs font-bold truncate max-w-[200px]">{toTitleCase(duty.office_name)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4">
                                            <div className="flex items-center gap-1.5 text-slate-900 bg-slate-100/80 px-2 py-1 rounded-md w-fit border border-slate-200">
                                                <Clock className="h-3 w-3 opacity-85" />
                                                <span className="text-[11px] font-bold">{duty.start_time?.substring(0, 5)} - {duty.end_time?.substring(0, 5)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4 text-center">
                                            {isCompleted ? (
                                                <Badge className="bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-50 text-[10px] font-bold py-0.5 px-2.5 rounded-full border">
                                                    Completed
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-50 text-[10px] font-bold py-0.5 px-2.5 rounded-full border">
                                                    Pending
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : <TableRow><TableCell colSpan={8} className="h-40 text-center text-slate-400 text-sm">No duties found matching filters.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls (Bottom) */}
                <div className="flex items-center justify-between px-2">
                    <p className="text-xs text-slate-500 font-medium">
                        Showing {totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline" size="sm"
                            className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            &laquo; Prev
                        </Button>
                        {(() => {
                            const pages = [];
                            const maxVisible = 5;
                            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                            let end = Math.min(totalPages, start + maxVisible - 1);
                            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                            for (let i = start; i <= end; i++) {
                                pages.push(
                                    <Button key={i} variant={currentPage === i ? "default" : "outline"} size="sm"
                                        className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${currentPage === i ? "bg-primary text-white hover:bg-primary/90 border-primary" : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"}`}
                                        onClick={() => setCurrentPage(i)}
                                    >{i}</Button>
                                );
                            }
                            return pages;
                        })()}
                        <Button
                            variant="outline" size="sm"
                            className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next &raquo;
                        </Button>
                    </div>
                </div>
            </div>
            ) : (
            /* ===== CALENDAR VIEW ===== */
            <CalendarView
                filteredDuties={filteredDuties}
                dateMode={dateMode}
                calendarAdMonth={calendarAdMonth}
                setCalendarAdMonth={setCalendarAdMonth}
                calendarBsYear={calendarBsYear}
                setCalendarBsYear={setCalendarBsYear}
                calendarBsMonth={calendarBsMonth}
                setCalendarBsMonth={setCalendarBsMonth}
                formatBSDate={formatBSDate}
                formatADDate={formatADDate}
            />
            )}
        </div>
    );
};

export default MyDuties;
