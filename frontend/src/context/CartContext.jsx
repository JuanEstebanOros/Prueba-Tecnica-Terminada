import { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

const addToCart = (product) => {
  setCart((prev) => {
    const existing = prev.find((item) => item._id === product._id);

    if (existing) {
      return prev.map((item) =>
       item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
      );
    }

    return [...prev, { ...product, quantity: 1 }];
  });
};


  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item._id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (!(quantity >= 1)) return;
    setCart((prev) =>
      prev.map((item) => (item._id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
