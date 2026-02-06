import React, { useEffect, useState } from "react";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getDutyChartExportPreview,
  downloadDutyChartExportFile,
  type ExportPreviewResponse,
} from "@/services/exportService";
import { cn } from "@/lib/utils";
import { NepaliDatePicker } from "@/components/common/NepaliDatePicker";
import { GregorianDatePicker } from "@/components/common/GregorianDatePicker";

interface ExportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dutyChartId: number;
  startDateISO: string;
  endDateISO: string;
  scheduleId?: string; // Add this
}

const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  open,
  onOpenChange,
  dutyChartId,
  startDateISO,
  endDateISO,
  scheduleId, // Add this
}) => {
  const [scope, setScope] = useState<"range" | "full">("range");
  const [format, setFormat] = useState<"excel" | "pdf" | "docx">("docx");
  const [startDate, setStartDate] = useState<string>(startDateISO);
  const [endDate, setEndDate] = useState<string>(endDateISO);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ExportPreviewResponse | null>(null);
  const [dateMode, setDateMode] = useState<"BS" | "AD">("BS");

  useEffect(() => {
    if (!open) return;
    setStartDate(startDateISO);
    setEndDate(endDateISO);
    // When opening, if we have a specific schedule filter from the calendar, 
    // we should probably stick to it, though we don't have a UI to change it here yet.
  }, [open, startDateISO, endDateISO]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!open || !dutyChartId) return;

      // If we're on full scope and already have data, don't re-fetch unless it's the first load
      if (scope === "full" && preview && preview.rows.length > 0 && !loading) return;

      try {
        setLoading(true);
        setError("");
        const res = await getDutyChartExportPreview({
          chart_id: dutyChartId,
          scope,
          start_date: scope === "range" ? startDate : undefined,
          end_date: scope === "range" ? endDate : undefined,
          schedule_id: scheduleId, // Pass schedule_id
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
    // Only re-fetch for dates if we are currently in "range" scope
  }, [open, dutyChartId, scope, scope === "range" ? startDate : null, scope === "range" ? endDate : null, scheduleId]);

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
        schedule_id: scheduleId, // Pass schedule_id
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

  const filteredColumns = (preview?.columns || []).filter(
    (col) => !["directorate", "department"].includes(col.key.toLowerCase())
  );

  const hasPreviewData =
    preview &&
    Array.isArray(filteredColumns) &&
    filteredColumns.length > 0 &&
    Array.isArray(preview.rows) &&
    preview.rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-[90vw] lg:max-w-[1100px] overflow-hidden">
        <DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>Export Duty Chart</DialogTitle>
                <DialogDescription>
                  Preview data and export as Excel, PDF, or DOCX.
                </DialogDescription>
              </div>
            </div>

            <div className="flex justify-center -my-2">
              <div className="px-6 py-1 bg-primary/5 border border-primary/10 rounded-full">
                <span className="text-sm font-bold text-primary tracking-wide">
                  अनुसूची - १
                </span>
              </div>
            </div>

            <div className="flex bg-slate-100/50 border rounded-md p-1 items-center self-start">
              <button
                onClick={() => setDateMode("BS")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all",
                  dateMode === "BS"
                    ? "bg-white shadow-sm text-primary"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                BS
              </button>
              <button
                onClick={() => setDateMode("AD")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all",
                  dateMode === "AD"
                    ? "bg-white shadow-sm text-primary"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                AD
              </button>
            </div>
          </div>
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
                <option value="docx">DOCX (.docx)</option>
              </select>
            </div>
          </div>

          {scope === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Start Date</label>
                {dateMode === "BS" ? (
                  <NepaliDatePicker
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                  />
                ) : (
                  <GregorianDatePicker
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">End Date</label>
                {dateMode === "BS" ? (
                  <NepaliDatePicker
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                  />
                ) : (
                  <GregorianDatePicker
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                  />
                )}
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <div className="p-2 border-b text-xs font-bold bg-slate-50/50">Preview</div>
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
                    <tr className="border-b">
                      {filteredColumns.map((col) => (
                        <th
                          key={col.key}
                          className="text-left p-2 font-bold bg-slate-50/30"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-600">
                    {preview!.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        {filteredColumns.map((col) => (
                          <td key={col.key} className="p-2">
                            {String((row as any)[col.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && !error && !hasPreviewData && (
                <div className="text-xs text-muted-foreground p-8 text-center bg-slate-50/20">
                  No preview data available for the selected range.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 px-4">
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading || downloading || !dutyChartId}
            className="h-9 px-4 min-w-[100px]"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Downloading...
              </>
            ) : (
              "Download"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportPreviewModal;
