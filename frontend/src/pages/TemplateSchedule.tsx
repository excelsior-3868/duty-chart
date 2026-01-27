import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Clock,
    Plus,
    ClipboardList,
    Loader2,
    Trash2,
    Pencil
} from "lucide-react";
import { createSchedule, getSchedules, deleteSchedule, updateSchedule, type Schedule } from "@/services/schedule";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const TemplateSchedule = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        start_time: '',
        end_time: '',
    });

    const [editingId, setEditingId] = useState<number | null>(null);

    const fetchTemplates = async () => {
        try {
            setFetching(true);
            const all = await getSchedules();
            // Filter for templates only
            const templates = all.filter(s => s.status === 'template');
            setSchedules(templates);
        } catch (error) {
            console.error("Failed to fetch templates:", error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSave = async () => {
        if (!formData.name || !formData.start_time || !formData.end_time) {
            toast.error("Please fill all required fields");
            return;
        }

        try {
            setLoading(true);
            if (editingId) {
                await updateSchedule(editingId, {
                    name: formData.name,
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    status: 'template'
                });
                toast.success("Schedule template updated successfully");
            } else {
                await createSchedule({
                    name: formData.name,
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    status: 'template'
                });
                toast.success("Schedule template created successfully");
            }
            setFormData({ name: '', start_time: '', end_time: '' });
            setEditingId(null);
            fetchTemplates();
        } catch (error: any) {
            console.error("Save template error:", error.response?.data);
            const data = error.response?.data;
            let errorMessage = `Failed to ${editingId ? 'update' : 'create'} template`;

            if (data) {
                if (typeof data === 'string') errorMessage = data;
                else if (data.detail) errorMessage = data.detail;
                else if (data.message) errorMessage = data.message;
                else {
                    // Collect field errors if any
                    const fieldErrors = Object.entries(data)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join(' | ');
                    if (fieldErrors) errorMessage = fieldErrors;
                }
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (schedule: Schedule) => {
        setFormData({
            name: schedule.name,
            start_time: schedule.start_time.slice(0, 5),
            end_time: schedule.end_time.slice(0, 5)
        });
        setEditingId(schedule.id);
        // Scroll to top or form if needed, but side-by-side should be visible
    };

    const cancelEdit = () => {
        setFormData({ name: '', start_time: '', end_time: '' });
        setEditingId(null);
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteSchedule(id);
            toast.success("Template deleted");
            fetchTemplates();
        } catch (error) {
            toast.error("Failed to delete template");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-primary">Schedule Template</h1>
                <p className="text-muted-foreground">Manage and configure reusable shift templates.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                            {editingId ? "Edit Template" : "Create Template"}
                        </CardTitle>
                        <CardDescription>Define a new shift timing to be used across offices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* Column 1: Schedule Name */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule Name <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="Enter schedule name (e.g. Morning Shift)"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-11"
                                />
                            </div>

                            {/* Column 2: Start and End Times side-by-side */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Time <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="time"
                                            className="h-11 pl-3 pr-10"
                                            value={formData.start_time}
                                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        />
                                        <Clock className="absolute right-3 top-3.5 h-4 w-4 text-[hsl(var(--inoc-blue))] pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Time <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="time"
                                            className="h-11 pl-3 pr-10"
                                            value={formData.end_time}
                                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        />
                                        <Clock className="absolute right-3 top-3.5 h-4 w-4 text-[hsl(var(--inoc-blue))] pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 gap-3">
                            {editingId && (
                                <Button
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    className="h-11"
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-[hsl(var(--inoc-blue))] hover:bg-[hsl(var(--inoc-blue-dark))] px-10 h-11 transition-all"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {editingId ? "Update Template" : "Create Schedule"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            Available Templates
                        </CardTitle>
                        <CardDescription>Existing global shift templates.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {fetching ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : schedules.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed rounded-lg bg-muted/50">
                                <p className="text-muted-foreground">No Schedule template found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {schedules.map((schedule) => (
                                    <div key={schedule.id} className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-lg">{schedule.name}</h3>
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Template</Badge>
                                        </div>
                                        <div className="flex items-center text-sm text-muted-foreground gap-4">
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-2 text-primary hover:bg-primary/5"
                                                onClick={() => handleEdit(schedule)}
                                            >
                                                <Pencil className="h-4 w-4 mr-1" /> Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(schedule.id)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" /> Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TemplateSchedule;
