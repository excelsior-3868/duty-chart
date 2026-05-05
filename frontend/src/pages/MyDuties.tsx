import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import {
    Clock,
    Calendar as CalendarIcon,
    List,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Building2,
    Filter
} from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getDutiesFiltered } from "@/services/dutiesService";
import { getDutyCharts } from "@/services/dutichart";
import NepaliDate from "nepali-date-converter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Shift Color Mapping
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

const MyDuties = () => {
    const { user } = useAuth();
    const [view, setView] = useState<"list" | "calendar">("calendar");
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");
    const [currentDate, setCurrentDate] = useState(new Date());

    // Filters
    const [selectedChartId, setSelectedChartId] = useState<string>("all");
    const [selectedShiftId, setSelectedShiftId] = useState<string>("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 15;

    // Fetch Duty Charts
    const { data: dutyCharts = [] } = useQuery({
        queryKey: ['dutyCharts', user?.office_id],
        queryFn: () => user?.office_id ? getDutyCharts(user.office_id) : Promise.resolve([]),
        enabled: !!user?.office_id,
    });

    // Fetch Duties
    const { data: duties = [], isLoading } = useQuery({
        queryKey: ['duties', 'my', user?.id],
        queryFn: () => user?.id ? getDutiesFiltered({ user: user.id }) : Promise.resolve([]),
        enabled: !!user?.id,
    });
    // BS date helpers (needed by filteredDuties and calendar)
    const currentNepaliDate = useMemo(() => new NepaliDate(currentDate), [currentDate]);
    const yearBS = currentNepaliDate.getYear();
    const monthBS = currentNepaliDate.getMonth();

    // Derived filtered duties (chart + shift + selected month)
    const filteredDuties = useMemo(() => {
        let result = [...duties];
        if (selectedChartId !== "all") {
            result = result.filter(d => String(d.duty_chart) === selectedChartId);
        }
        if (selectedShiftId !== "all") {
            result = result.filter(d => String(d.schedule) === selectedShiftId);
        }
        // Filter by selected month (same month visible in calendar)
        result = result.filter(d => {
            try {
                if (dateMode === "BS") {
                    const nd = new NepaliDate(new Date(d.date));
                    return nd.getYear() === yearBS && nd.getMonth() === monthBS;
                } else {
                    const dt = new Date(d.date);
                    return dt.getFullYear() === currentDate.getFullYear() && dt.getMonth() === currentDate.getMonth();
                }
            } catch { return false; }
        });
        return result;
    }, [duties, selectedChartId, selectedShiftId, dateMode, yearBS, monthBS, currentDate]);

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
        const shifts = new Map<number, { id: number; name: string }>();
        duties.forEach(d => {
            if (d.schedule && d.schedule_name) {
                shifts.set(d.schedule, { id: d.schedule, name: d.schedule_name });
            }
        });
        return Array.from(shifts.values());
    }, [duties]);

    const formatADDate = (dateStr: string) => {
        try { return format(new Date(dateStr), "MMM d, yyyy"); } catch (e) { return dateStr; }
    };

    const formatBSDate = (dateStr: string) => {
        try {
            const nd = new NepaliDate(new Date(dateStr));
            return nd.format("MMMM D, YYYY");
        } catch (e) { return ""; }
    };

    // Calendar logic
    const nepaliMonths = ["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
    const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const nepaliDays = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
    const englishDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


    const calendarDays = useMemo(() => {
        const startOfBSMonth = new NepaliDate(yearBS, monthBS, 1);
        const startAD = startOfBSMonth.toJsDate();
        let nextMonthYear = yearBS;
        let nextMonth = monthBS + 1;
        if (nextMonth > 11) { nextMonth = 0; nextMonthYear++; }
        const startOfNextBSMonth = new NepaliDate(nextMonthYear, nextMonth, 1);
        const endAD = new Date(startOfNextBSMonth.toJsDate().getTime() - 24 * 60 * 60 * 1000);
        const startGrid = startOfWeek(startAD);
        const endGrid = endOfWeek(endAD);
        const days = [];
        let day = startGrid;
        while (day <= endGrid) { days.push(day); day = addDays(day, 1); }
        return days;
    }, [yearBS, monthBS]);

    const handlePrevMonth = () => {
        if (dateMode === "BS") {
            let nM = monthBS - 1; let nY = yearBS;
            if (nM < 0) { nM = 11; nY--; }
            setCurrentDate(new NepaliDate(nY, nM, 1).toJsDate());
        } else {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        }
    };

    const handleNextMonth = () => {
        if (dateMode === "BS") {
            let nM = monthBS + 1; let nY = yearBS;
            if (nM > 11) { nM = 0; nY++; }
            setCurrentDate(new NepaliDate(nY, nM, 1).toJsDate());
        } else {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        }
    };

    const handleToday = () => setCurrentDate(new Date());

    const handleYearChange = (val: string) => {
        if (dateMode === "BS") setCurrentDate(new NepaliDate(parseInt(val), monthBS, 1).toJsDate());
        else setCurrentDate(new Date(parseInt(val), currentDate.getMonth(), 1));
    };

    const handleMonthChange = (val: string) => {
        if (dateMode === "BS") setCurrentDate(new NepaliDate(yearBS, nepaliMonths.indexOf(val), 1).toJsDate());
        else setCurrentDate(new Date(currentDate.getFullYear(), englishMonths.indexOf(val), 1));
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
                <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[180px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="calendar" className="text-xs gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Calendar</TabsTrigger>
                        <TabsTrigger value="list" className="text-xs gap-1.5"><List className="h-3.5 w-3.5" /> List</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Consolidated Control Bar */}
            <div className="flex items-center justify-between gap-1 bg-white p-1.5 rounded-xl border shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Select value={dateMode === "BS" ? nepaliMonths[monthBS] : englishMonths[currentDate.getMonth()]} onValueChange={handleMonthChange}>
                            <SelectTrigger className={cn("h-9 text-xs font-medium border-none focus:ring-0 hover:bg-slate-100", dateMode === "BS" ? "w-[100px] bg-slate-50" : "w-[110px] bg-slate-50")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(dateMode === "BS" ? nepaliMonths : englishMonths).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={String(dateMode === "BS" ? yearBS : currentDate.getFullYear())} onValueChange={handleYearChange}>
                            <SelectTrigger className="w-[70px] h-9 text-xs font-medium border-none bg-slate-50 hover:bg-slate-100 focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 11 }, (_, i) => (dateMode === "BS" ? yearBS : currentDate.getFullYear()) - 5 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                    <Select value={selectedChartId} onValueChange={setSelectedChartId}>
                        <SelectTrigger className="h-9 text-xs w-[220px] bg-primary text-white font-semibold border-2 border-primary hover:bg-primary/90">
                            <SelectValue placeholder="All Duty Charts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Duty Charts</SelectItem>
                            {dutyCharts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                        <SelectTrigger className="h-9 text-xs w-[220px] border-primary/20 bg-primary/5">
                            <SelectValue placeholder="All Shifts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Shifts</SelectItem>
                            {uniqueShifts.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                    {/* BS/AD Toggle */}
                    <div className="flex bg-slate-100/50 border rounded-md p-1 items-center shrink-0">
                        <button onClick={() => setDateMode("BS")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>BS</button>
                        <button onClick={() => setDateMode("AD")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>AD</button>
                    </div>
                </div>

                <div className="flex items-center border-l pl-2 gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" onClick={handleToday} className="h-8 text-xs px-2">Today</Button>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>

            {/* Content Area */}
            {view === "list" ? (
                <div className="space-y-1">
                    {/* Pagination Controls (Top) */}
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

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-primary hover:bg-primary">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="w-[50px] py-3 px-4 text-white font-medium text-sm text-center">#</TableHead>
                                    <TableHead className="w-[180px] py-3 px-4 text-white font-medium text-sm">Date (BS/AD)</TableHead>
                                    <TableHead className="py-3 px-4 text-white font-medium text-sm">Shift / Duty</TableHead>
                                    <TableHead className="w-[100px] py-3 px-4 text-white font-medium text-sm text-center">Alias</TableHead>
                                    <TableHead className="py-3 px-4 text-white font-medium text-sm">Office</TableHead>
                                    <TableHead className="w-[150px] py-3 px-4 text-white font-medium text-sm">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedDuties.length > 0 ? paginatedDuties.map((duty, index) => {
                                    const sc = getShiftColor(duty.schedule);
                                    return (
                                        <TableRow key={duty.id} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="p-4 text-center text-xs font-bold text-slate-400">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                                            <TableCell className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 text-sm">{formatBSDate(duty.date)}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{formatADDate(duty.date)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border w-fit shadow-sm", sc.bg, sc.border)}>
                                                    <Clock className={cn("h-3 w-3", sc.text)} />
                                                    <span className={cn("font-bold text-xs", sc.text)}>{duty.schedule_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-4 text-center">
                                                {duty.alias ? (
                                                    <span className={cn("text-[10px] font-black opacity-80 uppercase px-2 py-0.5 rounded border", sc.bg, sc.border, sc.text)}>
                                                        {duty.alias}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-[10px]">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Building2 className="h-3.5 w-3.5 opacity-40" />
                                                    <span className="text-xs font-semibold truncate max-w-[200px]">{duty.office_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100/50 px-2 py-1 rounded-md w-fit">
                                                    <Clock className="h-3 w-3 opacity-50" />
                                                    <span className="text-[11px] font-black">{duty.start_time?.substring(0, 5)} - {duty.end_time?.substring(0, 5)}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : <TableRow><TableCell colSpan={6} className="h-40 text-center text-slate-400 text-sm">No duties found matching filters.</TableCell></TableRow>}
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
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col max-h-[calc(100vh-260px)] overflow-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <div className="grid grid-cols-7 border-b bg-slate-50/80 min-w-[700px]">
                        {(dateMode === "BS" ? nepaliDays : englishDays).map((day, idx) => (
                            <div key={day} className={cn("py-3 text-center text-[11px] font-black uppercase tracking-wider text-slate-500", idx === 6 ? "text-red-500" : "")}>{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-[120px] md:auto-rows-[160px] min-w-[700px]">
                        {calendarDays.map((date, idx) => {
                            const nd = new NepaliDate(date);
                            const isCurrentMonth = nd.getMonth() === monthBS;
                            const isTodayDate = isSameDay(date, new Date());
                            const dateISO = format(date, "yyyy-MM-dd");
                            const dayDuties = filteredDuties.filter(d => d.date === dateISO);
                            return (
                                <div key={date.toString()} className={cn("p-2 border-b border-r group relative", !isCurrentMonth ? "bg-slate-50/30 opacity-60" : "bg-white", (idx + 1) % 7 === 0 && "border-r-0")}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={cn("text-sm font-black", !isCurrentMonth ? "text-slate-300" : "text-slate-900", isTodayDate && "text-white bg-primary rounded-full w-6 h-6 flex items-center justify-center -ml-1 -mt-1 shadow-sm")}>{dateMode === "BS" ? nd.getDate() : format(date, "d")}</span>
                                    </div>
                                    <div className="space-y-1 overflow-y-auto max-h-[85px] md:max-h-[125px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                        {dayDuties.map(d => {
                                            const sc = getShiftColor(d.schedule);
                                            return (
                                                <div key={d.id} className={cn("text-[9px] md:text-[10px] p-1.5 rounded-lg border-2 shadow-sm", sc.bg, sc.border)}>
                                                    <div className={cn("font-medium capitalize truncate leading-none mb-1", sc.text)}>{d.schedule_name}</div>
                                                    <div className={cn("flex flex-col gap-0.5 opacity-80", sc.text)}>
                                                        <div className="flex items-center gap-1 text-[8px] font-bold"><Clock className="h-2 w-2" />{d.start_time?.substring(0, 5)}-{d.end_time?.substring(0, 5)}</div>
                                                        <div className="flex items-center gap-1 text-[8px] font-bold truncate"><Building2 className="h-2 w-2" />{d.office_name}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyDuties;
