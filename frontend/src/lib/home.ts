// src/lib/home.ts
import { apiGet } from "./api";

export async function getHomeTimeline() {
  return apiGet<any[]>(`/history/events?limit=10`);
}

export async function getHomeNewsletter() {
  return apiGet<any[]>(`/newsletter/home?limit=6`);
}