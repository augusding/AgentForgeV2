import client from './client'

// ── Tasks ──
export const listTasks = (status?: string) =>
  client.get(`/work-items/tasks${status ? `?status=${status}` : ''}`) as Promise<{ priorities: any[] }>

export const createTask = (data: { title: string; priority?: string; due_date?: string; description?: string }) =>
  client.post('/work-items/tasks', data) as Promise<{ status: string; id: string }>

export const updateTask = (id: string, data: Record<string, any>) =>
  client.patch(`/work-items/tasks/${id}`, data) as Promise<{ status: string }>

export const deleteTask = (id: string) =>
  client.delete(`/work-items/tasks/${id}`) as Promise<{ status: string }>

// ── Schedules ──
export const createSchedule = (data: { title: string; scheduled_time: string; duration_minutes?: number; description?: string }) =>
  client.post('/work-items/schedules', data) as Promise<{ status: string; id: string }>

export const updateSchedule = (id: string, data: Record<string, any>) =>
  client.patch(`/work-items/schedules/${id}`, data) as Promise<{ status: string }>

export const deleteSchedule = (id: string) =>
  client.delete(`/work-items/schedules/${id}`) as Promise<{ status: string }>

// ── Followups ──
export const createFollowup = (data: { title: string; target?: string; due_date?: string; description?: string }) =>
  client.post('/work-items/followups', data) as Promise<{ status: string; id: string }>

export const updateFollowup = (id: string, data: Record<string, any>) =>
  client.patch(`/work-items/followups/${id}`, data) as Promise<{ status: string }>

export const deleteFollowup = (id: string) =>
  client.delete(`/work-items/followups/${id}`) as Promise<{ status: string }>

// ── Work Items ──
export const createWorkItem = (data: { title: string; priority?: string; due_date?: string; item_type?: string }) =>
  client.post('/work-items/items', data) as Promise<{ status: string; id: string }>

export const updateWorkItem = (id: string, data: Record<string, any>) =>
  client.patch(`/work-items/items/${id}`, data) as Promise<{ status: string }>

export const deleteWorkItem = (id: string) =>
  client.delete(`/work-items/items/${id}`) as Promise<{ status: string }>
