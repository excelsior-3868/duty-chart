import React, { useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { BookOpen, Upload, Download, Eye, Loader2, Trash2, FileText, Filter, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/* ===================== TYPES ===================== */

interface HelpDocument {
    id: string;
    title: string;
    description: string;
    document_type: string;
    file: string;
    file_name: string;
    file_size: number | null;
    file_url: string | null;
    uploaded_by: number | null;
    uploaded_by_name: string;
    uploaded_at: string;
}

const DOCUMENT_TYPES = [
    { value: "document", label: "Document" },
    { value: "notice", label: "Notice" },
    { value: "circular", label: "Circular" },
    { value: "manual", label: "Manual" },
    { value: "order", label: "Order" },
    { value: "other", label: "Other" },
];

const TYPE_BADGE: Record<string, string> = {
    notice: "bg-amber-100 text-amber-700 border-amber-200",
    circular: "bg-blue-100 text-blue-700 border-blue-200",
    manual: "bg-violet-100 text-violet-700 border-violet-200",
    document: "bg-slate-100 text-slate-700 border-slate-200",
    order: "bg-rose-100 text-rose-700 border-rose-200",
    other: "bg-gray-100 text-gray-600 border-gray-200",
};

function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ===================== MODULE-LEVEL CACHE ===================== */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, { data: HelpDocument[]; at: number }> = {};

function getCached(key: string): HelpDocument[] | null {
    const entry = cache[key];
    if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.data;
    return null;
}

function setCached(key: string, data: HelpDocument[]) {
    cache[key] = { data, at: Date.now() };
}

function invalidateCache() {
    Object.keys(cache).forEach((k) => delete cache[k]);
}

/* ===================== COMPONENT ===================== */

function HelpCenter() {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const [documents, setDocuments] = useState<HelpDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState("all");

    // Upload dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [documentType, setDocumentType] = useState("document");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Edit dialog
    const [editTarget, setEditTarget] = useState<HelpDocument | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editDocumentType, setEditDocumentType] = useState("document");
    const [editFile, setEditFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    // Delete dialog
    const [deleteTarget, setDeleteTarget] = useState<HelpDocument | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Per-row action loading
    const [viewingId, setViewingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const officeName = (user?.office_name || "").toLowerCase();
    const officeIsAllowed = officeName.includes("itd") || officeName.includes("coo");
    const canManage =
        user?.role === "SUPERADMIN" ||
        ((user?.role === "NETWORK_ADMIN" || user?.role === "OFFICE_ADMIN") && officeIsAllowed);
    const canDelete = canManage;

    useEffect(() => {
        document.title = "Help Center - NT Duty Chart Management System";
        fetchDocuments();
    }, []);

    /* ================= Fetch ================= */

    async function fetchDocuments(type?: string) {
        const activeType = type ?? filterType;
        const cacheKey = activeType || "all";

        const cached = getCached(cacheKey);
        if (cached) {
            setDocuments(cached);
            return;
        }

        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (activeType && activeType !== "all") params.document_type = activeType;
            const res = await api.get("/help-center/", { params });
            const data: HelpDocument[] = res.data.results ?? res.data;
            setCached(cacheKey, data);
            setDocuments(data);
        } catch {
            toast.error("Failed to load documents.");
        } finally {
            setLoading(false);
        }
    }

    function handleFilterChange(val: string) {
        setFilterType(val);
        fetchDocuments(val);
    }

    /* ================= Edit ================= */

    function openEdit(doc: HelpDocument) {
        setEditTarget(doc);
        setEditTitle(doc.title);
        setEditDescription(doc.description);
        setEditDocumentType(doc.document_type);
        setEditFile(null);
        if (editFileInputRef.current) editFileInputRef.current.value = "";
    }

    function closeEdit() {
        setEditTarget(null);
        setEditFile(null);
        if (editFileInputRef.current) editFileInputRef.current.value = "";
    }

    async function handleSaveEdit() {
        if (!editTarget) return;
        if (!editTitle.trim()) { toast.error("Title is required."); return; }
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append("title", editTitle.trim());
            formData.append("description", editDescription.trim());
            formData.append("document_type", editDocumentType);
            if (editFile) formData.append("file", editFile);
            await api.patch(`/help-center/${editTarget.id}/`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("Document updated successfully.");
            invalidateCache();
            closeEdit();
            fetchDocuments();
        } catch (err: any) {
            if (err?.response?.status === 413) {
                toast.error("File is too large: the server rejected the upload. Please use a smaller file or contact the administrator.");
            } else {
                toast.error("Failed to update document.");
            }
        } finally {
            setSaving(false);
        }
    }

    /* ================= Upload ================= */

    function resetForm() {
        setTitle("");
        setDescription("");
        setDocumentType("document");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleUpload() {
        if (!title.trim()) { toast.error("Title is required."); return; }
        if (!selectedFile) { toast.error("Please select a file."); return; }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            formData.append("document_type", documentType);
            formData.append("file", selectedFile);
            await api.post("/help-center/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("Document uploaded successfully.");
            invalidateCache();
            setDialogOpen(false);
            resetForm();
            fetchDocuments();
        } catch (err: any) {
            if (err?.response?.status === 413) {
                toast.error("File is too large: the server rejected the upload. Please use a smaller file or contact the administrator.");
            } else {
                toast.error("Failed to upload document.");
            }
        } finally {
            setUploading(false);
        }
    }

    /* ================= View (Blob) ================= */

    async function viewDocument(doc: HelpDocument) {
        if (!doc.file_url) { toast.error("File not available."); return; }
        setViewingId(doc.id);
        try {
            const res = await api.get(doc.file_url, { responseType: "blob" });
            const contentType = res.headers["content-type"] || "application/octet-stream";
            const blob = new Blob([res.data], { type: contentType });
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);
        } catch {
            toast.error("Failed to open document.");
        } finally {
            setViewingId(null);
        }
    }

    /* ================= Download (Blob) ================= */

    async function downloadDocument(doc: HelpDocument) {
        if (!doc.file_url) { toast.error("File not available."); return; }
        setDownloadingId(doc.id);
        try {
            const res = await api.get(doc.file_url, { responseType: "blob" });
            const blob = new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = doc.file_name || doc.title;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error("Failed to download document.");
        } finally {
            setDownloadingId(null);
        }
    }

    /* ================= Delete ================= */

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/help-center/${deleteTarget.id}/`);
            toast.success("Document deleted.");
            invalidateCache();
            setDeleteTarget(null);
            fetchDocuments();
        } catch {
            toast.error("Failed to delete document.");
        } finally {
            setDeleting(false);
        }
    }

    /* ================= Render ================= */

    return (
        <div className="p-6 space-y-4">
            <PageHeader
                title="Help Center"
                subtitle="Access and manage documents, notices, circulars, and other resources."
                icon={BookOpen}
                iconColor="text-violet-500"
            />

            {/* Controls */}
            <Card className="border-primary/20 shadow-lg overflow-hidden">
                <CardHeader className="bg-primary py-3 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Document Library
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        {/* Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <Select value={filterType} onValueChange={handleFilterChange}>
                                <SelectTrigger className="w-44 h-9 text-sm border-slate-200">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {DOCUMENT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Upload button — visible only to allowed managers */}
                        {canManage && (
                            <Button
                                size="sm"
                                className="h-9 text-xs font-bold gap-2 shadow-sm"
                                onClick={() => setDialogOpen(true)}
                            >
                                <Upload className="h-4 w-4" />
                                Upload Document
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-20 flex justify-center items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="mx-auto w-14 h-14 bg-violet-50 rounded-full flex items-center justify-center mb-4">
                            <FileText className="h-7 w-7 text-violet-400" />
                        </div>
                        <h4 className="text-lg font-medium text-slate-600">No documents found</h4>
                        <p className="text-sm text-slate-400 mt-1">Upload the first document using the button above.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-primary hover:bg-primary">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="py-3 text-white font-bold text-sm w-10">#</TableHead>
                                <TableHead className="py-3 text-white font-bold text-sm">Type</TableHead>
                                <TableHead className="py-3 text-white font-bold text-sm">Document</TableHead>
                                <TableHead className="py-3 text-white font-bold text-sm">Uploaded By</TableHead>
                                <TableHead className="py-3 text-white font-bold text-sm">Size</TableHead>
                                <TableHead className="py-3 text-white font-bold text-sm">Date</TableHead>
                                <TableHead className="py-3 text-white font-bold text-sm text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {documents.map((doc, idx) => (
                                <TableRow key={doc.id} className="hover:bg-slate-50/80 border-slate-100">
                                    <TableCell className="py-3 text-xs font-mono text-slate-400 font-bold">
                                        {idx + 1}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize",
                                            TYPE_BADGE[doc.document_type] ?? TYPE_BADGE.other
                                        )}>
                                            {doc.document_type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-3 max-w-xs">
                                        <p className="font-semibold text-sm text-slate-800 truncate">{doc.title}</p>
                                        {doc.description && (
                                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{doc.description}</p>
                                        )}
                                        {doc.file_name && (
                                            <p className="text-[10px] text-slate-300 mt-0.5 font-mono truncate">{doc.file_name}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <span className="text-sm text-slate-600">{doc.uploaded_by_name}</span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <span className="text-xs text-slate-500 font-mono">{formatFileSize(doc.file_size)}</span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-700">
                                                {format(new Date(doc.uploaded_at), "MMM dd, yyyy")}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {format(new Date(doc.uploaded_at), "hh:mm a")}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {/* View */}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={viewingId === doc.id}
                                                onClick={() => viewDocument(doc)}
                                                className="h-8 px-2.5 text-xs font-bold border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                                                title="View"
                                            >
                                                {viewingId === doc.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <Eye className="h-3.5 w-3.5" />}
                                            </Button>

                                            {/* Download */}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={downloadingId === doc.id}
                                                onClick={() => downloadDocument(doc)}
                                                className="h-8 px-2.5 text-xs font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400"
                                                title="Download"
                                            >
                                                {downloadingId === doc.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <Download className="h-3.5 w-3.5" />}
                                            </Button>

                                            {/* Edit (role-gated) */}
                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openEdit(doc)}
                                                    className="h-8 px-2.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            )}

                                            {/* Delete (role-gated) */}
                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDeleteTarget(doc)}
                                                    className="h-8 px-2.5 text-xs font-bold border-rose-200 text-rose-500 hover:bg-rose-50 hover:border-rose-400"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* ================= Upload Dialog ================= */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <Upload className="h-5 w-5" />
                            Upload Document
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Title <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                placeholder="e.g. Office Notice – Jestha 2082"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Description
                            </Label>
                            <Textarea
                                placeholder="Brief description of this document…"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="text-sm resize-none h-20"
                            />
                        </div>

                        {/* Document Type */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Document Type <span className="text-rose-500">*</span>
                            </Label>
                            <Select value={documentType} onValueChange={setDocumentType}>
                                <SelectTrigger className="h-9 text-sm border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value} className="text-sm">
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* File */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                File <span className="text-rose-500">*</span>
                            </Label>
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                                    selectedFile
                                        ? "border-primary/40 bg-primary/5"
                                        : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
                                )}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {selectedFile ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <FileText className="h-6 w-6 text-primary" />
                                        <p className="text-xs font-semibold text-primary truncate max-w-full px-2">{selectedFile.name}</p>
                                        <p className="text-[10px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <Upload className="h-6 w-6 text-slate-300" />
                                        <p className="text-xs text-slate-500 font-medium">Click to select a file</p>
                                        <p className="text-[10px] text-slate-400">PDF, DOC, DOCX, XLS, images supported</p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setSelectedFile(f);
                                }}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }} className="text-sm">
                            Cancel
                        </Button>
                        <Button onClick={handleUpload} disabled={uploading} className="text-sm font-bold min-w-[120px]">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            {uploading ? "Uploading…" : "Upload"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ================= Edit Dialog ================= */}
            <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit(); }}>
                <DialogContent className="max-w-md" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <Pencil className="h-5 w-5" />
                            Edit Document
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Title <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Description
                            </Label>
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="text-sm resize-none h-20"
                            />
                        </div>

                        {/* Document Type */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Document Type <span className="text-rose-500">*</span>
                            </Label>
                            <Select value={editDocumentType} onValueChange={setEditDocumentType}>
                                <SelectTrigger className="h-9 text-sm border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value} className="text-sm">
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Replace File (optional) */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-600">
                                Replace File <span className="text-slate-400 font-normal">(optional)</span>
                            </Label>
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                                    editFile
                                        ? "border-primary/40 bg-primary/5"
                                        : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
                                )}
                                onClick={() => editFileInputRef.current?.click()}
                            >
                                {editFile ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <FileText className="h-6 w-6 text-primary" />
                                        <p className="text-xs font-semibold text-primary truncate max-w-full px-2">{editFile.name}</p>
                                        <p className="text-[10px] text-slate-400">{formatFileSize(editFile.size)}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <Upload className="h-6 w-6 text-slate-300" />
                                        <p className="text-xs text-slate-500 font-medium">Click to replace file</p>
                                        {editTarget?.file_name && (
                                            <p className="text-[10px] text-slate-400 font-mono">Current: {editTarget.file_name}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input
                                ref={editFileInputRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setEditFile(f);
                                }}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={closeEdit} className="text-sm">Cancel</Button>
                        <Button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="text-sm font-bold min-w-[120px]"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                            {saving ? "Saving…" : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ================= Delete Confirm ================= */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{deleteTarget?.title}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default HelpCenter;
