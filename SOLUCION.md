# SOLUCIÓN

> Tengo capturas "antes / después" de cada ticket (T1, T2, T3, T4, T6, T7) en mi PC y las puedo mostrar en la sesión técnica.

## Tickets

### T1 — El carrito muestra cantidades erróneas al agregar rápido
- **Causa raíz:** `addToCart` en `frontend/src/context/CartContext.jsx` calculaba el nuevo carrito a partir de `cart`, el valor que tenía el estado en ese render. Si haces varios clics seguidos antes de que React vuelva a renderizar, todos parten del mismo carrito viejo y se pierden actualizaciones.
- **Solución:** usar el actualizador funcional `setCart(prev => ...)`. React le pasa siempre el estado más reciente, así que cada clic suma sobre el anterior.
- **Cómo lo verifiqué:** hice clic muchas veces seguidas en "Agregar" y comprobé que la cantidad y el total cuadran. Captura antes/después.

### T2 — Todos los pedidos quedan con total $0
- **Causa raíz:** en `backend/src/orders/orders.service.ts` (`create`) los items se recorrían con `forEach(async ...)`. `forEach` no espera las promesas, así que el pedido se guardaba con `total = 0` antes de que terminara alguno de los `await`.
- **Solución:** cambiar a `for...of` con `await`, que sí espera cada iteración antes de seguir.
- **Cómo lo verifiqué:** creé un pedido válido y el total salió correcto (ej. $980.18). Captura antes/después.

### T3 — La API se cae al comprar más unidades de las que hay en stock
- **Causa raíz:** el error de stock se lanzaba dentro de `forEach(async ...)`. Ese error termina en una promesa rechazada que nadie maneja, y Node apaga el proceso. Además, como se descontaba item por item, los productos anteriores ya habían perdido stock (descuento parcial).
- **Solución:** `create` trabaja en dos fases. Primero valida **todos** los items y, si alguno no alcanza, lanza `BadRequestException` (HTTP 400). Solo si todo está bien, descuenta el stock y guarda el pedido.
- **Cómo lo verifiqué:** un pedido con el producto A (alcanza) y el B (no alcanza) responde 400 `"No hay stock suficiente de ..."`, la API sigue viva y el stock de A queda intacto. Captura antes/después.

### T4 — La pestaña Pedidos es lenta y todo se pone más lento con el tiempo
- **Causa raíz:**
  - (a) `frontend/src/components/OrderList.jsx` hacía polling con `setInterval` sin `clearInterval`. Cada vez que entrabas a la pestaña o cambiabas el filtro se sumaba un timer nuevo, y las peticiones se iban acumulando.
  - (b) `findAll` en `orders.service.ts` hacía consultas N+1: una consulta por el cliente y otra por cada producto de **cada** pedido.
- **Solución:**
  - (a) el `useEffect` devuelve un cleanup con `clearInterval`.
  - (b) traigo los pedidos con `lean()`, junto los ids únicos y hago **2 consultas** con `$in` (clientes y productos, solo con `name`). Luego los uno en memoria con un `Map`.
- **Cómo lo verifiqué:** en la pestaña Network la petición bajó de **1.1–1.5 s a ~64 ms**, con la mitad del payload. También comprobé que ya no se acumulan peticiones al cambiar de pestaña. Captura antes/después.

### T5 — El buscador se siente trabado y la página va lenta sin hacer nada
- **Causa raíz (varias):**
  - El reloj (`now` + `setInterval`) vivía en `App`, así que **toda la app** se re-renderizaba cada segundo.
  - El buscador hacía una petición por cada tecla.
  - Había un bubble sort en el cliente sobre todos los productos.
  - Las tarjetas usaban `key={index}`.
  - Las categorías se sacaban de los productos visibles.
- **Solución:**
  - Reloj movido a `frontend/src/components/Clock.jsx`, con su propio estado e intervalo (`clearInterval` en el cleanup). `App` solo tiene el estado `tab`.
  - Debounce de 400 ms con `useEffect` + `clearTimeout` (`searchInput` → `search`).
  - El orden lo hace Mongo (ver Nueva funcionalidad).
  - `key={product._id}` en `ProductList.jsx`.
  - Categorías desde el servidor (`distinct`).
- **Cómo lo verifiqué:** `npm run build` OK. Con React DevTools → "Highlight updates when components render" se ve que cada segundo solo se actualiza el reloj, y en Network solo sale una petición cuando dejas de escribir.

