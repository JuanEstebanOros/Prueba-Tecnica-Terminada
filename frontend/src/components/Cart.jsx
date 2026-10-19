import { useEffect, useState } from 'react';
import { get, post } from '../api';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    get('/customers').then(setCustomers);
  }, []);

  useEffect(() => {
    let sum = 0;
    cart.forEach((item) => {
      sum += item.price * item.quantity;
    });
    setTotal(sum);
  }, [cart]);

  const checkout = async () => {
    if (!customerId) {
      alert('Selecciona un cliente');
      return;
    }
    try {
      const order = await post('/orders', {
        customerId,
        items: cart.map((item) => ({
          productId: item._id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      });
      alert(`Pedido creado ✔ Total: $${order.total}`);
      clearCart();
    } catch (err) {
      alert(`No se pudo crear el pedido: ${err.message}`);
    }
  };

  return (
    <div className="cart">
      <h2>Carrito ({cart.length})</h2>

      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">-- Cliente --</option>
        {customers.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name} ({c.email})
          </option>
        ))}
      </select>

      {cart.length === 0 && <p className="muted">El carrito está vacío</p>}

      <ul>
        {cart.map((item) => (
          <li key={item._id}>
            <span>{item.name}</span>
            <input
              type="number"
              min="1"
              max={item.stock}
              value={item.quantity}
              onChange={(e) => updateQuantity(item._id, Number(e.target.value))}
            />
            <span>${(item.price * item.quantity).toFixed(2)}</span>
            <button onClick={() => removeFromCart(item._id)}>✕</button>
          </li>
        ))}
      </ul>

      <p className="total">Total: ${total.toFixed(2)}</p>
      <button className="primary" onClick={checkout} disabled={cart.length === 0}>
        Finalizar compra
      </button>
    </div>
  );
}
