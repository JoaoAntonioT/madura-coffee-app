'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, ShoppingBag, ArrowRight, ClipboardList, Search } from 'lucide-react'
import { useCartStore } from '../lib/store'
import Link from 'next/link'

type Product = {
  id: string
  name: string
  description: string
  price: number
}

type Category = {
  id: string
  name: string
  products: Product[]
}

export default function Menu() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [observation, setObservation] = useState('')
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const addItem = useCartStore(state => state.addItem)
  const totalItems = useCartStore(state => state.totalItems())
  const totalPrice = useCartStore(state => state.totalPrice())

  useEffect(() => {
    // 1. Verifica se o cliente tem um pedido em andamento salvo no celular
    const token = localStorage.getItem('active_order_token')
    if (token) {
      const savedTokens = JSON.parse(localStorage.getItem('order_tokens_history') || '[]')
      if (!savedTokens.includes(token)) {
        localStorage.setItem('order_tokens_history', JSON.stringify([token, ...savedTokens]))
      }
      supabase
        .from('orders')
        .select('status')
        .eq('token', token)
        .single()
        .then(({ data }) => {
          if (data && !['DELIVERED', 'CANCELLED', 'REFUNDED', 'EXPIRED'].includes(data.status)) {
            setActiveToken(token)
          } else {
            localStorage.removeItem('active_order_token')
            setActiveToken(null)
          }
        })
    }

    async function fetchMenu() {
      const { data } = await supabase
        .from('categories')
        .select('*, products(*)')
        .order('sort_order')

      if (data) {
        const formattedData = data.map(cat => ({
          ...cat,
          products: cat.products.sort((a: Product, b: Product) => a.name.localeCompare(b.name))
        }))
        setCategories(formattedData)
      }
      setLoading(false)
    }
    fetchMenu()
  }, [])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)
  }

  const handleConfirmAdd = () => {
    if (selectedProduct) {
      addItem(selectedProduct, observation)
      setSelectedProduct(null)
      setObservation('')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-custom-gray animate-pulse">Carregando cardápio...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-transparent pb-28 relative">
      
      {/* ALERTA DE PEDIDO ATIVO */}
      {activeToken && (
        <Link href={`/pedido/${activeToken}`} className="bg-blue-600 text-white p-3 flex items-center justify-center gap-2 font-bold text-sm shadow-md animate-in slide-in-from-top-4">
          Você tem um pedido em andamento! Acompanhar <ArrowRight size={16} />
        </Link>
      )}

      <header className="bg-[#3E2723] p-4 sticky top-0 z-10 shadow-md flex justify-center items-center">
        <h1 className="text-2xl font-black tracking-wide text-white">MADURA COFFEE</h1>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-8">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-custom-gray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar café, bebida ou lanche..."
            className="w-full bg-white border border-custom-border/20 rounded-xl pl-10 pr-10 py-3 text-sm text-[#3E2723] font-medium placeholder:text-custom-gray shadow-sm focus:border-[#3E2723] outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-custom-gray hover:text-[#3E2723] p-1">
              <X size={16} />
            </button>
          )}
        </div>

        {categories
          .map((cat) => {
            const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            const q = norm(searchQuery.trim())
            const filteredProducts = q
              ? cat.products.filter(p => norm(p.name).includes(q) || norm(p.description).includes(q) || norm(cat.name).includes(q))
              : cat.products
            return { ...cat, products: filteredProducts }
          })
          .filter(cat => cat.products.length > 0)
          .map((category) => (
            <section key={category.id}>
              <h2 className="text-2xl font-black text-[#3E2723] mb-4 border-b border-custom-border/20-2 border-[#3E2723] pb-2">
                {category.name}
              </h2>
              
              <div className="space-y-4">
                {category.products.map((product) => (
                  <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-custom-border/10 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-[#3E2723] text-lg leading-tight">{product.name}</h3>
                      <span className="font-bold text-amber-700 whitespace-nowrap">{formatPrice(product.price)}</span>
                    </div>
                    
                    {product.description && (
                      <p className="text-sm text-custom-gray leading-relaxed">{product.description}</p>
                    )}

                    <button 
                      onClick={() => setSelectedProduct(product)}
                      className="mt-2 w-full bg-amber-100 hover:bg-amber-200 text-[#3E2723] font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={18} />
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl text-[#3E2723]">Adicionar item</h3>
              <button onClick={() => setSelectedProduct(null)} className="p-2 text-custom-gray hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <p className="font-medium text-medium-brown mb-2">{selectedProduct.name}</p>
            <p className="text-amber-700 font-bold mb-4">{formatPrice(selectedProduct.price)}</p>

            <label className="block mb-2 text-sm font-semibold text-medium-brown">
              Alguma observação? (Opcional)
            </label>
            <textarea 
              className="w-full border-2 border-custom-border/20 rounded-xl p-3 mb-4 focus:border-[#3E2723] focus:ring-0 outline-none resize-none"
              rows={3}
              placeholder="Ex: Sem chantilly, sem gelo..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
            />

            <button 
              onClick={handleConfirmAdd}
              className="w-full bg-[#3E2723] text-white font-bold py-3 rounded-xl hover:bg-[#4E342E] transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* BARRA INFERIOR: 80% Finalizar Pedido + 20% Botão Ícone Meus Pedidos */}
      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40 flex items-stretch gap-2">
        <Link
          href={totalItems > 0 ? '/checkout' : '#'}
          onClick={(e) => { if (totalItems === 0) e.preventDefault() }}
          className={`w-4/5 bg-[#3E2723] text-white p-4 rounded-2xl shadow-xl flex items-center justify-between transition-transform ${
            totalItems > 0 ? 'hover:bg-[#4E342E] active:scale-95' : 'opacity-90 cursor-default'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <ShoppingBag size={20} />
            </div>
            <span className="font-bold">
              {totalItems > 0 ? `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}` : '0 itens'}
            </span>
          </div>
          <span className="font-bold text-lg">{formatPrice(totalPrice)}</span>
        </Link>

        <Link
          href="/pedidos"
          title="Ver Meus Pedidos"
          className="w-1/5 bg-[#3E2723] text-white p-4 rounded-2xl shadow-xl flex items-center justify-center hover:bg-[#4E342E] transition-transform active:scale-95"
        >
          <div className="bg-white/20 p-2 rounded-full">
            <ClipboardList size={20} />
          </div>
        </Link>
      </div>
    </main>
  )
}
