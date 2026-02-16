// src/services/dutichart.ts
import api from "./api";

export interface DutyChart {
  id: number;
  office: number;
  effective_date: string;
  end_date?: string;
  name?: string;
  schedules?: number[];
  office_name?: string;
  department_name?: string;
  directorate_name?: string;
  duties_count?: number;
}

// GET all duty charts
export const getDutyCharts = async (officeId?: number): Promise<DutyChart[]> => {
  const params = officeId ? { office: officeId } : {};
  // NOTE: api baseURL already includes /api/v1, so request path should NOT include /v1 again
  const response = await api.get("/duty-charts/", { params });
  return response.data;
};

// GET a single duty chart by id
export const getDutyChartById = async (id: number): Promise<DutyChart> => {
  const response = await api.get(`/duty-charts/${id}/`);
  return response.data;
};

// CREATE a duty chart
export const createDutyChart = async (
  data: Partial<DutyChart>
): Promise<DutyChart> => {
  const response = await api.post("/duty-charts/", data);
  return response.data;
};

// UPDATE a duty chart (full)
export const updateDutyChart = async (
  id: number,
  data: Partial<DutyChart>
): Promise<DutyChart> => {
  const response = await api.put(`/duty-charts/${id}/`, data);
  return response.data;
};

// PATCH a duty chart (partial)
export const patchDutyChart = async (
  id: number,
  data: Partial<DutyChart>
): Promise<DutyChart> => {
  const response = await api.patch(`/duty-charts/${id}/`, data);
  return response.data;
};

// DELETE a duty chart
export const deleteDutyChart = async (id: number): Promise<void> => {
  await api.delete(`/duty-charts/${id}/`);
};

/**
 * Downloads the Excel template for duty chart import.
 */
export const downloadImportTemplate = async (params: {
  office_id: number;
  start_date: string;
  end_date: string;
  schedule_ids: number[];
}) => {
  const response = await api.get("/duty-chart/import-template/", {
    params,
    responseType: "blob",
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `duty_template_${params.start_date}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/**
 * Imports a duty chart via Excel.
 */
export const importDutyChartExcel = async (formData: FormData) => {
  const response = await api.post("/duty-chart/import/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

