import api from "./api";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  full_name?: string;
  phone_number?: string;
  office?: number | null;
  department?: number | null;
  directorate?: number | null;
  secondary_offices?: number[]; // optional list of secondary office IDs
  image?: string | null;
  position?: number | null;
  position_name?: string | null;
}

// GET all users (optionally filtered by office)
export const getUsers = async (officeId?: number): Promise<User[]> => {
  const params = typeof officeId === "number" ? { office: officeId } : {};
  const res = await api.get<User[]>("/users/", { params });
  return res.data;
};

// GET user by ID
export const getUser = async (id: number): Promise<User> => {
  const res = await api.get<User>(`/users/${id}/`);
  return res.data;
};

// CREATE user
export const createUser = async (data: Partial<User>): Promise<User> => {
  const res = await api.post<User>("/users/", data);
  return res.data;
};

// UPDATE user
export const updateUser = async (
  id: number,
  data: Partial<User>
): Promise<User> => {
  const res = await api.put<User>(`/users/${id}/`, data);
  return res.data;
};

// PATCH user
export const patchUser = async (
  id: number,
  data: Partial<User>
): Promise<User> => {
  const res = await api.patch<User>(`/users/${id}/`, data);
  return res.data;
};

// DELETE user
export const deleteUser = async (id: number): Promise<void> => {
  await api.delete(`/users/${id}/`);
};
