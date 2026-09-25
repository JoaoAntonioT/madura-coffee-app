import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

// Usamos a SERVICE_ROLE_KEY para ter poder de atualizar o pedido direto
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // O frontend vai nos mandar todas essas informações embaralhadas/seguras
    const { order_id, token, issuer_id, payment_method_id, installments, payer } = body

    // 1. Busca os dados do pedido no banco
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    // 2. Faz a cobrança real no Mercado Pago
    const payment = new Payment(client)
    const mpResponse = await payment.create({
      body: {
        transaction_amount: order.total_amount,
        token: token,
        description: `Pedido #${order.short_id} - MADURA COFFEE`,
        installments: installments,
        payment_method_id: payment_method_id,
        issuer_id: issuer_id,
        payer: {
          email: payer?.email || order.customer_email || 'cliente@maduracoffee.com.br',
          identification: payer?.identification // CPF/CNPJ se o formulário pedir
        }
      }
    })

    // 3. Salva a tentativa no nosso banco de dados
    await supabase.from('payment_attempts').insert({
      order_id: order.id,
      method: 'CREDIT_CARD',
      provider_payment_id: mpResponse.id?.toString(),
      amount: order.total_amount,
      status: mpResponse.status?.toUpperCase() // Pode ser 'APPROVED', 'IN_PROCESS', 'REJECTED'
    })

    // 4. Se o cartão for aprovado na hora, já mudamos o status do pedido!
    if (mpResponse.status === 'approved') {
      await supabase
        .from('orders')
        .update({ status: 'PAID' })
        .eq('id', order.id)
    }

    // Devolvemos o status para a tela do celular
    return NextResponse.json({ 
      status: mpResponse.status, 
      id: mpResponse.id 
    })

  } catch (error) {
    console.error('Erro ao processar cartão:', error)
    return NextResponse.json({ error: 'Erro interno ao processar pagamento' }, { status: 500 })
  }
}