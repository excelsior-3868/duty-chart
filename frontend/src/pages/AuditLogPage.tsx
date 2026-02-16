import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs, AuditLogItem } from "@/services/auditLogService";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Eye } from "lucide-react";

export default function AuditLogPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState<string>("ALL");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    // Set document title
    useEffect(() => {
        document.title = "System Audit Logs - NT Duty Chart Management System";
    }, []);

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on search
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["auditLogs", page, debouncedSearch, actionFilter, startDate, endDate],
        queryFn: () => getAuditLogs({
            page,
            search: debouncedSearch,
            action: actionFilter === "ALL" ? undefined : actionFilter,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
        }),
    });

    const getActionColor = (action: string) => {
        switch (action) {
            case "CREATE": return "default";
            case "UPDATE": return "secondary";
            case "DELETE": return "destructive";
            case "LOGIN": return "outline";
            case "LOGOUT": return "outline";
            default: return "secondary";
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary">System Audit Logs</h1>
                    <p className="text-muted-foreground">Detailed history of all system operations.</p>
                </div>
            </div>

            {/* Filter Card */}
            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:flex-1qq">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, ID, details..."
                                className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto whitespace-nowrap">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:block">Filter:</span>

                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    className="w-[140px] bg-slate-50/50 border-slate-200 text-xs"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                    max={endDate || undefined}
                                />
                                <span className="text-slate-400">-</span>
                                <Input
                                    type="date"
                                    className="w-[140px] bg-slate-50/50 border-slate-200 text-xs"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                    min={startDate || undefined}
                                />
                            </div>

                            <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(1); }}>
                                <SelectTrigger className="w-full md:w-[150px] bg-slate-50/50 border-slate-200 text-xs">
                                    <SelectValue placeholder="Action Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Actions</SelectItem>
                                    <SelectItem value="CREATE">Create</SelectItem>
                                    <SelectItem value="UPDATE">Update</SelectItem>
                                    <SelectItem value="DELETE">Delete</SelectItem>
                                    <SelectItem value="LOGIN">Login</SelectItem>
                                    <SelectItem value="LOGOUT">Logout</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table Area (No Outer Card) */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center p-24 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    </div>
                ) : isError ? (
                    <div className="text-center text-red-500 p-8 bg-red-50 rounded-xl border border-red-100">
                        Failed to load system logs. Please try again.
                    </div>
                ) : (
                    <>
                        {/* Pagination Controls (Top) */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-2">
                                <p className="text-xs text-slate-500 font-medium">
                                    Showing {((data?.results?.length || 0) > 0) ? (page - 1) * 15 + 1 : 0} to {Math.min(page * 15, data?.count || 0)} of {data?.count || 0} entries
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                    >
                                        &laquo; Prev
                                    </Button>

                                    {/* Page Numbers */}
                                    {(() => {
                                        const totalPages = Math.ceil((data?.count || 0) / 15) || 1;
                                        const pages = [];
                                        const maxVisible = 5;
                                        let start = Math.max(1, page - Math.floor(maxVisible / 2));
                                        let end = Math.min(totalPages, start + maxVisible - 1);

                                        if (end - start + 1 < maxVisible) {
                                            start = Math.max(1, end - maxVisible + 1);
                                        }

                                        for (let i = start; i <= end; i++) {
                                            pages.push(
                                                <Button
                                                    key={i}
                                                    variant={page === i ? "default" : "outline"}
                                                    size="sm"
                                                    className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${page === i
                                                        ? "bg-primary text-white hover:bg-primary/90 border-primary"
                                                        : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                                        }`}
                                                    onClick={() => setPage(i)}
                                                    disabled={isLoading}
                                                >
                                                    {i}
                                                </Button>
                                            );
                                        }
                                        return pages;
                                    })()}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                        onClick={() => setPage((p) => Math.min(Math.ceil((data?.count || 0) / 15) || 1, p + 1))}
                                        disabled={page === (Math.ceil((data?.count || 0) / 15) || 1) || isLoading}
                                    >
                                        Next &raquo;
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-primary hover:bg-primary">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="w-[180px] py-3 text-white font-bold text-sm">Timestamp</TableHead>
                                            <TableHead className="w-[200px] py-3 text-white font-bold text-sm">Employee Name</TableHead>
                                            <TableHead className="w-[120px] py-3 text-white font-bold text-sm">Employee ID</TableHead>
                                            <TableHead className="w-[100px] py-3 text-white font-bold text-sm">Action</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm">Operation Details</TableHead>
                                            <TableHead className="w-[80px] py-3 text-white font-bold text-sm text-right">View</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data?.results?.map((log) => (
                                            <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                                                <TableCell className="whitespace-nowrap font-mono text-xs font-bold text-primary">
                                                    {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-slate-800 text-sm">
                                                        {log.actor_full_name || log.actor_userid || "System"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {log.actor_employee_id ? (
                                                        <span className="text-xs font-bold text-primary font-mono">
                                                            {log.actor_employee_id}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-medium italic">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getActionColor(log.action) as any} className="text-[10px] font-bold px-2 py-0 h-5">
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="max-w-[400px] py-4">
                                                    <p className="text-sm leading-relaxed text-slate-600">
                                                        {log.details || "-"}
                                                    </p>
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setSelectedLog(log)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {data?.results && data.results.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-32 text-slate-400 font-medium italic">
                                                    No system activities found for the selected criteria.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls (Bottom) */}
                            <div className="flex items-center justify-between px-2">
                                <p className="text-xs text-slate-500 font-medium">
                                    Showing {((data?.results?.length || 0) > 0) ? (page - 1) * 15 + 1 : 0} to {Math.min(page * 15, data?.count || 0)} of {data?.count || 0} entries
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                    >
                                        &laquo; Prev
                                    </Button>

                                    {/* Page Numbers */}
                                    {(() => {
                                        const totalPages = Math.ceil((data?.count || 0) / 15) || 1;
                                        const pages = [];
                                        const maxVisible = 5;
                                        let start = Math.max(1, page - Math.floor(maxVisible / 2));
                                        let end = Math.min(totalPages, start + maxVisible - 1);

                                        if (end - start + 1 < maxVisible) {
                                            start = Math.max(1, end - maxVisible + 1);
                                        }

                                        for (let i = start; i <= end; i++) {
                                            pages.push(
                                                <Button
                                                    key={i}
                                                    variant={page === i ? "default" : "outline"}
                                                    size="sm"
                                                    className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${page === i
                                                        ? "bg-primary text-white hover:bg-primary/90 border-primary"
                                                        : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                                        }`}
                                                    onClick={() => setPage(i)}
                                                    disabled={isLoading}
                                                >
                                                    {i}
                                                </Button>
                                            );
                                        }
                                        return pages;
                                    })()}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                        onClick={() => setPage((p) => Math.min(Math.ceil((data?.count || 0) / 15) || 1, p + 1))}
                                        disabled={page === (Math.ceil((data?.count || 0) / 15) || 1) || isLoading}
                                    >
                                        Next &raquo;
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Details Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-md border-none rounded-xl overflow-hidden shadow-2xl p-0">
                    <div className="p-6 border-b border-slate-100">
                        <DialogTitle className="text-lg font-bold text-slate-900">Activity Log Details</DialogTitle>
                        <p className="text-slate-500 text-xs mt-1">Full record of the selected system operation</p>
                    </div>
                    {selectedLog && (
                        <div className="p-6 space-y-6 bg-white">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold">Performed By</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-slate-900">{selectedLog.actor_full_name || "System"}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-mono text-slate-500">@{selectedLog.actor_userid}</span>
                                        {selectedLog.actor_employee_id && (
                                            <span className="text-[9px] bg-slate-100 px-1 rounded font-bold">#{selectedLog.actor_employee_id}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] text-slate-400 font-bold">Action Type</p>
                                    <div>
                                        <Badge variant={getActionColor(selectedLog.action) as any} className="font-bold border-none shadow-sm capitalize">
                                            {selectedLog.action.toLowerCase()}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold">Date & Time</p>
                                    <p className="text-xs font-semibold text-slate-700 uppercase">{format(new Date(selectedLog.timestamp), "MMM dd, yyyy")}</p>
                                    <p className="text-[10px] font-mono text-slate-500">{format(new Date(selectedLog.timestamp), "HH:mm:ss")}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold">Source IP</p>
                                    <p className="text-xs font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 w-fit">{selectedLog.ip_address || "None"}</p>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold">Operation Summary</p>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 leading-relaxed font-semibold italic shadow-inner">
                                    "{selectedLog.details || "No descriptive details available."}"
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button className="px-8 rounded-full font-bold text-xs" onClick={() => setSelectedLog(null)}>
                                    Acknowledge
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog >
        </div >
    );
}
