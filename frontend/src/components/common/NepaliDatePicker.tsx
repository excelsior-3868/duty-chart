import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import NepaliDate from "nepali-date-converter";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";

interface NepaliDatePickerProps {
    value: string; // ISO yyyy-MM-dd
    onChange: (isoValue: string) => void;
    className?: string;
    label?: string;
    id?: string;
}

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
    value,
    onChange,
    className,
    label,
    id
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Derive current view (month/year) from value or current date
    const [viewDate, setViewDate] = useState(() => {
        if (value) return new NepaliDate(new Date(value));
        return new NepaliDate();
    });

    const selectedND = useMemo(() => {
        if (!value) return null;
        try {
            return new NepaliDate(new Date(value));
        } catch {
            return null;
        }
    }, [value]);

    const year = viewDate.getYear();
    const month = viewDate.getMonth();

    const monthNames = [
        "Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin",
        "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
    ];

    const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    // Calculate days in current month
    const daysInMonth = useMemo(() => {
        let days = 28;
        while (days < 33) {
            try {
                const next = new NepaliDate(year, month, days + 1);
                if (next.getMonth() !== month) break;
                days++;
            } catch {
                break;
            }
        }
        return days;
    }, [year, month]);

    // First day of month (0-6)
    const firstDayOfMonth = useMemo(() => {
        try {
            return new NepaliDate(year, month, 1).getDay();
        } catch {
            return 0;
        }
    }, [year, month]);

    const handlePrevMonth = () => {
        const newDate = new NepaliDate(year, month, 1);
        if (month === 0) {
            newDate.setYear(year - 1);
            newDate.setMonth(11);
        } else {
            newDate.setMonth(month - 1);
        }
        setViewDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new NepaliDate(year, month, 1);
        if (month === 11) {
            newDate.setYear(year + 1);
            newDate.setMonth(0);
        } else {
            newDate.setMonth(month + 1);
        }
        setViewDate(newDate);
    };

    const handleSelectDay = (day: number) => {
        try {
            const selected = new NepaliDate(year, month, day);
            const adDate = selected.toJsDate();
            const iso = format(adDate, "yyyy-MM-dd");
            onChange(iso);
            setIsOpen(false);
        } catch (e) {
            console.error("Failed to select Nepali date:", e);
        }
    };

    const isSelected = (day: number) => {
        return selectedND &&
            selectedND.getYear() === year &&
            selectedND.getMonth() === month &&
            selectedND.getDate() === day;
    };

    const isToday = (day: number) => {
        const today = new NepaliDate();
        return today.getYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day;
    };

    const formattedValue = useMemo(() => {
        if (!selectedND) return "";
        const m = (selectedND.getMonth() + 1).toString().padStart(2, '0');
        const d = selectedND.getDate().toString().padStart(2, '0');
        return `${m}/${d}/${selectedND.getYear()}`;
    }, [selectedND]);

    return (
        <div className={cn("w-full", className)}>
            {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <div
                        id={id}
                        className="flex items-center justify-between w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        <span className={cn(!value ? "text-muted-foreground" : "text-foreground")}>
                            {formattedValue || "mm/dd/yyyy"}
                        </span>
                        <CalendarIcon className="h-4 w-4 opacity-50" />
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3">
                        <div className="flex justify-center pt-1 relative items-center mb-4">
                            <div className="text-sm font-medium">{monthNames[month]} {year}</div>
                            <div className="flex items-center space-x-1 absolute right-0">
                                <Button
                                    variant="outline"
                                    className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                                    onClick={handlePrevMonth}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                                    onClick={handleNextMonth}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <table className="w-full border-collapse space-y-1">
                            <thead>
                                <tr className="flex">
                                    {daysOfWeek.map(d => (
                                        <th key={d} className="text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]">
                                            {d}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="block mt-2">
                                {/* Since table structure is tricky with just rows, we'll use a flex/grid approach inside tbody or just rows */}
                                {Array.from({ length: Math.ceil((firstDayOfMonth + daysInMonth) / 7) }).map((_, rowIndex) => (
                                    <tr key={rowIndex} className="flex w-full mt-2">
                                        {Array.from({ length: 7 }).map((_, colIndex) => {
                                            const dayIndex = rowIndex * 7 + colIndex;
                                            const day = dayIndex - firstDayOfMonth + 1;
                                            if (day <= 0 || day > daysInMonth) {
                                                return <td key={colIndex} className="h-9 w-9 text-center text-sm p-0 relative" />;
                                            }
                                            const active = isSelected(day);
                                            const today = isToday(day);
                                            return (
                                                <td key={colIndex} className="h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20">
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                                                            active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                                                            today && !active && "bg-accent text-accent-foreground"
                                                        )}
                                                        onClick={() => handleSelectDay(day)}
                                                    >
                                                        {day}
                                                    </Button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex items-center justify-between border-t mt-4 pt-2">
                            <Button
                                variant="link"
                                className="px-0 h-auto text-xs font-normal"
                                onClick={() => {
                                    const today = new NepaliDate();
                                    setViewDate(today);
                                    handleSelectDay(today.getDate());
                                }}
                            >
                                Today
                            </Button>
                            <Button
                                variant="link"
                                className="px-0 h-auto text-xs font-normal text-muted-foreground"
                                onClick={() => {
                                    onChange("");
                                    setIsOpen(false);
                                }}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};
