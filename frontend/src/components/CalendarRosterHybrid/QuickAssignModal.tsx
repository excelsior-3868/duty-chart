import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Office, DutyChart, Shift } from "./CalendarRosterHybrid";
import NepaliDate from "nepali-date-converter";
import { Calendar as CalendarIcon } from "lucide-react";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";

export interface QuickAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offices: Office[];
  dutyCharts: DutyChart[];
  shifts: Shift[];
}

export const QuickAssignModal: React.FC<QuickAssignModalProps> = ({ open, onOpenChange, offices, dutyCharts, shifts }) => {
  const [officeId, setOfficeId] = useState<string>("");
  const [dutyChartId, setDutyChartId] = useState<string>("");
  const [shiftId, setShiftId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [directorate, setDirectorate] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");

  const handleCancel = () => onOpenChange(false);
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    onOpenChange(false);
  };

  const inputClass = "w-full rounded-md border text-sm px-3 py-2 bg-[hsl(var(--card-bg))] border-[hsl(var(--gray-300))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-200))] focus:border-[hsl(var(--inoc-blue))]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mr-6">
            <div>
              <DialogTitle>Quick Assign</DialogTitle>
              <DialogDescription>
                Directly assign staff to a specific duty chart and shift.
              </DialogDescription>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setDateMode("BS")}
                className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}
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
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Office</label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue placeholder="Select Office" /></SelectTrigger>
                <SelectContent>
                  {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Duty Chart</label>
              <Select value={dutyChartId} onValueChange={setDutyChartId}>
                <SelectTrigger><SelectValue placeholder="Select Duty Chart" /></SelectTrigger>
                <SelectContent>
                  {dutyCharts.map(dc => <SelectItem key={dc.id} value={dc.id}>{dc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Shift</label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger><SelectValue placeholder="Select Shift" /></SelectTrigger>
                <SelectContent>
                  {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Employee full name" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              {dateMode === "AD" ? (
                <GregorianDatePicker
                  value={startDate}
                  onChange={setStartDate}
                />
              ) : (
                <NepaliDatePicker
                  value={startDate}
                  onChange={setStartDate}
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              {dateMode === "AD" ? (
                <GregorianDatePicker
                  value={endDate}
                  onChange={setEndDate}
                />
              ) : (
                <NepaliDatePicker
                  value={endDate}
                  onChange={setEndDate}
                />
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button type="submit" className="bg-primary">Assign</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickAssignModal;