import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface BacklogTask {
  id: string
  ticketNumber?: string
  title: string
  project: string
  assignee: string
  deadline: string // ISO date
  progress: number // 0-100
  status: 'todo' | 'in-progress' | 'done'
  createdAt: string
  updatedAt: string
}

interface BacklogState {
  tasks: BacklogTask[]
  addTask: (task: Omit<BacklogTask, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, updates: Partial<BacklogTask>) => void
  deleteTask: (id: string) => void
  getTasksByAssignee: (assignee: string) => BacklogTask[]
  getTasksByWeek: (weekStart: Date) => BacklogTask[]
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export const useBacklogStore = create<BacklogState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (task) => {
        const newTask: BacklogTask = {
          ...task,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set(state => ({ tasks: [...state.tasks, newTask] }))
      },

      updateTask: (id, updates) => {
        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === id
              ? { ...task, ...updates, updatedAt: new Date().toISOString() }
              : task
          ),
        }))
      },

      deleteTask: (id) => {
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
        }))
      },

      getTasksByAssignee: (assignee) => {
        return get().tasks.filter(task => task.assignee === assignee)
      },

      getTasksByWeek: (weekStart) => {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        
        return get().tasks.filter(task => {
          const taskDate = new Date(task.deadline)
          return taskDate >= weekStart && taskDate <= weekEnd
        })
      },
    }),
    {
      name: 'ezek-backlog-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
