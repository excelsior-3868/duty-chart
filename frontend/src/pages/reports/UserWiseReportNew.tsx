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
import { Loader2, Download, FileText, Calendar, Users, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

/* ===================== COMPONENT ===================== */

function UserWiseReportNew() {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [selectAllUsers, setSelectAllUsers] = useState(false);

    const [duties, setDuties] = useState<DutyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [firstLoad, setFirstLoad] = useState(true);

    const [me, setMe] = useState<any>(null);

    const [dateFrom, setDateFrom] = useState("2026-01-01");
    const [dateTo, setDateTo] = useState("2026-01-31");

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [dutyOptions, setDutyOptions] = useState<DutyOption[]>([]);
    const [selectedDuty, setSelectedDuty] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

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
        if (!me || !me.is_staff) return;
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
        if (me) fetchUsers(selectedDuty);
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

    /* ================= Handle Duty Change ================= */

    const handleDutyChange = (val: string) => {
        setSelectedDuty(val);
        if (val) {
            const selected = dutyOptions.find(d => d.id.toString() === val);
            if (selected) {
                setDateFrom(selected.effective_date);
                setDateTo(selected.end_date);
            }
        }
    };

    /* ================= Load preview ================= */

    async function loadReport() {
        if (!selectAllUsers && selectedUsers.length === 0) {
            alert("Please select a user or enable Complete Duty Chart");
            return;
        }
        setLoading(true);
        setFirstLoad(false);
        try {
            const res = await api.get("/reports/duties/preview/", {
                params: {
                    date_from: dateFrom,
                    date_to: dateTo,
                    user_id: selectedUsers,
                    duty_id: selectedDuty || undefined,
                },
            });

            if (res.data && res.data.groups) {
                const rows = res.data.groups.flatMap((g: any) => g.rows || []);
                setDuties(rows);
            } else if (Array.isArray(res.data)) {
                setDuties(res.data);
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

    /* ================= Download DOCX ================= */

    async function downloadReport() {
        if (!selectAllUsers && selectedUsers.length === 0) {
            alert("No users selected!");
            return;
        }

        try {
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

            const response = await api.get("/reports/duties/file-new/", {
                params,
                responseType: "blob",
            });

            const url = window.URL.createObjectURL(
                new Blob([response.data], {
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                })
            );

            const link = document.createElement("a");
            link.href = url;
            link.download = `Completed_Work_Report_${dateFrom}_${dateTo}.docx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed", err);
            alert("Failed to download report");
        }
    }

    /* ================= Render ================= */

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Completed Work Report (अनुसूची - २)
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Generate and export professional performance reports in "Annex 2" format.
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
                    <p className="text-muted-foreground text-xs mb-6">Select the timeframe and personnel to include in the report.</p>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-end">
                        {/* Duty Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-500">
                                <Calendar className="h-3.5 w-3.5" />
                                Select Duty Chart
                            </Label>
                            <Select value={selectedDuty} onValueChange={handleDutyChange}>
                                <SelectTrigger className="w-full bg-white h-9 text-xs font-medium">
                                    <SelectValue placeholder="-- Select Duty Chart --" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-xs">-- Select Duty --</SelectItem>
                                    {dutyOptions.map((d) => (
                                        <SelectItem key={d.id} value={d.id.toString()} className="text-xs">
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-500">
                                <Calendar className="h-3.5 w-3.5" />
                                Custom Date Range
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-white h-9 text-xs font-medium"
                                    title="From Date"
                                />
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="bg-white h-9 text-xs font-medium"
                                    title="To Date"
                                />
                            </div>
                        </div>

                        {/* User Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-500">
                                <Users className="h-3.5 w-3.5" />
                                Personnel Selection
                            </Label>

                            <div className="flex gap-2">
                                <div className="flex items-center space-x-2 w-fit px-3 bg-muted/50 rounded-md border h-9 shrink-0">
                                    <Checkbox
                                        id="all-users"
                                        checked={selectAllUsers}
                                        onCheckedChange={(checked) => {
                                            setSelectAllUsers(checked === true);
                                            if (checked) setSelectedUsers([]);
                                        }}
                                    />
                                    <Label htmlFor="all-users" className="cursor-pointer font-bold whitespace-nowrap text-[10px] uppercase">All</Label>
                                </div>

                                {me && me.is_staff ? (
                                    <div className="relative flex-1" ref={dropdownRef}>
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="w-full justify-between bg-white text-left font-medium h-9 text-xs"
                                            disabled={selectAllUsers}
                                            onClick={() => setDropdownOpen((p) => !p)}
                                        >
                                            <span className="truncate">
                                                {selectedUsers.length === 0
                                                    ? "Select Employee"
                                                    : `${selectedUsers.length} selected`}
                                            </span>
                                            <Users className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
                                        </Button>

                                        {dropdownOpen && !selectAllUsers && (
                                            <Card className="absolute z-50 mt-1 w-full shadow-2xl animate-in fade-in zoom-in duration-200 min-w-[250px]">
                                                <div className="p-2 border-b">
                                                    <Input
                                                        placeholder="Search employees..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="h-8 text-xs"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-2">
                                                    {users
                                                        .filter(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                        .map((u) => (
                                                            <div key={u.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-sm transition-colors cursor-pointer text-xs">
                                                                <Checkbox
                                                                    id={`user-${u.id}`}
                                                                    checked={selectedUsers.includes(u.id)}
                                                                    onCheckedChange={() =>
                                                                        setSelectedUsers((prev) =>
                                                                            prev.includes(u.id)
                                                                                ? prev.filter((id) => id !== u.id)
                                                                                : [...prev, u.id]
                                                                        )
                                                                    }
                                                                />
                                                                <Label
                                                                    htmlFor={`user-${u.id}`}
                                                                    className="w-full cursor-pointer pr-4 font-medium"
                                                                >
                                                                    {u.full_name}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    {users.filter(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                                        <div className="p-4 text-center text-muted-foreground italic text-xs">No employees found</div>
                                                    )}
                                                </div>
                                            </Card>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-2 border rounded-md bg-muted/20 text-xs h-9 flex items-center flex-1 truncate font-medium">{me?.full_name}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row gap-4 pt-6 border-t justify-center md:justify-end">
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
                            onClick={downloadReport}
                            variant="outline"
                            className="min-w-[140px] h-9 text-xs font-bold border-primary text-primary hover:bg-primary/10 shadow-sm"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download DOCX
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4 pt-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b-2 border-primary/20 pb-2">
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
                    <div className="p-20 text-center flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-lg font-medium text-muted-foreground animate-pulse font-mono tracking-widest uppercase">Fetching data...</p>
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
                    <Card className="overflow-hidden border-none shadow-xl rounded-xl">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-primary/90 text-white">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border-r border-white/10">Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border-r border-white/10">Weekday</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border-r border-white/10">Schedule</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border-r border-white/10">Time (Start - End)</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 italic font-mono">
                                    {duties.map((d, i) => (
                                        <tr key={d.id} className={cn("hover:bg-primary/5 transition-colors", i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r">{d.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground border-r">{d.weekday}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary/80 border-r">{d.schedule}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold border-r">
                                                {d.start_time.slice(0, 5)} - {d.end_time.slice(0, 5)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter shadow-sm",
                                                    d.is_completed ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"
                                                )}>
                                                    {d.is_completed ? "Completed" : "Not Finished"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}

export default UserWiseReportNew;
