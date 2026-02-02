// src/services/dashboardService.ts
import api from "./api";

export interface DashboardOffice {
    id: number;
    user: number;
    office: number;
    office_name?: string;
}

export const getDashboardOffices = async (): Promise<DashboardOffice[]> => {
    const res = await api.get<DashboardOffice[]>("/user-dashboard-offices/");
    return res.data;
};

export const addDashboardOffice = async (officeId: number): Promise<DashboardOffice> => {
    const res = await api.post<DashboardOffice>("/user-dashboard-offices/", { office: officeId });
    return res.data;
};

export const removeDashboardOffice = async (id: number): Promise<void> => {
    await api.delete(`/user-dashboard-offices/${id}/`);
};
