import { useEffect, useState } from 'react';
import { get } from '../api';
import { useCart } from '../context/CartContext';
import ProductCard from './ProductCard';



export default function ProductList() {
  const { addToCart } = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    setLoading(true);
    get(`/products?search=${search}&page=${page}&limit=${limit}&category=${category}&sortBy=${sortBy}`).then((data) => {
      setProducts(data.data);
      setTotal(data.total);
      setError(null);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
}, [search, page, category, sortBy]);

  useEffect(() => {
    get('/products/categories').then((data) => setCategories(data));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);

  }, [searchInput]);


  return (
    <div>
      <div className="toolbar">
        <input
          placeholder="Buscar producto..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select value={category} autoComplete="off" onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={sortBy} autoComplete="off" onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
          <option value="name">Nombre</option>
          <option value="price">Precio</option>
        </select>
        {loading && <span>Cargando...</span>}
      </div>

      {error && <p className="error">Error cargando productos: {error}</p>}

      <p className="muted">{total} productos</p>

      <div className="grid">
        {products.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onAdd={() => addToCart(product)}
            style={{ borderColor: product.stock < 5 ? 'orange' : '#ddd' }}
          />
        ))}
      </div>
      <div>
        <button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Anterior
        </button>
        <span> Página {page} de {Math.ceil(total / limit)} </span>
        <button onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / limit)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
