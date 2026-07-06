import { useState, useMemo } from 'react'
import { ListTodo, Plus, Trash2, Edit2, Calendar, FolderOpen, ChevronRight, ChevronDown, User, BarChart3, Circle } from 'lucide-react'
import { useBacklogStore, type BacklogTask } from '../../store/backlogStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  todo: '#64748b',
  'in-progress': '#3b82f6',
  done: '#22c55e',
}

export default function BacklogWorkspace() {
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<BacklogTask | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<Date>(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff))
  })
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const tasks = useBacklogStore(state => state.tasks)
  const addTask = useBacklogStore(state => state.addTask)
  const updateTask = useBacklogStore(state => state.updateTask)
  const deleteTask = useBacklogStore(state => state.deleteTask)

  const [formData, setFormData] = useState({
    ticketNumber: '',
    title: '',
    project: '',
    assignee: '',
    deadline: new Date().toISOString().split('T')[0],
    progress: 0,
    status: 'todo' as const,
  })

  // Tarefas filtradas
  const filteredTasks = useMemo(() => {
    let list = tasks
    if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter)
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        (t.ticketNumber && t.ticketNumber.toLowerCase().includes(q))
      )
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [tasks, statusFilter, searchFilter])

  // Tarefas da semana selecionada (para gráficos)
  const getTasksForSelectedWeek = () => {
    const weekEnd = new Date(selectedWeek)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return tasks.filter(task => {
      const taskDate = new Date(task.deadline)
      return taskDate >= selectedWeek && taskDate <= weekEnd
    })
  }

  const tasksThisWeek = getTasksForSelectedWeek()

  const assigneeGroups = useMemo(() => {
    const groups: Record<string, BacklogTask[]> = {}
    tasksThisWeek.forEach(task => {
      const key = task.assignee || 'Sem responsável'
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [tasksThisWeek])

  const statusStats = [
    { name: 'To Do', value: tasksThisWeek.filter(t => t.status === 'todo').length, color: '#64748b' },
    { name: 'Em Andamento', value: tasksThisWeek.filter(t => t.status === 'in-progress').length, color: '#3b82f6' },
    { name: 'Concluído', value: tasksThisWeek.filter(t => t.status === 'done').length, color: '#22c55e' },
  ]

  const progressData = assigneeGroups.map(([name, assigneeTasks]) => {
    const totalProgress = assigneeTasks.reduce((sum, t) => sum + t.progress, 0)
    return {
      name,
      progress: assigneeTasks.length > 0 ? Math.round(totalProgress / assigneeTasks.length) : 0,
      total: assigneeTasks.length,
    }
  })

  const changeWeek = (direction: number) => {
    setSelectedWeek(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + (7 * direction))
      return newDate
    })
  }

  const formatWeek = (date: Date) => {
    const end = new Date(date)
    end.setDate(end.getDate() + 6)
    return `${date.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`
  }

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingTask) {
      updateTask(editingTask.id, formData)
    } else {
      addTask(formData)
    }
    setShowModal(false)
    setEditingTask(null)
    setFormData({
      ticketNumber: '',
      title: '',
      project: '',
      assignee: '',
      deadline: new Date().toISOString().split('T')[0],
      progress: 0,
      status: 'todo',
    })
  }

  const openEdit = (task: BacklogTask) => {
    setEditingTask(task)
    setFormData({
      ticketNumber: task.ticketNumber || '',
      title: task.title,
      project: task.project,
      assignee: task.assignee,
      deadline: task.deadline.split('T')[0],
      progress: task.progress,
      status: task.status,
    })
    setShowModal(true)
  }

  return (
    <div className="flex h-full bg-nova-bg text-nova-text">
      {/* === SIDEBAR: Lista de Tarefas === */}
      <div className="w-[280px] min-w-[280px] border-r border-nova-border flex flex-col bg-nova-bg-secondary shrink-0">
        {/* Header da sidebar */}
        <div className="h-12 px-3 border-b border-nova-border flex items-center justify-between bg-nova-bg">
          <div className="flex items-center gap-2">
            <ListTodo size={16} className="text-nova-accent" />
            <span className="font-semibold text-sm">Tarefas</span>
            <span className="text-[10px] text-nova-text-muted">({filteredTasks.length})</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="p-1.5 rounded hover:bg-nova-hover text-nova-accent"
            title="Nova Tarefa"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-2 border-b border-nova-border space-y-2">
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Buscar tarefas..."
            className="w-full bg-nova-input-bg border border-nova-input-border rounded px-2 py-1.5 text-[11px] text-nova-text outline-none placeholder:text-nova-text-muted"
          />
          <div className="flex gap-1">
            {['all', 'todo', 'in-progress', 'done'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  statusFilter === s
                    ? s === 'all' ? 'bg-nova-accent/20 text-nova-accent' :
                      s === 'todo' ? 'bg-gray-500/20 text-gray-400' :
                      s === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    : 'bg-nova-hover/30 text-nova-text-muted hover:bg-nova-hover'
                }`}
              >
                {s === 'all' ? 'Todas' : s === 'todo' ? 'To Do' : s === 'in-progress' ? 'Andamento' : 'Feito'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de tarefas */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {filteredTasks.length === 0 ? (
            <div className="p-4 text-center text-nova-text-muted text-xs">
              <p className="mt-4">Nenhuma tarefa encontrada</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 text-nova-accent hover:underline text-[11px]"
              >
                Criar nova tarefa
              </button>
            </div>
          ) : (
            <div className="divide-y divide-nova-border/50">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`p-3 cursor-pointer transition-colors hover:bg-nova-hover/40 ${
                    selectedTaskId === task.id ? 'bg-nova-accent/10 border-l-2 border-l-nova-accent' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Circle
                      size={8}
                      fill={STATUS_COLORS[task.status]}
                      className="shrink-0"
                      color={STATUS_COLORS[task.status]}
                    />
                    {task.ticketNumber && (
                      <span className="text-[10px] font-mono text-nova-accent">#{task.ticketNumber}</span>
                    )}
                    <span className="text-[10px] text-nova-text-muted ml-auto">
                      {new Date(task.deadline).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[12px] font-medium truncate text-nova-text">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-nova-text-muted truncate flex items-center gap-1">
                      <FolderOpen size={10} /> {task.project}
                    </span>
                    <span className="text-[10px] text-nova-text-muted truncate flex items-center gap-1">
                      <User size={10} /> {task.assignee}
                    </span>
                  </div>
                  <div className="mt-1.5 w-full bg-nova-border rounded-full h-1.5 cursor-pointer group relative"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                      updateTask(task.id, { progress: Math.max(0, Math.min(100, pct)) })
                    }}
                  >
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        task.progress === 100 ? 'bg-green-500' :
                        task.progress > 50 ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/5 rounded-full transition-opacity" />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[9px] text-nova-text-muted">{task.progress}%</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      task.status === 'todo' ? 'bg-gray-500/15 text-gray-400 hover:bg-gray-500/25' :
                      task.status === 'in-progress' ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' :
                      'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                    }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const next = task.status === 'todo' ? 'in-progress' : task.status === 'in-progress' ? 'done' : 'todo'
                        updateTask(task.id, { status: next as any })
                      }}
                    >
                      {task.status === 'todo' ? 'To Do' : task.status === 'in-progress' ? 'Em Andamento' : 'Concluído'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === CONTEÚDO: Gráficos + Detalhes === */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Header do conteúdo */}
        <div className="h-12 px-4 border-b border-nova-border flex items-center justify-between bg-nova-bg shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-nova-accent" />
            <h2 className="text-sm font-semibold">Backlog</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-nova-text-muted">{formatWeek(selectedWeek)}</span>
            <button onClick={() => changeWeek(-1)} className="p-1 hover:bg-nova-hover rounded"><ChevronDown size={14} /></button>
            <button onClick={() => changeWeek(1)} className="p-1 hover:bg-nova-hover rounded"><ChevronRight size={14} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-nova-bg-secondary border border-nova-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-nova-text-secondary mb-3 uppercase tracking-wider">Progresso por Responsável</h3>
              {progressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#9ca3af" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} itemStyle={{ color: '#f9fafb' }} />
                    <Bar dataKey="progress" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-nova-text-muted text-xs">Nenhuma tarefa nesta semana</div>
              )}
            </div>

            <div className="bg-nova-bg-secondary border border-nova-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-nova-text-secondary mb-3 uppercase tracking-wider">Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusStats.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                    {statusStats.filter(s => s.value > 0).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={_entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} itemStyle={{ color: '#f9fafb' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detalhes da tarefa selecionada */}
          {selectedTask ? (
            <div className="bg-nova-bg-secondary border border-nova-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Circle size={12} fill={STATUS_COLORS[selectedTask.status]} color={STATUS_COLORS[selectedTask.status]} />
                  <h3 className="font-semibold text-nova-text">{selectedTask.title}</h3>
                  {selectedTask.ticketNumber && (
                    <span className="text-xs font-mono text-nova-accent">#{selectedTask.ticketNumber}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(selectedTask)} className="px-3 py-1 bg-nova-hover rounded text-[11px] hover:bg-nova-hover/80 flex items-center gap-1">
                    <Edit2 size={12} /> Editar
                  </button>
                  <button onClick={() => deleteTask(selectedTask.id)} className="px-3 py-1 bg-red-500/10 text-red-400 rounded text-[11px] hover:bg-red-500/20 flex items-center gap-1">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-nova-bg rounded-lg p-3">
                  <span className="text-[10px] text-nova-text-muted uppercase">Projeto</span>
                  <p className="text-sm font-medium flex items-center gap-1 mt-1"><FolderOpen size={14} /> {selectedTask.project}</p>
                </div>
                <div className="bg-nova-bg rounded-lg p-3">
                  <span className="text-[10px] text-nova-text-muted uppercase">Responsável</span>
                  <p className="text-sm font-medium flex items-center gap-1 mt-1"><User size={14} /> {selectedTask.assignee}</p>
                </div>
                <div className="bg-nova-bg rounded-lg p-3">
                  <span className="text-[10px] text-nova-text-muted uppercase">Prazo</span>
                  <p className="text-sm font-medium flex items-center gap-1 mt-1"><Calendar size={14} /> {new Date(selectedTask.deadline).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-nova-bg rounded-lg p-3">
                  <span className="text-[10px] text-nova-text-muted uppercase">Status</span>
                  <p className="text-sm font-medium mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                      selectedTask.status === 'todo' ? 'bg-gray-500/20 text-gray-400' :
                      selectedTask.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {selectedTask.status === 'todo' ? 'To Do' : selectedTask.status === 'in-progress' ? 'Em Andamento' : 'Concluído'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-nova-bg rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-nova-text">Progresso</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedTask.progress}
                      onChange={(e) => updateTask(selectedTask.id, { progress: parseInt(e.target.value) })}
                      className="w-32 h-1.5 accent-nova-accent cursor-pointer"
                    />
                    <span className="text-xs font-bold w-8 text-right">{selectedTask.progress}%</span>
                  </div>
                </div>
                <div className="w-full bg-nova-border rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      selectedTask.progress === 100 ? 'bg-green-500' :
                      selectedTask.progress > 50 ? 'bg-blue-500' :
                      selectedTask.progress > 0 ? 'bg-yellow-500' :
                      'bg-nova-text-muted'
                    }`}
                    style={{ width: `${selectedTask.progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-nova-text-muted">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-nova-bg-secondary border border-nova-border rounded-xl p-4">
              <div className="h-full flex items-center justify-center text-nova-text-muted">
                <div className="text-center py-8">
                  <ListTodo size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Selecione uma tarefa</p>
                  <p className="text-xs mt-1">Clique em uma tarefa na lista lateral para ver detalhes</p>
                </div>
              </div>
            </div>
          )}

          {/* Tarefas da semana */}
          {selectedTask === null && (
            <div className="bg-nova-bg-secondary border border-nova-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-nova-text-secondary mb-3 uppercase tracking-wider">Tarefas da Semana</h3>
              {assigneeGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assigneeGroups.map(([name, assigneeTasks]) => (
                    <div key={name} className="border border-nova-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <User size={14} className="text-nova-text-secondary" />
                        <span className="font-semibold text-sm">{name}</span>
                        <span className="text-[10px] text-nova-text-muted ml-auto">{assigneeTasks.length}</span>
                      </div>
                      {assigneeTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="w-full text-left bg-nova-bg border border-nova-border rounded p-2 mb-1 hover:bg-nova-hover/40 transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <Circle size={6} fill={STATUS_COLORS[task.status]} color={STATUS_COLORS[task.status]} />
                            <span className="text-xs truncate">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-nova-text-muted">
                            <span>{task.progress}%</span>
                            <span>{new Date(task.deadline).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-nova-text-muted text-xs">
                  <p>Nenhuma tarefa com prazo nesta semana</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-nova-bg border border-nova-border rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-nova-border flex items-center justify-between">
              <h3 className="font-semibold">{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
              <button onClick={() => { setShowModal(false); setEditingTask(null); }} className="p-1 hover:bg-nova-hover rounded">
                <ChevronDown size={20} className="text-nova-text-muted" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Nº Chamado (opcional)</label>
                  <input type="text" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                    value={formData.ticketNumber} onChange={(e) => setFormData({...formData, ticketNumber: e.target.value})} placeholder="Ex: #1234" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Responsável</label>
                  <input type="text" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                    value={formData.assignee} onChange={(e) => setFormData({...formData, assignee: e.target.value})} placeholder="Nome da pessoa" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Título / Assunto</label>
                <input required type="text" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                  value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Descrição da tarefa" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Projeto</label>
                  <input required type="text" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                    value={formData.project} onChange={(e) => setFormData({...formData, project: e.target.value})} placeholder="Nome do projeto" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Data Final</label>
                  <input required type="date" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                    value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Progresso (%)</label>
                  <input type="number" min="0" max="100" className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                    value={formData.progress} onChange={(e) => setFormData({...formData, progress: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nova-text-secondary mb-1 uppercase">Status</label>
                  <select className="w-full bg-nova-input-bg border border-nova-input-border rounded px-3 py-2 text-sm text-nova-text"
                    value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})}>
                    <option value="todo">To Do</option>
                    <option value="in-progress">Em Andamento</option>
                    <option value="done">Concluído</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-nova-border">
                <button type="button" onClick={() => { setShowModal(false); setEditingTask(null); }}
                  className="px-4 py-2 bg-nova-bg-tertiary border border-nova-border rounded hover:bg-nova-hover text-nova-text">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-nova-accent text-white rounded hover:bg-nova-accent-hover">
                  {editingTask ? 'Salvar Alterações' : 'Adicionar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
