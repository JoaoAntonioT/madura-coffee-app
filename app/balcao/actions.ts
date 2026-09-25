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