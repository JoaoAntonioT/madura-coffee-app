'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '../../../lib/supabase'
import { Copy, Check, QrCode, CreditCard, Store } from 'lucide-react'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'

// Proteção: Só inicializa se a chave existir, evitando crash na Vercel (Erro 500)
const mpPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
if (mpPublicKey) {
  initMercadoPago(mpPublicKey)
}

export default function OrderStatus({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [order, setOrder] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'manual'>('pix')
  const [paymentSettings, setPaymentSettings] = useState({ pix: true, credit_card: true, counter: true })
  
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null)
  const [loadingPix, setLoadingPix] = useState(false)
  const [copied, setCopied] = useState(false)

  const [queuePosition, setQueuePosition] = useState<number | null>(null)

  const fetchOrder = async () => {
    // 0. Fetch Settings First
    const { data: settings } = await supabase.from('settings').select('value').eq('id', 'payment_methods').single()
    if (settings) {
      setPaymentSettings(settings.value)
      // Ajusta o método default caso o pix esteja desativado
      if (!settings.value.pix) {
        if (settings.value.credit_card) setPaymentMethod('card')
        else if (settings.value.counter) setPaymentMethod('manual')
      }
    }

    const { data: orderData } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('token', token)
      .single()
    
    if (orderData) {
      setOrder(orderData)
      
      if (orderData.status === 'AWAITING_PAYMENT') {
        const { data: pix } = await supabase
          .from('payment_attempts')
          .select('*')
          .eq('order_id', orderData.id)
          .eq('status', 'PENDING')
          .single()

        if (pix && pix.qr_code) {
          setPixData({ qr_code: pix.qr_code, qr_code_base64: pix.qr_code_base64 })
        }
      }
    }
  }

  useEffect(() => {
    fetchOrder()
    
    const channel = supabase
      .channel(`order-${token}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `token=eq.${token}`
        },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...payload.new }))
        }
      )
      .subscribe()
    
    let interval: NodeJS.Timeout
    
    // O relógio atualiza a tela a cada 5s se estiver no PIX ou no Caixa (aguardando o barista)
    if (paymentMethod === 'pix' || paymentMethod === 'manual') {
      interval = setInterval(() => {
        fetchOrder()
      }, 5000)
    }

    return () => {
      supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
    }
  }, [token, paymentMethod])

  useEffect(() => {
    if (order && (order.status === 'PAID' || order.status === 'IN_PRODUCTION')) {
      const fetchQueuePosition = async () => {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['PAID', 'IN_PRODUCTION'])
          .lt('created_at', order.created_at)
          
        if (count !== null) setQueuePosition(count)
      }
      
      fetchQueuePosition()
      const interval = setInterval(fetchQueuePosition, 10000)
      return () => clearInterval(interval)
    }
  }, [order?.status, order?.created_at]) 

  useEffect(() => {
    if (order?.status !== 'READY') return

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 1000])
    }

    const stopVibration = () => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(0)
      }
    }

    window.addEventListener('click', stopVibration)

    return () => {
      stopVibration()
      window.removeEventListener('click', stopVibration)
    }
  }, [order?.status])

  const handleGeneratePix = async () => {
    if (!order) return
    setLoadingPix(true)
    try {
      const response = await fetch('/api/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id })
      })
      const data = await response.json()
      if (data.qr_code) setPixData(data)
      else alert('Erro ao gerar PIX. Tente novamente.')
    } catch (error) {
      alert('Falha na comunicação com o servidor.')
    } finally {
      setLoadingPix(false)
    }
  }

  const handleCopyPix = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.qr_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000) 
    }
  }

  const initialization = {
    amount: order?.total_amount || 0,
  }

  const customization = {
    paymentMethods: {
      creditCard: 'all' as any,
    },
  }

  const onSubmitCard = async ({ formData }: any) => {
    return new Promise<void>((resolve, reject) => {
      fetch('/api/cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, order_id: order.id }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            alert('Erro ao processar: ' + data.error)
            reject()
          } else if (data.status === 'rejected') {
            alert('Cartão recusado pelo emissor. Verifique os dados, o limite e tente novamente.')
            reject()
          } else {
            fetchOrder()
            resolve()
          }
        })
        .catch((error) => {
          console.error(error)
          alert('Falha na comunicação com o banco.')
          reject()
        })
    })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-custom-gray animate-pulse">Buscando seu pedido...</p>
      </div>
    )
  }

  if (order.status === 'READY') {
    const handleFechar = () => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(0)
      }
      localStorage.removeItem('active_order_token')
      window.location.href = '/'
    }

    return (
      <div className="fixed inset-0 z-50 bg-green-100 text-white flex flex-col items-center justify-center p-6 animate-in zoom-in duration-300">
        <button
          type="button"
          onClick={handleFechar}
          className="absolute top-4 right-4 text-white/80 hover:text-white text-sm font-bold border border-white/30 rounded-full px-3 py-1"
        >
          Fechar
        </button>

        <div className="mb-6 text-6xl animate-bounce">☕</div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-2 leading-tight">
          SEU CAFÉ <br />ESTÁ PRONTO!
        </h1>
        <p className="text-green-600 text-lg mb-8 text-center">Vá até o balcão de retirada e mostre este número:</p>

        <div className="bg-white text-green-600 text-6xl font-black py-4 px-12 rounded-2xl shadow-2xl mb-12">
          #{order.short_id}
        </div>

        <p className="font-bold text-center mb-2">Itens do pedido:</p>
        <ul className="text-green-600 mb-8 max-w-sm w-full space-y-1">
          {order.order_items?.map((item: any) => (
            <li key={item.id} className="flex justify-between border-b border-custom-border/20 border-green-500 pb-1">
              <span>{item.quantity}x {item.product_name}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-8 pb-24">
      
      <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md w-full border-t  border-amber-900 mb-4">
        <h1 className="text-sm font-bold text-custom-gray uppercase tracking-widest mb-1">Pedido #{order.short_id}</h1>
        <h2 className="text-xl font-black text-amber-900 mb-2">Olá, {order.customer_name}!</h2>
        
        {order.status === 'AWAITING_PAYMENT' && (
          <div className="bg-yellow-50 text-yellow-700 font-bold p-3 rounded-lg flex items-center justify-center gap-2">
            ⏳ Aguardando Pagamento
          </div>
        )}
        {order.status === 'PAID' && (
          <div className="bg-green-100-50 text-green-600 font-bold p-3 rounded-lg flex items-center justify-center gap-2">
            <Check size={20} /> Pagamento Aprovado!
          </div>
        )}
      </div>

      {order.status === 'AWAITING_PAYMENT' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md w-full">
          <p className="text-amber-800 mb-2">Total a pagar</p>
          <p className="text-3xl font-black text-amber-900 mb-6">{formatPrice(order.total_amount)}</p>

          {/* Abas com as 3 opções */}
          <div className="flex gap-1 w-full mb-6 p-1 bg-gray-100 rounded-xl overflow-x-auto text-sm">
            {paymentSettings.pix && (
            <button 
              onClick={() => setPaymentMethod('pix')}
              className={lex-1 py-3 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all duration-300 }
            >
              <QrCode size={16} /> PIX
            </button>
)}
            {paymentSettings.credit_card && (
            <button 
              onClick={() => setPaymentMethod('card')}
              className={lex-1 py-3 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all duration-300 }
            >
              <CreditCard size={16} /> Cartão Online
            </button>
)}
            {paymentSettings.counter && (
            <button 
              onClick={() => setPaymentMethod('manual')}
              className={lex-1 py-3 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all duration-300 }
            >
              <Store size={16} /> Balcão
            </button>
)}
          </div>

          {/* ABA: PIX */}
          {paymentMethod === 'pix' && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              {!pixData ? (
                <button 
                  onClick={handleGeneratePix}
                  disabled={loadingPix}
                  className="w-full bg-amber-900 text-white font-bold py-4 rounded-xl hover:bg-amber-800 transition-colors flex items-center justify-center gap-2"
                >
                  <QrCode size={20} />
                  {loadingPix ? 'Gerando PIX seguro...' : 'Gerar código PIX'}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-gray-100 p-4 rounded-xl">
                    <img 
                      src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} 
                      alt="QR Code PIX" 
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <p className="text-sm text-custom-gray">Escaneie o QR Code ou copie o código abaixo:</p>
                  
                  <button 
                    onClick={handleCopyPix}
                    className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                      copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-amber-900 hover:bg-gray-200'
                    }`}
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA: CARTÃO ONLINE */}
          {paymentMethod === 'card' && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300 text-left">
              <Payment
                initialization={initialization}
                customization={customization}
                onSubmit={onSubmitCard}
                onError={(e) => console.error(e)}
              />
            </div>
          )}

          {/* ABA: PAGAMENTO MANUAL (CAIXA) */}
          {paymentMethod === 'manual' && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300 text-center bg-cream p-6 rounded-xl border border-yellow">
              <div className="w-12 h-12 bg-amber-200 text-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store size={24} />
              </div>
              <h3 className="font-bold text-lg text-amber-900 mb-2">Pague direto no balcão</h3>
              <p className="text-amber-800 text-sm mb-4">
                Dirija-se à nossa tenda e informe o número do seu pedido para um de nossos baristas:
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-dashed border-amber-900 inline-block mb-4">
                <span className="text-4xl font-black text-amber-900">#{order.short_id}</span>
              </div>
              <p className="text-xs text-amber-700 font-medium animate-pulse">
                Aguardando confirmação do atendente...
              </p>
            </div>
          )}
        </div>
      )}
      
      {(order.status === 'PAID' || order.status === 'IN_PRODUCTION') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm max-w-md w-full animate-in fade-in slide-in-from-bottom-4">
          <h3 className="font-black text-xl text-amber-900 mb-6 text-center">Acompanhe seu pedido</h3>
          
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
            
            {/* 1. Pagamento Realizado */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-white border-4 bg-green-100 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <Check size={16} strokeWidth={3} />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-green-100-50 p-4 rounded-xl border border-green-100 shadow-sm">
                <h4 className="font-bold text-green-600">Pagamento realizado</h4>
              </div>
            </div>

            {/* 2. Aguardando na Fila */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-white border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${order.status === 'IN_PRODUCTION' ? 'bg-green-100 text-white' : 'bg-cream0 text-white animate-pulse'}`}>
                {order.status === 'IN_PRODUCTION' ? <Check size={16} strokeWidth={3} /> : <span className="font-bold">⏳</span>}
              </div>
              <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border shadow-sm ${order.status === 'IN_PRODUCTION' ? 'bg-green-100-50 border-green-100' : 'bg-cream border-amber-100'}`}>
                <h4 className={`font-bold ${order.status === 'IN_PRODUCTION' ? 'text-green-600' : 'text-amber-900'}`}>Aguardando na fila</h4>
                {order.status === 'PAID' && queuePosition !== null && (
                  <p className="text-sm text-amber-700 font-medium mt-1">
                    {queuePosition === 0 ? 'Você é o próximo!' : `(${queuePosition} pedidos na frente)`}
                  </p>
                )}
              </div>
            </div>

            {/* 3. Barista Começou */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-white border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${order.status === 'IN_PRODUCTION' ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-200 text-custom-gray'}`}>
                {order.status === 'IN_PRODUCTION' ? '☕' : <Store size={16} />}
              </div>
              <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border shadow-sm ${order.status === 'IN_PRODUCTION' ? 'bg-blue-50 border-b border-custom-border/20lue-100' : 'bg-white border-custom-border/10'}`}>
                <h4 className={`font-bold ${order.status === 'IN_PRODUCTION' ? 'text-blue-800' : 'text-custom-gray'}`}>Barista começou seu pedido</h4>
                {order.status === 'IN_PRODUCTION' && (
                  <p className="text-sm text-blue-600 mt-1">Em breve será chamado.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  )
}