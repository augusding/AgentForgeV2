import client from './client'
import type { DashboardStats } from '../types/stats'

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return client.get('/stats')
}
