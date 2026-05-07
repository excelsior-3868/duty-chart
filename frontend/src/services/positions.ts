import api from "./api";

export interface Position {
  id: number;
  name: string;
  level: number;
}

export const getPositions = async (): Promise<Position[]> => {
  const res = await api.get<any>("/positions/", { params: { page_size: 1000 } });
  if (res.data.results && Array.isArray(res.data.results)) {
    return res.data.results;
  }
  return res.data;
};

