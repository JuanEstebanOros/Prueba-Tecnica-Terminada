import { useEffect, useState } from 'react';

// El reloj tiene su propio estado: solo este componente se re-renderiza cada segundo.
export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="clock">{now.toLocaleTimeString()}</span>;
}
