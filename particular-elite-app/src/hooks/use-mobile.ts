import { useEffect, useState } from 'react';

const LIMITE = 768; // abaixo de md

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < LIMITE);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LIMITE - 1}px)`);
    const ao = () => setMobile(mq.matches);
    mq.addEventListener('change', ao);
    ao();
    return () => mq.removeEventListener('change', ao);
  }, []);
  return mobile;
}
