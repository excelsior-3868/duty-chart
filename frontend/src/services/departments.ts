import api from "./api";

// Define the Department type
export interface Department {
  id: number;
  name: string;
}

// GET all departments
export const getDepartments = async (): Promise<Department[]> => {
  const res = await api.get<Department[]>("/departments/");
  return res.data;
};

// GET department by ID
export const getDepartment = async (id: number): Promise<Department> => {
  const res = await api.get<Department>(`/departments/${id}/`);
  return res.data;
};

// CREATE new department
export const createDepartment = async (data: { name: string }): Promise<Department> => {
  const res = await api.post<Department>("/departments/", data);
  return res.data;
};

// UPDATE department
export const updateDepartment = async (id: number, data: { name: string }): Promise<Department> => {
  const res = await api.put<Department>(`/departments/${id}/`, data);
  return res.data;
};

// DELETE department
export const deleteDepartment = async (id: number): Promise<void> => {
  await api.delete(`/departments/${id}/`);
};
