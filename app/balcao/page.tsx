'use client'

import { useEffect, useState, useTransition } from 'react'
import { supabase } from '../../lib/supabase'
import { Lock, Coffee, Users, LogOut, CheckCircle, Store, DollarSign, Loader2, UserPlus, LayoutDashboard, Package, Plus, Trash2, Search, Clock, X, Banknote, CreditCard, Ban, Check, History, Download, RotateCcw, AlertTriangle, ClipboardList, Settings } from 'lucide-react'
import { cadastrarMembro, confirmarPagamento, marcarPronto, atualizarReceitaProduto, assumirPedido, limparPedidosExpirados, cancelarPedido, marcarComoEntregue, reativarPedido, reembolsarPedido, salvarInsumoEstoque, excluirInsumoEstoque, adicionarCategoria, editarCategoria, moverCategoria, excluirCategoria, salvarProduto, toggleProdutoDisponivel, excluirProduto, atualizarMetodosPagamento } from './actions'

// ==========================================
// TIPAGENS
// ==========================================
type TeamMember = {
  id: string
  name: string
  role: 'ADMIN' | 'BARISTA' | 'VENDEDOR'
}

type OrderItem = {
  id: string
  product_name: string
  quantity: number
}

type Order = {
  id: string
  short_id: string
  customer_name: string
  total_amount: number
  status: string
  payment_method: string
  created_at: string
  assigned_to?: string | null
  order_items?: OrderItem[]
}

type Ingredient = { name: string, quantity: number, unit: string }

