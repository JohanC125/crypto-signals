'use client';
import { useState, useEffect } from 'react';

const MONEDAS = [
  { simbolo: 'BTC', nombre: 'Bitcoin' },
  { simbolo: 'ETH', nombre: 'Ethereum' },
  { simbolo: 'SOL', nombre: 'Solana' },
  { simbolo: 'BNB', nombre: 'BNB' },
  { simbolo: 'XRP', nombre: 'Ripple' },
];

function getColor(senal) {
  if (!senal) return '#64748b';
  if (senal.includes('COMPRAR')) return '#22c55e';
  if (senal.includes('VENDER')) return '#ef4444';
  return '#eab308';
}

function getBadge(senal) {
  if (!senal) return 'SIN ANALIZAR';
  if (senal.includes('COMPRAR')) return 'COMPRAR';
  if (senal.includes('VENDER')) return 'VENDER';
  return 'ESPERAR';
}

export default function Home() {
  const [datos, setDatos] = useState([]);
  const [senales, setSenales] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoPrecios, setCargandoPrecios] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');

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
        volumen: parseFloat(parseFloat(d.volume).toFixed(0)),
      }));
      setDatos(nuevosDatos);
      setUltimaActualizacion(new Date().toLocaleTimeString());
      setCargandoPrecios(false);
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '600', margin: 0 }}>Señales Cripto IA</h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
              Precios reales de Binance · Actualizado {ultimaActualizacion}
            </p>
          </div>
          <button onClick={analizarMercado} disabled={cargando} style={{ background: cargando ? '#1e3a5f' : '#1d4ed8', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            {cargando ? 'Analizando...' : 'Analizar con IA'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {cargandoPrecios ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', border: '0.5px solid #334155', height: '80px' }} />
            ))
          ) : (
            datos.map(m => (
              <div key={m.simbolo} style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', border: '0.5px solid #334155' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>{m.simbolo}</div>
                <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>${m.precio.toLocaleString()}</div>
                <div style={{ color: m.cambio >= 0 ? '#22c55e' : '#ef4444', fontSize: '12px' }}>
                  {m.cambio >= 0 ? '▲' : '▼'} {Math.abs(m.cambio)}%
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ background: '#1e293b', borderRadius: '12px', border: '0.5px solid #334155', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #334155' }}>
            <h2 style={{ color: '#fff', fontSize: '16px', fontWeight: '500', margin: 0 }}>Tabla de mercado — Precios reales</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Moneda', 'Precio', 'Cambio 24h', 'Volumen', 'Señal IA'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', color: '#64748b', fontSize: '12px', textAlign: 'left', fontWeight: '500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map(m => {
                const sig = senales.find(s => s.symbol === m.simbolo);
                return (
                  <tr key={m.simbolo} style={{ borderTop: '0.5px solid #334155' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ color: '#fff', fontWeight: '500' }}>{m.simbolo}</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>{m.nombre}</div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#fff', fontWeight: '500' }}>${m.precio.toLocaleString()}</td>
                    <td style={{ padding: '14px 20px', color: m.cambio >= 0 ? '#22c55e' : '#ef4444' }}>
                      {m.cambio >= 0 ? '+' : ''}{m.cambio}%
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '13px' }}>
                      {m.volumen.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: getColor(sig?.signal || '') + '22', color: getColor(sig?.signal || ''), padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                        {getBadge(sig?.signal || '')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {senales.length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '0.5px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #334155' }}>
              <h2 style={{ color: '#fff', fontSize: '16px', fontWeight: '500', margin: 0 }}>Análisis detallado por IA</h2>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {senales.map(sig => (
                <div key={sig.symbol} style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', border: `0.5px solid ${getColor(sig.signal)}44` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: '#fff', fontWeight: '600' }}>{sig.symbol}</span>
                    <span style={{ background: getColor(sig.signal) + '22', color: getColor(sig.signal), padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                      {getBadge(sig.signal)}
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{sig.signal}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!senales.length && !cargando && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#1e293b', borderRadius: '12px', border: '0.5px solid #334155' }}>
            Presiona <strong style={{ color: '#fff' }}>"Analizar con IA"</strong> para obtener señales detalladas de cada moneda
          </div>
        )}

      </div>
    </main>
  );
}