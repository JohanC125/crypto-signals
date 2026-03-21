'use client';
import { useEffect, useRef, useState } from 'react';

export default function Grafico({ simbolo }) {
  const canvasRef = useRef(null);
  const [velas, setVelas] = useState([]);

  useEffect(() => {
    const fetchVelas = async () => {
      try {
        const res = await fetch(`/api/klines?symbol=${simbolo}`);
        const data = await res.json();
        setVelas(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchVelas();
  }, [simbolo]);

  useEffect(() => {
    if (!velas.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const precios = velas.flatMap(v => [v.high, v.low]);
    const minP = Math.min(...precios);
    const maxP = Math.max(...precios);
    const rango = maxP - minP;

    const toY = (p) => H - 20 - ((p - minP) / rango) * (H - 40);
    const velaW = Math.floor(W / velas.length) - 1;

    velas.forEach((v, i) => {
      const x = i * (velaW + 1) + velaW / 2;
      const color = v.close >= v.open ? '#22c55e' : '#ef4444';

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(v.high));
      ctx.lineTo(x, toY(v.low));
      ctx.stroke();

      const yOpen = toY(v.open);
      const yClose = toY(v.close);
      ctx.fillStyle = color;
      ctx.fillRect(
        i * (velaW + 1),
        Math.min(yOpen, yClose),
        velaW,
        Math.max(Math.abs(yClose - yOpen), 1)
      );
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText(`$${maxP.toLocaleString()}`, 4, 14);
    ctx.fillText(`$${minP.toLocaleString()}`, 4, H - 6);
  }, [velas]);

  return (
    <canvas ref={canvasRef} width={1060} height={300} style={{ width: '100%', height: '300px', borderRadius: '8px' }} />
  );
}