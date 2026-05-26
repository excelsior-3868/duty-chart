import api from "./api";
import publicApi from "./publicApi";

// Define the user type (adjust according to your backend)
export interface User {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_id: string;
  department: string;
  position: string;
  password: string;
}

// Register a new user
export const registerUser = async (data: User) => {
  const res = await publicApi.post<User>("/users/", data);
  return res.data;
};

// Get all users
export const getUsers = async () => {
  const res = await api.get<User[]>("/users/");
  return res.data;
};

// Get user by ID
export const getUserById = async (id: number) => {
  const res = await api.get<User>(`/users/${id}/`);
  return res.data;
};

// Update user
export const updateUser = async (id: number, data: Partial<User>) => {
  const res = await api.put<User>(`/users/${id}/`, data);
  return res.data;
};

// Patch user
export const patchUser = async (id: number, data: Partial<User>) => {
  const res = await api.patch<User>(`/users/${id}/`, data);
  return res.data;
};

// Delete user
export const deleteUser = async (id: number) => {
  const res = await api.delete(`/users/${id}/`);
  return res.data;
};