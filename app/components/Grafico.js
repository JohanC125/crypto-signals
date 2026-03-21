'use client';
import { useEffect, useRef } from 'react';

export default function Grafico({ simbolo }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${simbolo}USDT`,
      interval: '60',
      timezone: 'America/Bogota',
      theme: 'dark',
      style: '1',
      locale: 'es',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
    });

    containerRef.current.appendChild(script);
  }, [simbolo]);

  return (
    <div ref={containerRef} style={{ height: '400px', width: '100%' }}>
      <div style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
}