import { useState, useEffect } from 'react'
import { useSkillStore } from '../../store/skillStore'
import { Plus, Trash2, Edit3, ToggleLeft, ToggleRight, Zap, X, Save, FileText } from 'lucide-react'

export default function SkillsPanel() {
  const {
    skills,
    editingSkillId,
    addSkill,
    updateSkill,
    removeSkill,
    toggleSkill,
    setEditingSkillId,
  } = useSkillStore()

  const [isCreating, setIsCreating] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formContent, setFormContent] = useState('')

  const editingSkill = skills.find(s => s.id === editingSkillId)

  useEffect(() => {
    if (editingSkill) {
      setFormName(editingSkill.name)
      setFormDesc(editingSkill.description)
      setFormContent(editingSkill.content)
      setIsCreating(true)
    }
  }, [editingSkillId])

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormContent('')
    setIsCreating(false)
    setEditingSkillId(null)
  }

  const handleSave = () => {
    if (!formName.trim() || !formContent.trim()) return

    if (editingSkillId) {
      updateSkill(editingSkillId, {
        name: formName.trim(),
        description: formDesc.trim(),
        content: formContent.trim(),
      })
    } else {
      addSkill(formName.trim(), formDesc.trim(), formContent.trim())
    }
    resetForm()
  }

  const handleDelete = (id: string) => {
    removeSkill(id)
    if (editingSkillId === id) {
      resetForm()
    }
  }

  const activeCount = skills.filter(s => s.active).length

  return (
    <div className="h-full flex flex-col bg-nova-bg-secondary">
      {/* Header */}
      <div className="p-4 border-b border-nova-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-nova-text flex items-center gap-2">
            <Zap size={16} className="text-nova-accent" />
            Skills da IA
          </h2>
          <span className="text-[10px] text-nova-text-muted bg-nova-bg px-2 py-0.5 rounded-full">
            {activeCount}/{skills.length} ativas
          </span>
        </div>
        <p className="text-[10px] text-nova-text-muted">
          Skills são instruções que serão adicionadas automaticamente no prompt de qualquer IA configurada.
        </p>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {skills.length === 0 && !isCreating && (
          <div className="text-center py-8">
            <FileText size={28} className="text-nova-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-[11px] text-nova-text-muted">Nenhuma skill criada ainda.</p>
            <p className="text-[10px] text-nova-text-muted mt-1">Crie skills para instruir as IAs.</p>
          </div>
        )}

        {skills.map(skill => (
          <div
            key={skill.id}
            className={`border rounded-lg p-3 transition-all ${
              skill.active
                ? 'border-nova-accent/30 bg-nova-accent/5'
                : 'border-nova-border bg-nova-bg opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[12px] font-semibold text-nova-text truncate">{skill.name}</h3>
                  {skill.active && (
                    <span className="text-[9px] text-nova-accent bg-nova-accent/10 px-1.5 py-0.5 rounded">
                      ativa
                    </span>
                  )}
                </div>
                {skill.description && (
                  <p className="text-[10px] text-nova-text-muted mt-0.5 truncate">{skill.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleSkill(skill.id)}
                  className="text-nova-text-muted hover:text-nova-accent transition-colors p-1"
                  title={skill.active ? 'Desativar' : 'Ativar'}
                >
                  {skill.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button
                  onClick={() => setEditingSkillId(skill.id)}
                  className="text-nova-text-muted hover:text-nova-accent transition-colors p-1"
                  title="Editar"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(skill.id)}
                  className="text-nova-text-muted hover:text-red-400 transition-colors p-1"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Form */}
      <div className="border-t border-nova-border p-3">
        {isCreating ? (
          <div className="space-y-3">
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Nome da skill"
              className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg px-3 py-2 text-xs text-nova-text outline-none focus:border-nova-accent transition-colors"
              autoFocus
            />
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Descrição curta (opcional)"
              className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg px-3 py-2 text-xs text-nova-text outline-none focus:border-nova-accent transition-colors"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Instruções da skill — será injetado no prompt da IA"
              className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg px-3 py-2 text-xs text-nova-text outline-none focus:border-nova-accent transition-colors resize-none"
              rows={5}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!formName.trim() || !formContent.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-nova-accent text-white text-xs font-medium hover:bg-nova-accent-hover disabled:opacity-40 transition-colors"
              >
                <Save size={12} />
                {editingSkillId ? 'Atualizar' : 'Salvar'}
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-nova-border text-nova-text-muted text-xs hover:text-nova-text transition-colors"
              >
                <X size={12} />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-nova-border text-nova-text-muted text-xs hover:border-nova-accent hover:text-nova-accent transition-colors"
          >
            <Plus size={14} />
            Nova Skill
          </button>
        )}
      </div>
    </div>
  )
}
