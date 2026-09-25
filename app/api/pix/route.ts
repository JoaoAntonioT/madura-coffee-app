import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

// Cria a conexão com o banco para uso no servidor
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Configura o Mercado Pago com a sua chave secreta
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })

export async function POST(request: Request) {
  try {
    const { order_id } = await request.json()

    // 1. Busca os dados do pedido no banco
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    // 2. Verifica se já existe um PIX pendente para não gerar duplicado
    const { data: existingPix } = await supabase
      .from('payment_attempts')
      .select('*')
      .eq('order_id', order_id)
      .eq('status', 'PENDING')
      .single()

    if (existingPix) {
      return NextResponse.json({
        qr_code: existingPix.qr_code,
        qr_code_base64: existingPix.qr_code_base64
      })
    }

    // 3. Pede para o Mercado Pago gerar o PIX
    const payment = new Payment(client)
    const pixResponse = await payment.create({
      body: {
        transaction_amount: order.total_amount,
        description: `Pedido #${order.short_id} - MADURA COFFEE`,
        payment_method_id: 'pix',
        // O Mercado Pago exige um email. Se o cliente não preencheu, usamos um genérico
        payer: { email: order.customer_email || 'cliente@maduracoffee.com.br' }
      }
    })

    const qrCode = pixResponse.point_of_interaction?.transaction_data?.qr_code
    const qrCodeBase64 = pixResponse.point_of_interaction?.transaction_data?.qr_code_base64
    const paymentId = pixResponse.id?.toString()

    // 4. Salva a tentativa de pagamento no nosso banco
    await supabase.from('payment_attempts').insert({
      order_id: order.id,
      method: 'PIX',
      provider_payment_id: paymentId,
      amount: order.total_amount,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64
    })

    return NextResponse.json({
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64
    })
  } catch (error) {
    console.error('Erro ao gerar PIX:', error)
    return NextResponse.json({ error: 'Erro interno ao gerar PIX' }, { status: 300 })
  }
}