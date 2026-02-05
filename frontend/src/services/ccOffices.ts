import api from "./api";
import { AccountingOffice } from "./accountingOffices";

export interface CCOffice {
    id: number;
    name: string;
    accounting_office: number | null;
    accounting_office_name?: string;
}

export interface CCOfficeResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CCOffice[];
}

// List
export const getCCOffices = async (params?: { page?: number; search?: string; all?: boolean }): Promise<CCOfficeResponse | CCOffice[]> => {
    const res = await api.get("/cc-offices/", { params });
    return res.data;
};

// Create
export const createCCOffice = async (data: {
    name: string;
    accounting_office: number | null;
}): Promise<CCOffice> => {
    const res = await api.post<CCOffice>("/cc-offices/", data);
    return res.data;
};

// Read
export const getCCOffice = async (id: number): Promise<CCOffice> => {
    const res = await api.get<CCOffice>(`/cc-offices/${id}/`);
    return res.data;
};

// Update
export const updateCCOffice = async (
    id: number,
    data: { name: string; accounting_office: number | null }
): Promise<CCOffice> => {
    const res = await api.put<CCOffice>(`/cc-offices/${id}/`, data);
    return res.data;
};

// Partial Update
export const patchCCOffice = async (
    id: number,
    data: Partial<{ name: string; accounting_office: number | null }>
): Promise<CCOffice> => {
    const res = await api.patch<CCOffice>(`/cc-offices/${id}/`, data);
    return res.data;
};

// Delete
export const deleteCCOffice = async (id: number): Promise<void> => {
    await api.delete(`/cc-offices/${id}/`);
};
