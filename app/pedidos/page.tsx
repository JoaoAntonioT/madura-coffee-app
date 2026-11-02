'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { ChevronLeft, Coffee, Clock, CheckCircle, AlertCircle, ArrowRight, ShoppingBag } from 'lucide-react'

type OrderItem = {
  id: string
  product_name: string
  quantity: number
  price: number
  observation?: string | null
}

type Order = {
  id: string
  short_id: string
  token: string
  customer_name: string
  total_amount: number
  status: string
  created_at: string
  order_items?: OrderItem[]
}

const ACTIVE_STATUSES = ['CREATED', 'PENDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT', 'PAID', 'IN_PRODUCTION', 'READY']

export default function MeusPedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMyOrders = useCallback(async () => {
    const savedTokens: string[] = JSON.parse(localStorage.getItem('order_tokens_history') || '[]')
    const activeToken = localStorage.getItem('active_order_token')

    const allTokens = Array.from(new Set([...(activeToken ? [activeToken] : []), ...savedTokens]))

    if (allTokens.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    // Garante que todos estejam sincronizados no histórico
    localStorage.setItem('order_tokens_history', JSON.stringify(allTokens))

    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('token', allTokens)
      .order('created_at', { ascending: false })

    if (data) {
      setOrders(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMyOrders()

    const channel = supabase
      .channel('customer-orders-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchMyOrders()
        }
      )
      .subscribe()

    const interval = setInterval(fetchMyOrders, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchMyOrders])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <span className="bg-green-700 text-white text-xs font-black px-3 py-1 rounded-full animate-pulse">☕ Pronto para retirada!</span>
      case 'IN_PRODUCTION':
        return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">Em preparo</span>
      case 'PAID':
        return <span className="bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">Na fila de preparo</span>
      case 'AWAITING_PAYMENT':
      case 'AWAITING_MANUAL_PAYMENT':
      case 'CREATED':
      case 'PENDING':
        return <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">⏳ Aguardando pagamento</span>
      case 'DELIVERED':
        return <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">Entregue</span>
      case 'CANCELLED':
        return <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">Cancelado</span>
      case 'REFUNDED':
        return <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">Estornado</span>
      case 'EXPIRED':
        return <span className="bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">Expirado</span>
      default:
        return <span className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">{status}</span>
    }
  }

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const pastOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status))

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-[#3E2723] text-white p-4 sticky top-0 z-10 shadow-md flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black tracking-wide">Meus Pedidos</h1>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-8">
        {loading ? (
          <div className="py-16 text-center text-custom-gray animate-pulse font-medium">
            Carregando seus pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center space-y-4 border border-custom-border/10 mt-6">
            <div className="w-14 h-14 bg-amber-100 text-[#3E2723] rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag size={26} />
            </div>
            <h2 className="text-lg font-black text-[#3E2723]">Você ainda não fez pedidos</h2>
            <p className="text-sm text-custom-gray">
              Seus pedidos feitos neste aparelho aparecerão aqui para você acompanhar.
            </p>
            <Link
              href="/"
              className="inline-block bg-[#3E2723] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#4E342E] transition"
            >
              Ver Cardápio
            </Link>
          </div>
        ) : (
          <>
            {/* SEÇÃO 1: PEDIDOS EM ANDAMENTO */}
            <section className="space-y-4">
              <h2 className="text-lg font-black text-[#3E2723] flex items-center gap-2 border-b border-[#3E2723]/20 pb-2">
                <Clock size={20} /> Em Andamento ({activeOrders.length})
              </h2>

              {activeOrders.length === 0 ? (
                <p className="text-sm text-custom-gray bg-white p-4 rounded-xl border border-custom-border/10">
                  Nenhum pedido em andamento no momento.
                </p>
              ) : (
                activeOrders.map(order => (
                  <div
                    key={order.id}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 space-y-3 ${
                      order.status === 'READY' ? 'border-green-700 ring-2 ring-green-600/20' : 'border-[#3E2723]'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-bold text-custom-gray block">
                          {formatDateTime(order.created_at)}
                        </span>
                        <h3 className="text-2xl font-black text-[#3E2723]">Pedido #{order.short_id}</h3>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <ul className="bg-gray-50 p-3 rounded-xl space-y-1.5 text-sm">
                      {order.order_items?.map(item => (
                        <li key={item.id} className="text-[#3E2723] font-bold flex flex-col">
                          <span>
                            <span className="text-amber-700">{item.quantity}x</span> {item.product_name}
                          </span>
                          {item.observation && (
                            <span className="text-xs font-normal text-amber-800 italic ml-4">
                              Obs: {item.observation}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="font-black text-lg text-[#3E2723]">
                        {formatPrice(order.total_amount)}
                      </span>
                      <Link
                        href={`/pedido/${order.token}`}
                        className="bg-[#3E2723] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#4E342E] transition"
                      >
                        Acompanhar <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* SEÇÃO 2: HISTÓRICO DE PEDIDOS ANTERIORES */}
            <section className="space-y-4">
              <h2 className="text-lg font-black text-[#3E2723] flex items-center gap-2 border-b border-[#3E2723]/20 pb-2">
                <CheckCircle size={20} /> Já Realizados ({pastOrders.length})
              </h2>

              {pastOrders.length === 0 ? (
                <p className="text-sm text-custom-gray bg-white p-4 rounded-xl border border-custom-border/10">
                  Nenhum pedido finalizado ainda.
                </p>
              ) : (
                pastOrders.map(order => (
                  <div
                    key={order.id}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-custom-border/10 space-y-3 opacity-90"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-bold text-custom-gray block">
                          {formatDateTime(order.created_at)}
                        </span>
                        <h3 className="text-lg font-black text-[#3E2723]">Pedido #{order.short_id}</h3>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <ul className="bg-gray-50 p-3 rounded-xl space-y-1 text-sm">
                      {order.order_items?.map(item => (
                        <li key={item.id} className="text-medium-brown font-medium flex flex-col">
                          <span>
                            <span className="font-bold text-amber-700">{item.quantity}x</span> {item.product_name}
                          </span>
                          {item.observation && (
                            <span className="text-xs text-amber-800 italic ml-4">
                              Obs: {item.observation}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-between items-center pt-1 text-sm">
                      <span className="text-custom-gray font-medium">Total do pedido</span>
                      <span className="font-black text-[#3E2723]">{formatPrice(order.total_amount)}</span>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

