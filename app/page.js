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
  const [senales, setSenales] = useState({});
  const [cargando, setCargando] = useState(null);
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

  const analizarMoneda = async (simbolo) => {
    setCargando(simbolo);
    try {
      const res = await fetch(`/api/signals?symbol=${simbolo}`);
      const data = await res.json();
      setSenales(prev => ({ ...prev, [simbolo]: data }));
    } catch (e) {
      console.error(e);
    }
    setCargando(null);
  };

  const sig = senales[monedaSeleccionada];

  return (
    <main style={{ background: '#0b1120', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '600', margin: 0 }}>Señales Cripto IA</h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>Precios reales de Binance · {ultimaActualizacion}</p>
          </div>
        </div>

        {/* Tarjetas monedas */}
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

        {/* Botón analizar moneda seleccionada */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <button
            onClick={() => analizarMoneda(monedaSeleccionada)}
            disabled={cargando === monedaSeleccionada}
            style={{ background: cargando === monedaSeleccionada ? '#1e3a5f' : '#1d4ed8', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}
          >
            {cargando === monedaSeleccionada ? '⏳ Analizando...' : `⚡ Analizar ${monedaSeleccionada} con IA`}
          </button>
        </div>

        {/* Señal generada */}
        {sig ? (
          <div style={{ background: '#1e293b', borderRadius: '12px', border: `1px solid ${sig.operacion === 'LONG' ? '#22c55e44' : '#ef444444'}`, overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: sig.operacion === 'LONG' ? '#052e16' : '#2d0a0a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{sig.operacion === 'LONG' ? '🟢' : '🔴'}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: '600', fontSize: '18px' }}>OPERACIÓN: {sig.operacion}</div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>ACTIVO: {sig.symbol}USDT</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Confianza IA</div>
                <div style={{ color: sig.confianza >= 70 ? '#22c55e' : '#eab308', fontWeight: '700', fontSize: '20px' }}>{sig.confianza}%</div>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>🕐 TEMPORALIDAD</div>
                  <div style={{ color: '#fff', fontWeight: '600', fontSize: '16px' }}>{sig.temporalidad}</div>
                </div>
                <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>💪 APALANCAMIENTO</div>
                  <div style={{ color: '#fff', fontWeight: '600', fontSize: '16px' }}>{sig.apalancamiento}</div>
                </div>
              </div>

              <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '0.5px solid #1d4ed8' }}>
                <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>💰 PRECIO DE ENTRADA (pon esto en Binance)</div>
                <div style={{ color: '#60a5fa', fontWeight: '700', fontSize: '22px' }}>${sig.precio_entrada?.toLocaleString()}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: '#052e16', borderRadius: '10px', padding: '14px', border: '0.5px solid #22c55e44' }}>
                  <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>✅ TAKE PROFIT — Vende aquí para ganar</div>
                  <div style={{ color: '#22c55e', fontWeight: '700', fontSize: '20px' }}>${sig.take_profit?.toLocaleString()}</div>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Pon este valor en el campo TP de Binance</div>
                </div>
                <div style={{ background: '#2d0a0a', borderRadius: '10px', padding: '14px', border: '0.5px solid #ef444444' }}>
                  <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>🛑 STOP LOSS — Sal aquí para no perder</div>
                  <div style={{ color: '#ef4444', fontWeight: '700', fontSize: '20px' }}>${sig.stop_loss?.toLocaleString()}</div>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Pon este valor en el campo SL de Binance</div>
                </div>
              </div>

              <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: `0.5px solid ${sig.riesgo_liquidacion > 50 ? '#ef4444' : '#eab308'}44` }}>
                <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>☠️ RIESGO DE LIQUIDACIÓN</div>
                <div style={{ color: sig.riesgo_liquidacion > 50 ? '#ef4444' : '#eab308', fontWeight: '700', fontSize: '20px' }}>{sig.riesgo_liquidacion}%</div>
              </div>

              <div style={{ background: '#0f172a', borderRadius: '10px', padding: '14px', borderLeft: '3px solid #1d4ed8', marginBottom: '16px' }}>
                <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px' }}>⚡ ANÁLISIS DE LA IA</div>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>{sig.razon}</p>
              </div>

              <div style={{ background: '#1c1a04', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#eab308', textAlign: 'center' }}>
                ⚠️ Esto es análisis educativo, no asesoría financiera. Opera siempre con gestión de riesgo.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#1e293b', borderRadius: '12px', border: '0.5px solid #334155' }}>
            Selecciona una moneda arriba y presiona <strong style={{ color: '#fff' }}>"⚡ Analizar con IA"</strong>
          </div>
        )}

      </div>
    </main>
  );
}