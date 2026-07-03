import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { User, Lock, UserPlus, LogIn, Eye, EyeOff, Loader2, Code2, Users } from 'lucide-react'
import logo from '../../assets/logo.png'

export default function LoginScreen() {
  const { login, register, initAuth, isAuthLoading, onlineUsers, startPing, stopPing } = useAuthStore()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nome, setNome] = useState('')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    initAuth()
  }, [])

  // Inicia ping da sessão quando usuário loga
  useEffect(() => {
    const user = useAuthStore.getState().user
    if (user) {
      startPing()
    }
    return () => {
      stopPing()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!usuario.trim() || !senha.trim()) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    if (mode === 'register') {
      if (!nome.trim()) {
        setError('Preencha o nome completo')
        return
      }
      if (senha.length < 4) {
        setError('A senha deve ter pelo menos 4 caracteres')
        return
      }
      if (senha !== confirmSenha) {
        setError('As senhas não conferem')
        return
      }

      const result = await register(nome, usuario, senha)
      if (result.success) {
        setSuccessMsg('Conta criada com sucesso!')
        setTimeout(() => setMode('login'), 1000)
      } else {
        setError(result.error || 'Erro ao cadastrar')
      }
    } else {
      const result = await login(usuario, senha)
      if (!result.success) {
        setError(result.error || 'Erro ao fazer login')
      }
    }
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-[#0a0f0d] via-[#0f1a15] to-[#080c0a]">
      {/* Left side - Branding */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-nova-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-nova-accent/3 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center">
          <img src={logo} alt="Ezek Editor" className="w-24 h-24 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-nova-text mb-3">Ezek Editor</h1>
          <p className="text-nova-text-muted text-sm max-w-md leading-relaxed">
            Editor de código moderno com inteligência artificial integrada, auditoria de segurança e muito mais.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            <div className="bg-white/5 border border-nova-border rounded-lg p-3">
              <Code2 size={16} className="text-nova-accent mb-1" />
              <p className="text-[11px] text-nova-text-secondary font-medium">IA Integrada</p>
              <p className="text-[10px] text-nova-text-muted">Multi-provedores</p>
            </div>
            <div className="bg-white/5 border border-nova-border rounded-lg p-3">
              <Lock size={16} className="text-nova-accent mb-1" />
              <p className="text-[11px] text-nova-text-secondary font-medium">Auditoria</p>
              <p className="text-[10px] text-nova-text-muted">OWASP Top 10</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <img src={logo} alt="Ezek Editor" className="w-16 h-16 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-nova-text">Ezek Editor</h2>
          </div>

          <div className="bg-nova-bg-secondary border border-nova-border rounded-xl p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-nova-accent/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                {mode === 'login' ? <LogIn size={22} className="text-nova-accent" /> : <UserPlus size={22} className="text-nova-accent" />}
              </div>
              <h2 className="text-lg font-semibold text-nova-text">
                {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
              </h2>
              <p className="text-xs text-nova-text-muted mt-1">
                {mode === 'login' ? 'Faça login para continuar' : 'Cadastre-se para começar'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-[11px] text-nova-text-secondary mb-1.5 font-medium">Nome completo</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nova-text-muted" />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-nova-text outline-none focus:border-nova-accent transition-colors"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-nova-text-secondary mb-1.5 font-medium">Usuário</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nova-text-muted" />
                  <input
                    type="text"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-nova-text outline-none focus:border-nova-accent transition-colors"
                    placeholder="Seu usuário"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-nova-text-secondary mb-1.5 font-medium">Senha</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nova-text-muted" />
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg pl-9 pr-10 py-2.5 text-sm text-nova-text outline-none focus:border-nova-accent transition-colors"
                    placeholder="Sua senha"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-nova-text-muted hover:text-nova-text"
                  >
                    {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-[11px] text-nova-text-secondary mb-1.5 font-medium">Confirmar senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nova-text-muted" />
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={confirmSenha}
                      onChange={(e) => setConfirmSenha(e.target.value)}
                      className="w-full bg-nova-input-bg border border-nova-input-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-nova-text outline-none focus:border-nova-accent transition-colors"
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-red-400">{error}</p>
                </div>
              )}

              {successMsg && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-green-400">{successMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full flex items-center justify-center gap-2 bg-nova-accent text-white rounded-lg py-2.5 text-sm font-medium hover:bg-nova-accent-hover transition-colors disabled:opacity-60"
              >
                {isAuthLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === 'login' ? (
                  <LogIn size={16} />
                ) : (
                  <UserPlus size={16} />
                )}
                {mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setError('')
                  setSuccessMsg('')
                }}
                className="text-[12px] text-nova-text-muted hover:text-nova-accent transition-colors"
              >
                {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
              </button>
            </div>

            {/* Online users counter */}
            <div className="mt-4 pt-3 border-t border-nova-border flex items-center justify-center gap-2">
              <Users size={13} className="text-nova-accent" />
              <span className="text-[11px] text-nova-text-muted">
                <span className="text-nova-accent font-semibold">{onlineUsers}</span> usuário{onlineUsers !== 1 ? 's' : ''} online
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
