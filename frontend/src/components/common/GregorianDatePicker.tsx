import * as React from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface GregorianDatePickerProps {
    value: string; // ISO yyyy-MM-dd
    onChange: (isoValue: string) => void;
    className?: string;
    placeholder?: string;
}

export function GregorianDatePicker({ value, onChange, className, placeholder = "mm/dd/yyyy" }: GregorianDatePickerProps) {
    const date = value ? parseISO(value) : undefined;

    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div
                    className={cn(
                        "flex items-center justify-between w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                        className
                    )}
                >
                    <span className={cn(!value ? "text-muted-foreground" : "text-foreground")}>
                        {date ? format(date, "MM/dd/yyyy") : "mm/dd/yyyy"}
                    </span>
                    <CalendarIcon className="h-4 w-4 opacity-50" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                        if (d) {
                            const iso = format(d, "yyyy-MM-dd");
                            onChange(iso);
                            setIsOpen(false);
                        } else {
                            onChange("");
                        }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                />
            </PopoverContent>
        </Popover>
    )
}
