'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '../../../lib/supabase'
import { Copy, Check, QrCode, CreditCard } from 'lucide-react'
// Importamos o SDK do Mercado Pago
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'

// Inicializa a conexão visual com a sua Chave Pública
initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY!)

export default function OrderStatus({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [order, setOrder] = useState<any>(null)
  
  // Controle das abas
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix')
  
  // Estados do PIX
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null)
  const [loadingPix, setLoadingPix] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchOrder = async () => {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
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
    const interval = setInterval(() => {
      fetchOrder()
    }, 5000)
    return () => clearInterval(interval)
  }, [token])

  // --- FUNÇÕES DO PIX ---
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

  // --- CONFIGURAÇÃO DO TIJOLO (BRICK) DE CARTÃO ---
  const initialization = {
    amount: order?.total_amount || 0,
  }

  const customization = {
    paymentMethods: {
      creditCard: 'all' as any, // Habilita todos os cartões de crédito
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
          } else {
            // Se aprovado, a nossa verificação de 5s vai notar a mudança e atualizar a tela!
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 animate-pulse">Buscando seu pedido...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-8 pb-24">
      
      {/* Cabeçalho do Pedido */}
      <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md w-full border-t-4 border-amber-900 mb-4">
        <h1 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Pedido #{order.short_id}</h1>
        <h2 className="text-xl font-black text-gray-800 mb-2">Olá, {order.customer_name}!</h2>
        
        {order.status === 'AWAITING_PAYMENT' && (
          <div className="bg-yellow-50 text-yellow-700 font-bold p-3 rounded-lg flex items-center justify-center gap-2">
            ⏳ Aguardando Pagamento
          </div>
        )}
        {order.status === 'PAID' && (
          <div className="bg-green-50 text-green-700 font-bold p-3 rounded-lg flex items-center justify-center gap-2">
            <Check size={20} /> Pagamento Aprovado!
          </div>
        )}
      </div>

      {order.status === 'AWAITING_PAYMENT' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md w-full">
          <p className="text-gray-600 mb-2">Total a pagar</p>
          <p className="text-3xl font-black text-amber-900 mb-6">{formatPrice(order.total_amount)}</p>

          {/* Controle de Abas */}
          <div className="flex gap-2 w-full mb-6 p-1 bg-gray-100 rounded-xl">
            <button 
              onClick={() => setPaymentMethod('pix')}
              className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                paymentMethod === 'pix' ? 'bg-white text-amber-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <QrCode size={18} /> PIX
            </button>
            <button 
              onClick={() => setPaymentMethod('card')}
              className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                paymentMethod === 'card' ? 'bg-white text-amber-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CreditCard size={18} /> Cartão
            </button>
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
                  <p className="text-sm text-gray-500">Escaneie o QR Code ou copie o código abaixo:</p>
                  
                  <button 
                    onClick={handleCopyPix}
                    className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                      copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA: CARTÃO DE CRÉDITO */}
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
        </div>
      )}
      
      {/* Tela de Sucesso */}
      {order.status === 'PAID' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md w-full animate-in fade-in slide-in-from-bottom-4">
          <div className="w-16 h-16 bg-amber-100 text-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
            ☕
          </div>
          <h3 className="font-bold text-xl text-gray-800 mb-2">Preparando seu café!</h3>
          <p className="text-gray-600">Seu pedido já está com nossos baristas.</p>
        </div>
      )}
    </main>
  )
}