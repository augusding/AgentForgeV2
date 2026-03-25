import { create } from 'zustand'
import type { DailyContext, Priority, ScheduleItem, FollowUp, WorkItem } from '../api/workstation'
import {
  fetchDailyContext, fetchWorkItems,
  addPriority, updatePriority, deletePriority,
  addScheduleItem, deleteScheduleItem,
  addFollowUp, updateFollowUp, deleteFollowUp,
  addWorkItem, updateWorkItem, deleteWorkItem,
} from '../api/workstation'

interface DailyContextState {
  context: DailyContext | null
  loading: boolean

  load: () => Promise<void>

  // Priorities
  addPriority: (text: string, priority?: string) => Promise<void>
  togglePriority: (id: string, done: boolean) => Promise<void>
  removePriority: (id: string) => Promise<void>

  // Schedule
  addSchedule: (item: { time: string; title: string; duration_min?: number; type?: string }) => Promise<void>
  removeSchedule: (id: string) => Promise<void>

  // Follow-ups
  addFollowUp: (item: { text: string; direction?: string; person?: string; due_date?: string }) => Promise<void>
  toggleFollowUp: (id: string, done: boolean) => Promise<void>
  removeFollowUp: (id: string) => Promise<void>

  // Work Items
  addWorkItem: (item: { title: string; status?: string; progress_pct?: number; due_date?: string; milestone?: string }) => Promise<void>
  updateWorkItem: (id: string, updates: Partial<WorkItem>) => Promise<void>
  removeWorkItem: (id: string) => Promise<void>
}

export const useDailyContextStore = create<DailyContextState>((set, get) => ({
  context: null,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const [context, work_items] = await Promise.all([fetchDailyContext(), fetchWorkItems()])
      set({ context: { ...context, work_items }, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  addPriority: async (text, priority = 'mid') => {
    const item = await addPriority(text, priority)
    set(s => s.context ? { context: { ...s.context, priorities: [...s.context.priorities, item] } } : {})
  },

  togglePriority: async (id, done) => {
    await updatePriority(id, { done })
    set(s => s.context ? {
      context: { ...s.context, priorities: s.context.priorities.map(p => p.id === id ? { ...p, done } : p) }
    } : {})
  },

  removePriority: async (id) => {
    await deletePriority(id)
    set(s => s.context ? { context: { ...s.context, priorities: s.context.priorities.filter(p => p.id !== id) } } : {})
  },

  addSchedule: async (item) => {
    const created = await addScheduleItem(item)
    set(s => s.context ? {
      context: {
        ...s.context,
        schedule: [...s.context.schedule, created].sort((a, b) => a.time.localeCompare(b.time))
      }
    } : {})
  },

  removeSchedule: async (id) => {
    await deleteScheduleItem(id)
    set(s => s.context ? { context: { ...s.context, schedule: s.context.schedule.filter(i => i.id !== id) } } : {})
  },

  addFollowUp: async (item) => {
    const created = await addFollowUp(item)
    set(s => s.context ? { context: { ...s.context, followups: [...s.context.followups, created] } } : {})
  },

  toggleFollowUp: async (id, done) => {
    await updateFollowUp(id, { done })
    set(s => s.context ? {
      context: { ...s.context, followups: s.context.followups.map(f => f.id === id ? { ...f, done } : f) }
    } : {})
  },

  removeFollowUp: async (id) => {
    await deleteFollowUp(id)
    set(s => s.context ? { context: { ...s.context, followups: s.context.followups.filter(f => f.id !== id) } } : {})
  },

  addWorkItem: async (item) => {
    const created = await addWorkItem(item)
    set(s => s.context ? { context: { ...s.context, work_items: [...s.context.work_items, created] } } : {})
  },

  updateWorkItem: async (id, updates) => {
    await updateWorkItem(id, updates)
    set(s => s.context ? {
      context: { ...s.context, work_items: s.context.work_items.map(w => w.id === id ? { ...w, ...updates } : w) }
    } : {})
  },

  removeWorkItem: async (id) => {
    await deleteWorkItem(id)
    set(s => s.context ? { context: { ...s.context, work_items: s.context.work_items.filter(w => w.id !== id) } } : {})
  },
}))
