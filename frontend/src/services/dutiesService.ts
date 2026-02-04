import api from "./api";

export interface Duty {
  id: number;
  date: string;
  user: number;
  office: number;
  schedule: number;
  duty_chart?: number;
  is_completed: boolean;
  currently_available: boolean;
  user_name?: string;
  office_name?: string;
  schedule_name?: string;
  schedule_shift?: string;
  shift_type?: string;
  alias?: string;
  start_time?: string;
  end_time?: string;
  position_name?: string;
  phone_number?: string;
  user_office_name?: string;
  user_department_name?: string;
  user_directorate_name?: string;
  email?: string;
}

// GET all duties
export const getDuties = async (): Promise<Duty[]> => {
  const response = await api.get("/duties/");
  return response.data;
};

// GET duties by filters
export const getDutiesFiltered = async (
  params: {
    user?: number;
    office?: number;
    duty_chart?: number;
    schedule?: number;
    date?: string;
  }
): Promise<Duty[]> => {
  const response = await api.get("/duties/", { params });
  return response.data;
};

// GET duty by id
export const getDutyById = async (id: number): Promise<Duty> => {
  const response = await api.get(`/duties/${id}/`);
  return response.data;
};

// CREATE a duty
export const createDuty = async (
  data: Partial<Duty>
): Promise<Duty> => {
  const response = await api.post("/duties/", data);
  return response.data;
};

// UPDATE a duty
export const updateDuty = async (
  id: number,
  data: Partial<Duty>
): Promise<Duty> => {
  const response = await api.put(`/duties/${id}/`, data);
  return response.data;
};

// PATCH a duty
export const patchDuty = async (
  id: number,
  data: Partial<Duty>
): Promise<Duty> => {
  const response = await api.patch(`/duties/${id}/`, data);
  return response.data;
};

export const deleteDuty = async (id: number): Promise<void> => {
  await api.delete(`/duties/${id}/`);
};

export const bulkUpsertDuties = async (data: Partial<Duty>[]): Promise<{ created: number; updated: number }> => {
  const response = await api.post("/duties/bulk-upsert/", data);
  return response.data;
};

