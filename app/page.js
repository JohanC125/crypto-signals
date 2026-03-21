'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Grafico = dynamic(() => import('./components/Grafico'), { ssr: false });

const MONEDAS = [
  { simbolo: 'BTC', nombre: 'Bitcoin' },
  { simbolo: 'ETH', nombre: 'Ethereum' },
  { simbolo: 'SOL', nombre: 'Solana' },
  { simbolo: 'BNB', nombre: 'BNB' },
  { simbolo: 'XRP', nombre: 'Ripple' },
];

export default function Home() {
  const [datos, setDatos] = useState([]);
  const [senales, setSenales] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('BTC');

  const fetchPrecios = async () => {
    try {
      const res = await Promise.all(
        MONEDAS.map(m => fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${m.simbolo}USDT`).then(r => r.json()))
      );
      const nuevosDatos = res.map((d, i) => ({
        simbolo: MONEDAS[i].simbolo,
        nombre: MONEDAS[i].nombre,
        precio: parseFloat(parseFloat(d.lastPrice).toFixed(2)),
        cambio: parseFloat(parseFloat(d.priceChangePercent).toFixed(2)),
      }));
      setDatos(nuevosDatos);
      setUltimaActualizacion(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPrecios();
    const interval = setInterval(fetchPrecios, 5000);
    return () => clearInterval(interval);
  }, []);

  const analizarMercado = async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/signals');
      const data = await res.json();
      setSenales(data.signals || []);
    } catch (e) {
      console.error(e);
    }
    setCargando(false);
  };

  return (
    <main style={{ background: '#0b1120', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '600', margin: 0 }}>Señales Cripto IA</h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Precios reales de Binance · Actualizado {ultimaActualizacion}</p>
          </div>
          <button onClick={analizarMercado} disabled={cargando} style={{ background: cargando ? '#1e3a5f' : '#1d4ed8', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            {cargando ? 'Analizando...' : '⚡ Analizar con IA'}
          </button>
        </div>

        {/* Tarjetas precios */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {datos.map(m => (
            <div key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)} style={{ background: monedaSeleccionada === m.simbolo ? '#1d4ed8' : '#1e293b', borderRadius: '12px', padding: '16px', border: monedaSeleccionada === m.simbolo ? '0.5px solid #3b82f6' : '0.5px solid #334155', cursor: 'pointer' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>{m.simbolo}</div>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>${m.precio.toLocaleString()}</div>
              <div style={{ color: m.cambio >= 0 ? '#22c55e' : '#ef4444', fontSize: '12px' }}>
                {m.cambio >= 0 ? '▲' : '▼'} {Math.abs(m.cambio)}%
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico */}
        <div style={{ background: '#1e293b', borderRadius: '12px', border: '0.5px solid #334155', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#fff', fontSize: '16px', fontWeight: '500', margin: 0 }}>Gráfico {monedaSeleccionada}/USDT</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {MONEDAS.map(m => (
                <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)} style={{ background: monedaSeleccionada === m.simbolo ? '#1d4ed8' : '#0f172a', color: monedaSeleccionada === m.simbolo ? '#fff' : '#64748b', border: '0.5px solid #334155', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  {m.simbolo}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>
        </div>

        {/* Señales estilo Telegram */}
        {senales.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ color: '#fff', fontSize: '16px', fontWeight: '500', margin: 0 }}>⚡ Señales generadas por IA</h2>
            {senales.map(sig => (
              <div key={sig.symbol} style={{ background: '#1e293b', borderRadius: '12px', border: `1px solid ${sig.operacion === 'LONG' ? '#22c55e33' : '#ef444433'}`, overflow: 'hidden' }}>
                <div style={{ background: sig.operacion === 'LONG' ? '#052e16' : '#2d0a0a', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{sig.operacion === 'LONG' ? '🟢' : '🔴'}</span>
                    <div>
                      <span style={{ color: '#fff', fontWeight: '600', fontSize: '16px' }}>SEÑAL {sig.operacion}</span>
                      <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '8px' }}>#{sig.symbol}USDT</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Confianza</div>
                    <div style={{ color: sig.confianza >= 70 ? '#22c55e' : '#eab308', fontWeight: '600' }}>{sig.confianza}%</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '3px' }}>🕐 TEMPORALIDAD</div>
                      <div style={{ color: '#fff', fontWeight: '600' }}>{sig.temporalidad}</div>
                    </div>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '3px' }}>💪 APALANCAMIENTO</div>
                      <div style={{ color: '#fff', fontWeight: '600' }}>{sig.apalancamiento}</div>
                    </div>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '3px' }}>💰 PRECIO ENTRADA</div>
                      <div style={{ color: '#60a5fa', fontWeight: '600' }}>${sig.precio_entrada?.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '3px' }}>☠️ RIESGO LIQUIDACIÓN</div>
                      <div style={{ color: sig.riesgo_liquidacion > 50 ? '#ef4444' : '#eab308', fontWeight: '600' }}>{sig.riesgo_liquidacion}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ background: '#052e16', borderRadius: '8px', padding: '10px 14px', border: '0.5px solid #22c55e44' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '3px' }}>✅ TAKE PROFIT</div>
                      <div style={{ color: '#22c55e', fontWeight: '600', fontSize: '16px' }}>${sig.take_profit?.toLocaleString()}</div>
                      <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Vende aquí para ganar</div>
                    </div>
                    <div style={{ background: '#2d0a0a', borderRadius: '8px', padding: '10px 14px', border: '0.5px solid #ef444444' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '3px' }}>🛑 STOP LOSS</div>
                      <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '16px' }}>${sig.stop_loss?.toLocaleString()}</div>
                      <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Sal aquí para no perder</div>
                    </div>
                  </div>
                  <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 14px', borderLeft: '3px solid #1d4ed8' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>⚠️ ANÁLISIS IA</div>
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>{sig.razon}</p>
                  </div>
                  <div style={{ marginTop: '12px', padding: '8px 14px', background: '#0f172a', borderRadius: '8px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                    ⚠️ Esto es análisis educativo, no asesoría financiera. Opera siempre con gestión de riesgo.
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#1e293b', borderRadius: '12px', border: '0.5px solid #334155' }}>
            Presiona <strong style={{ color: '#fff' }}>"⚡ Analizar con IA"</strong> para generar señales de trading
          </div>
        )}

      </div>
    </main>
  );
}