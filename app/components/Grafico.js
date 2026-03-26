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
      interval: '1',
      timezone: 'America/Bogota',
      theme: 'dark',
      style: '1',
      locale: 'es',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      refresh_interval: 10,
    });

    containerRef.current.appendChild(script);
  }, [simbolo]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: '400px' }}>
      <div style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
}