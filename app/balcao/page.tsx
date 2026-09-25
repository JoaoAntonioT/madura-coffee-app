'use client'

import { useEffect, useState, useTransition } from 'react'
import { supabase } from '../../lib/supabase'
import { Lock, Coffee, Users, LogOut, CheckCircle, Store, DollarSign, Loader2, UserPlus, LayoutDashboard } from 'lucide-react'
import { cadastrarMembro, confirmarPagamento, marcarPronto } from './actions'

type TeamMember = {
  id: string
  name: string
  role: 'ADMIN' | 'BARISTA' | 'VENDEDOR'
}

type Order = {
  id: string
  short_id: string
  customer_name: string
  total_amount: number
  status: string
  payment_method: string
  created_at: string
}

export default function Balcao() {
  const [user, setUser] = useState<TeamMember | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState('')
  
  // Nova aba ATENDIMENTO adicionada
  const [activeTab, setActiveTab] = useState<'ATENDIMENTO' | 'CAIXA' | 'PREPARO' | 'EQUIPE'>('ATENDIMENTO')
  const [orders, setOrders] = useState<Order[]>([])
  
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Verifica login salvo e direciona para a aba principal de cada cargo
  useEffect(() => {
    const savedUser = localStorage.getItem('balcao_user')
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)
      
      if (parsedUser.role === 'VENDEDOR') setActiveTab('ATENDIMENTO')
      else if (parsedUser.role === 'BARISTA') setActiveTab('PREPARO')
      else setActiveTab('ATENDIMENTO') // Admin
    }
  }, [])

  // Relógio que busca os pedidos a cada 5 segundos dependendo da aba
  useEffect(() => {
    if (!user || activeTab === 'EQUIPE') return

    const fetchOrders = async () => {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: true })

      if (activeTab === 'CAIXA') {
        query = query.eq('status', 'AWAITING_PAYMENT').eq('payment_method', 'manual')
      } 
      else if (activeTab === 'PREPARO') {
        query = query.eq('status', 'PAID')
      }
      else if (activeTab === 'ATENDIMENTO') {
        // Busca tanto os manuais pendentes quanto os pagos na fila
        query = query.or('status.eq.PAID,and(status.eq.AWAITING_PAYMENT,payment_method.eq.manual)')
      }
      
      const { data } = await query
      if (data) setOrders(data)
    }

    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [user, activeTab])

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const { data } = await supabase.from('team').select('*').eq('pin', pinInput).single()

    if (data) {
      setUser(data)
      localStorage.setItem('balcao_user', JSON.stringify(data))
      setPinInput('')
      
      if (data.role === 'VENDEDOR') setActiveTab('ATENDIMENTO')
      else if (data.role === 'BARISTA') setActiveTab('PREPARO')
      else setActiveTab('ATENDIMENTO')
    } else {
      setError('PIN incorreto ou não encontrado.')
    }
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('balcao_user')
  }

  // Ações via Server Actions
  const handleCadastro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await cadastrarMembro(formData)
      if (res.success) {
        alert('Membro cadastrado com sucesso!')
        form.reset()
      } else {
        alert(`Erro: ${res.error}`)
      }
    })
  }

  const handleConfirmarPagamento = (orderId: string) => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await confirmarPagamento(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
      else setOrders(prev => prev.filter(o => o.id !== orderId))
      setLoadingId(null)
    })
  }

  const handleMarcarPronto = (orderId: string) => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await marcarPronto(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
      else setOrders(prev => prev.filter(o => o.id !== orderId))
      setLoadingId(null)
    })
  }

  // ==========================================
  // TELA DE LOGIN
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen bg-amber-900 flex items-center justify-center p-4">
        {/* ... (Seu código de login continua o mesmo) ... */}
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Acesso Restrito</h1>
          <p className="text-gray-500 mb-6">Digite seu PIN de acesso à operação</p>
          
          <form onSubmit={handleLogin}>
            <input 
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="******"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-widest border-2 border-gray-200 rounded-xl p-4 mb-4 focus:border-amber-900 focus:ring-0 outline-none"
            />
            {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}
            <button type="submit" className="w-full bg-amber-900 text-white font-bold py-4 rounded-xl hover:bg-amber-800 transition-colors">
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Divisão das listas para a aba de Atendimento
  const pedidosACobrar = orders.filter(o => o.status === 'AWAITING_PAYMENT')
  const pedidosEmPreparo = orders.filter(o => o.status === 'PAID')

  // ==========================================
  // TELA DA CENTRAL DE OPERAÇÕES
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-amber-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-black text-lg flex items-center gap-2">
            <Store size={20} /> Operação Madura
          </h1>
          <p className="text-amber-200 text-sm font-medium flex items-center gap-2">
            {user.name} 
            <span className="bg-amber-800 px-2 py-0.5 rounded text-xs">{user.role}</span>
          </p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-amber-800 rounded-lg hover:bg-amber-700 transition">
          <LogOut size={20} />
        </button>
      </header>

      {/* MENU SUPERIOR BASEADO EM REGRAS (RBAC) */}
      <div className="bg-white border-b flex px-2 overflow-x-auto">
        
        {/* TODOS VEEM A ABA ATENDIMENTO (Visão Geral) */}
        <button 
          onClick={() => setActiveTab('ATENDIMENTO')}
          className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'ATENDIMENTO' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'
          }`}
        >
          <LayoutDashboard size={20} /> Visão de Atendimento
        </button>

        {(user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
          <button 
            onClick={() => setActiveTab('CAIXA')}
            className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'CAIXA' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'
            }`}
          >
            <DollarSign size={20} /> Caixa Rápido
          </button>
        )}

        {(user.role === 'ADMIN' || user.role === 'BARISTA') && (
          <button 
            onClick={() => setActiveTab('PREPARO')}
            className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'PREPARO' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'
            }`}
          >
            <Coffee size={20} /> Fila de Preparo
          </button>
        )}
        
        {user.role === 'ADMIN' && (
          <button 
            onClick={() => setActiveTab('EQUIPE')}
            className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'EQUIPE' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'
            }`}
          >
            <Users size={20} /> Equipe
          </button>
        )}
      </div>

      <main className="p-4 flex-1 w-full mx-auto max-w-7xl">
        
        {/* ABA ATENDIMENTO (VISÃO GERAL DO SALÃO) */}
        {activeTab === 'ATENDIMENTO' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Coluna 1: A Cobrar (Foco do Vendedor) */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-700 text-lg flex items-center gap-2">
                <DollarSign className="text-amber-500" /> Aguardando Pagamento ({pedidosACobrar.length})
              </h2>
              {pedidosACobrar.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-500 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-xl text-amber-900">#{order.short_id}</h3>
                    <p className="text-gray-600 font-medium text-sm">{order.customer_name}</p>
                    <p className="text-md font-black text-gray-800 mt-1">R$ {order.total_amount.toFixed(2)}</p>
                  </div>
                  {/* Botão visível apenas se o usuário tiver permissão */}
                  {(user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
                    <button 
                      onClick={() => handleConfirmarPagamento(order.id)}
                      disabled={isPending && loadingId === order.id}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} 
                      Receber
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Coluna 2: Fila de Produção (Foco do Barista) */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-700 text-lg flex items-center gap-2">
                <Coffee className="text-amber-900" /> Em Produção ({pedidosEmPreparo.length})
              </h2>
              {pedidosEmPreparo.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-900 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-xl text-gray-800">#{order.short_id}</h3>
                    <p className="text-gray-600 font-medium text-sm">{order.customer_name}</p>
                  </div>
                  {/* Botão visível apenas se o usuário tiver permissão */}
                  {(user.role === 'ADMIN' || user.role === 'BARISTA') && (
                    <button 
                      onClick={() => handleMarcarPronto(order.id)}
                      disabled={isPending && loadingId === order.id}
                      className="bg-amber-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-800 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />} 
                      Pronto
                    </button>
                  )}
                </div>
              ))}
            </div>
            
          </div>
        )}

        {/* ABA CAIXA (ISOLADA) */}
        {activeTab === 'CAIXA' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {orders.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-500 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="font-black text-2xl text-amber-900">#{order.short_id}</h3>
                  <p className="text-gray-600 font-medium">{order.customer_name}</p>
                  <p className="text-lg font-black text-gray-800 mt-1">R$ {order.total_amount.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => handleConfirmarPagamento(order.id)}
                  disabled={isPending && loadingId === order.id}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-bold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isPending && loadingId === order.id ? <Loader2 className="animate-spin" /> : <CheckCircle />} 
                  Confirmar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ABA PREPARO (ISOLADA) */}
        {activeTab === 'PREPARO' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {orders.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-900 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="font-black text-xl text-gray-800">#{order.short_id}</h3>
                  <p className="text-gray-600 font-medium">{order.customer_name}</p>
                </div>
                <button 
                  onClick={() => handleMarcarPronto(order.id)}
                  disabled={isPending && loadingId === order.id}
                  className="bg-amber-900 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-bold hover:bg-amber-800 transition disabled:opacity-50"
                >
                  {isPending && loadingId === order.id ? <Loader2 className="animate-spin" /> : <Coffee />} 
                  Pronto
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ABA EQUIPE */}
        {activeTab === 'EQUIPE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-md mx-auto border">
             {/* ... (Seu formulário de cadastro que já fizemos continua igual aqui) ... */}
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <UserPlus className="text-amber-900" size={24} />
              <h2 className="text-xl font-black text-gray-800">Cadastrar Operador</h2>
            </div>

            <form onSubmit={handleCadastro} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                <input name="name" type="text" required className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-amber-900 focus:outline-none" placeholder="Ex: Maria Vendedora"/>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">PIN de Acesso (6 dígitos)</label>
                <input name="pin" type="password" pattern="[0-9]*" inputMode="numeric" required maxLength={6} className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-amber-900 focus:outline-none" placeholder="******"/>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cargo / Permissão</label>
                <select name="role" required className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-amber-900 focus:outline-none bg-white">
                  <option value="BARISTA">Barista (Fila de Preparo)</option>
                  <option value="VENDEDOR">Vendedor (Cobranças)</option>
                  <option value="ADMIN">Administrador (Acesso Total)</option>
                </select>
              </div>

              <button type="submit" disabled={isPending} className="w-full bg-amber-900 text-white font-black py-4 rounded-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-70 hover:bg-amber-800 transition-colors">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar Membro'}
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  )
}