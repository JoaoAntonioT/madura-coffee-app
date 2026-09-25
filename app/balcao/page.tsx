'use client'

import { useEffect, useState, useTransition } from 'react'
import { supabase } from '../../lib/supabase'
import { Lock, Coffee, Users, LogOut, CheckCircle, Store, DollarSign, Loader2, UserPlus, LayoutDashboard, Package, Plus, Trash2, Search, Clock } from 'lucide-react'
import { cadastrarMembro, confirmarPagamento, marcarPronto, atualizarReceitaProduto, assumirPedido, limparPedidosExpirados } from './actions'

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
// Formata a data do banco (ISO) para o horário local (Ex: "14:30")
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
  
  const [activeTab, setActiveTab] = useState<'ATENDIMENTO' | 'CAIXA' | 'PREPARO' | 'EQUIPE' | 'PRODUTOS'>('ATENDIMENTO')
  const [orders, setOrders] = useState<Order[]>([])
  const [productsList, setProductsList] = useState<ProductInfo[]>([])
  
  // NOVO: Estado para a barra de pesquisa
  const [busca, setBusca] = useState('')
  
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

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

    if (activeTab === 'PRODUTOS') {
      const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name, recipe_instructions, recipe_ingredients').order('name')
        if (data) setProductsList(data)
      }
      fetchProducts()
      return
    }

    setOrders([]) 

    const fetchOrders = async () => {
      // 1. ANTES DE BUSCAR: Executa a varredura para expirar pedidos velhos (> 15 min)
      await limparPedidosExpirados()

      // 2. BUSCA: Traz os pedidos ordenados por data crescente (Mais antigos primeiro)
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['CREATED', 'PENDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT', 'PAID', 'IN_PRODUCTION'])
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
            o.status === 'CREATED' || o.status === 'PENDING' || o.status.includes('AWAITING')
          )
        }
        setOrders(filtrados)
      }
    }

    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [user, activeTab])

  // Login & Logout
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

  // Ações
  const handleCadastro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await cadastrarMembro(formData)
      if (res.success) { alert('Membro cadastrado!'); e.currentTarget.reset() }
      else alert(`Erro: ${res.error}`)
    })
  }

  const handleConfirmarPagamento = (orderId: string) => {
    setLoadingId(orderId)
    startTransition(async () => {
      const res = await confirmarPagamento(orderId)
      if (!res.success) alert(`Erro: ${res.error}`)
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

  // Renderização do Login
  if (!user) {
    return (
      <div className="min-h-screen bg-amber-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-900 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Acesso Restrito</h1>
          <p className="text-gray-500 mb-6">Digite seu PIN de acesso à operação</p>
          <form onSubmit={handleLogin}>
            <input type="password" inputMode="numeric" maxLength={6} placeholder="******" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-3xl tracking-widest border-2 border-gray-200 rounded-xl p-4 mb-4 focus:border-amber-900 outline-none" />
            {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}
            <button type="submit" className="w-full bg-amber-900 text-white font-bold py-4 rounded-xl hover:bg-amber-800 transition-colors">Entrar</button>
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
    o.short_id.toLowerCase().includes(searchLower) || 
    o.customer_name.toLowerCase().includes(searchLower)
  )

  const pedidosACobrar = ordersFiltradasBusca.filter(o => o.status === 'CREATED' || o.status === 'PENDING' || o.status.includes('AWAITING'))
  const pedidosEmPreparo = ordersFiltradasBusca.filter(o => o.status === 'PAID' || o.status === 'IN_PRODUCTION')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-amber-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-black text-lg flex items-center gap-2">
            <Store size={20} /> Operação Madura
          </h1>
          <p className="text-amber-200 text-sm font-medium flex items-center gap-2">
            {user.name} <span className="bg-amber-800 px-2 py-0.5 rounded text-xs">{user.role}</span>
          </p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-amber-800 rounded-lg hover:bg-amber-700 transition"><LogOut size={20} /></button>
      </header>

      <div className="bg-white border-b flex px-2 overflow-x-auto">
        <button onClick={() => setActiveTab('ATENDIMENTO')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ATENDIMENTO' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'}`}><LayoutDashboard size={20} /> Visão de Atendimento</button>
        {(user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
          <button onClick={() => setActiveTab('CAIXA')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'CAIXA' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'}`}><DollarSign size={20} /> Caixa Rápido</button>
        )}
        {(user.role === 'ADMIN' || user.role === 'BARISTA') && (
          <button onClick={() => setActiveTab('PREPARO')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'PREPARO' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'}`}><Coffee size={20} /> Fila de Preparo</button>
        )}
        {user.role === 'ADMIN' && (
          <>
            <button onClick={() => setActiveTab('PRODUTOS')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'PRODUTOS' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'}`}><Package size={20} /> Produtos & Receitas</button>
            <button onClick={() => setActiveTab('EQUIPE')} className={`py-4 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'EQUIPE' ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'}`}><Users size={20} /> Equipe</button>
          </>
        )}
      </div>

      <main className="p-4 flex-1 w-full mx-auto max-w-7xl">
        
        {/* BARRA DE PESQUISA (Aparece nas abas de operação) */}
        {['ATENDIMENTO', 'CAIXA', 'PREPARO'].includes(activeTab) && (
          <div className="mb-6 max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por número do pedido (#1047) ou nome do cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-amber-900 focus:border-amber-900 sm:text-sm"
              />
            </div>
          </div>
        )}

        {/* ABA ATENDIMENTO */}
        {activeTab === 'ATENDIMENTO' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1: A Cobrar */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-700 text-lg flex items-center gap-2">
                <DollarSign className="text-amber-500" /> Aguardando Pagamento ({pedidosACobrar.length})
              </h2>
              {pedidosACobrar.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-500 flex justify-between items-center relative">
                  {/* HORÁRIO DO PEDIDO */}
                  <div className="absolute top-2 right-4 flex items-center gap-1 text-gray-400 text-xs font-bold">
                    <Clock size={12} /> {formatTime(order.created_at)}
                  </div>
                  
                  <div className="mt-2">
                    <h3 className="font-black text-xl text-amber-900">#{order.short_id}</h3>
                    <p className="text-gray-600 font-medium text-sm">{order.customer_name}</p>
                    <p className="text-md font-black text-gray-800 mt-1">R$ {order.total_amount.toFixed(2)}</p>
                  </div>
                  {(user.role === 'ADMIN' || user.role === 'VENDEDOR') && (
                    <button onClick={() => handleConfirmarPagamento(order.id)} disabled={isPending && loadingId === order.id} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 mt-2">
                      {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Receber
                    </button>
                  )}
                </div>
              ))}
              {pedidosACobrar.length === 0 && <p className="text-gray-400 text-sm italic">Nenhuma cobrança pendente.</p>}
            </div>

            {/* Coluna 2: Produção */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-700 text-lg flex items-center gap-2">
                <Coffee className="text-amber-900" /> Fila de Preparo ({pedidosEmPreparo.length})
              </h2>
              {pedidosEmPreparo.map(order => (
                <OrderPreparoCard key={order.id} order={order} user={user} isPending={isPending} loadingId={loadingId} onAssumir={handleAssumir} onPronto={handleMarcarPronto} />
              ))}
              {pedidosEmPreparo.length === 0 && <p className="text-gray-400 text-sm italic">Nenhum pedido na fila.</p>}
            </div>
          </div>
        )}

        {/* ABA CAIXA ISOLADA */}
        {activeTab === 'CAIXA' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {pedidosACobrar.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-500 flex justify-between items-center flex-wrap gap-4 relative">
                <div className="absolute top-2 right-4 flex items-center gap-1 text-gray-400 text-xs font-bold">
                  <Clock size={12} /> {formatTime(order.created_at)}
                </div>
                <div className="mt-2">
                  <h3 className="font-black text-2xl text-amber-900">#{order.short_id}</h3>
                  <p className="text-gray-600 font-medium">{order.customer_name}</p>
                  <p className="text-lg font-black text-gray-800 mt-1">R$ {order.total_amount.toFixed(2)}</p>
                </div>
                <button onClick={() => handleConfirmarPagamento(order.id)} disabled={isPending && loadingId === order.id} className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-bold hover:bg-green-700 disabled:opacity-50 mt-2">
                  {isPending && loadingId === order.id ? <Loader2 className="animate-spin" /> : <CheckCircle />} Confirmar Recebimento
                </button>
              </div>
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

        {/* ABA PRODUTOS E EQUIPE (MANTIDAS EXATAMENTE COMO NO SEU CÓDIGO ANTERIOR) */}
        {/* ... */}
        {activeTab === 'PRODUTOS' && (
          <div className="space-y-6 max-w-4xl mx-auto">
             <div className="flex items-center gap-2 border-b pb-4">
              <Package className="text-amber-900" size={24} />
              <h2 className="text-xl font-black text-gray-800">Cardápio & Controle de Insumos</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {productsList.map(product => (
                <RecipeFormCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'EQUIPE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-md mx-auto border">
            {/* O conteúdo do formulário de equipe mantém-se igual */}
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <UserPlus className="text-amber-900" size={24} />
              <h2 className="text-xl font-black text-gray-800">Cadastrar Operador</h2>
            </div>
            <form onSubmit={handleCadastro} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                <input name="name" type="text" required className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-amber-900" placeholder="Ex: Maria Vendedora"/>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">PIN de Acesso (6 dígitos)</label>
                <input name="pin" type="password" pattern="[0-9]*" inputMode="numeric" required maxLength={6} className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-amber-900" placeholder="******"/>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cargo / Permissão</label>
                <select name="role" required className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-amber-900 bg-white">
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

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================
function OrderPreparoCard({ order, user, isPending, loadingId, onAssumir, onPronto }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-900 flex flex-col sm:flex-row justify-between gap-4 relative">
      {/* HORÁRIO DO PEDIDO */}
      <div className="absolute top-2 right-4 flex items-center gap-1 text-gray-400 text-xs font-bold">
        <Clock size={12} /> {formatTime(order.created_at)}
      </div>

      <div className="flex-1 mt-4 sm:mt-0">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-black text-xl text-gray-800">#{order.short_id}</h3>
          {order.status === 'IN_PRODUCTION' && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">Em Produção</span>}
        </div>
        <p className="text-gray-600 font-medium text-sm mb-3">Cliente: {order.customer_name}</p>
        
        <ul className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
          {order.order_items?.map((item: any) => (
            <li key={item.id} className="text-sm font-bold text-gray-700 flex gap-2">
              <span className="text-amber-600">{item.quantity}x</span> {item.product_name}
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
            <button onClick={() => onPronto(order.id)} disabled={(isPending && loadingId === order.id) || order.assigned_to !== user.id} className="bg-amber-900 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-amber-800 disabled:opacity-50 flex items-center justify-center gap-2" title={order.assigned_to !== user.id ? "Outro barista assumiu" : ""}>
              {isPending && loadingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />} Pronto
            </button>
          )
        )}
      </div>
    </div>
  )
}

function RecipeFormCard({ product }: { product: ProductInfo }) {
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
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
      <h3 className="font-black text-gray-800 text-xl mb-4 border-b pb-2">{product.name}</h3>
      <div className="space-y-4 mb-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-gray-700">Ingredientes (P/ Estoque)</label>
            <button type="button" onClick={() => setIngredients([...ingredients, { name: '', quantity: 1, unit: 'g' }])} className="text-amber-700 text-sm font-bold flex items-center gap-1 hover:bg-amber-50 p-1 rounded">
              <Plus size={16} /> Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input type="text" placeholder="Ex: Café em grão" value={ing.name} onChange={(e) => { const newIng = [...ingredients]; newIng[idx].name = e.target.value; setIngredients(newIng) }} className="flex-1 border rounded p-2 text-sm outline-none focus:border-amber-900" />
                <input type="number" placeholder="Qtd" value={ing.quantity} onChange={(e) => { const newIng = [...ingredients]; newIng[idx].quantity = Number(e.target.value); setIngredients(newIng) }} className="w-16 border rounded p-2 text-sm outline-none focus:border-amber-900" />
                <select value={ing.unit} onChange={(e) => { const newIng = [...ingredients]; newIng[idx].unit = e.target.value; setIngredients(newIng) }} className="w-20 border rounded p-2 text-sm bg-white">
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="un">un</option>
                </select>
                <button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
              </div>
            ))}
            {ingredients.length === 0 && <p className="text-xs text-gray-400 italic">Nenhum ingrediente configurado.</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Modo de Preparo (Instruções)</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Passo a passo para o barista..." className="w-full border-2 border-gray-100 rounded-lg p-3 text-sm focus:border-amber-900 outline-none resize-none bg-gray-50" rows={3} />
        </div>
      </div>
      <button onClick={handleSave} disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition flex justify-center items-center gap-2">
        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Configurações'}
      </button>
    </div>
  )
}