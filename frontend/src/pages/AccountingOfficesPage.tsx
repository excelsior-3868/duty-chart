import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getAccountingOffices,
    createAccountingOffice,
    updateAccountingOffice,
    deleteAccountingOffice,
    AccountingOffice,
    AccountingOfficeResponse,
} from "@/services/accountingOffices";
import {
    getDirectorates,
    Directorate,
} from "@/services/directorates";
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
    DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    Loader2,
    Plus,
    Edit3,
    Trash2,
    Building2,
    AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function AccountingOfficesPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedOffice, setSelectedOffice] = useState<AccountingOffice | null>(null);

    // Debounce search
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    // Form states
    const [formData, setFormData] = useState({
        name: "",
        directorate: null as number | null,
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ["accounting-offices", page, debouncedSearch],
        queryFn: () => getAccountingOffices({ page, search: debouncedSearch }) as Promise<AccountingOfficeResponse>,
    });

    const { data: directorates } = useQuery({
        queryKey: ["directorates", "all"],
        queryFn: () => getDirectorates({ all: true }) as Promise<Directorate[]>,
    });

    const offices = data?.results || [];

    const createMutation = useMutation({
        mutationFn: createAccountingOffice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["accounting-offices"] });
            setIsAddModalOpen(false);
            resetForm();
            toast.success("Accounting Office created successfully");
        },
        onError: () => toast.error("Failed to create accounting office"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            updateAccountingOffice(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["accounting-offices"] });
            setIsEditModalOpen(false);
            setSelectedOffice(null);
            resetForm();
            toast.success("Accounting Office updated successfully");
        },
        onError: () => toast.error("Failed to update accounting office"),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAccountingOffice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["accounting-offices"] });
            setIsDeleteModalOpen(false);
            setSelectedOffice(null);
            toast.success("Accounting Office deleted successfully");
        },
        onError: () => toast.error("Failed to delete accounting office"),
    });

    const resetForm = () => {
        setFormData({
            name: "",
            directorate: null,
        });
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        createMutation.mutate(formData as any);
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOffice || !formData.name.trim()) return;
        updateMutation.mutate({
            id: selectedOffice.id,
            data: formData,
        });
    };

    const handleDelete = () => {
        if (!selectedOffice) return;
        deleteMutation.mutate(selectedOffice.id);
    };

    const openEdit = (office: AccountingOffice) => {
        setSelectedOffice(office);
        setFormData({
            name: office.name,
            directorate: office.directorate,
        });
        setIsEditModalOpen(true);
    };

    const openDelete = (office: AccountingOffice) => {
        setSelectedOffice(office);
        setIsDeleteModalOpen(true);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Accounting Offices</h1>
                    <p className="text-muted-foreground text-sm">Manage accounting offices and their directorate mapping.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="gap-2 shadow-sm whitespace-nowrap">
                    <Plus className="h-4 w-4" /> Add Office
                </Button>
            </div>

            {/* Filter Card */}
            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search offices..."
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
                            <p className="text-xs font-medium text-slate-400">Loading offices...</p>
                        </div>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-xl border border-red-100 text-center gap-3">
                        <AlertCircle className="h-10 w-10 text-red-400" />
                        <div>
                            <p className="text-red-800 font-bold">Failed to load offices</p>
                            <p className="text-red-600/70 text-sm">Please check your connection or permissions.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["accounting-offices"] })} className="mt-2 border-red-200 text-red-700 hover:bg-red-100">
                            Try Again
                        </Button>
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
                                            <TableHead className="w-[80px] py-3 text-white font-bold pl-6 text-sm">ID</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm">Office Name</TableHead>
                                            <TableHead className="py-3 text-white font-bold text-sm">Directorate</TableHead>
                                            <TableHead className="w-[120px] py-3 text-white font-bold text-sm text-right pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {offices?.map((office) => (
                                            <TableRow key={office.id} className="hover:bg-slate-50/80 transition-colors border-slate-100 group">
                                                <TableCell className="font-mono text-xs font-bold text-primary pl-6">
                                                    #{office.id}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                                            <Building2 className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <span className="font-medium text-slate-800 text-sm tracking-tight">
                                                            {office.name}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-slate-600">
                                                        {office.directorate_name || "None"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                                                            onClick={() => openEdit(office)}
                                                        >
                                                            <Edit3 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                            onClick={() => openDelete(office)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {offices && offices.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-48 text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Building2 className="h-10 w-10 text-slate-100" />
                                                        <p className="font-medium italic">No matching offices found.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
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

            {/* Add Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[425px] border-none shadow-2xl overflow-hidden rounded-2xl p-0">
                    <div className="p-6 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold text-slate-900">New Accounting Office</DialogTitle>
                        <p className="text-slate-500 text-xs mt-1">Create a new accounting office.</p>
                    </div>
                    <form onSubmit={handleAdd} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-bold text-slate-500">
                                Office Name
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g. Accounting Centre X"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-slate-50/50 border-slate-200 focus-visible:ring-primary h-11"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Directorate</Label>
                            <Select
                                value={formData.directorate ? String(formData.directorate) : "none"}
                                onValueChange={(val) => setFormData({ ...formData, directorate: val === "none" ? null : Number(val) })}
                            >
                                <SelectTrigger className="bg-slate-50/50 border-slate-200 h-11">
                                    <SelectValue placeholder="Select Directorate" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {directorates?.map(d => (
                                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-50 gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending || !formData.name.trim()} className="px-8 bg-primary hover:bg-primary/90">
                                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                Create Office
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[425px] border-none shadow-2xl overflow-hidden rounded-2xl p-0">
                    <div className="p-6 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold text-slate-900">Edit Accounting Office</DialogTitle>
                        <p className="text-slate-500 text-xs mt-1">Modify the details of the accounting office.</p>
                    </div>
                    <form onSubmit={handleEdit} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-xs font-bold text-slate-500">
                                Office Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-slate-50/50 border-slate-200 focus-visible:ring-primary h-11"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Directorate</Label>
                            <Select
                                value={formData.directorate ? String(formData.directorate) : "none"}
                                onValueChange={(val) => setFormData({ ...formData, directorate: val === "none" ? null : Number(val) })}
                            >
                                <SelectTrigger className="bg-slate-50/50 border-slate-200 h-11">
                                    <SelectValue placeholder="Select Directorate" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {directorates?.map(d => (
                                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-50 gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={updateMutation.isPending || !formData.name.trim()} className="px-8 bg-primary hover:bg-primary/90">
                                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent className="sm:max-w-[400px] border-none shadow-2xl overflow-hidden rounded-2xl p-0">
                    <div className="p-6 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                            Confirm Delete
                        </DialogTitle>
                        <p className="text-slate-500 text-xs mt-1">This action cannot be undone.</p>
                    </div>
                    <div className="p-6">
                        <p className="text-slate-600 text-sm leading-relaxed">
                            Are you sure you want to delete the office <span className="font-bold text-slate-900">"{selectedOffice?.name}"</span>?
                        </p>
                        <div className="mt-8 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} className="px-8">
                                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete Permanently
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

