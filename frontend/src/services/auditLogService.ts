import api from "./api";

export interface AuditLogItem {
    id: string;
    timestamp: string;
    actor: number | null;
    actor_userid: string | null;
    actor_employee_id: string | null;
    actor_full_name?: string;
    actor_email?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
    entity_type: string;
    ip_address: string | null;
    status: string;
    details?: string;
}

export interface AuditLogResponse {
    results: AuditLogItem[];
    count: number;
    next: string | null;
    previous: string | null;
}

export const getAuditLogs = async (params: {
    page?: number;
    search?: string;
    action?: string;
    entity_type?: string;
}): Promise<AuditLogResponse> => {
    const response = await api.get("auditlogs/", { params });
    return response.data;
};
