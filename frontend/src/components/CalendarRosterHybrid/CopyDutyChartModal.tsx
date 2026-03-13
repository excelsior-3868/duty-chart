import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOffices, type Office } from "@/services/offices";
import { getDutyCharts, copyDutyChart, type DutyChart } from "@/services/dutichart";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface CopyDutyChartModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCopied?: (chart: DutyChart) => void;
}

const CopyDutyChartModal: React.FC<CopyDutyChartModalProps> = ({ open, onOpenChange, onCopied }) => {
    const { user, hasPermission } = useAuth();
    const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");
    const [offices, setOffices] = useState<Office[]>([]);
    const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [openOffice, setOpenOffice] = useState(false);
    const [openChart, setOpenChart] = useState(false);

    const [formData, setFormData] = useState({
        office: "",
        source_chart_id: "",
        name: "",
        effective_date: "",
        end_date: "",
    });

    useEffect(() => {
        if (open) {
            const loadOffices = async () => {
                try {
                    const res = await getOffices();
                    setOffices(res);
                    // Auto-select user's office if available
                    if (user?.office_id) {
                        setFormData(prev => ({ ...prev, office: String(user.office_id) }));
                    }
                } catch (e) {
                    console.error("Failed to load offices", e);
                }
            };
            loadOffices();
        }
    }, [open, user]);

    useEffect(() => {
        const fetchCharts = async () => {
            if (formData.office) {
                try {
                    const res = await getDutyCharts(parseInt(formData.office));
                    setDutyCharts(res);
                    setFormData(prev => ({ ...prev, source_chart_id: "" }));
                } catch (e) {
                    console.error("Failed to fetch duty charts", e);
                    setDutyCharts([]);
                }
            } else {
                setDutyCharts([]);
            }
        };
        fetchCharts();
    }, [formData.office]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.source_chart_id || !formData.effective_date) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await copyDutyChart({
                source_chart_id: parseInt(formData.source_chart_id),
                office: parseInt(formData.office),
                name: formData.name,
                effective_date: formData.effective_date,
                end_date: formData.end_date || undefined,
            });
            toast.success("Duty Chart copied successfully!");
            onCopied?.(result);
            onOpenChange(false);
            setFormData({
                office: "",
                source_chart_id: "",
                name: "",
                effective_date: "",
                end_date: "",
            });
        } catch (error: any) {
            console.error("Failed to copy duty chart:", error);
            const msg = error.response?.data?.detail || "An error occurred while copying the duty chart.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = "text-sm font-medium text-[hsl(var(--title))]";
    const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-xl overflow-hidden p-0">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mr-6">
                        <div>
                            <DialogTitle>Copy Duty Chart</DialogTitle>
                            <DialogDescription>
                                Duplicate an existing duty roster with shifted dates.
                            </DialogDescription>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                            <button
                                type="button"
                                onClick={() => setDateMode("BS")}
                                className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                BS
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateMode("AD")}
                                className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                AD
                            </button>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelClass}>Office *</label>
                            <Popover open={openOffice} onOpenChange={setOpenOffice}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openOffice}
                                        className="w-full justify-between h-10 border-[hsl(var(--gray-300))]"
                                    >
                                        <span className="truncate">
                                            {formData.office ? offices.find(o => String(o.id) === formData.office)?.name : "Select Office"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search office..." />
                                        <CommandList>
                                            <CommandEmpty>No office found.</CommandEmpty>
                                            <CommandGroup>
                                                {offices
                                                    .filter(office => {
                                                        if (hasPermission('duties.create_any_office_chart')) return true;
                                                        const allowedIds = [user?.office_id, ...(user?.secondary_offices || [])].filter(Boolean).map(id => Number(id));
                                                        return allowedIds.includes(Number(office.id));
                                                    })
                                                    .map((office) => (
                                                        <CommandItem
                                                            key={office.id}
                                                            value={office.name}
                                                            onSelect={() => {
                                                                handleInputChange("office", String(office.id));
                                                                setOpenOffice(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", formData.office === String(office.id) ? "opacity-100" : "opacity-0")} />
                                                            {office.name}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClass}>Source Chart *</label>
                            <Popover open={openChart} onOpenChange={setOpenChart}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openChart}
                                        disabled={!formData.office}
                                        className="w-full justify-between h-10 border-[hsl(var(--gray-300))]"
                                    >
                                        <span className="truncate">
                                            {formData.source_chart_id ? dutyCharts.find(c => String(c.id) === formData.source_chart_id)?.name : "Select Source"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search chart..." />
                                        <CommandList>
                                            <CommandEmpty>No chart found.</CommandEmpty>
                                            <CommandGroup>
                                                {dutyCharts.map((chart) => (
                                                    <CommandItem
                                                        key={chart.id}
                                                        value={chart.name || "Untitled"}
                                                        onSelect={() => {
                                                            handleInputChange("source_chart_id", String(chart.id));
                                                            if (!formData.name) {
                                                                handleInputChange("name", `Copy of ${chart.name}`);
                                                            }
                                                            setOpenChart(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", formData.source_chart_id === String(chart.id) ? "opacity-100" : "opacity-0")} />
                                                        {chart.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelClass}>New Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                            placeholder="e.g., April Rotation"
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelClass}>New Effective Date *</label>
                            {dateMode === "AD" ? (
                                <GregorianDatePicker
                                    value={formData.effective_date}
                                    onChange={(val) => handleInputChange("effective_date", val)}
                                />
                            ) : (
                                <NepaliDatePicker
                                    value={formData.effective_date}
                                    onChange={(val) => handleInputChange("effective_date", val)}
                                />
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className={labelClass}>New End Date</label>
                            {dateMode === "AD" ? (
                                <GregorianDatePicker
                                    value={formData.end_date}
                                    onChange={(val) => handleInputChange("end_date", val)}
                                />
                            ) : (
                                <NepaliDatePicker
                                    value={formData.end_date}
                                    onChange={(val) => handleInputChange("end_date", val)}
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-primary text-white hover:bg-primary-hover"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Copying...
                                </>
                            ) : (
                                "Copy Duty Chart"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CopyDutyChartModal;
