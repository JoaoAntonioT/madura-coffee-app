import { create } from 'zustand'

export type CartItem = {
  id: string;
  product: { id: string; name: string; price: number };
  quantity: number;
  observation: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: { id: string; name: string; price: number }, observation: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  
  addItem: (product, observation) => {
    const items = get().items;
    // Cria um ID combinando o produto e a observação. 
    // Assim, "Frappé (Sem chantilly)" e "Frappé (Normal)" ficam separados no carrinho.
    const itemId = `${product.id}-${observation.trim().toLowerCase()}`;
    const existingItem = items.find(i => i.id === itemId);

    if (existingItem) {
      set({ items: items.map(i => i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      set({ items: [...items, { id: itemId, product, quantity: 1, observation }] });
    }
  },
  
  removeItem: (id) => {
    set({ items: get().items.filter(i => i.id !== id) });
  },
  
  updateQuantity: (id, delta) => {
    const items = get().items.map(i => {
      if (i.id === id) {
        const newQuantity = i.quantity + delta;
        // Não deixa a quantidade ser menor que 1
        return newQuantity > 0 ? { ...i, quantity: newQuantity } : i;
      }
      return i;
    });
    set({ items });
  },
  
  clearCart: () => set({ items: [] }),
  
  totalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
  
  totalPrice: () => get().items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0),
}))