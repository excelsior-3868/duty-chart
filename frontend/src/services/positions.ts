import api from "./api";

export interface Position {
  id: number;
  name: string;
  level: number;
}

export const getPositions = async (): Promise<Position[]> => {
  const res = await api.get<Position[]>("/positions/");
  return res.data;
};