type ProductInfo = {
  id: string
  name: string
  recipe_instructions: string | null
  recipe_ingredients: Ingredient[] | null
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
export default function Balcao() {
  const [user, setUser] = useState<TeamMember | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState('')
  
  const [activeTab, setActiveTab] = useState<'ATENDIMENTO' | 'CAIXA' | 'PREPARO' | 'EQUIPE' | 'PRODUTOS' | 'HISTORICO' | 'ESTOQUE' | 'CONFIG'>('ATENDIMENTO')
  const [paymentSettings, setPaymentSettings] = useState({ pix: true, credit_card: true, counter: true })
  const [orders, setOrders] = useState<Order[]>([])
  const [productsList, setProductsList] = useState<ProductInfo[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [estoque, setEstoque] = useState<{id: string, name: string, quantity: number, unit: string}[]>([])
  
  const [produtoSubTab, setProdutoSubTab] = useState<'CARDAPIO' | 'FICHAS'>('CARDAPIO')
  const [categoryModal, setCategoryModal] = useState<{id?: string, name: string, sort_order: number} | null>(null)
  const [produtoModal, setProdutoModal] = useState<{id?: string, category_id: string, name: string, description: string, price: number} | null>(null)
  
  const [historico, setHistorico] = useState<Order[]>([])
  
  const [historicoFilter, setHistoricoFilter] = useState<'ALL' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'>('ALL')
  const [detailModalOrder, setDetailModalOrder] = useState<Order | null>(null)
  const [refundStep, setRefundStep] = useState<0 | 1 | 2>(0) // 0: Nenhum, 1: Escolhendo tipo, 2: Digitando valor
  const [refundAmount, setRefundAmount] = useState('')
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([])

  const [busca, setBusca] = useState('')
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Modais
  const [checkoutModalOrder, setCheckoutModalOrder] = useState<Order | null>(null)
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null)
  const [insumoModal, setInsumoModal] = useState<{id?: string, name: string, quantity: number, unit: string} | null>(null)

  // Verifica login salvo
  useEffect(() => {
    const savedUser = localStorage.getItem('balcao_user')
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)
      if (parsedUser.role === 'VENDEDOR') setActiveTab('ATENDIMENTO')
      else if (parsedUser.role === 'BARISTA') setActiveTab('PREPARO')
      else setActiveTab('ATENDIMENTO')
    }
  }, [])

  // ==========================================
  // RELÓGIO, BUSCA E LIMPEZA DE EXPIRADOS
  // ==========================================
  useEffect(() => {
    if (!user || activeTab === 'EQUIPE') return

    if (activeTab === 'HISTORICO') {
      const fetchHistorico = async () => {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('status', ['DELIVERED', 'CANCELLED', 'EXPIRED', 'REFUNDED'])
          .gte('created_at', startOfDay.toISOString())
          .order('created_at', { ascending: false })
          .limit(100)
          
        if (data) setHistorico(data)
        
        if (teamMembers.length === 0) {
          const { data: tData } = await supabase.from('team').select('id, name')
          if (tData) setTeamMembers(tData)
        }
      }
      fetchHistorico()
      return
    }

    if (activeTab === 'ESTOQUE') {
      const fetchEstoque = async () => {
        const { data } = await supabase.from('inventory').select('*').order('name')
        if (data) setEstoque(data)
      }
      fetchEstoque()
      return
    }

    if (activeTab === 'PRODUTOS') {
      const fetchData = async () => {
        const { data: catData } = await supabase.from('categories').select('*').order('sort_order')
        if (catData) setCategories(catData)

        const { data: prodData } = await supabase.from('products').select('*').order('name')
        if (prodData) setProductsList(prodData)

        if (estoque.length === 0) {
          const { data: inv } = await supabase.from('inventory').select('*').order('name')
          if (inv) setEstoque(inv)
        }
      }
      fetchData()
      return
    }

    if (activeTab === 'CONFIG') {
      const fetchConfig = async () => {
        const { data } = await supabase.from('settings').select('value').eq('id', 'payment_methods').single()
        if (data) setPaymentSettings(data.value)
      }
      fetchConfig()
      return
    }

    setOrders([]) 

    const fetchOrders = async () => {
      await limparPedidosExpirados()

      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['CREATED', 'PENDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT', 'PAID', 'IN_PRODUCTION', 'READY'])
        .order('created_at', { ascending: true })

      if (data) {
        let filtrados = data
        if (activeTab === 'CAIXA') {
          filtrados = data.filter(o => o.status === 'CREATED' || o.status === 'PENDING' || o.status.includes('AWAITING'))
        } 
        else if (activeTab === 'PREPARO') {
          filtrados = data.filter(o => o.status === 'PAID' || o.status === 'IN_PRODUCTION')
        } 
        else if (activeTab === 'ATENDIMENTO') {
          filtrados = data.filter(o => 
            o.status === 'PAID' || o.status === 'IN_PRODUCTION' || 
            o.status === 'CREATED' || o.status === 'PENDING' || o.status.includes('AWAITING') || o.status === 'READY'
          )
        }
        setOrders(filtrados)
      }
    }

    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [user, activeTab])

  // ==========================================
  // HANDLERS E AÇÕES
  // ==========================================
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

  const handleCadastro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const res = await cadastrarMembro(formData)
      if (res.success) { 
        alert('Membro cadastrado!')
        form.reset() 
      }
      else {
        alert(`Erro: ${res.error}`)
      }
    })
  }

  // HANDLERS CARDAPIO
  const handleSalvarCategoria = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!categoryModal) return
    startTransition(async () => {
      const res = categoryModal.id 
        ? await editarCategoria(categoryModal.id, categoryModal.name)
        : await adicionarCategoria(categoryModal.name, categoryModal.sort_order)
      
      if (res.success) setCategoryModal(null)
      else alert(`Erro: ${res.error}`)
    })
  }

  const handleExcluirCategoria = (id: string) => {
    if (!confirm('Deseja excluir esta categoria? Os produtos precisam ser realocados antes.')) return
    startTransition(async () => {
      const res = await excluirCategoria(id)
      if (res.success) setCategoryModal(null)
      else alert(`Erro: ${res.error}`)
    })
  }

  const handleMoverCategoria = (id: string, currentOrder: number, direction: 'up' | 'down') => {
    startTransition(async () => {
      await moverCategoria(id, currentOrder, direction)
    })
  }

  const handleSalvarProduto = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!produtoModal) return
    startTransition(async () => {
      const res = await salvarProduto(produtoModal.id || null, produtoModal.category_id, produtoModal.name, produtoModal.description, produtoModal.price)
      if (res.success) setProdutoModal(null)
      else alert(`Erro: ${res.error}`)
    })
  }

  const handleToggleProduto = (id: string, is_available: boolean) => {
    startTransition(async () => {
      await toggleProdutoDisponivel(id, is_available)
    })
  }

  const handleExcluirProduto = (id: string) => {
    if (!confirm('Excluir este produto permanentemente?')) return
    startTransition(async () => {
      const res = await excluirProduto(id)
      if (res.success) setProdutoModal(null)
      else alert(`Erro: ${res.error}`)
    })
  }

  const handleConfirmarPagamentoFinal = (orderId: string, tipo: 'dinheiro' | 'maquininha') => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await confirmarPagamento(orderId, tipo)
      if (!res.success) alert(`Erro: ${res.error}`)
      setCheckoutModalOrder(null)
      setLoadingId(null)
    })
  }

  const handleConfirmarCancelamento = (orderId: string) => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await cancelarPedido(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
      setCancelModalOrder(null)
      setLoadingId(null)
    })
  }

  const handleAssumir = (orderId: string) => {
    if (!user) return
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await assumirPedido(orderId, user.id)
      if (!res.success) alert(`Aviso: ${res.error}`)
      setLoadingId(null)
    })
  }

  const handleMarcarPronto = (orderId: string) => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await marcarPronto(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
      setLoadingId(null)
    })
  }

  const handleEntregar = (orderId: string) => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await marcarComoEntregue(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
      setLoadingId(null)
    })
  }

  const handleReativar = (orderId: string) => {
    if (!confirm('Deseja realmente voltar este pedido para a fila (Status Pago)?')) return
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await reativarPedido(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
      else setDetailModalOrder(null)
      setLoadingId(null)
    })
  }

  const handleReembolsar = (orderId: string, isPartial: boolean) => {
    let amount = undefined
    if (isPartial) {
      const val = parseFloat(refundAmount)
      if (isNaN(val) || val <= 0) return alert('Digite um valor válido.')
      amount = val
    }
    
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await reembolsarPedido(orderId, isPartial, amount)
      if (!res.success) alert(`Erro: ${res.error}`)
      else {
        alert('Reembolso/Cancelamento processado com sucesso.')
        setDetailModalOrder(null)
        setRefundStep(0)
      }
      setLoadingId(null)
    })
  }

  const handleSalvarInsumo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!insumoModal) return
    startTransition(async () => {
      const res = await salvarInsumoEstoque(insumoModal.id || null, insumoModal.name, insumoModal.quantity, insumoModal.unit)
      if (!res.success) alert(`Erro: ${res.error}`)
      else {
        setInsumoModal(null)
        // Refresh local
        const { data } = await supabase.from('inventory').select('*').order('name')
        if (data) setEstoque(data)
      }
    })
  }

  const handleExcluirInsumo = async (id: string) => {
    if (!confirm('Deseja realmente remover este insumo do estoque?')) return
    startTransition(async () => {
      const res = await excluirInsumoEstoque(id)
      if (!res.success) alert(`Erro: ${res.error}`)
      else {
        setInsumoModal(null)
        // Refresh local
        setEstoque(estoque.filter(i => i.id !== id))
      }
    })
  }

  const handleExportCSV = () => {
    if (historico.length === 0) return alert('Nenhum dado para exportar.')

    const headers = ['ID', 'Cliente', 'Data/Hora', 'Status', 'Metodo Pagamento', 'Total', 'Itens']
    
    const rows = historico.map(order => {
      const itensFormatados = order.order_items?.map((i: any) => `${i.quantity}x ${i.product_name}`).join(' | ') || ''
      return [
        `#${order.short_id}`,
        order.customer_name,
        new Date(order.created_at).toLocaleString('pt-BR'),
        order.status,
        order.payment_method || 'N/A',
        order.total_amount.toFixed(2),
        itensFormatados
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio-madura-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ==========================================
  // TELA DE LOGIN
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#3E2723] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-[#3E2723] rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black text-[#3E2723] mb-2">Acesso Restrito</h1>
          <p className="text-custom-gray mb-6">Digite seu PIN de acesso à operação</p>
          <form onSubmit={handleLogin}>
            <input type="password" inputMode="numeric" maxLength={6} placeholder="******" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-3xl tracking-widest border-2 border-custom-border/20 rounded-xl p-4 mb-4 focus:border-[#3E2723] outline-none" />
            {error && <p className="text-red text-sm mb-4 font-medium">{error}</p>}
            <button type="submit" className="w-full bg-[#3E2723] text-white font-bold py-4 rounded-xl hover:bg-[#4E342E] transition-colors">Entrar</button>
          </form>
        </div>
      </div>
    )
  }

  // ==========================================
  // FILTRAGEM PELA BARRA DE PESQUISA
  // ==========================================
  const searchLower = busca.toLowerCase()
  const ordersFiltradasBusca = orders.filter(o => 
    String(o.short_id || '').toLowerCase().includes(searchLower) || 
    String(o.customer_name || '').toLowerCase().includes(searchLower)
  )

  const pedidosACobrar = ordersFiltradasBusca.filter(o => o.status === 'CREATED' || o.status === 'PENDING' || o.status.includes('AWAITING'))
  const pedidosEmPreparo = ordersFiltradasBusca.filter(o => o.status === 'PAID' || o.status === 'IN_PRODUCTION')
  const pedidosAguardandoRetirada = ordersFiltradasBusca.filter(o => o.status === 'READY')

  // ==========================================
  // TELA PRINCIPAL
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#3E2723] text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-black text-lg flex items-center gap-2">
            <Store size={20} /> Operação Madura
          </h1>
          <p className="text-amber-200 text-sm font-medium flex items-center gap-2">
            {user.name} <span className="bg-[#4E342E] px-2 py-0.5 rounded text-xs">{user.role}</span>
          </p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-[#4E342E] rounded-lg hover:bg-amber-700 transition"><LogOut size={20} /></button>
      </header>

      <div className="bg-white border-b border-custom-border/20 flex px-2 overflow-x-auto">
        <button onClick={() => setActiveTab('ATENDIMENTO')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'ATENDIMENTO' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><LayoutDashboard size={20} /> Visão de Atendimento</button>
        {(user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
          <button onClick={() => setActiveTab('CAIXA')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'CAIXA' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><DollarSign size={20} /> Caixa Rápido</button>
        )}
        {(user.role === 'ADMIN' || user.role === 'BARISTA') && (
          <button onClick={() => setActiveTab('PREPARO')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'PREPARO' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><Coffee size={20} /> Fila de Preparo</button>
        )}
        {user.role === 'ADMIN' && (
          <>
            <button onClick={() => setActiveTab('PRODUTOS')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'PRODUTOS' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><Package size={20} /> Produtos & Receitas</button>
            <button onClick={() => setActiveTab('EQUIPE')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'EQUIPE' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><Users size={20} /> Equipe</button>
            <button onClick={() => setActiveTab('HISTORICO')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'HISTORICO' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><History size={20} /> Histórico</button>
            <button onClick={() => setActiveTab('ESTOQUE')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'ESTOQUE' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><ClipboardList size={20} /> Estoque</button>
            <button onClick={() => setActiveTab('CONFIG')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b border-custom-border/20-2 transition-colors whitespace-nowrap ${activeTab === 'CONFIG' ? 'border-[#3E2723] text-[#3E2723]' : 'border-t border-custom-border/20ransparent text-custom-gray'}`}><Settings size={20} /> Ajustes</button>
          </>
        )}
      </div>

      <main className="p-4 flex-1 w-full mx-auto max-w-7xl">
        
        {/* BARRA DE PESQUISA */}
        {['ATENDIMENTO', 'CAIXA', 'PREPARO'].includes(activeTab) && (
          <div className="mb-6 max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-custom-gray" />
              </div>
              <input
                type="text"
                placeholder="Buscar por número do pedido (#1047) ou nome do cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-custom-border/30 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-900 focus:border-[#3E2723] sm:text-sm"
              />
            </div>
          </div>
        )}

        {/* ABA ATENDIMENTO */}
        {activeTab === 'ATENDIMENTO' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h2 className="font-bold text-medium-brown text-lg flex items-center gap-2">
                <DollarSign className="text-amber-500" /> Aguardando Pagamento ({pedidosACobrar.length})
              </h2>
              {pedidosACobrar.map(order => (
                <OrderCaixaCard key={order.id} order={order} user={user} onOpenCheckout={setCheckoutModalOrder} onOpenCancel={setCancelModalOrder} />
              ))}
              {pedidosACobrar.length === 0 && <p className="text-custom-gray text-sm italic">Nenhuma cobrança pendente.</p>}
            </div>

            <div className="space-y-4">
              <h2 className="font-bold text-medium-brown text-lg flex items-center gap-2">
                <Coffee className="text-[#3E2723]" /> Fila de Preparo ({pedidosEmPreparo.length})
              </h2>
              {pedidosEmPreparo.map(order => (
                <OrderPreparoCard key={order.id} order={order} user={user} isPending={isPending} loadingId={loadingId} onAssumir={handleAssumir} onPronto={handleMarcarPronto} />
              ))}
              {pedidosEmPreparo.length === 0 && <p className="text-custom-gray text-sm italic">Nenhum pedido na fila.</p>}
            </div>

            <div className="space-y-4">
              <h2 className="font-bold text-medium-brown text-lg flex items-center gap-2">
                <CheckCircle className="text-green" /> Aguardando Retirada ({pedidosAguardandoRetirada.length})
              </h2>
              {pedidosAguardandoRetirada.map(order => (
                <OrderRetiradaCard key={order.id} order={order} isPending={isPending} loadingId={loadingId} onEntregar={handleEntregar} />
              ))}
              {pedidosAguardandoRetirada.length === 0 && <p className="text-custom-gray text-sm italic">Nenhum pedido pronto para entrega.</p>}
            </div>
          </div>
        )}

        {/* ABA CAIXA ISOLADA */}
        {activeTab === 'CAIXA' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {pedidosACobrar.map(order => (
              <OrderCaixaCard key={order.id} order={order} user={user} onOpenCheckout={setCheckoutModalOrder} onOpenCancel={setCancelModalOrder} />
            ))}
          </div>
        )}

        {/* ABA PREPARO ISOLADA */}
        {activeTab === 'PREPARO' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {pedidosEmPreparo.map(order => (
               <OrderPreparoCard key={order.id} order={order} user={user} isPending={isPending} loadingId={loadingId} onAssumir={handleAssumir} onPronto={handleMarcarPronto} />
            ))}
          </div>
        )}

        {/* ABA PRODUTOS E RECEITAS */}
        {activeTab === 'PRODUTOS' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between border-b border-custom-border/20 pb-4">
              <div className="flex items-center gap-2">
                <Package className="text-[#3E2723]" size={24} />
                <h2 className="text-xl font-black text-[#3E2723]">Cardápio & Fichas Técnicas</h2>
              </div>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setProdutoSubTab('CARDAPIO')} 
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${produtoSubTab === 'CARDAPIO' ? 'bg-white text-[#3E2723] shadow-sm' : 'text-custom-gray hover:text-medium-brown'}`}
                >
                  Gestão de Cardápio
                </button>
                <button 
                  onClick={() => setProdutoSubTab('FICHAS')} 
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${produtoSubTab === 'FICHAS' ? 'bg-white text-[#3E2723] shadow-sm' : 'text-custom-gray hover:text-medium-brown'}`}
                >
                  Fichas Técnicas (Estoque)
                </button>
              </div>
            </div>

            {produtoSubTab === 'FICHAS' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {productsList.map(product => (
                  <RecipeFormCard key={product.id} product={product} estoque={estoque} />
                ))}
              </div>
            )}

            {produtoSubTab === 'CARDAPIO' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button onClick={() => setCategoryModal({name: '', sort_order: categories.length + 1})} className="bg-[#3E2723] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#4E342E] transition">
                    <Plus size={18} /> Nova Categoria
                  </button>
                </div>
                
                <div className="space-y-8">
                  {categories.map((cat, index) => {
                    const catProducts = productsList.filter(p => p.category_id === cat.id)
                    return (
                      <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-custom-border/20 overflow-hidden">
                        <div className="bg-white px-4 py-3 border-b border-custom-border/20 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <h3 className="font-black text-lg text-[#3E2723]">{cat.name}</h3>
                            <button onClick={() => setCategoryModal(cat)} className="text-custom-gray hover:text-[#3E2723] text-sm font-bold">Editar</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button disabled={index === 0} onClick={() => handleMoverCategoria(cat.id, cat.sort_order, 'up')} className="p-1 text-custom-gray hover:text-[#3E2723] disabled:opacity-30">⬆️</button>
                            <button disabled={index === categories.length - 1} onClick={() => handleMoverCategoria(cat.id, cat.sort_order, 'down')} className="p-1 text-custom-gray hover:text-[#3E2723] disabled:opacity-30">⬇️</button>
                            <button onClick={() => handleExcluirCategoria(cat.id)} className="p-1 text-red hover:text-red"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="space-y-3">
                            {catProducts.map(prod => (
                              <div key={prod.id} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${!prod.is_available ? 'bg-white opacity-60' : 'hover:bg-white'}`}>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-bold text-[#3E2723]">{prod.name}</p>
                                      <p className="text-sm text-custom-gray mt-1 max-w-lg truncate">{prod.description}</p>
                                    </div>
                                    <div className="text-right ml-4">
                                      <p className="font-black text-[#3E2723]">R$ {prod.price?.toFixed(2)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-6 flex items-center gap-4 border-l pl-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={prod.is_available} onChange={(e) => handleToggleProduto(prod.id, e.target.checked)} className="w-4 h-4 accent-yellow cursor-pointer" />
                                    <span className={`text-sm font-bold ${prod.is_available ? 'text-green' : 'text-red'}`}>
                                      {prod.is_available ? 'Ativo' : 'Esgotado'}
                                    </span>
                                  </label>
                                  <button onClick={() => setProdutoModal(prod)} className="text-custom-gray hover:text-[#3E2723] font-bold text-sm bg-gray-100 px-3 py-1 rounded">Editar</button>
                                </div>
                              </div>
                            ))}
                            {catProducts.length === 0 && <p className="text-sm text-custom-gray italic">Nenhum produto nesta categoria.</p>}
                          </div>
                          <button onClick={() => setProdutoModal({name: '', description: '', price: 0, category_id: cat.id})} className="mt-4 text-[#3E2723] font-bold text-sm flex items-center gap-1 hover:underline">
                            <Plus size={16} /> Adicionar Produto em {cat.name}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA HISTÓRICO */}
        {activeTab === 'HISTORICO' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border max-w-5xl mx-auto overflow-hidden">
            <div className="flex justify-between items-center mb-6 border-b border-custom-border/20 pb-4">
              <div className="flex items-center gap-2">
                <History className="text-[#3E2723]" size={24} />
                <h2 className="text-xl font-black text-[#3E2723]">Histórico de Hoje</h2>
              </div>
              <div className="flex gap-2">
                <select 
                  className="border border-custom-border/30 rounded-lg px-3 py-2 bg-white text-sm font-bold text-medium-brown outline-none"
                  value={historicoFilter}
                  onChange={(e) => setHistoricoFilter(e.target.value as any)}
                >
                  <option value="ALL">Todos</option>
                  <option value="DELIVERED">Entregues</option>
                  <option value="CANCELLED">Cancelados</option>
                  <option value="EXPIRED">Expirados</option>
                  <option value="REFUNDED">Reembolsados</option>
                </select>
                <button 
                  onClick={handleExportCSV} 
                  className="bg-green text-white px-4 py-2 rounded-lg font-bold hover:bg-green transition flex items-center gap-2"
                >
                  <Download size={18} /> Exportar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white border-b border-custom-border/20 border-custom-border/20 text-medium-brown text-sm">
                    <th className="p-3 font-bold">Pedido</th>
                    <th className="p-3 font-bold">Cliente</th>
                    <th className="p-3 font-bold">Horário</th>
                    <th className="p-3 font-bold">Status</th>
                    <th className="p-3 font-bold">Pagamento</th>
                    <th className="p-3 font-bold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-custom-gray">Nenhum pedido finalizado hoje.</td>
                    </tr>
                  ) : (
                    historico
                      .filter(order => historicoFilter === 'ALL' || order.status === historicoFilter)
                      .map(order => (
                      <tr key={order.id} onClick={() => setDetailModalOrder(order)} className="border-b border-custom-border/20 border-custom-border/10 hover:bg-white transition cursor-pointer">
                        <td className="p-3 font-bold text-[#3E2723]">#{order.short_id}</td>
                        <td className="p-3 text-medium-brown font-medium">{order.customer_name}</td>
                        <td className="p-3 text-custom-gray text-sm">{new Date(order.created_at).toLocaleTimeString('pt-BR')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            order.status === 'DELIVERED' ? 'bg-green text-green' :
                            order.status === 'CANCELLED' ? 'bg-red text-red' :
                            order.status === 'REFUNDED' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-[#3E2723]'
                          }`}>
                            {order.status === 'DELIVERED' ? 'ENTREGUE' : order.status === 'CANCELLED' ? 'CANCELADO' : order.status === 'REFUNDED' ? 'REEMBOLSADO' : 'EXPIRADO'}
                          </span>
                        </td>
                        <td className="p-3 text-custom-gray text-sm">{order.payment_method || '-'}</td>
                        <td className="p-3 font-black text-[#3E2723]">R$ {order.total_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA ESTOQUE */}
        {activeTab === 'ESTOQUE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border max-w-5xl mx-auto overflow-hidden">
            <div className="flex justify-between items-center mb-6 border-b border-custom-border/20 pb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-[#3E2723]" size={24} />
                <h2 className="text-xl font-black text-[#3E2723]">Estoque de Insumos</h2>
              </div>
              <button 
                onClick={() => setInsumoModal({ name: '', quantity: 0, unit: 'g' })}
                className="bg-[#3E2723] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#4E342E] transition flex items-center gap-2"
              >
                <Plus size={18} /> Novo Insumo
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white border-b border-custom-border/20 border-custom-border/20 text-medium-brown text-sm">
                    <th className="p-3 font-bold">Insumo</th>
                    <th className="p-3 font-bold text-center">Quantidade Atual</th>
                    <th className="p-3 font-bold">Unidade</th>
                    <th className="p-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {estoque.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-custom-gray">
                        Nenhum item carregado.<br/>
                        Verifique se a tabela <b>inventory</b> já foi criada no Supabase e se contém registros!
                      </td>
                    </tr>
                  ) : (
                    estoque.map(item => (
                      <tr key={item.id} onClick={() => setInsumoModal(item)} className="border-b border-custom-border/20 border-custom-border/10 hover:bg-white transition cursor-pointer">
                        <td className="p-3 font-bold text-[#3E2723]">{item.name}</td>
                        <td className="p-3 font-black text-xl text-[#3E2723] text-center">{item.quantity}</td>
                        <td className="p-3 text-custom-gray">{item.unit}</td>
                        <td className="p-3">
                          {item.quantity <= 0 ? (
                            <span className="bg-red text-red px-2 py-1 rounded text-xs font-bold">ESGOTADO</span>
                          ) : item.quantity < 20 ? (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">BAIXO</span>
                          ) : (
                            <span className="bg-green text-green px-2 py-1 rounded text-xs font-bold">NORMAL</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'EQUIPE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-md mx-auto border">
            <div className="flex items-center gap-2 mb-6 border-b border-custom-border/20 pb-4">
              <UserPlus className="text-[#3E2723]" size={24} />
              <h2 className="text-xl font-black text-[#3E2723]">Cadastrar Operador</h2>
            </div>
            <form onSubmit={handleCadastro} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-medium-brown mb-1">Nome Completo</label>
                <input name="name" type="text" required className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723]" placeholder="Ex: Maria Vendedora"/>
              </div>
              <div>
                <label className="block text-sm font-bold text-medium-brown mb-1">PIN de Acesso (6 dígitos)</label>
                <input name="pin" type="password" pattern="[0-9]*" inputMode="numeric" required maxLength={6} className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723]" placeholder="******"/>
              </div>
              <div>
                <label className="block text-sm font-bold text-medium-brown mb-1">Cargo / Permissão</label>
                <select name="role" required className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] bg-white">
                  <option value="BARISTA">Barista (Fila de Preparo)</option>
                  <option value="VENDEDOR">Vendedor (Cobranças)</option>
                  <option value="ADMIN">Administrador (Acesso Total)</option>
                </select>
              </div>
              <button type="submit" disabled={isPending} className="w-full bg-[#3E2723] text-white font-black py-4 rounded-lg flex items-center justify-center gap-2 mt-4 hover:bg-[#4E342E] transition-colors disabled:opacity-50">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar Membro'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL 1: CHECKOUT EM 2 ETAPAS                */}
        {/* ========================================== */}
        {checkoutModalOrder && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95">
              <button onClick={() => setCheckoutModalOrder(null)} className="absolute top-4 right-4 text-custom-gray hover:text-medium-brown"><X size={24} /></button>
              
              <h3 className="font-black text-2xl text-[#3E2723] mb-1">#{checkoutModalOrder.short_id}</h3>
              <p className="text-medium-brown font-medium mb-4">{checkoutModalOrder.customer_name}</p>

              <div className="bg-white p-4 rounded-lg border border-custom-border/10 space-y-2 mb-4">
                <p className="text-xs font-bold text-custom-gray uppercase">Conferência dos Itens</p>
                <ul className="space-y-1">
                  {checkoutModalOrder.order_items?.map((item: any) => (
                    <li key={item.id} className="text-sm font-bold text-medium-brown flex justify-between">
                      <span><span className="text-yellow">{item.quantity}x</span> {item.product_name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center mb-6 border-b border-custom-border/20 pb-4">
                <span className="font-bold text-custom-gray">TOTAL A COBRAR</span>
                <span className="text-2xl font-black text-[#3E2723]">R$ {checkoutModalOrder.total_amount.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleConfirmarPagamentoFinal(checkoutModalOrder.id, 'dinheiro')}
                  disabled={isPending && loadingId === checkoutModalOrder.id}
                  className="bg-green-50 text-green border-2 border-green-200 py-4 rounded-xl font-black flex flex-col items-center gap-2 hover:bg-green transition disabled:opacity-50"
                >
                  <Banknote size={24} /> Em Dinheiro
                </button>
                <button 
                  onClick={() => handleConfirmarPagamentoFinal(checkoutModalOrder.id, 'maquininha')}
                  disabled={isPending && loadingId === checkoutModalOrder.id}
                  className="bg-blue-50 text-blue-700 border-2 border-b border-custom-border/20lue-200 py-4 rounded-xl font-black flex flex-col items-center gap-2 hover:bg-blue-100 transition disabled:opacity-50"
                >
                  <CreditCard size={24} /> Na Maquininha
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL 2: CANCELAR PEDIDO                     */}
        {/* ========================================== */}
        {cancelModalOrder && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl text-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-red text-red rounded-full flex items-center justify-center mx-auto mb-4"><Ban size={32} /></div>
              <h3 className="font-black text-xl text-[#3E2723] mb-2">Cancelar Pedido #{cancelModalOrder.short_id}?</h3>
              <p className="text-sm text-custom-gray mb-6">O pedido de {cancelModalOrder.customer_name} será arquivado e não aparecerá mais na fila.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setCancelModalOrder(null)} className="py-3 font-bold text-medium-brown bg-gray-100 rounded-lg hover:bg-gray-200">Voltar</button>
                <button 
                  onClick={() => handleConfirmarCancelamento(cancelModalOrder.id)}
                  disabled={isPending && loadingId === cancelModalOrder.id}
                  className="py-3 font-bold text-white bg-red rounded-lg hover:bg-red flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isPending && loadingId === cancelModalOrder.id ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL 3: DETALHES DO PEDIDO (HISTÓRICO)      */}
        {/* ========================================== */}
        {detailModalOrder && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95">
              <button onClick={() => setDetailModalOrder(null)} className="absolute top-4 right-4 text-custom-gray hover:text-medium-brown"><X size={24} /></button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 text-[#3E2723] rounded-full flex items-center justify-center">
                  <Coffee size={24} />
                </div>
                <div>
                  <h3 className="font-black text-2xl text-[#3E2723]">#{detailModalOrder.short_id}</h3>
                  <p className="text-custom-gray font-medium">{detailModalOrder.customer_name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-custom-border/10">
                    <p className="text-xs font-bold text-custom-gray mb-1">Status Final</p>
                    <p className="font-bold text-[#3E2723]">{detailModalOrder.status}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-custom-border/10">
                    <p className="text-xs font-bold text-custom-gray mb-1">Pagamento</p>
                    <p className="font-bold text-[#3E2723]">{detailModalOrder.payment_method || 'Não Pago'}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-custom-border/10">
                    <p className="text-xs font-bold text-custom-gray mb-1">Total</p>
                    <p className="font-bold text-[#3E2723]">R$ {detailModalOrder.total_amount.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-custom-border/10">
                    <p className="text-xs font-bold text-custom-gray mb-1">Responsável (Preparo)</p>
                    <p className="font-bold text-[#3E2723]">
                      {teamMembers.find(t => t.id === detailModalOrder.assigned_to)?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-custom-border/10">
                  <p className="text-xs font-bold text-custom-gray mb-2">Horários</p>
                  <ul className="text-sm text-medium-brown space-y-1">
                    <li><span className="font-bold">Criado em:</span> {new Date(detailModalOrder.created_at).toLocaleString('pt-BR')}</li>
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-lg border border-custom-border/10 mb-4">
                  <p className="text-xs font-bold text-custom-gray mb-2">Itens</p>
                  <ul className="space-y-1">
                    {detailModalOrder.order_items?.map((item: any) => (
                      <li key={item.id} className="text-sm font-bold text-medium-brown flex justify-between">
                        <span><span className="text-yellow">{item.quantity}x</span> {item.product_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* AREA DE AÇÕES SENSÍVEIS */}
                <div className="border-t border-custom-border/20 pt-4 mt-4">
                  {refundStep === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleReativar(detailModalOrder.id)}
                        disabled={isPending && loadingId === detailModalOrder.id}
                        className="py-3 font-bold text-medium-brown bg-gray-100 rounded-lg hover:bg-gray-200 flex justify-center items-center gap-2"
                      >
                        <RotateCcw size={18} /> Reativar
                      </button>
                      <button 
                        onClick={() => setRefundStep(1)}
                        className="py-3 font-bold text-white bg-red rounded-lg hover:bg-red flex justify-center items-center gap-2"
                      >
                        <AlertTriangle size={18} /> Reembolsar
                      </button>
                    </div>
                  ) : refundStep === 1 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-[#3E2723] text-center mb-2">Qual tipo de reembolso?</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => handleReembolsar(detailModalOrder.id, false)}
                          disabled={isPending && loadingId === detailModalOrder.id}
                          className="py-3 font-bold text-white bg-red rounded-lg hover:bg-red flex justify-center items-center gap-2"
                        >
                          {isPending && loadingId === detailModalOrder.id ? <Loader2 size={16} className="animate-spin" /> : 'Reembolso Total'}
                        </button>
                        <button 
                          onClick={() => setRefundStep(2)}
                          className="py-3 font-bold text-red bg-red-50 border border-red-200 rounded-lg hover:bg-red flex justify-center items-center gap-2"
                        >
                          Valor Parcial
                        </button>
                      </div>
                      <button onClick={() => setRefundStep(0)} className="w-full py-2 text-sm text-custom-gray font-bold hover:text-medium-brown">Cancelar</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-[#3E2723] text-center mb-2">Digite o valor a reembolsar:</p>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={refundAmount} 
                        onChange={(e) => setRefundAmount(e.target.value)} 
                        placeholder={`Máx: R$ ${detailModalOrder.total_amount.toFixed(2)}`}
                        className="w-full border-2 border-custom-border/20 rounded-lg p-3 outline-none focus:border-red-600 text-center font-bold text-lg"
                      />
                      <button 
                        onClick={() => handleReembolsar(detailModalOrder.id, true)}
                        disabled={isPending && loadingId === detailModalOrder.id}
                        className="w-full py-3 font-bold text-white bg-red rounded-lg hover:bg-red flex justify-center items-center gap-2"
                      >
                        {isPending && loadingId === detailModalOrder.id ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Parcial'}
                      </button>
                      <button onClick={() => setRefundStep(1)} className="w-full py-2 text-sm text-custom-gray font-bold hover:text-medium-brown">Voltar</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL CATEGORIA                              */}
        {/* ========================================== */}
        {categoryModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95">
              <button onClick={() => setCategoryModal(null)} className="absolute top-4 right-4 text-custom-gray hover:text-medium-brown"><X size={24} /></button>
              <h3 className="font-black text-xl text-[#3E2723] mb-4">{categoryModal.id ? 'Editar Categoria' : 'Nova Categoria'}</h3>
              <form onSubmit={handleSalvarCategoria} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-medium-brown mb-1">Nome da Categoria</label>
                  <input type="text" required value={categoryModal.name} onChange={(e) => setCategoryModal({...categoryModal, name: e.target.value})} className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none" placeholder="Ex: Bebidas Quentes" />
                </div>
                <button type="submit" disabled={isPending} className="w-full bg-[#3E2723] text-white font-black py-3 rounded-lg hover:bg-[#4E342E] transition">Salvar Categoria</button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL PRODUTO                                */}
        {/* ========================================== */}
        {produtoModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 my-auto">
              <button onClick={() => setProdutoModal(null)} className="absolute top-4 right-4 text-custom-gray hover:text-medium-brown"><X size={24} /></button>
              <h3 className="font-black text-xl text-[#3E2723] mb-4">{produtoModal.id ? 'Editar Produto' : 'Novo Produto'}</h3>
              <form onSubmit={handleSalvarProduto} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-medium-brown mb-1">Nome do Produto</label>
                  <input type="text" required value={produtoModal.name} onChange={(e) => setProdutoModal({...produtoModal, name: e.target.value})} className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none" placeholder="Ex: Espresso Duplo" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-medium-brown mb-1">Descrição</label>
                  <textarea value={produtoModal.description} onChange={(e) => setProdutoModal({...produtoModal, description: e.target.value})} className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none resize-none" rows={3} placeholder="Breve descrição para o cliente..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-medium-brown mb-1">Preço (R$)</label>
                    <input type="number" step="0.01" required value={produtoModal.price} onChange={(e) => setProdutoModal({...produtoModal, price: parseFloat(e.target.value) || 0})} className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-medium-brown mb-1">Categoria</label>
                    <select value={produtoModal.category_id} onChange={(e) => setProdutoModal({...produtoModal, category_id: e.target.value})} className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none bg-white">
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  {produtoModal.id && (
                    <button type="button" onClick={() => handleExcluirProduto(produtoModal.id!)} className="p-3 text-red bg-red-50 rounded-lg hover:bg-red font-bold"><Trash2 size={20} /></button>
                  )}
                  <button type="submit" disabled={isPending} className="flex-1 bg-[#3E2723] text-white font-black py-3 rounded-lg hover:bg-[#4E342E] transition">Salvar Produto</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* MODAL 4: INSUMO (ESTOQUE)                    */}
        {/* ========================================== */}
        {insumoModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95">
              <button onClick={() => setInsumoModal(null)} className="absolute top-4 right-4 text-custom-gray hover:text-medium-brown"><X size={24} /></button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-amber-100 text-[#3E2723] rounded-full flex items-center justify-center">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-[#3E2723]">{insumoModal.id ? 'Editar Insumo' : 'Novo Insumo'}</h3>
                </div>
              </div>

              <form onSubmit={handleSalvarInsumo} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-medium-brown mb-1">Nome Exato (igual à receita)</label>
                  <input 
                    type="text" 
                    required 
                    value={insumoModal.name}
                    onChange={(e) => setInsumoModal({...insumoModal, name: e.target.value})}
                    className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none" 
                    placeholder="Ex: Café em grão"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-medium-brown mb-1">Quantidade</label>
                    <input 
                      type="number" 
                      required 
                      step="0.01"
                      value={insumoModal.quantity}
                      onChange={(e) => setInsumoModal({...insumoModal, quantity: parseFloat(e.target.value) || 0})}
                      className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-medium-brown mb-1">Unidade</label>
                    <select 
                      value={insumoModal.unit}
                      onChange={(e) => setInsumoModal({...insumoModal, unit: e.target.value})}
                      className="w-full p-3 border-2 border-custom-border/20 rounded-lg focus:border-[#3E2723] outline-none bg-white"
                    >
                      <option value="g">g (gramas)</option>
                      <option value="ml">ml (mililitros)</option>
                      <option value="un">un (unidades)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  {insumoModal.id && (
                    <button 
                      type="button"
                      onClick={() => handleExcluirInsumo(insumoModal.id!)}
                      className="p-3 text-red bg-red-50 rounded-lg hover:bg-red font-bold"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button 
                    type="submit" 
                    disabled={isPending} 
                    className="flex-1 bg-[#3E2723] text-white font-black py-3 rounded-lg hover:bg-[#4E342E] transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Insumo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ABA CONFIG */}
        {activeTab === 'CONFIG' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6 border-b border-custom-border/20 pb-4">
              <Settings className="text-[#3E2723]" size={24} />
              <h2 className="text-xl font-black text-[#3E2723]">Ajustes da Loja</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-[#3E2723] mb-4">Métodos de Pagamento Permitidos</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-white cursor-pointer transition">
                    <div>
                      <p className="font-bold text-[#3E2723]">PIX Online (Mercado Pago)</p>
                      <p className="text-sm text-custom-gray">Permite pagamento via QRCode PIX no celular.</p>
                    </div>
                    <input type="checkbox" checked={paymentSettings.pix} onChange={(e) => {
                      const ns = {...paymentSettings, pix: e.target.checked}
                      setPaymentSettings(ns)
                      startTransition(() => { atualizarMetodosPagamento(ns) })
                    }} className="w-5 h-5 accent-yellow" />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-white cursor-pointer transition">
                    <div>
                      <p className="font-bold text-[#3E2723]">Cartão de Crédito Online (Mercado Pago)</p>
                      <p className="text-sm text-custom-gray">Permite pagamento digitando cartão no celular.</p>
                    </div>
                    <input type="checkbox" checked={paymentSettings.credit_card} onChange={(e) => {
                      const ns = {...paymentSettings, credit_card: e.target.checked}
                      setPaymentSettings(ns)
                      startTransition(() => { atualizarMetodosPagamento(ns) })
                    }} className="w-5 h-5 accent-yellow" />
                  </label>

                  <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-white cursor-pointer transition">
                    <div>
                      <p className="font-bold text-[#3E2723]">Pagar no Balcão</p>
                      <p className="text-sm text-custom-gray">Permite que o cliente faça o pedido e pague presencialmente.</p>
                    </div>
                    <input type="checkbox" checked={paymentSettings.counter} onChange={(e) => {
                      const ns = {...paymentSettings, counter: e.target.checked}
                      setPaymentSettings(ns)
                      startTransition(() => { atualizarMetodosPagamento(ns) })
                    }} className="w-5 h-5 accent-yellow" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

// ==========================================
// COMPONENTES AUXILIARES (CARDS)
// ==========================================

function OrderCaixaCard({ order, user, onOpenCheckout, onOpenCancel }: any) {
  const isPayingOnline = order.payment_method === 'PIX' || order.payment_method === 'CREDIT_CARD' || order.payment_method === 'CARTAO'

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow flex flex-col gap-3 relative">
      <div className="absolute top-2 right-4 flex items-center gap-1 text-custom-gray text-xs font-bold">
        <Clock size={12} /> {formatTime(order.created_at)}
      </div>
      <div className="mt-2">
        <h3 className="font-black text-xl text-[#3E2723]">#{order.short_id}</h3>
        <p className="text-medium-brown font-medium text-sm">{order.customer_name}</p>
        <p className="text-md font-black text-[#3E2723] mt-1">R$ {order.total_amount.toFixed(2)}</p>
      </div>

      {isPayingOnline ? (
        <div className="bg-cream text-medium-brown p-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-yellow mt-2">
          <Loader2 size={16} className="animate-spin" /> Pagando online ({order.payment_method})
        </div>
      ) : (
        (user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => onOpenCheckout(order)} className="flex-1 bg-green text-white py-2 rounded-lg text-sm font-bold hover:bg-green transition flex justify-center items-center gap-2">
              <DollarSign size={16} /> Receber
            </button>
            <button onClick={() => onOpenCancel(order)} className="bg-red-50 text-red px-3 py-2 rounded-lg text-sm font-bold hover:bg-red transition border border-red-200 flex justify-center items-center" title="Cancelar Pedido">
              <Ban size={16} />
            </button>
          </div>
        )
      )}
    </div>
  )
}

function OrderPreparoCard({ order, user, isPending, loadingId, onAssumir, onPronto }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-[#3E2723] flex flex-col sm:flex-row justify-between gap-4 relative">
      <div className="absolute top-2 right-4 flex items-center gap-1 text-custom-gray text-xs font-bold">
        <Clock size={12} /> {formatTime(order.created_at)}
      </div>
      <div className="flex-1 mt-4 sm:mt-0">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-black text-xl text-[#3E2723]">#{order.short_id}</h3>
          {order.status === 'IN_PRODUCTION' && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">Em Produção</span>}
        </div>
        <p className="text-medium-brown font-medium text-sm mb-3">Cliente: {order.customer_name}</p>
        <ul className="bg-white p-3 rounded-lg border border-custom-border/10 space-y-1">
          {order.order_items?.map((item: any) => (
            <li key={item.id} className="text-sm font-bold text-medium-brown flex gap-2">
              <span className="text-yellow">{item.quantity}x</span> {item.product_name}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col justify-end gap-2 min-w-[140px] mt-2 sm:mt-0">
        {(user.role === 'ADMIN' || user.role === 'BARISTA') && (
          order.status === 'PAID' ? (
            <button onClick={() => onAssumir(order.id)} disabled={isPending && loadingId === order.id} className="bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : 'Assumir Pedido'}
            </button>
          ) : (
            <button onClick={() => onPronto(order.id)} disabled={(isPending && loadingId === order.id) || order.assigned_to !== user.id} className="bg-[#3E2723] text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-[#4E342E] disabled:opacity-50 flex items-center justify-center gap-2" title={order.assigned_to !== user.id ? "Outro barista assumiu" : ""}>
              {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />} Pronto
            </button>
          )
        )}
      </div>
    </div>
  )
}

function OrderRetiradaCard({ order, isPending, loadingId, onEntregar }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500 flex flex-col gap-3 relative">
      <div className="absolute top-2 right-4 flex items-center gap-1 text-custom-gray text-xs font-bold">
        <Clock size={12} /> {formatTime(order.created_at)}
      </div>
      <div className="mt-2">
        <h3 className="font-black text-xl text-green">#{order.short_id}</h3>
        <p className="text-medium-brown font-medium text-sm">{order.customer_name}</p>
      </div>

      <button onClick={() => onEntregar(order.id)} disabled={isPending && loadingId === order.id} className="mt-2 bg-green text-white py-3 rounded-lg text-sm font-bold hover:bg-green transition flex justify-center items-center gap-2 disabled:opacity-50">
        {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Entregar Pedido
      </button>
    </div>
  )
}

function RecipeFormCard({ product, estoque }: { product: ProductInfo, estoque: any[] }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(product.recipe_ingredients || [])
  const [instructions, setInstructions] = useState(product.recipe_instructions || '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    const res = await atualizarReceitaProduto(product.id, instructions, ingredients)
    setLoading(false)
    if (res.success) alert('Receita salva com sucesso!')
    else alert('Erro ao salvar.')
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-custom-border/20">
      <h3 className="font-black text-[#3E2723] text-xl mb-4 border-b border-custom-border/20 pb-2">{product.name}</h3>
      <div className="space-y-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-medium-brown">Ingredientes (P/ Estoque)</label>
            <button type="button" onClick={() => setIngredients([...ingredients, { name: '', quantity: 1, unit: 'g' }])} className="text-amber-700 text-sm font-bold flex items-center gap-1 hover:bg-cream p-1 rounded"><Plus size={16} /> Adicionar</button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select 
                  value={ing.name} 
                  onChange={(e) => { 
                    const newIng = [...ingredients]; 
                    newIng[idx].name = e.target.value; 
                    const selItem = estoque.find(i => i.name === e.target.value);
                    if (selItem) newIng[idx].unit = selItem.unit; // Auto-preenche a unidade
                    setIngredients(newIng) 
                  }} 
                  className="flex-1 border rounded p-2 text-sm outline-none focus:border-[#3E2723] bg-white"
                >
                  <option value="" disabled>Selecione um insumo...</option>
                  {estoque.map(item => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                  {ing.name && !estoque.some(i => i.name === ing.name) && (
                    <option value={ing.name}>{ing.name} (Fora do Estoque)</option>
                  )}
                </select>
                <input type="number" placeholder="Qtd" value={ing.quantity} onChange={(e) => { const newIng = [...ingredients]; newIng[idx].quantity = Number(e.target.value); setIngredients(newIng) }} className="w-16 border rounded p-2 text-sm outline-none focus:border-[#3E2723]" />
                <span className="w-10 text-center text-sm font-bold text-custom-gray pt-2">{ing.unit}</span>
                <button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-red p-2 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
              </div>
            ))}
            {ingredients.length === 0 && <p className="text-xs text-custom-gray italic">Nenhum ingrediente configurado.</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-medium-brown mb-2">Modo de Preparo (Instruções)</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Passo a passo para o barista..." className="w-full border-2 border-custom-border/10 rounded-lg p-3 text-sm focus:border-[#3E2723] outline-none resize-none bg-white" rows={3} />
        </div>
      </div>
      <button onClick={handleSave} disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition flex justify-center items-center gap-2">
        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Configurações'}
      </button>
    </div>
  )
}