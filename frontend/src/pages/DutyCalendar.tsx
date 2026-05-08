import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/constants";
import NepaliDate from "nepali-date-converter";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Download, ChevronsUpDown, Check, Pencil, Search, Phone, Mail, FileSpreadsheet, User as UserIcon, Trash2, Info, FileText, ExternalLink, Upload, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getOffices, type Office } from "@/services/offices";
import { getDutyCharts, getDutyChartById, approveDutyChart, patchDutyChart, type DutyChart as DutyChartInfo } from "@/services/dutichart";
import { getDutiesFiltered, type Duty, deleteDuty } from "@/services/dutiesService";
import { getUser, type User } from "@/services/users";
import { getOffice as getOfficeDetail, type Office as OfficeInfo } from "@/services/offices";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import CreateDutyModal from "@/components/CalendarRosterHybrid/CreateDutyModal";
import CreateDutyChartModal from "@/components/CalendarRosterHybrid/CreateDutyChartModal";
import EditDutyChartModal from "@/components/CalendarRosterHybrid/EditDutyChartModal";
import ExportPreviewModal from "@/components/CalendarRosterHybrid/ExportPreviewModal";
import ApproveDutyChartModal from "@/components/CalendarRosterHybrid/ApproveDutyChartModal";
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

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

// Interface for Duty Chart (simplified)
interface DutyChart {
    id: string;
    name: string;
    status?: 'draft' | 'approved';
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
    responsibility?: string;
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
    const navigate = useNavigate();
    // --- State: Calendar View ---
    const [currentDate, setCurrentDate] = useState(new Date()); // View navigation date
    const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");

    // --- State: Data & Selection ---
    const [offices, setOffices] = useState<Office[]>([]);
    const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");

    // --- Bulk Delete State ---
    const [selectedDutyIds, setSelectedDutyIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
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
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);

    // --- State: Schedules (Available Shifts) ---
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("all");

    // --- State: Holidays ---
    const [holidays, setHolidays] = useState<any[]>([]);

