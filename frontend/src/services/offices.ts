// src/services/offices.ts
import api from "./api";

export interface Office {
  id: number;
  name: string;
  location?: string;
  department?: number;
  department_name?: string;
  directorate_name?: string;
}

// GET all offices
export const getOffices = async (): Promise<Office[]> => {
  const res = await api.get<Office[]>("/offices/");
  return res.data;
};

// CREATE office
export const createOffice = async (data: Partial<Office>): Promise<Office> => {
  const res = await api.post<Office>("/offices/", data);
  return res.data;
};

// GET one office
export const getOffice = async (id: number): Promise<Office> => {
  const res = await api.get<Office>(`/offices/${id}/`);
  return res.data;
};

// UPDATE (PUT) office
export const updateOffice = async (
  id: number,
  data: Partial<Office>
): Promise<Office> => {
  const res = await api.put<Office>(`/offices/${id}/`, data);
  return res.data;
};

// PATCH office
export const patchOffice = async (
  id: number,
  data: Partial<Office>
): Promise<Office> => {
  const res = await api.patch<Office>(`/offices/${id}/`, data);
  return res.data;
};

// DELETE office
export const deleteOffice = async (id: number): Promise<void> => {
  await api.delete(`/offices/${id}/`);
};