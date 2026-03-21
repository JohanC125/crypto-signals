'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Grafico = dynamic(() => import('./components/Grafico'), { ssr: false });

const MONEDAS = [
  { simbolo: 'BTC', nombre: 'Bitcoin', color: '#F7931A' },
  { simbolo: 'ETH', nombre: 'Ethereum', color: '#627EEA' },
  { simbolo: 'SOL', nombre: 'Solana', color: '#9945FF' },
  { simbolo: 'BNB', nombre: 'BNB', color: '#F3BA2F' },
  { simbolo: 'XRP', nombre: 'Ripple', color: '#00AAE4' },
];

export default function Home() {
  const [datos, setDatos] = useState([]);
  const [senales, setSenales] = useState({});
  const [cargando, setCargando] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('BTC');
  const [monto, setMonto] = useState('');

  const fetchPrecios = async () => {
    try {
      const res = await Promise.all(
        MONEDAS.map(m => fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${m.simbolo}USDT`).then(r => r.json()))
      );
      const nuevosDatos = res.map((d, i) => ({
        ...MONEDAS[i],
        precio: parseFloat(parseFloat(d.lastPrice).toFixed(2)),
        cambio: parseFloat(parseFloat(d.priceChangePercent).toFixed(2)),
        volumen: parseFloat(parseFloat(d.quoteVolume).toFixed(0)),
      }));
      setDatos(nuevosDatos);
      setUltimaActualizacion(new Date().toLocaleTimeString());
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
    setCargando(null);
  };

  const sig = senales[monedaSeleccionada];
  const monedaActual = datos.find(m => m.simbolo === monedaSeleccionada);

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <div style={{ background: '#161a1e', borderBottom: '1px solid #2b2f36', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo */}
          <div style={{ position: 'relative', width: '42px', height: '42px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6D28D9 0%, #A855F7 50%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px #A855F766' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: '16px', color: '#fff', letterSpacing: '-1px' }}>JC</span>
            </div>
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', background: '#0ecb81', borderRadius: '50%', border: '2px solid #161a1e' }}></div>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px', letterSpacing: '0.5px' }}>JACJ <span style={{ color: '#A855F7' }}>Signals</span></div>
            <div style={{ color: '#6D28D9', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>by Johan Caro</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', background: '#0ecb81', borderRadius: '50%' }}></div>
          <span style={{ color: '#848e9c', fontSize: '12px' }}>EN VIVO · {ultimaActualizacion}</span>
        </div>
      </div>

      {/* Barra monedas */}
      <div style={{ background: '#161a1e', borderBottom: '1px solid #2b2f36', padding: '0 20px', display: 'flex', gap: '4px', overflowX: 'auto' }}>
        {datos.map(m => (
          <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)} style={{ background: 'none', border: 'none', borderBottom: monedaSeleccionada === m.simbolo ? `2px solid ${m.color}` : '2px solid transparent', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#000' }}>{m.simbolo[0]}</div>
            <span style={{ color: monedaSeleccionada === m.simbolo ? '#fff' : '#848e9c', fontSize: '13px', fontWeight: '500' }}>{m.simbolo}/USDT</span>
            <span style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '12px' }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, overflow: 'hidden' }}>

        {/* Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #2b2f36' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2b2f36', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: monedaActual?.color || '#fff' }}></div>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>{monedaSeleccionada}/USDT</span>
              </div>
              <div style={{ color: '#fff', fontSize: '28px', fontWeight: '700' }}>${monedaActual?.precio?.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div>
                <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>Cambio 24h</div>
                <div style={{ color: monedaActual?.cambio >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '600' }}>{monedaActual?.cambio >= 0 ? '+' : ''}{monedaActual?.cambio}%</div>
              </div>
              <div>
                <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>Volumen 24h</div>
                <div style={{ color: '#fff', fontWeight: '500', fontSize: '13px' }}>${monedaActual?.volumen?.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>
        </div>

        {/* Derecha */}
        <div style={{ background: '#161a1e', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

          <div style={{ padding: '16px', borderBottom: '1px solid #2b2f36', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>⚡ Señal IA</span>
            <button
              onClick={() => analizarMoneda(monedaSeleccionada)}
              disabled={cargando === monedaSeleccionada}
              style={{ background: cargando === monedaSeleccionada ? '#2b2f36' : 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', boxShadow: cargando === monedaSeleccionada ? 'none' : '0 0 12px #A855F744' }}
            >
              {cargando === monedaSeleccionada ? '⏳ Analizando...' : `Analizar ${monedaSeleccionada}`}
            </button>
          </div>

          {/* Formulario Binance Spot */}
          <div style={{ padding: '16px', borderBottom: '1px solid #2b2f36' }}>
            <div style={{ color: '#A855F7', fontSize: '11px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>📋 Campos para Binance Spot</div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <div style={{ flex: 1, background: '#0ecb8122', border: '1px solid #0ecb81', borderRadius: '6px', padding: '8px', textAlign: 'center', color: '#0ecb81', fontWeight: '600', fontSize: '13px' }}>Comprar</div>
              <div style={{ flex: 1, background: '#2b2f36', border: '1px solid #2b2f36', borderRadius: '6px', padding: '8px', textAlign: 'center', color: '#848e9c', fontSize: '13px' }}>Vender</div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>Precio (USDT)</div>
              <div style={{ background: '#0b0e11', border: `1px solid ${sig ? '#3b82f6' : '#2b2f36'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: sig ? '#3b82f6' : '#848e9c', fontWeight: '600', fontSize: '15px' }}>
                  {sig ? sig.precio_entrada?.toLocaleString() : '— Analiza primero'}
                </span>
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>Monto ({monedaSeleccionada})</div>
              <div style={{ background: '#0b0e11', border: '1px solid #2b2f36', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder="Cuánto USDT quieres invertir"
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', flex: 1 }}
                />
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
              {monto && sig?.precio_entrada && (
                <div style={{ color: '#848e9c', fontSize: '11px', marginTop: '4px' }}>
                  = <span style={{ color: '#3b82f6', fontWeight: '600' }}>{(parseFloat(monto) / sig.precio_entrada).toFixed(6)}</span> {monedaSeleccionada}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>✅ Take Profit (TP)</div>
              <div style={{ background: '#0d2e1f', border: `1px solid ${sig ? '#0ecb8166' : '#2b2f36'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: sig ? '#0ecb81' : '#848e9c', fontWeight: '600', fontSize: '15px' }}>
                  {sig ? sig.take_profit?.toLocaleString() : '—'}
                </span>
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
              <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '3px' }}>Vende aquí para asegurar ganancias</div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>🛑 Stop Loss (SL)</div>
              <div style={{ background: '#2d0f0f', border: `1px solid ${sig ? '#f6465d66' : '#2b2f36'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: sig ? '#f6465d' : '#848e9c', fontWeight: '600', fontSize: '15px' }}>
                  {sig ? sig.stop_loss?.toLocaleString() : '—'}
                </span>
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
              <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '3px' }}>Sal aquí para no perder más</div>
            </div>

            <button style={{ width: '100%', background: 'linear-gradient(135deg, #0ecb81, #0aa866)', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              Comprar {monedaSeleccionada}
            </button>
          </div>

          {/* Señal IA */}
          {sig && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: sig.operacion === 'LONG' ? '#0d2e1f' : '#2d0f0f', border: `1px solid ${sig.operacion === 'LONG' ? '#0ecb81' : '#f6465d'}`, borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: sig.operacion === 'LONG' ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '16px' }}>{sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}</div>
                  <div style={{ color: '#848e9c', fontSize: '11px' }}>{sig.temporalidad} · Apalancamiento {sig.apalancamiento}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>Confianza</div>
                  <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700', fontSize: '18px' }}>{sig.confianza}%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '10px', border: '1px solid #2b2f36' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '2px' }}>RSI REAL</div>
                  <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#fff', fontWeight: '700', fontSize: '16px' }}>{sig.rsi}</div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>{sig.rsi < 30 ? 'Sobreventa' : sig.rsi > 70 ? 'Sobrecompra' : 'Neutral'}</div>
                </div>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '10px', border: '1px solid #2b2f36' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '2px' }}>MACD</div>
                  <div style={{ color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '16px' }}>{sig.macd?.toUpperCase()}</div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>{sig.macd === 'alcista' ? 'Tendencia arriba' : 'Tendencia abajo'}</div>
                </div>
              </div>

              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #A855F7' }}>
                <div style={{ color: '#A855F7', fontSize: '10px', marginBottom: '4px', fontWeight: '600' }}>⚡ ANÁLISIS IA — JACJ Signals</div>
                <p style={{ color: '#b7bdc6', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>{sig.razon}</p>
              </div>

              <div style={{ background: '#1a1600', borderRadius: '8px', padding: '8px', fontSize: '10px', color: '#f0b90b', textAlign: 'center' }}>
                ⚠️ Análisis educativo. No es asesoría financiera.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}