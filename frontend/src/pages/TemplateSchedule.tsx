import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/context/AuthContext";
import { TimePicker } from "@/components/common/TimePicker";


const TemplateSchedule = () => {
    const { hasPermission } = useAuth();

    const queryClient = useQueryClient();

    const [loading, setLoading] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        start_time: '',
        end_time: '',
        shift_type: '',
        alias: '',
    });

    const [editingId, setEditingId] = useState<number | null>(null);

    const { data: allSchedules = [], isLoading: fetching } = useQuery({
        queryKey: ['schedules', 'all'],
        queryFn: () => getSchedules(),
        staleTime: 5 * 60 * 1000,
    });

    const schedules = allSchedules.filter((s: Schedule) => s.status === 'template');

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
                    shift_type: formData.shift_type,
                    alias: formData.alias,
                    status: 'template'
                });
                toast.success("Schedule updated successfully");
            } else {
                await createSchedule({
                    name: formData.name,
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    shift_type: formData.shift_type,
                    alias: formData.alias,
                    status: 'template'
                });
                toast.success("Schedule created successfully");
            }
            setFormData({ name: '', start_time: '', end_time: '', shift_type: '', alias: '' });
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['schedules', 'all'] });
        } catch (error: any) {
            console.error("Save template error:", error.response?.data);
            const data = error.response?.data;
            let errorMessage = `Failed to ${editingId ? 'update' : 'create'} schedule`;

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
            end_time: schedule.end_time.slice(0, 5),
            shift_type: schedule.shift_type || '',
            alias: schedule.alias || ''
        });
        setEditingId(schedule.id);
    };

    const cancelEdit = () => {
        setFormData({ name: '', start_time: '', end_time: '', shift_type: '', alias: '' });
        setEditingId(null);
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteSchedule(id);
            toast.success("Template deleted");
            queryClient.invalidateQueries({ queryKey: ['schedules', 'all'] });
        } catch (error) {
            toast.error("Failed to delete template");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-primary">Duty Schedule Template</h1>
                <p className="text-muted-foreground">Manage and configure reusable shift templates.</p>
            </div>

            <div className={`grid grid-cols-1 ${hasPermission('schedule_templates.create') ? 'xl:grid-cols-2' : ''} gap-6`}>
                {hasPermission('schedule_templates.create') && (
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                                {editingId ? "Edit Duty Schedule Template" : "Create Duty Schedule Template"}
                            </CardTitle>
                            <CardDescription>Define a new shift timing to be used as a template across offices.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Schedule Name */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Schedule Name <span className="text-destructive">*</span></Label>
                                    <Input
                                        placeholder="Enter schedule name (e.g. Morning Shift)"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="h-10"
                                    />
                                </div>

                                {/* Placeholder for Office alignment in DutyHoursCard */}
                                <div className="hidden md:block"></div>

                                {/* Alias / Code */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Shift Alias / Code</Label>
                                    <Input
                                        placeholder="e.g. MS"
                                        value={formData.alias}
                                        onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                                        className="h-10"
                                    />
                                </div>

                                {/* Shift Type */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Shift Type</Label>
                                    <Select
                                        value={formData.shift_type}
                                        onValueChange={(val) => setFormData({ ...formData, shift_type: val })}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Regular">Regular</SelectItem>
                                            <SelectItem value="Shift">Shift</SelectItem>
                                            <SelectItem value="OnCall">OnCall</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Start Time */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Start Time <span className="text-destructive">*</span></Label>
                                    <TimePicker
                                        value={formData.start_time}
                                        onChange={(val) => setFormData({ ...formData, start_time: val })}
                                    />
                                </div>

                                {/* End Time */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">End Time <span className="text-destructive">*</span></Label>
                                    <TimePicker
                                        value={formData.end_time}
                                        onChange={(val) => setFormData({ ...formData, end_time: val })}
                                    />
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
                                    className="bg-primary hover:bg-primary-hover px-10 h-11 transition-all"
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingId ? "Update Duty Schedule Template" : "Create Duty Schedule Template"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}


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
                                <p className="text-muted-foreground">No Duty Schedule template found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {schedules.map((schedule) => (
                                    <div key={schedule.id} className="p-3 border rounded-lg bg-card hover:shadow-md transition-shadow relative group">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <h3 className="font-semibold text-sm truncate pr-2">{schedule.name}</h3>
                                            <Badge variant="outline" className="text-[10px] h-4 bg-primary/5 text-primary border-primary/20 px-1.5">Template</Badge>
                                        </div>
                                        <div className="flex items-center text-xs text-muted-foreground gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-1 font-medium bg-secondary/30 px-2 py-0.5 rounded">
                                                <Clock className="h-3 w-3" />
                                                {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                            </div>
                                            {schedule.alias && (
                                                <Badge variant="secondary" className="text-[10px] h-5 font-normal">
                                                    Code: {schedule.alias}
                                                </Badge>
                                            )}
                                            {schedule.shift_type && (
                                                <Badge variant="outline" className="text-[10px] h-5 font-normal">
                                                    Type: {schedule.shift_type}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {hasPermission('schedule_templates.edit') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-2 text-primary hover:bg-primary/5"
                                                    onClick={() => handleEdit(schedule)}
                                                >
                                                    <Pencil className="h-4 w-4 mr-1" /> Edit
                                                </Button>
                                            )}
                                            {hasPermission('schedule_templates.delete') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(schedule.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                                </Button>
                                            )}

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
