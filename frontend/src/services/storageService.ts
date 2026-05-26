import api from "./api";

export interface S3Node {
    id: string;
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    last_modified?: string;
    url?: string;
    children?: S3Node[];
}

export const storageApi = {
    getS3Explorer: () => api.get("/s3-explorer/")
};
