import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center my-4">
      <div className="text-5xl font-bold text-[#B21B1B] tracking-tight mb-2">
        {format(now, 'HH:mm')}
      </div>
      <div className="text-sm font-semibold text-slate-500">
        {format(now, 'EEEE, d MMMM yyyy', { locale: id })}
      </div>
    </div>
  );
}
