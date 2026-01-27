import api from "./api";

export interface BulkUploadResult {
  id: number;
  status: string;
  message?: string;
}

export const bulkUpload = async (data: any[]): Promise<BulkUploadResult[]> => {
  const res = await api.post<BulkUploadResult[]>("/bulk-upload/", data);
  return res.data;
};
