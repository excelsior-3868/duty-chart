import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSMSLogs, SMSLogItem } from "@/services/smsLogService";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Eye, Mail } from "lucide-react";

export default function SMSLogsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState<SMSLogItem | null>(null);

    // Set document title
    useEffect(() => {
        document.title = "SMS Logs - NT Duty Chart Management System";
    }, []);

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search || "");
            setPage(1); // Reset to page 1 on search
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["smsLogs", page, debouncedSearch],
        queryFn: () => getSMSLogs({
            page,
            search: debouncedSearch,
        }),
    });

    const getStatusVariant = (status: string) => {
        switch (status.toLowerCase()) {
            case "sent":
            case "success": return "default";
            case "pending":
            case "sending": return "secondary";
            case "failed":
            case "error": return "destructive";
            default: return "outline";
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary">SMS Delivery Logs</h1>
                    <p className="text-muted-foreground">Historical record of all SMS notifications sent by the system.</p>
                </div>
            </div>

            {/* Filter Card */}
            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Phone, Name or Message..."
                                className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-primary"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table Area */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center p-24 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    </div>
                ) : isError ? (
                    <div className="text-center text-red-500 p-8 bg-red-50 rounded-xl border border-red-100">
                        Failed to load SMS logs. Please try again.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {/* Pagination Controls (Top) */}
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
                                        <TableHead className="w-[160px] py-3 text-white font-bold text-sm">Timestamp</TableHead>
                                        <TableHead className="w-[180px] py-3 text-white font-bold text-sm">Recipient Name</TableHead>
                                        <TableHead className="w-[140px] py-3 text-white font-bold text-sm">Mobile Number</TableHead>
                                        <TableHead className="w-[100px] py-3 text-white font-bold text-sm">Status</TableHead>
                                        <TableHead className="py-3 text-white font-bold text-sm">Message Content</TableHead>
                                        <TableHead className="w-[80px] py-3 text-white font-bold text-sm text-right">View</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.results?.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                                            <TableCell className="whitespace-nowrap font-mono text-xs font-bold text-primary">
                                                {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-800 text-sm">
                                                {log.user_full_name || "Unknown User"}
                                            </TableCell>
                                            <TableCell className="text-sm font-bold text-primary font-mono whitespace-nowrap">
                                                {log.phone}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(log.status) as any} className="text-[10px] font-bold px-2 py-0 h-5 uppercase">
                                                    {log.status}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="max-w-[400px] py-4">
                                                <p className="text-sm leading-relaxed text-slate-700 font-medium">
                                                    {log.message}
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
                                                No SMS logs found for the selected criteria.
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
                )}
            </div>

            {/* Details Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-md border-none rounded-xl overflow-hidden shadow-2xl p-0">
                    <div className="p-6 border-b border-slate-100">
                        <DialogTitle className="text-lg font-bold text-slate-900">SMS Log Details</DialogTitle>
                        <p className="text-slate-500 text-xs mt-1">Full record of the SMS transmission</p>
                    </div>
                    {selectedLog && (
                        <div className="p-6 space-y-6 bg-white">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold">Recipient</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-slate-900">{selectedLog.user_full_name || "Unknown"}</p>
                                    </div>
                                    <p className="text-[11px] font-mono text-primary font-bold">{selectedLog.phone}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] text-slate-400 font-bold">Delivery Status</p>
                                    <div>
                                        <Badge variant={getStatusVariant(selectedLog.status) as any} className="font-bold border-none shadow-sm uppercase">
                                            {selectedLog.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold">Sent Date & Time</p>
                                    <p className="text-xs font-semibold text-slate-700 uppercase">{format(new Date(selectedLog.created_at), "MMM dd, yyyy")}</p>
                                    <p className="text-[10px] font-mono text-slate-500">{format(new Date(selectedLog.created_at), "HH:mm:ss")}</p>
                                </div>
                                <div className="col-span-2 space-y-2 pt-2 border-t border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold">Message Content</p>
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 leading-relaxed font-semibold italic shadow-inner">
                                        "{selectedLog.message}"
                                    </div>
                                </div>
                                {selectedLog.response_raw && (
                                    <div className="col-span-2 space-y-2">
                                        <p className="text-[10px] text-slate-400 font-bold">Gateway Response</p>
                                        <pre className="p-3 bg-slate-900 text-slate-300 rounded-lg text-[10px] overflow-x-auto font-mono">
                                            {selectedLog.response_raw}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button className="px-8 rounded-full font-bold text-xs" onClick={() => setSelectedLog(null)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
