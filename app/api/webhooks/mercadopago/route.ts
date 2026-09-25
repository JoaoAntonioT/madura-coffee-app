import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

// Nosso banco de dados (COM A CHAVE MESTRA AGORA)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // <- Mudou aqui!
)

// Nosso acesso ao Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // O Mercado Pago manda o ID do pagamento que foi atualizado
    const paymentId = body?.data?.id || body?.id

    if (!paymentId) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }

    // 1. Perguntamos direto ao Mercado Pago: "Qual é o status real desse pagamento?"
    // (Isso evita que hackers mandem webhooks falsos para aprovar pedidos)
    const paymentAPI = new Payment(client)
    const paymentInfo = await paymentAPI.get({ id: paymentId })

    // 2. Procuramos esse pagamento no nosso banco
    const { data: attempt } = await supabase
      .from('payment_attempts')
      .select('*')
      .eq('provider_payment_id', paymentId.toString())
      .single()

    if (!attempt) {
      // Se não achou, responde OK para o Mercado Pago parar de tentar avisar
      return NextResponse.json({ message: 'Pagamento ignorado' }, { status: 200 })
    }

    const novoStatus = paymentInfo.status?.toUpperCase() // Ex: 'APPROVED', 'REJECTED'

    // 3. Atualiza o status da nossa tentativa de pagamento
    await supabase
      .from('payment_attempts')
      .update({ status: novoStatus })
      .eq('id', attempt.id)

    // 4. A MÁGICA: Se foi aprovado, atualiza o pedido para PAID e salva o método
    if (novoStatus === 'APPROVED') {
      await supabase
        .from('orders')
        .update({ 
          status: 'PAID',
          payment_method: attempt.method // Vai salvar 'PIX' ou 'CREDIT_CARD' automaticamente
        })
        .eq('id', attempt.order_id)
    }

    // Responde OK (200) para o Mercado Pago
    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error) {
    console.error('Erro no webhook:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}