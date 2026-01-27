import api from "./api";

export interface Directorate {
  id: number;
  name: string;
}

// List
export const getDirectorates = async (): Promise<Directorate[]> => {
  const res = await api.get<Directorate[]>("/directorates/");
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
