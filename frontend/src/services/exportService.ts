// src/services/exportService.ts
import api from "./api";

/* =========================
   PREVIEW
   ========================= */
/* =========================
   PREVIEW
   ========================= */
export interface ExportPreviewParams {
  chart_id: number;
  scope?: "full" | "range";
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface ExportPreviewResponse {
  chart: {
    id: number;
    name?: string | null;
    office?: string | null;
    effective_date: string;
    end_date?: string | null;
  };
  columns: { key: string; label: string }[];
  pagination: { page: number; page_size: number; total: number };
  rows: Record<string, any>[];
}

export const getDutyChartExportPreview = async (
  params: ExportPreviewParams
): Promise<ExportPreviewResponse> => {
  const response = await api.get("export/duty-chart/preview/", { params });
  return response.data as ExportPreviewResponse;
};

/* =========================
   DOWNLOAD FILE (FIXED)
   ========================= */
export interface ExportFileParams {
  chart_id: number;
  format: "excel" | "pdf" | "docx";
  scope?: "full" | "range";
  start_date?: string;
  end_date?: string;
}

export const downloadDutyChartExportFile = async (
  params: ExportFileParams
): Promise<Blob> => {
  // Rename format to export_format to avoid conflict with DRF internal params
  const { format, ...rest } = params;
  const response = await api.get("export/duty-chart/download/", {
    params: { ...rest, export_format: format },
    responseType: "blob",
  });

  return response.data as Blob;
};