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
import { FileUp, Check, Loader2, AlertCircle } from "lucide-react";
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
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate the target filename that will be used in S3
  const getTargetFilename = () => {
    if (!file) return "";
    const ext = file.name.split('.').pop();
    const cleanOffice = officeName.replace(/\s+/g, "_");
    const cleanChart = chartName.replace(/\s+/g, "_");
    return `${cleanOffice}_${cleanChart}_anusuchi1.${ext}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleApprove = async () => {
    if (!file) {
      toast.error("Please upload the approved Anusuchi 1 document.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("approval_document", file);
      if (remarks) {
        formData.append("approval_remarks", remarks);
      }

      const result = await approveDutyChart(chartId, formData);
      toast.success(result.detail || "Chart approved and notifications sent.");
      onSuccess();
      onOpenChange(false);
      // Reset form
      setFile(null);
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
          <div className="space-y-2">
            <Label htmlFor="approval_document" className="text-sm font-bold flex items-center gap-2">
              Approved Anusuchi 1 <span className="text-destructive">*</span>
            </Label>
            <div 
              className={`border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                file ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-primary/50 bg-slate-50/50'
              }`}
              onClick={() => document.getElementById('approval_document')?.click()}
            >
              <FileUp className={`w-8 h-8 ${file ? 'text-emerald-500' : 'text-slate-400'}`} />
              <div className="text-center">
                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-700 break-all">
                      {getTargetFilename()}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Original: {file.name}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-700">
                    Click to upload Anusuchi 1 (PDF/Image)
                  </p>
                )}
                <p className="text-[10px] text-slate-500 mt-1">Max size: 5MB</p>
              </div>
              <Input
                id="approval_document"
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={handleFileChange}
              />
            </div>
            {file && (
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> File selected and will be renamed for storage
              </p>
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
            disabled={loading || !file}
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
