const API_URL = 'http://localhost:3000';

// fetch no falla con 400/500: hay que revisar res.ok y lanzar el mensaje que manda el backend.
async function handleResponse(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message || `Error ${res.status}`);
  }
  return data;
}

export async function get(path) {
  const res = await fetch(API_URL + path);
  return handleResponse(res);
}

export async function post(path, body) {
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}
