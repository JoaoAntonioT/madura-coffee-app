'use server'

import { supabase } from '../../lib/supabase'
import { revalidatePath } from 'next/cache'

// Ação para Aba EQUIPE: Cadastrar novo membro
export async function cadastrarMembro(formData: FormData) {
  const name = formData.get('name') as string
  const pin = formData.get('pin') as string
  const role = formData.get('role') as string

  const { error } = await supabase
    .from('team')
    .insert([{ name, pin, role }])

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Este PIN já está em uso.' }
    return { success: false, error: error.message }
  }

  revalidatePath('/balcao')
  return { success: true }
}

// Ação para Aba CAIXA: Confirmar Pagamento Manual
export async function confirmarPagamento(orderId: string, tipoPagamento: 'dinheiro' | 'maquininha') {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'PAID', 
        payment_method: tipoPagamento
      })
      .eq('id', orderId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Ação para Aba PREPARO: Marcar como Pronto
export async function marcarPronto(orderId: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'READY' })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function assumirPedido(orderId: string, teamMemberId: string) {
  // 1. Verifica se alguém já assumiu antes de gravar (Evita concorrência)
  const { data: orderToCheck, error: checkError } = await supabase
    .from('orders')
    .select('assigned_to, status')
    .eq('id', orderId)
    .single()

  if (checkError) return { success: false, error: 'Erro ao verificar pedido.' }
  if (orderToCheck.assigned_to) return { success: false, error: 'Outro barista já assumiu este pedido!' }

  // 2. Atualiza o status para IN_PRODUCTION e vincula ao barista
  const { error } = await supabase
    .from('orders')
    .update({ 
      status: 'IN_PRODUCTION',
      assigned_to: teamMemberId 
    })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/balcao')
  return { success: true }
}

// Adicione no final do seu app/balcao/actions.ts

export async function atualizarReceitaProduto(productId: string, instructions: string, ingredients: any[]) {
  try {
    const { error } = await supabase
      .from('products')
      .update({ 
        recipe_instructions: instructions,
        recipe_ingredients: ingredients // Salva a lista estruturada
      })
      .eq('id', productId)

    if (error) throw error
    
    revalidatePath('/balcao')
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao atualizar receita:', error)
    return { success: false, error: error.message }
  }
}
export async function limparPedidosExpirados() {
  try {
    
    const limiteExpiracao = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    // Atualiza para EXPIRED pedidos que estão em CREATED, PENDING, AWAITING_PAYMENT ou AWAITING_MANUAL_PAYMENT e que foram criados há mais de 15 minutos
    const { error } = await supabase
      .from('orders')
      .update({ status: 'EXPIRED' })
      .in('status', ['CREATED', 'PENDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT'])
      .lt('created_at', limiteExpiracao)

    if (error) throw error
  } catch (error) {
    console.error('Erro ao limpar pedidos expirados:', error)
  }
}

export async function cancelarPedido(orderId: string) {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', orderId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function marcarComoEntregue(orderId: string) {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'DELIVERED' })
      .eq('id', orderId)

    if (error) throw error
    revalidatePath('/balcao')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

import { MercadoPagoConfig, PaymentRefund } from 'mercadopago'

export async function reembolsarPedido(orderId: string, isPartial: boolean, amountToRefund?: number) {
  try {
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (!order) return { success: false, error: 'Pedido não encontrado' }

    const isOnline = ['pix', 'card', 'PIX', 'CREDIT_CARD'].includes(order.payment_method || '')

    if (isOnline) {
      const { data: attempt } = await supabase.from('payment_attempts')
        .select('*')
        .eq('order_id', orderId)
        .not('provider_payment_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!attempt || !attempt.provider_payment_id) {
         return { success: false, error: 'Nenhum ID de pagamento (MercadoPago) encontrado para estorno online.' }
      }

      const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })
      const refund = new PaymentRefund(client)
      
      const refundData: any = { payment_id: attempt.provider_payment_id }
      if (isPartial && amountToRefund) {
        refundData.body = { amount: amountToRefund }
      }
      
      await refund.create(refundData)
    }

    await supabase.from('orders').update({ status: 'REFUNDED' }).eq('id', orderId)
    
    revalidatePath('/balcao')
    return { success: true }
  } catch (error: any) {
    console.error('Erro no reembolso:', error)
    return { success: false, error: error.message || 'Falha ao estornar' }
  }
}

export async function reativarPedido(orderId: string) {
  try {
    await supabase.from('orders').update({ status: 'PAID' }).eq('id', orderId)
    revalidatePath('/balcao')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}