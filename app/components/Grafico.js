'use client';
import { useEffect, useRef } from 'react';

export default function Grafico({ simbolo }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let chart;

    const iniciar = async () => {
      const { createChart } = await import('lightweight-charts');

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: '#0f172a' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: '#1e293b' },
          horzLines: { color: '#1e293b' },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#334155' },
        timeScale: { borderColor: '#334155', timeVisible: true },
      });

      chartRef.current = chart;

      const serie = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${simbolo}USDT&interval=1h&limit=100`
        );
        const data = await res.json();

        const velas = data.map(k => ({
          time: Math.floor(k[0] / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

        serie.setData(velas);
        chart.timeScale().fitContent();
      } catch (e) {
        console.error(e);
      }
    };

    iniciar();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [simbolo]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '300px', borderRadius: '8px', overflow: 'hidden' }} />
  );
}