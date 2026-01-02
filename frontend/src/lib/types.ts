// src/lib/mock/types.ts
export type EquityPoint = { d: string; v: number };

export type PositionRow = {
  symbol: string;
  name: string;
  qty: number;
  avg: number;
  price: number;
  value: number;
  weight: string;
  day: string;
  pnl: string;
};