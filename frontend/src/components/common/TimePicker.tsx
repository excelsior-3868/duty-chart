import React, { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimePickerProps {
    value: string; // HH:mm (24h format)
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({
    value,
    onChange,
    className,
    disabled = false
}) => {
    const [hour, setHour] = useState("12");
    const [minute, setMinute] = useState("00");
    const [period, setPeriod] = useState("AM");

    // Initialize from value (24h HH:mm)
    useEffect(() => {
        if (value && value.includes(":")) {
            const [h24, m] = value.split(":");
            let h12 = parseInt(h24);
            const p = h12 >= 12 ? "PM" : "AM";

            h12 = h12 % 12;
            if (h12 === 0) h12 = 12;

            setHour(String(h12).padStart(2, "0"));
            setMinute(m);
            setPeriod(p);
        } else {
            setHour("");
            setMinute("");
            setPeriod("");
        }
    }, [value]);

    const handleTimeChange = (h: string, m: string, p: string) => {
        if (!h || !m || !p) return;
        let h24 = parseInt(h);
        if (p === "PM" && h24 < 12) h24 += 12;
        if (p === "AM" && h24 === 12) h24 = 0;

        const formattedH = String(h24).padStart(2, "0");
        onChange(`${formattedH}:${m}`);
    };

    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <Select
                disabled={disabled}
                value={hour}
                onValueChange={(val) => {
                    setHour(val);
                    handleTimeChange(val, minute, period);
                }}
            >
                <SelectTrigger className="w-[80px] h-10 px-2 focus:ring-0">
                    <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                    {hours.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <span className="text-gray-400 font-bold">:</span>

            <Select
                disabled={disabled}
                value={minute}
                onValueChange={(val) => {
                    setMinute(val);
                    handleTimeChange(hour, val, period);
                }}
            >
                <SelectTrigger className="w-[80px] h-10 px-2 focus:ring-0">
                    <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                    {minutes.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                disabled={disabled}
                value={period}
                onValueChange={(val) => {
                    setPeriod(val);
                    handleTimeChange(hour, minute, val);
                }}
            >
                <SelectTrigger className="w-[95px] h-10 px-2 focus:ring-0">
                    <SelectValue placeholder="AM/PM" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};
