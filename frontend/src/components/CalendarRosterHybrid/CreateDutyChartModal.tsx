import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DutyChartCard } from "@/components/DutyChartCard/DutyChartCard";
import type { DutyChart as DutyChartDTO } from "@/services/dutichart";

interface CreateDutyChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (chart: DutyChartDTO) => void;
}

const CreateDutyChartModal: React.FC<CreateDutyChartModalProps> = ({ open, onOpenChange, onCreated }) => {
  const [dateMode, setDateMode] = useState<"AD" | "BS">("BS");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-3xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mr-6">
            <div>
              <DialogTitle>Create Duty Chart</DialogTitle>
              <DialogDescription>
                Set up a new duty roster by selecting an office and specifying the effective dates.
              </DialogDescription>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setDateMode("BS")}
                className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "BS" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                BS (Nepali)
              </button>
              <button
                type="button"
                onClick={() => setDateMode("AD")}
                className={`px-4 py-1 text-xs font-medium rounded-md transition-all ${dateMode === "AD" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                AD (Gregorian)
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto px-6">
          <DutyChartCard
            onCreated={(chart) => { onCreated?.(chart); onOpenChange(false); }}
            dateMode={dateMode}
            setDateMode={setDateMode}
            hideHeader={true}
          />
        </div>

        <DialogFooter className="p-6 pt-0">
          <button
            type="submit"
            form="create-duty-chart-form"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDutyChartModal;