### T6 — Buscar `camisa (talla` deja la pantalla en blanco
- **Causa raíz:** el backend armaba `new RegExp(search)` con el texto del usuario. `(` es un carácter especial de las expresiones regulares, así que el patrón quedaba inválido, la API respondía 500 y el frontend se rompía.
- **Solución:** `escapeRegExp` en `products.service.ts` escapa los caracteres especiales antes de crear el RegExp: `text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. Así la búsqueda trata el texto como texto literal.
- **Cómo lo verifiqué:** buscar `camisa (talla` devuelve "Camisa (talla M) edición especial" sin errores. Captura antes/después.

### T7 — La pestaña Estadísticas nunca ha funcionado
- **Causa raíz:**
  - (a) en `orders.controller.ts` la ruta `@Get('top-products')` estaba declarada **después** de `@Get(':id')`. Nest revisa las rutas en orden, así que tomaba "top-products" como un `id` y Mongoose daba `CastError`.
  - (b) en `Stats.jsx` el objeto `options = { limit: 10 }` se creaba dentro del componente y estaba en las dependencias del `useEffect`. Cada render creaba una referencia nueva, el efecto se volvía a ejecutar y se formaba un bucle infinito de peticiones.
- **Solución:** (a) moví `top-products` antes de `:id`. (b) moví `options` fuera del componente, así que la referencia ya no cambia.
- **Cómo lo verifiqué:** la pestaña muestra el top 10 y en Network sale una sola petición. Captura antes/después.

## Nueva funcionalidad — Paginación, filtros y orden en el servidor

- `GET /products` recibe `page`, `limit`, `search`, `category` y `sortBy`, y responde `{ data, total, page, limit }`. Hay 5003 productos en la BD.
- `page` mínimo 1. `limit` entre 1 y **100** (por defecto 20), para que nadie pueda pedir un millón de registros.
- Todo pasa en Mongo: `find(filter).sort(sort).skip((page-1)*limit).limit(limit).lean()`. El total sale de `countDocuments(filter)` **con el mismo filtro**, así coincide con lo que se pagina. Las dos consultas corren en paralelo con `Promise.all`.
- `sortBy` usa una **whitelist** (`name` o `price`). Cualquier otro valor usa `createdAt` descendente. Siempre desempata por `_id`, para que el orden sea estable y no se repitan ni salten productos entre páginas.
- `lean()` devuelve objetos planos, más livianos que los documentos de Mongoose.
- `GET /products/categories` usa `distinct('category')` y `GET /products/count` usa `countDocuments()`, en vez de cargar todos los productos.
- Frontend (`ProductList.jsx`):
  - Botones Anterior/Siguiente y "Página X de N".
  - `setPage(1)` al cambiar búsqueda, categoría u orden.
  - Debounce de 400 ms en el buscador.
  - Categorías desde el servidor.
  - `sortBy` en las dependencias del `useEffect` (antes faltaba y cambiar el orden no recargaba nada).
  - `autoComplete="off"` en los `<select>`, porque Chrome restauraba el valor visual tras F5 y quedaba distinto del estado de React.

## Otros problemas encontrados

| Problema | Dónde | Impacto | ¿Lo arreglé? |
|----------|-------|---------|--------------|
| XSS guardado: un producto tiene `<img src=x onerror=alert(...)>` en la descripción y se pintaba con `dangerouslySetInnerHTML` | `ProductCard.jsx` | Alto: se ejecuta JS en el navegador de cualquiera que vea el producto | Sí, ahora se muestra como texto. Efecto secundario: el `<b>` de "Camisa (talla M)" se ve como texto literal |
| `api.js` no revisaba `res.ok`: un 400/500 se trataba como éxito ("Total: $undefined") | `frontend/src/api.js`, `Cart.jsx` | Medio: el usuario cree que compró cuando falló | Sí, lanza `Error` con el mensaje del backend y el carrito lo muestra |
| `main.ts` sin `ValidationPipe`: los DTOs con class-validator no se aplican (se acepta un pedido con `items: []` o un cliente que no existe) | `backend/src/main.ts` | Alto: entran datos inválidos a la BD | No |
| CORS abierto a cualquier origen | `main.ts` (`enableCors()`) | Medio | No |
| URI de Mongo hardcodeada | `app.module.ts`, `seed.ts` | Bajo/Medio: no se puede configurar por entorno | Sí, se lee de `MONGO_URI` (con el valor local como respaldo) y está documentada en el README |
| La API de clientes devuelve la contraseña en texto plano (y se guarda sin hash) | `customers.service.ts`, `customer.schema.ts` | Alto: fuga de credenciales | No |
| Se confía en el `unitPrice` que manda el cliente | `orders.service.ts` `create` | Alto: alguien puede comprar a $0.01 | Sí, el total y el `unitPrice` guardado salen de `product.price` de la BD |
| Condición de carrera en el stock: leer → validar → guardar no es atómico | `orders.service.ts` `create` | Medio: dos compras simultáneas pueden dejar stock negativo | No (alternativa: `findOneAndUpdate` con `stock: { $gte: qty }` + `$inc`, o una transacción) |
| `create` falla con 500 si el `productId` no existe (`product` es `null`) | `orders.service.ts` | Medio | Sí, `NotFoundException` (404) con mensaje claro |
| `updateStatus` falla con 500 si la orden no existe (`order` es `null`) | `orders.service.ts` | Medio: debería ser 404 | Sí, `NotFoundException` (404) |
| `topProducts` carga **todas** las órdenes en memoria, hace un `findById` por producto y falla si el producto es `null` | `orders.service.ts` | Medio: lento y frágil | No (mejor un `aggregate` con `$unwind`/`$group`/`$lookup`) |
| `findOne` con un id mal formado da `CastError` (500) en vez de 400/404 | products, orders, customers | Bajo | No |
| Falta índice en `category` y `createdAt` (y `name` para ordenar) | `product.schema.ts`, `order.schema.ts` | Medio: las consultas escanean toda la colección | No |
| Los parámetros de la URL no se codifican: buscar `a&b` o `#` corta la query | `ProductList.jsx` | Bajo | No (usar `encodeURIComponent` o `URLSearchParams`) |
| Peticiones obsoletas pueden pisar a las nuevas (respuesta lenta de una búsqueda vieja) | `ProductList.jsx`, `OrderList.jsx` | Bajo | No (usar `AbortController`) |
| Sin manejo de error en `ProductList`/`OrderList`: si la API falla, "Cargando..." se queda para siempre | `ProductList.jsx`, `OrderList.jsx` | Bajo | Sí, `.catch` guarda el mensaje en un estado `error`, se muestra en pantalla, se quita el "Cargando..." y se limpia en la siguiente carga exitosa |
| El estado `error` de Stats nunca se limpia | `Stats.jsx` | Bajo | No |
| `removeFromCart` usa el `cart` viejo (el mismo problema de T1) | `CartContext.jsx` | Bajo | No |
| El input de cantidad del carrito usa `defaultValue` y no está conectado: cambiarlo no hace nada | `Cart.jsx` | Bajo: confunde al usuario | Sí, `updateQuantity` en `CartContext` (actualizador funcional, limita la cantidad entre 1 y el stock con `Math.min(Math.max(1, quantity), item.stock)`) e input controlado con `value` + `onChange` + `max={item.stock}`. Este límite del frontend es solo por comodidad: la validación real del stock sigue siendo la del backend (T3), porque el stock del carrito es el que había al agregarlo y alguien puede saltarse el frontend |
| El carrito usa `key={index}` | `Cart.jsx` | Bajo | Sí, `key={item._id}` |
| Totales con decimales flotantes sin redondear | `Cart.jsx`, `orders.service.ts` | Bajo: montos tipo `$30.060000000000002` | Parcial: el carrito los muestra con `.toFixed(2)`; el total guardado en el backend sigue sin redondear |

## Si tuviera más tiempo…

1. **Seguridad primero:** activar `ValidationPipe` con DTOs de class-validator (y quitar `unitPrice` del DTO, que ya no se usa), y quitar la contraseña de las respuestas (y guardarla con hash).
2. **Integridad del pedido:** descuento de stock atómico (`findOneAndUpdate` con `$gte` + `$inc`) o una transacción de Mongo para todo el pedido.
3. **Tests:** unitarios y e2e de la creación de órdenes (total, stock insuficiente → 400, sin descuento parcial) y de la paginación.
4. **Rendimiento:** índices en Mongo (`category`, `createdAt`, `name`), `topProducts` con `aggregate`, y caché de categorías.
5. **Frontend:** estado vacío en la UI, `AbortController` para peticiones obsoletas y `URLSearchParams` para las queries.
6. **Configuración:** variables de entorno para el puerto, la URL de la API y los orígenes de CORS (la URI de Mongo ya usa `MONGO_URI`).
