import api from "./api";

export interface Schedule {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  office?: number;
  office_name?: string;
  status?: 'template' | 'default' | 'expired' | string;
  created_at?: string;
  updated_at?: string;
}

// GET schedules (optionally filtered by office and/or duty_chart)
export const getSchedules = async (
  officeId?: number,
  dutyChartId?: number
): Promise<Schedule[]> => {
  const params: Record<string, number> = {};
  if (typeof officeId === "number") params.office = officeId;
  if (typeof dutyChartId === "number") params.duty_chart = dutyChartId;

  const response = await api.get("/schedule/", { params });
  return response.data;
};

// GET a single schedule by id
export const getScheduleById = async (id: number): Promise<Schedule> => {
  const response = await api.get(`/schedule/${id}/`);
  return response.data;
};

// CREATE a schedule
export const createSchedule = async (
  data: Partial<Schedule>
): Promise<Schedule> => {
  const response = await api.post("/schedule/", data);
  return response.data;
};

// UPDATE a schedule
export const updateSchedule = async (
  id: number,
  data: Partial<Schedule>
): Promise<Schedule> => {
  const response = await api.put(`/schedule/${id}/`, data);
  return response.data;
};

// PATCH a schedule
export const patchSchedule = async (
  id: number,
  data: Partial<Schedule>
): Promise<Schedule> => {
  const response = await api.patch(`/schedule/${id}/`, data);
  return response.data;
};

// DELETE a schedule
export const deleteSchedule = async (id: number): Promise<void> => {
  await api.delete(`/schedule/${id}/`);
};