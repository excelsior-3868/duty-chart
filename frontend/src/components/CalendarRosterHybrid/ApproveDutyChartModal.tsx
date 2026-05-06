import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileUp, Check, Loader2, AlertCircle, Plus as PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { approveDutyChart } from "@/services/dutichart";

interface ApproveDutyChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartId: number;
  chartName: string;
  officeName: string;
  onSuccess: () => void;
  dutiesCount: number;
}

const ApproveDutyChartModal: React.FC<ApproveDutyChartModalProps> = ({
  open,
  onOpenChange,
  chartId,
  chartName,
  officeName,
  onSuccess,
  dutiesCount,
}) => {
  const [remarks, setRemarks] = useState("");
  const [anusuchiFiles, setAnusuchiFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAnusuchiFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleApprove = async () => {
    if (anusuchiFiles.length === 0) {
      toast.error("Please upload the approved Anusuchi 1 document.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      anusuchiFiles.forEach((f) => {
        formData.append("anusuchi_documents", f);
      });
      if (remarks) {
        formData.append("approval_remarks", remarks);
      }

      const result = await approveDutyChart(chartId, formData);
      toast.success(result.detail || "Chart approved and notifications sent.");
      onSuccess();
      onOpenChange(false);
      // Reset form
      setAnusuchiFiles([]);
      setRemarks("");
    } catch (error: any) {
      console.error("Approval error:", error);
      const detail = error.response?.data?.detail || "Failed to approve chart.";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            Approve & Notify
          </DialogTitle>
          <DialogDescription>
            Confirming approval for <strong>{chartName}</strong>. 
            This will notify <strong>{dutiesCount}</strong> assigned staff members via SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-4 p-4 border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <FileUp className="h-4 w-4" />
                  स्वीकृत अनुसूची कागजातहरू *
                </h3>
                <p className="text-xs text-emerald-600/80">
                  Upload multiple signed/approved documents for this chart.
                </p>
              </div>
              <label className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 cursor-pointer transition-colors shadow-sm self-start">
                <PlusIcon className="h-3.5 w-3.5" />
                Add File(s)
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {anusuchiFiles.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {anusuchiFiles.map((file, idx) => (
                  <div key={`new-${idx}`} className="flex items-center justify-between p-2 bg-white border border-emerald-100 rounded-md shadow-sm group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] text-emerald-600 font-bold italic">अनुसूची - १</span>
                        <span className="text-xs font-medium truncate text-slate-700">{file.name}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnusuchiFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {anusuchiFiles.length === 0 && (
              <div className="text-center py-4 border border-emerald-100 border-dashed rounded-md bg-white/50">
                <p className="text-xs text-emerald-600/60 italic">No documents added yet. At least one is required for approval.</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm font-bold">Approval Remarks (Optional)</Label>
            <Textarea
              id="remarks"
              placeholder="Enter any notes or reference numbers related to this approval..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="resize-none h-24"
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 leading-relaxed">
              <strong>Important:</strong> Approval is final. SMS notifications will be dispatched immediately to all assigned staff for this period.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={loading || anusuchiFiles.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm & Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveDutyChartModal;
