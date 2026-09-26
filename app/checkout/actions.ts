'use server'

import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin'

export async function criarPedido(
  customerName: string, 
  customerEmail: string, 
  totalAmount: number, 
  items: any[]
) {
  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        customer_email: customerEmail || null,
        total_amount: totalAmount
      })
      .select()
      .single()

    if (orderError || !order) throw orderError

    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      observation: item.observation
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
    if (itemsError) throw itemsError

    return { success: true, token: order.token }
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error)
    return { success: false, error: error.message }
  }
}
