import api from "./api";

export interface User {
  id: number;
  username: string;
  email: string;
  employee_id?: string;
  is_active: boolean;
  full_name?: string;
  phone_number?: string;
  office?: number | null;
  office_name?: string | null;
  department?: number | null;
  directorate?: number | null;
  secondary_offices?: number[]; // optional list of secondary office IDs
  image?: string | null;
  position?: number | null;
  position_name?: string | null;
  is_activated?: boolean;
}

// GET all users (optionally filtered by office and activation status)
export const getUsers = async (officeId?: number, isActivated?: boolean): Promise<User[]> => {
  const params: any = {};
  if (typeof officeId === "number") params.office = officeId;
  if (typeof isActivated === "boolean") params.is_activated = isActivated;

  // Request a large page size for the dashboard/dropdowns if not specified otherwise
  // or handle pagination if the API enforces it.
  const res = await api.get<any>("/users/?page_size=100", { params });
  if (res.data.results && Array.isArray(res.data.results)) {
    return res.data.results;
  }
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return [];
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