    // --- State: Day Detail Modal ---
    const [showDayDetailModal, setShowDayDetailModal] = useState(false);
    const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null);
    const [systemSettings, setSystemSettings] = useState<any>(null);

    const { user, hasPermission, canManageOffice, isAssignedToOffice } = useAuth();
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
        document.title = "Duty Chart Calendar - NT Duty Chart Management System";
        const load = async () => {
            try {
                const [officesRes, holidaysRes, settingsRes] = await Promise.all([
                    getOffices(),
                    api.get('holidays/'),
                    api.get('system-settings/')
                ]);
                setOffices(officesRes.map((o: any) => ({
                    ...o,
                    id: o.id
                })));
                setHolidays(holidaysRes.data);
                setSystemSettings(settingsRes.data);
            } catch (e) {
                console.error("Failed to load initial data", e);
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
                name: c.name,
                status: c.status
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

    // --- 4. Load Chart Detail & Schedules ---
    const fetchDutyChartInfo = useCallback(async () => {
        if (!selectedDutyChartId) {
            setSelectedDutyChartInfo(null);
            setSchedules([]);
            setSelectedScheduleId("all");
            return;
        }

        try {
            const info = await getDutyChartById(parseInt(selectedDutyChartId));
            setSelectedDutyChartInfo(info);

            // --- Automatically focus calendar on the chart's effective date ---
            if (info.effective_date) {
                const effDate = new Date(info.effective_date);
                setCurrentDate(effDate);
            }

            // Load schedules for this chart
            const res = await getSchedules(undefined, parseInt(selectedDutyChartId));
            const fetchedSchedules = res || [];
            setSchedules(fetchedSchedules);

            // Always default to "all" shifts as requested
            setSelectedScheduleId("all");
        } catch (e) {
            console.error("Failed to load duty chart info:", e);
            setSelectedDutyChartInfo(null);
            setSchedules([]);
        }
    }, [selectedDutyChartId]);

    useEffect(() => {
        fetchDutyChartInfo();
    }, [fetchDutyChartInfo]);


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
            return {
                id: String(d.id),
                employee_name: name,
                role: "",
                start_time: d.start_time || "",
                end_time: d.end_time || "",
                date: new Date(d.date),
                shift: d.schedule_name || "Shift",
                phone_number: d.phone_number || "",
                email: d.email || "",
                directorate: d.user_office_directorate_name || "",
                department: d.user_office_ac_office_name || "",
                position: d.position_name || "",
                office: d.office_name || "",
                avatar: resolveAvatar(d.image),
                schedule_id: d.schedule,
                alias: d.alias,
                employee_id: d.employee_id || "",
                employee_office_id: d.user_office_id ?? null,
                responsibility: d.responsibility_name || "",
            } as DutyAssignment;
        });
    }, [duties]);

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


    const isSuperAdmin = user?.role === 'SUPERADMIN';
    // Is the current user the creator of the currently selected duty chart?
    const isChartCreator = !!(
        selectedDutyChartInfo &&
        user?.id != null &&
        selectedDutyChartInfo.created_by === user.id
    );

    const canDeleteAssignment = useCallback((a: DutyAssignment) => {
        if (isSuperAdmin) return true;
        if (!hasPermission('duties.delete')) return false;
        
        if (isChartCreator) return true;

        if (selectedDutyChartInfo) {
            const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
                ? Number((selectedDutyChartInfo.office as any)?.id)
                : Number(selectedDutyChartInfo.office);
            return isAssignedToOffice(chartOfficeId);
        }
        
        return false;
    }, [isSuperAdmin, hasPermission, isChartCreator, selectedDutyChartInfo, canManageOffice]);

    const modalAssignments = useMemo(() => {
        if (!selectedDateForDetail) return [];
        return assignments
            .filter(a => isSameDay(a.date, selectedDateForDetail) && (selectedScheduleId === "all" || String(a.schedule_id) === selectedScheduleId))
            .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    }, [assignments, selectedDateForDetail, selectedScheduleId]);

    // Close day detail modal logic (only clear selection when closed manually or by external triggers)
    useEffect(() => {
        if (!showDayDetailModal) {
            setSelectedDutyIds(new Set());
        }
    }, [showDayDetailModal]);

    // Bulk Delete Logic
    const toggleDutySelection = (id: string) => {
        const newSelected = new Set(selectedDutyIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedDutyIds(newSelected);
    };

    const handleSelectAll = () => {
        const selectable = modalAssignments.filter(canDeleteAssignment);
        if (selectable.length === 0) return;

        const allSelected = selectable.every(a => selectedDutyIds.has(a.id));

        if (allSelected) {
            // Deselect all visible
            const newSet = new Set(selectedDutyIds);
            selectable.forEach(a => newSet.delete(a.id));
            setSelectedDutyIds(newSet);
        } else {
            // Select all visible
            const newSet = new Set(selectedDutyIds);
            selectable.forEach(a => newSet.add(a.id));
            setSelectedDutyIds(newSet);
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedDutyIds.size === 0) return;
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        setShowBulkDeleteConfirm(false);
        setIsBulkDeleting(true);
        try {
            // Convert to array and delete each
            const idsToDelete = Array.from(selectedDutyIds);
            let successCount = 0;
            let failCount = 0;

            for (const idStr of idsToDelete) {
                try {
                    await deleteDuty(parseInt(idStr));
                    successCount++;
                } catch (error) {
                    console.error(`Failed to delete duty ${idStr}`, error);
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Successfully deleted ${successCount} assignment(s).`);
                fetchDuties(); // Refresh list
                setSelectedDutyIds(new Set()); // Clear selection
                setShowDayDetailModal(false); // Close the detail modal immediately
            }

            if (failCount > 0) {
                toast.error(`Failed to delete ${failCount} assignment(s). Check console/permissions.`);
            }

        } catch (error) {
            toast.error("An error occurred during bulk delete.");
        } finally {
            setIsBulkDeleting(false);
        }
    };

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
        if (!hasPermission('duties.edit_dutychart')) return false;
        if (isSuperAdmin) return true;
        if (!selectedDutyChartInfo) return false;

        // A peer of the creator — same role AND same office as the creator —
        // can also edit the chart if they have the 'create_any_office_chart' permission.
        const creatorRole = (selectedDutyChartInfo as any).created_by_role;
        const creatorOfficeId = (selectedDutyChartInfo as any).created_by_office;
        if (
            creatorRole &&
            creatorOfficeId &&
            user?.role === creatorRole &&
            Number(user?.office_id) === Number(creatorOfficeId) &&
            hasPermission('duties.create_any_office_chart')
        ) return true;

        // Otherwise, user must belong to the chart's own office
        const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
            ? Number((selectedDutyChartInfo.office as any)?.id)
            : Number(selectedDutyChartInfo.office);
        return isAssignedToOffice(chartOfficeId);
    }, [hasPermission, isSuperAdmin, selectedDutyChartInfo, isAssignedToOffice, user]);


    const canDeleteDuty = useMemo(() => {
        if (!selectedDutyChartInfo) return false;
        if (!hasPermission('duties.delete')) return false;
        if (isSuperAdmin) return true;
        
        if (isChartCreator) return true;

        const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
            ? Number((selectedDutyChartInfo.office as any)?.id)
            : Number(selectedDutyChartInfo.office);
        return isAssignedToOffice(chartOfficeId);
    }, [selectedDutyChartInfo, hasPermission, isSuperAdmin, isChartCreator, isAssignedToOffice]);

    const handleUploadAdditionalDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !selectedDutyChartId) return;

        setIsUploadingDocument(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach(file => {
                formData.append('anusuchi_documents', file);
            });

            await patchDutyChart(parseInt(selectedDutyChartId), formData);
            toast.success("Document(s) uploaded successfully");
            
            // Refresh chart info to show new documents
            await fetchDutyChartInfo();
        } catch (error) {
            console.error("Failed to upload document:", error);
            toast.error("Failed to upload document");
        } finally {
            setIsUploadingDocument(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDuty = async () => {
        if (!selectedProfile?.id) return;
        try {
            await deleteDuty(parseInt(selectedProfile.id));
            toast.success("Duty deleted");
            setShowDeleteConfirm(false);
            setShowProfileModal(false);
            setShowDayDetailModal(false); // Close the day detail modal as well
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
        <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen w-full">
            {/* Header: Title + Controls */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <PageHeader 
                            title="Duty Chart Calendar" 
                            subtitle="Manage events and duty schedules." 
                            icon={CalendarIcon} 
                            iconColor="text-emerald-500"
                        />
                        {selectedDutyChartInfo && (
                            <div className="hidden sm:block">
                                {selectedDutyChartInfo.status === 'approved' ? (
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 px-3 py-1 gap-1.5 font-bold">
                                            <Check className="w-3 h-3" /> Approved
                                        </Badge>
                                        
                                        {selectedDutyChartInfo && (selectedDutyChartInfo.status === 'approved' || (selectedDutyChartInfo as any).anusuchi_documents?.length > 0) && (() => {
                                            // Document is visible to: SuperAdmin, employees of the chart's office,
                                            // or the user/network-admin who created this duty chart.
                                            const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
                                                ? Number((selectedDutyChartInfo.office as any)?.id)
                                                : Number(selectedDutyChartInfo.office);
                                            const canSeeDocument = isSuperAdmin || isAssignedToOffice(chartOfficeId) || isChartCreator;
                                            return canSeeDocument;
                                        })() && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm transition-all hover:scale-110">
                                                        <FileText className="w-4 h-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-72 p-2" align="start">
                                                    <div className="space-y-2">
                                                        <div className="px-2 py-1 border-b flex items-center justify-between">
                                                            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                <FileText className="w-3 h-3 text-emerald-600" />
                                                                अनुसूची कागजातहरू
                                                            </h4>
                                                            {canManageSelectedChart && (
                                                                <Button 
                                                                    variant="default" 
                                                                    size="sm" 
                                                                    className="h-7 px-2.5 text-[10px] gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold transition-all shadow-sm"
                                                                    disabled={isUploadingDocument}
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                >
                                                                    {isUploadingDocument ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                                                    थप कागजात
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <input 
                                                            type="file" 
                                                            ref={fileInputRef} 
                                                            className="hidden" 
                                                            multiple 
                                                            onChange={handleUploadAdditionalDocument}
                                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                        />
                                                        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                                                            {((selectedDutyChartInfo as any).anusuchi_documents || []).length > 0 ? (
                                                                (selectedDutyChartInfo as any).anusuchi_documents.map((doc: any, idx: number) => (
                                                                    <a 
                                                                        key={idx}
                                                                        href={doc.file}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center justify-between p-2 hover:bg-emerald-50 rounded-md transition-colors group border border-transparent hover:border-emerald-100"
                                                                    >
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center shrink-0">
                                                                                <span className="text-[10px] font-bold text-emerald-700">{idx + 1}</span>
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-[10px] font-bold text-emerald-600 uppercase italic">अनुसूची - १</span>
                                                                                <span className="text-xs font-medium text-slate-600 truncate">
                                                                                    {doc.file.split('/').pop()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 shrink-0" />
                                                                    </a>
                                                                ))
                                                            ) : (
                                                                <div className="py-4 text-center text-[10px] text-slate-400 italic">
                                                                    कुनै कागजात अपलोड गरिएको छैन।
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex flex-col gap-0.5 shadow-sm animate-in fade-in zoom-in duration-300 max-w-[220px]">
                                        <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] uppercase tracking-wide">
                                            <Info className="w-3.5 h-3.5 text-amber-600" /> Draft Mode
                                        </div>
                                        <div className="text-[10px] text-amber-600 font-medium leading-tight">
                                            Real-time SMS notifications are disabled. All staff will be notified via bulk SMS upon approval.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">

                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-100/50 border rounded-md p-1 items-center shrink-0">
                                <button onClick={() => setDateMode("BS")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>BS</button>
                                <button onClick={() => setDateMode("AD")} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all", dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700")}>AD</button>
                            </div>
                            <Button variant="outline" className="gap-2 text-xs h-9" onClick={() => navigate(ROUTES.ANNEX_I_REPORT)}>
                                <Download className="w-3.5 h-3.5" /> Download अनुसूची -१
                            </Button>
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
                            {selectedDutyChartInfo?.status === 'draft' && (() => {
                                // Approval is strictly office-scoped:
                                // Only SuperAdmin or an employee assigned to the chart's OWN office
                                // who has the 'approve_dutychart' permission may approve.
                                if (!hasPermission('duties.approve_dutychart')) return false;

                                const chartOfficeId = typeof selectedDutyChartInfo.office === "object"
                                    ? Number((selectedDutyChartInfo.office as any)?.id)
                                    : Number(selectedDutyChartInfo.office);
                                return isSuperAdmin || isAssignedToOffice(chartOfficeId);
                            })() && (
                                <Button className="gap-2 text-xs h-9 bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowApproveModal(true)}>
                                    <Check className="w-3.5 h-3.5" /> Approve & Notify
                                </Button>
                            )}
                        </div>
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

                        {/* Shift Filter - Always visible now */}
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

                        <div className={cn("w-full transition-all duration-500", loading && "blur-[2px] opacity-60")}>
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
                                            // Updated Logic: Only assigned shifts, sorted by time status
                                            const dayAssignments = assignments
                                                .filter(a =>
                                                    isSameDay(a.date, date) &&
                                                    (selectedScheduleId === "all" || String(a.schedule_id) === selectedScheduleId)
                                                )
                                                .map(a => {
                                                    const now = new Date();
                                                    // Calculate time status relative to NOW
                                                    const isToday = isSameDay(a.date, now);

                                                    let status: 'current' | 'upcoming' | 'past' = 'past';

                                                    if (a.start_time && a.end_time) {
                                                        const [sh, sm] = a.start_time.split(':').map(Number);
                                                        const [eh, em] = a.end_time.split(':').map(Number);

                                                        const nowH = now.getHours();
                                                        const nowM = now.getMinutes();
                                                        const currentMin = nowH * 60 + nowM;
                                                        const startMin = sh * 60 + sm;
                                                        const endMin = eh * 60 + em;

                                                        // Handle overnight logic roughly if end < start
                                                        const isOvernight = endMin < startMin;

                                                        if (isToday) {
                                                            if (isOvernight) {
                                                                if (currentMin >= startMin || currentMin < endMin) status = 'current';
                                                                else if (currentMin < startMin) status = 'upcoming'; // e.g. 10 AM, start 10 PM
                                                                else status = 'past';
                                                            } else {
                                                                if (currentMin >= startMin && currentMin < endMin) status = 'current';
                                                                else if (currentMin < startMin) status = 'upcoming';
                                                                else status = 'past';
                                                            }
                                                        } else if (new Date(a.date) > now) {
                                                            status = 'upcoming';
                                                        } else {
                                                            status = 'past';
                                                        }
                                                    }

                                                    return { ...a, status };
                                                })
                                                .sort((a, b) => {
                                                    // Sort Order: Current -> Upcoming -> Past
                                                    const statusOrder = { current: 0, upcoming: 1, past: 2 };
                                                    if (a.status !== b.status) {
                                                        return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
                                                    }
                                                    // Secondary Sort: Start Time
                                                    return (a.start_time || "").localeCompare(b.start_time || "");
                                                });

                                            const isSaturday = date.getDay() === 6;

                                            return (
                                                <div
                                                    key={date.toString()}
                                                    className={cn(
                                                        "border-b border-r p-2 relative transition-colors hover:bg-slate-50 group min-h-[120px] flex flex-col",
                                                        !isCurrentMonth ? "bg-slate-50/50" : "bg-white",
                                                        (idx + 1) % 7 === 0 ? "border-r-0" : ""
                                                    )}
                                                    onClick={(e) => {
                                                        setSelectedDateForDetail(date);
                                                        setTimeout(() => {
                                                            setShowDayDetailModal(true);
                                                        }, 10);
                                                    }}
                                                >

                                                    <div className="flex justify-between items-start mb-1 relative z-10">
                                                        <span className={cn(
                                                            "text-base font-bold select-none",
                                                            !isCurrentMonth ? "text-slate-400" : "text-slate-900",
                                                            (
                                                                isSaturday || 
                                                                (systemSettings?.show_sunday_as_holiday && date.getDay() === 0) ||
                                                                holidays.some(h => h.date === format(date, "yyyy-MM-dd"))
                                                            ) && isCurrentMonth ? "text-red-500" : "",
                                                            isTodayDate ? "text-white bg-primary rounded-full w-8 h-8 flex items-center justify-center -ml-1 -mt-1" : ""
                                                        )}>
                                                            {dateMode === "BS" ? nd.getDate() : format(date, "d")}
                                                        </span>

                                                        {(() => {
                                                            const dateStr = format(date, "yyyy-MM-dd");
                                                            const holiday = holidays.find(h => h.date === dateStr);
                                                            if (!holiday) return null;
                                                            return (
                                                                <div className="flex-1 flex items-center justify-center gap-1 min-w-0 px-1">
                                                                    <Badge variant="destructive" className="h-3.5 px-1 text-[7px] font-black uppercase leading-none shrink-0">Holiday</Badge>
                                                                    <span className="text-[9px] font-bold text-red-600 truncate">
                                                                        {holiday.name}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}

                                                        <span className="text-[10px] text-slate-400 font-medium select-none">
                                                            {dateMode === "BS" ? format(date, "d") : nd.getDate()}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1 overflow-y-auto max-h-[100px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent relative z-20">
                                                        {dayAssignments.map((assignment: any) => {
                                                            const shiftColor = getShiftColor(assignment.schedule_id);
                                                            const isUnassigned = assignment.type === 'unassigned';
                                                            const isOnShift = assignment.status === 'current';

                                                            return (
                                                                <div
                                                                    key={assignment.id}
                                                                    className={cn(
                                                                        "flex items-center gap-1.5 p-1 rounded-md border shadow-sm transition-all hover:shadow-md",
                                                                        isUnassigned
                                                                            ? "bg-slate-50 border-dashed border-slate-300 opacity-70"
                                                                            : cn(shiftColor.border, shiftColor.bg)
                                                                    )}
                                                                >
                                                                    {isOnShift && (
                                                                        <span className="relative flex h-2 w-2 shrink-0">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                        </span>
                                                                    )}
                                                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                                                        <span className={cn(
                                                                            "text-[10px] truncate leading-tight",
                                                                            isUnassigned ? "font-normal italic text-slate-500" : cn("font-bold", shiftColor.text)
                                                                        )}>
                                                                            {assignment.employee_name}
                                                                        </span>
                                                                        {assignment.alias && (
                                                                            <span className={cn(
                                                                                "text-[8px] font-black opacity-60 uppercase shrink-0 ml-1",
                                                                                isUnassigned ? "text-slate-400" : shiftColor.text
                                                                            )}>
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

                                                        if (canAssignDuties && isDateInChartRange) {
                                                            return (
                                                                <Button
                                                                    variant="secondary"
                                                                    size="icon"
                                                                    className="absolute bottom-1 right-1 h-6 w-6 rounded-full shadow-sm bg-primary text-white hover:bg-primary-hover opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 z-50"
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
                        </div>

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
                        dutyChartInfo={selectedDutyChartInfo}
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
                            <DialogTitle className="text-2xl font-bold text-center mb-0.5">
                                {selectedProfile?.employee_name}
                            </DialogTitle>
                            <div className="text-sm text-slate-500 font-medium text-center mb-2">
                                {selectedProfile?.position}{selectedProfile?.position && selectedProfile?.responsibility ? " — " : ""}{selectedProfile?.responsibility}
                            </div>
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

                <ApproveDutyChartModal
                    open={showApproveModal}
                    onOpenChange={setShowApproveModal}
                    chartId={Number(selectedDutyChartId)}
                    chartName={selectedDutyChartInfo?.name || "Duty Chart"}
                    officeName={selectedDutyChartInfo?.office_name || "Office"}
                    dutiesCount={duties.length}
                    onSuccess={() => {
                        fetchDutyCharts(selectedDutyChartId);
                        fetchDutyChartInfo();
                        fetchDuties();
                    }}
                />

                {/* Day Detail Modal */}
                <Dialog open={showDayDetailModal} onOpenChange={(open) => {
                    setShowDayDetailModal(open);
                    if (!open) setSelectedDutyIds(new Set());
                }}>
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

                        {modalAssignments.some(canDeleteAssignment) && (
                            <div className="flex items-center gap-2 px-1 pb-0 border-b">
                                <Checkbox
                                    checked={modalAssignments.length > 0 && modalAssignments.filter(canDeleteAssignment).length > 0 && modalAssignments.filter(canDeleteAssignment).every(a => selectedDutyIds.has(a.id))}
                                    onCheckedChange={handleSelectAll}
                                    disabled={modalAssignments.filter(canDeleteAssignment).length === 0}
                                />
                                <span className="text-sm font-medium">Select All</span>
                            </div>
                        )}

                        <div className="max-h-[60vh] overflow-y-auto space-y-3 pt-0 pb-4 pr-2 scrollbar-thin">
                            {modalAssignments.map((a) => {
                                const shiftColor = getShiftColor(a.schedule_id);
                                return (
                                    <div
                                        key={a.id}
                                        className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm hover:border-blue-400 decoration-slate-900 transition-all group"
                                    >
                                        <div onClick={(e) => e.stopPropagation()}>
                                            {canDeleteAssignment(a) && (
                                                <Checkbox
                                                    checked={selectedDutyIds.has(a.id)}
                                                    onCheckedChange={() => toggleDutySelection(a.id)}
                                                />
                                            )}
                                        </div>
                                        <div
                                            className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                                            onClick={() => {
                                                handleAssignmentClick(a);
                                                setShowDayDetailModal(false);
                                            }}
                                        >
                                            <div className={cn("w-1.5 h-10 rounded-full shrink-0", shiftColor.accent)} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="font-bold text-slate-800 text-sm truncate">{a.employee_name}</div>
                                                        {holidays.some(h => h.date === format(selectedDateForDetail || new Date(), "yyyy-MM-dd")) && (
                                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] py-0 px-1.5 h-4 font-bold whitespace-nowrap">
                                                                Holiday Duty
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5 h-4 font-semibold capitalize whitespace-nowrap", shiftColor.text, shiftColor.border, shiftColor.bg)}>
                                                        {a.shift}
                                                    </Badge>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                    {a.position}{a.position && a.responsibility ? " — " : ""}{a.responsibility}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}</span>
                                                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {a.phone_number}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter className="flex items-center justify-between sm:justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {selectedDutyIds.size > 0 && <span>{selectedDutyIds.size} selected</span>}
                            </div>
                            <div className="flex gap-2">
                                {selectedDutyIds.size > 0 && (
                                    <>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleBulkDeleteClick}
                                            disabled={isBulkDeleting}
                                        >
                                            {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                            Delete Selected
                                        </Button>

                                        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete {selectedDutyIds.size} selected assignment(s)? This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                                <Button variant="outline" onClick={() => setShowDayDetailModal(false)}>Close</Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default DutyCalendar;
