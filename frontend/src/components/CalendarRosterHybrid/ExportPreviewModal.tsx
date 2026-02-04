import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDutyChartExportPreview,
  downloadDutyChartExportFile,
  type ExportPreviewResponse,
} from "@/services/exportService";

interface ExportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dutyChartId: number;
  startDateISO: string;
  endDateISO: string;
}

const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  open,
  onOpenChange,
  dutyChartId,
  startDateISO,
  endDateISO,
}) => {
  const [scope, setScope] = useState<"range" | "full">("range");
  const [format, setFormat] = useState<"excel" | "pdf" | "docx">("excel");
  const [startDate, setStartDate] = useState<string>(startDateISO);
  const [endDate, setEndDate] = useState<string>(endDateISO);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ExportPreviewResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setStartDate(startDateISO);
    setEndDate(endDateISO);
  }, [open, startDateISO, endDateISO]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!open || !dutyChartId) return;
      try {
        setLoading(true);
        setError("");
        const res = await getDutyChartExportPreview({
          chart_id: dutyChartId,
          scope,
          start_date: scope === "range" ? startDate : undefined,
          end_date: scope === "range" ? endDate : undefined,
          page: 1,
          page_size: 10,
        });
        setPreview(res);
      } catch (e) {
        console.error("Failed to load export preview", e);
        setError("Failed to load export preview.");
        setPreview(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [open, dutyChartId, scope, startDate, endDate]);

  const handleDownload = async () => {
    if (!dutyChartId) return;
    try {
      setDownloading(true);
      setError("");
      const blob = await downloadDutyChartExportFile({
        chart_id: dutyChartId,
        format,
        scope,
        start_date: scope === "range" ? startDate : undefined,
        end_date: scope === "range" ? endDate : undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const ext =
        format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : "docx";

      a.href = url;
      a.download = `DutyChart_${dutyChartId}_${scope}_${startDate || "full"}-${endDate || "full"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download export file", e);
      setError("Failed to download export file.");
    } finally {
      setDownloading(false);
    }
  };

  const hasPreviewData =
    preview &&
    Array.isArray(preview.columns) &&
    Array.isArray(preview.rows);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-[90vw] lg:max-w-[1100px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Export Duty Chart</DialogTitle>
          <DialogDescription>
            Preview data and export as Excel, PDF, or DOCX.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Scope</label>
              <select
                className="h-9 rounded-md border px-3 bg-background text-foreground"
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
              >
                <option value="range">Date Range (week)</option>
                <option value="full">Full Chart</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Format</label>
              <select
                className="h-9 rounded-md border px-3 bg-background text-foreground"
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF (.pdf)</option>
                <option value="docx">DOCX (.docx)</option>
              </select>
            </div>
          </div>

          {scope === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <div className="p-2 border-b text-xs font-medium">Preview</div>
            <div className="p-2 max-h-[60vh] overflow-auto overflow-x-auto">
              {loading && (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {!loading && error && (
                <div className="text-xs text-red-600">{error}</div>
              )}

              {!loading && !error && hasPreviewData && (
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr>
                      {preview!.columns.map((col) => (
                        <th
                          key={col.key}
                          className="text-left p-1 border-b"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview!.rows.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        {preview!.columns.map((col) => (
                          <td key={col.key} className="p-1">
                            {String((row as any)[col.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && !error && !hasPreviewData && (
                <div className="text-xs text-muted-foreground">
                  No data available.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading || downloading || !dutyChartId}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportPreviewModal;
