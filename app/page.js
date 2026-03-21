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
      <div style={{ background: '#161a1e', borderBottom: '1px solid #2b2f36', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: '#F3BA2F', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', color: '#000' }}>S</div>
          <span style={{ color: '#fff', fontWeight: '600', fontSize: '16px' }}>SignalAI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#848e9c', fontSize: '12px' }}>● EN VIVO · {ultimaActualizacion}</span>
        </div>
      </div>

      {/* Barra de monedas */}
      <div style={{ background: '#161a1e', borderBottom: '1px solid #2b2f36', padding: '0 20px', display: 'flex', gap: '4px', overflowX: 'auto' }}>
        {datos.map(m => (
          <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)} style={{ background: 'none', border: 'none', borderBottom: monedaSeleccionada === m.simbolo ? `2px solid ${m.color}` : '2px solid transparent', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#000' }}>{m.simbolo[0]}</div>
            <span style={{ color: monedaSeleccionada === m.simbolo ? '#fff' : '#848e9c', fontSize: '13px', fontWeight: '500' }}>{m.simbolo}/USDT</span>
            <span style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '12px' }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
          </button>
        ))}
      </div>

      {/* Contenido principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, gap: '0', overflow: 'hidden' }}>

        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #2b2f36', overflow: 'hidden' }}>

          {/* Info precio */}
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

          {/* Gráfico */}
          <div style={{ flex: 1, padding: '0' }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>
        </div>

        {/* Columna derecha — Señal IA */}
        <div style={{ background: '#161a1e', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #2b2f36', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>⚡ Señal IA</span>
            <button
              onClick={() => analizarMoneda(monedaSeleccionada)}
              disabled={cargando === monedaSeleccionada}
              style={{ background: cargando === monedaSeleccionada ? '#2b2f36' : '#F3BA2F', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}
            >
              {cargando === monedaSeleccionada ? '⏳ Analizando...' : `Analizar ${monedaSeleccionada}`}
            </button>
          </div>

          {sig ? (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Badge operación */}
              <div style={{ background: sig.operacion === 'LONG' ? '#0d2e1f' : '#2d0f0f', border: `1px solid ${sig.operacion === 'LONG' ? '#0ecb81' : '#f6465d'}`, borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: sig.operacion === 'LONG' ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '20px' }}>{sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}</div>
                  <div style={{ color: '#848e9c', fontSize: '12px', marginTop: '2px' }}>{sig.symbol}USDT · {sig.temporalidad}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#848e9c', fontSize: '11px' }}>Confianza</div>
                  <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700', fontSize: '22px' }}>{sig.confianza}%</div>
                </div>
              </div>

              {/* RSI y MACD */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '10px 12px', border: '1px solid #2b2f36' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '3px' }}>RSI REAL</div>
                  <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#fff', fontWeight: '700', fontSize: '18px' }}>{sig.rsi}</div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>{sig.rsi < 30 ? 'Sobreventa' : sig.rsi > 70 ? 'Sobrecompra' : 'Neutral'}</div>
                </div>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '10px 12px', border: '1px solid #2b2f36' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '3px' }}>MACD</div>
                  <div style={{ color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '18px' }}>{sig.macd?.toUpperCase()}</div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>{sig.macd === 'alcista' ? 'Tendencia arriba' : 'Tendencia abajo'}</div>
                </div>
              </div>

              {/* Precio entrada */}
              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '12px', border: '1px solid #1d4ed8' }}>
                <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '4px' }}>💰 PRECIO ENTRADA — Campo "Precio (USDT)" en Binance</div>
                <div style={{ color: '#3b82f6', fontWeight: '700', fontSize: '20px' }}>${sig.precio_entrada?.toLocaleString()}</div>
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#848e9c', fontSize: '12px' }}>Invertir $</span>
                  <input
                    type="number"
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                    placeholder="5"
                    style={{ background: '#161a1e', border: '1px solid #2b2f36', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '13px', width: '70px' }}
                  />
                  <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
                </div>
                {monto && sig.precio_entrada && (
                  <div style={{ marginTop: '6px', color: '#848e9c', fontSize: '12px' }}>
                    → Monto {sig.symbol}: <span style={{ color: '#3b82f6', fontWeight: '600' }}>{(parseFloat(monto) / sig.precio_entrada).toFixed(6)}</span>
                  </div>
                )}
              </div>

              {/* TP y SL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: '#0d2e1f', borderRadius: '8px', padding: '12px', border: '1px solid #0ecb8144' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '4px' }}>✅ TAKE PROFIT</div>
                  <div style={{ color: '#0ecb81', fontWeight: '700', fontSize: '18px' }}>${sig.take_profit?.toLocaleString()}</div>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '3px' }}>Campo TP en Binance</div>
                </div>
                <div style={{ background: '#2d0f0f', borderRadius: '8px', padding: '12px', border: '1px solid #f6465d44' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '4px' }}>🛑 STOP LOSS</div>
                  <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '18px' }}>${sig.stop_loss?.toLocaleString()}</div>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '3px' }}>Campo SL en Binance</div>
                </div>
              </div>

              {/* Riesgo liquidación */}
              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '12px', border: `1px solid ${sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b'}44` }}>
                <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '4px' }}>☠️ RIESGO LIQUIDACIÓN · Apalancamiento: {sig.apalancamiento}</div>
                <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '700', fontSize: '20px' }}>{sig.riesgo_liquidacion}%</div>
                <div style={{ marginTop: '6px', background: '#2b2f36', borderRadius: '4px', height: '4px' }}>
                  <div style={{ background: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', height: '4px', borderRadius: '4px', width: `${sig.riesgo_liquidacion}%` }}></div>
                </div>
              </div>

              {/* Análisis */}
              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #F3BA2F' }}>
                <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '6px' }}>⚡ ANÁLISIS IA</div>
                <p style={{ color: '#b7bdc6', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>{sig.razon}</p>
              </div>

              <div style={{ background: '#1a1600', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#f0b90b', textAlign: 'center' }}>
                ⚠️ Análisis educativo. No es asesoría financiera.
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '12px' }}>
              <div style={{ fontSize: '40px' }}>⚡</div>
              <div style={{ color: '#fff', fontWeight: '600', fontSize: '15px', textAlign: 'center' }}>Analiza {monedaSeleccionada} con IA</div>
              <div style={{ color: '#848e9c', fontSize: '13px', textAlign: 'center' }}>Obtén señal de entrada, TP, SL y análisis completo</div>
              <button
                onClick={() => analizarMoneda(monedaSeleccionada)}
                disabled={cargando === monedaSeleccionada}
                style={{ background: '#F3BA2F', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', marginTop: '8px' }}
              >
                {cargando === monedaSeleccionada ? '⏳ Analizando...' : `⚡ Analizar ${monedaSeleccionada}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}