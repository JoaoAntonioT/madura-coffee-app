'use client'

import { useState } from 'react'
import { useCartStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function Checkout() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, totalPrice, clearCart } = useCartStore()
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0 || !name.trim()) return
    
    setLoading(true)

    // 1. Cria o Pedido principal no banco
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: name.trim(),
        customer_email: email.trim() || null,
        total_amount: totalPrice()
      })
      .select()
      .single()

    if (orderError || !order) {
      alert('Erro ao criar pedido. Tente novamente.')
      setLoading(false)
      return
    }

    // 2. Prepara os itens do carrinho para salvar
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      observation: item.observation
    }))

    // 3. Salva os itens no banco
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) {
      alert('Erro ao salvar os itens do pedido.')
      setLoading(false)
      return
    }

    // 4. Sucesso! Salva o Token no celular do cliente e limpa o carrinho
    localStorage.setItem('active_order_token', order.token)
    clearCart()
    
    // 5. Redireciona para a tela de acompanhamento
    router.push(`/pedido/${order.token}`)
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold text-[#3E2723] mb-4">Seu carrinho está vazio</h2>
        <Link href="/" className="text-[#3E2723] font-bold bg-amber-100 px-6 py-3 rounded-xl">
          Voltar ao Cardápio
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white p-4 sticky top-0 z-10 shadow-sm flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Revisar Pedido</h1>
      </header>

      <form onSubmit={handleCheckout} className="max-w-md mx-auto p-4 space-y-6">
        {/* Lista de Itens */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-custom-border/10 space-y-4">
          {items.map(item => (
            <div key={item.id} className="flex flex-col gap-2 border-b border-custom-border/20 border-gray-50 pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between font-bold text-[#3E2723]">
                <span>{item.product.name}</span>
                <span className="text-amber-700">{formatPrice(item.product.price * item.quantity)}</span>
              </div>
              
              {item.observation && (
                <p className="text-sm text-custom-gray italic">Obs: {item.observation}</p>
              )}

              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => removeItem(item.id)} className="text-red p-2 hover:bg-red-50 rounded-lg">
                  <Trash2 size={18} />
                </button>

                <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                  <button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-2 bg-white rounded shadow-sm text-medium-brown">
                    <Minus size={16} />
                  </button>
                  <span className="font-bold w-6 text-center">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-2 bg-white rounded shadow-sm text-medium-brown">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Dados do Cliente */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-custom-border/10 space-y-4">
          <h2 className="font-bold text-[#3E2723]">Seus dados para entrega</h2>
          
          <div>
            <label className="block text-sm font-semibold text-medium-brown mb-1">Nome completo (Obrigatório)</label>
            <input 
              required
              type="text"
              placeholder="Como devemos te chamar?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-2 border-custom-border/20 rounded-xl p-3 focus:border-[#3E2723] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-medium-brown mb-1">E-mail (Opcional)</label>
            <input 
              type="email"
              placeholder="Para receber novidades no futuro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-custom-border/20 rounded-xl p-3 focus:border-[#3E2723] outline-none"
            />
          </div>
        </section>

        {/* Botão Fixo de Finalizar */}
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#3E2723] text-white font-bold p-4 rounded-2xl shadow-xl hover:bg-[#4E342E] transition-colors disabled:bg-gray-400 flex justify-between items-center"
          >
            <span>{loading ? 'Processando...' : 'Confirmar Pedido'}</span>
            <span>{formatPrice(totalPrice())}</span>
          </button>
        </div>
      </form>
    </main>
  )
}