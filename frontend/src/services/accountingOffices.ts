import api from "./api";

export interface AccountingOffice {
    id: number;
    name: string;
    directorate: number | null;
    directorate_name?: string;
}

export interface AccountingOfficeResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: AccountingOffice[];
}

// List
export const getAccountingOffices = async (params?: { page?: number; search?: string; all?: boolean }): Promise<AccountingOfficeResponse | AccountingOffice[]> => {
    const res = await api.get("/accounting-offices/", { params });
    return res.data;
};

// Create
export const createAccountingOffice = async (data: {
    name: string;
    directorate: number | null;
}): Promise<AccountingOffice> => {
    const res = await api.post<AccountingOffice>("/accounting-offices/", data);
    return res.data;
};

// Read
export const getAccountingOffice = async (id: number): Promise<AccountingOffice> => {
    const res = await api.get<AccountingOffice>(`/accounting-offices/${id}/`);
    return res.data;
};

// Update
export const updateAccountingOffice = async (
    id: number,
    data: { name: string; directorate: number | null }
): Promise<AccountingOffice> => {
    const res = await api.put<AccountingOffice>(`/accounting-offices/${id}/`, data);
    return res.data;
};

// Partial Update
export const patchAccountingOffice = async (
    id: number,
    data: Partial<{ name: string; directorate: number | null }>
): Promise<AccountingOffice> => {
    const res = await api.patch<AccountingOffice>(`/accounting-offices/${id}/`, data);
    return res.data;
};

// Delete
export const deleteAccountingOffice = async (id: number): Promise<void> => {
    await api.delete(`/accounting-offices/${id}/`);
};
