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
