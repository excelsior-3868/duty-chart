import api from "./api";

export interface SMSLogItem {
    id: number;
    user: number | null;
    phone: string;
    message: string;
    status: string;
    response_raw: string | null;
    created_at: string;
    user_full_name?: string; // If you add this to the serializer
}

export interface SMSLogResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: SMSLogItem[];
}

export const getSMSLogs = async (params: { page?: number; search?: string }): Promise<SMSLogResponse> => {
    const response = await api.get("notifications/sms-logs/", { params });
    return response.data;
};
