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
export async function confirmarPagamento(orderId: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'PAID', payment_method: 'manual' })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }
  return { success: true }
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

export async function atualizarReceitaProduto(productId: string, recipeText: string) {
  try {
    const { error } = await supabase
      .from('products')
      .update({ recipe_instructions: recipeText })
      .eq('id', productId)

    if (error) throw error
    
    revalidatePath('/balcao')
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao atualizar receita:', error)
    return { success: false, error: error.message }
  }
}