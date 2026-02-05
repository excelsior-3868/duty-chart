import api from "./api";

export interface Directorate {
  id: number;
  name: string;
  parent: number | null;
  parent_name?: string;
  hierarchy_level: number;
  remarks: string | null;
}

export interface DirectorateResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Directorate[];
}

// List
export const getDirectorates = async (params?: { page?: number; search?: string; all?: boolean }): Promise<DirectorateResponse | Directorate[]> => {
  const res = await api.get("/directorates/", { params });
  return res.data;
};

// Create
export const createDirectorate = async (data: {
  name: string;
}): Promise<Directorate> => {
  const res = await api.post<Directorate>("/directorates/", data);
  return res.data;
};

// Read
export const getDirectorate = async (id: number): Promise<Directorate> => {
  const res = await api.get<Directorate>(`/directorates/${id}/`);
  return res.data;
};

// Update
export const updateDirectorate = async (
  id: number,
  data: { name: string }
): Promise<Directorate> => {
  const res = await api.put<Directorate>(`/directorates/${id}/`, data);
  return res.data;
};

// Partial Update
export const patchDirectorate = async (
  id: number,
  data: Partial<{ name: string }>
): Promise<Directorate> => {
  const res = await api.patch<Directorate>(`/directorates/${id}/`, data);
  return res.data;
};

// Delete
export const deleteDirectorate = async (id: number): Promise<void> => {
  await api.delete(`/directorates/${id}/`);
};
