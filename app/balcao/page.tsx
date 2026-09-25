'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Lock, Coffee, Users, LogOut, CheckCircle, Store, DollarSign } from 'lucide-react'

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
  
  const [activeTab, setActiveTab] = useState<'CAIXA' | 'PREPARO' | 'EQUIPE'>('PREPARO')
  const [orders, setOrders] = useState<Order[]>([])

  // Verifica login salvo
  useEffect(() => {
    const savedUser = localStorage.getItem('balcao_user')
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)
      // Direciona para a aba certa baseada na profissão
      if (parsedUser.role === 'VENDEDOR') setActiveTab('CAIXA')
      else if (parsedUser.role === 'BARISTA') setActiveTab('PREPARO')
      else setActiveTab('CAIXA') // Admin
    }
  }, [])

  // Relógio que busca os pedidos a cada 5 segundos dependendo da aba
  useEffect(() => {
    if (!user || activeTab === 'EQUIPE') return

    const fetchOrders = async () => {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: true })

      // Se estiver no CAIXA, busca só quem quer pagar no balcão
      if (activeTab === 'CAIXA') {
        query = query.eq('status', 'AWAITING_PAYMENT').eq('payment_method', 'manual')
      } 
      // Se estiver no PREPARO, busca só quem já pagou
      else if (activeTab === 'PREPARO') {
        query = query.eq('status', 'PAID')
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
      if (data.role === 'VENDEDOR') setActiveTab('CAIXA')
      else if (data.role === 'BARISTA') setActiveTab('PREPARO')
      else setActiveTab('CAIXA')
    } else {
      setError('PIN incorreto ou não encontrado.')
    }
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('balcao_user')
  }

  // ==========================================
  // TELA DE LOGIN
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen bg-amber-900 flex items-center justify-center p-4">
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

      {/* MENU DE NAVEGAÇÃO SUPERIOR - ADAPTÁVEL POR CARGO */}
      <div className="bg-white border-b flex px-2 overflow-x-auto">
        {(user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
          <button 
            onClick={() => setActiveTab('CAIXA')}
            className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'CAIXA' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'
            }`}
          >
            <DollarSign size={20} /> Cobranças (Caixa)
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

      {/* CONTEÚDO */}
      <main className="p-4 flex-1">
        
        {/* ABA CAIXA (SÓ VENDEDOR E ADMIN) */}
        {activeTab === 'CAIXA' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700 mb-4 text-lg">Pedidos aguardando pagamento no balcão:</h2>
            {orders.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Nenhuma cobrança pendente.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-500 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-2xl text-amber-900">#{order.short_id}</h3>
                    <p className="text-gray-600 font-medium">{order.customer_name}</p>
                    <p className="text-lg font-black text-gray-800 mt-1">R$ {order.total_amount.toFixed(2)}</p>
                  </div>
                  <button className="bg-green-600 text-white px-4 py-3 rounded-lg flex flex-col items-center font-bold hover:bg-green-700 transition">
                    <CheckCircle size={24} className="mb-1" /> 
                    Confirmar<br/>Recebimento
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA PREPARO (SÓ BARISTA E ADMIN) */}
        {activeTab === 'PREPARO' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700 mb-4 text-lg">Cafés já pagos aguardando preparo:</h2>
            {orders.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Fila limpa! Nenhum pedido pendente.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-900 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-xl text-gray-800">#{order.short_id}</h3>
                    <p className="text-gray-600 font-medium">{order.customer_name}</p>
                  </div>
                  <button className="bg-amber-900 text-white p-3 rounded-lg flex gap-2 font-bold hover:bg-amber-800 transition">
                    <Coffee size={20} /> 
                    Marcar como Pronto
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA EQUIPE (SÓ ADMIN) */}
        {activeTab === 'EQUIPE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="font-bold text-lg mb-4 text-gray-800">Gerenciar Time</h2>
            <p className="text-gray-500 text-sm">O formulário de cadastro de Baristas e Vendedores entrará aqui no próximo passo!</p>
          </div>
        )}

      </main>
    </div>
  )
}