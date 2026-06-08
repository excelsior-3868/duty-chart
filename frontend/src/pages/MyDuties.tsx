import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
    Clock,
    Calendar as CalendarIcon,
    Loader2,
    Building2
} from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getDutiesFiltered } from "@/services/dutiesService";
import { getDutyCharts } from "@/services/dutichart";
import { getSchedules } from "@/services/schedule";
import NepaliDate from "nepali-date-converter";
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
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";

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
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");

    // Filters
    const [selectedChartId, setSelectedChartId] = useState<string>("all");
    const [selectedShiftId, setSelectedShiftId] = useState<string>("all");
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

    // Auto-update date range filters when duty chart changes, and reset selected shift
    React.useEffect(() => {
        setSelectedShiftId("all");
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
        if (selectedShiftId !== "all") {
            result = result.filter(d => String(d.schedule) === selectedShiftId);
        }
        if (dateFrom) {
            result = result.filter(d => d.date >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(d => d.date <= dateTo);
        }
        return result;
    }, [duties, selectedChartId, selectedShiftId, dateFrom, dateTo]);

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

                    {/* BS/AD Toggle */}
                    <div className="flex bg-slate-100/50 border rounded-md p-1 items-center shrink-0">
                        <button onClick={() => setDateMode("BS")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>BS</button>
                        <button onClick={() => setDateMode("AD")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>AD</button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
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
                                const sc = getShiftColor(duty.schedule);
                                const todayStr = format(new Date(), "yyyy-MM-dd");
                                const isCompleted = duty.is_completed || duty.date < todayStr;
                                const dayName = format(new Date(duty.date), "EEEE");

                                return (
                                    <TableRow key={duty.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="p-4 text-center text-xs font-bold text-slate-400">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                                        <TableCell className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{formatBSDate(duty.date)}</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">{formatADDate(duty.date)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4 font-semibold text-slate-700 text-xs">
                                            {dayName}
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
                                        <TableCell className="p-4 text-center">
                                            {isCompleted ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-[10px] font-bold py-0.5 px-2.5 rounded-full border">
                                                    Completed
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 text-[10px] font-bold py-0.5 px-2.5 rounded-full border">
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
        </div>
    );
};

export default MyDuties;
