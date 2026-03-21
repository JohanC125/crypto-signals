'use client';
import { useState, useEffect, useRef } from 'react';
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
  const [cargando, setCargando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('BTC');
  const [monto, setMonto] = useState('');
  const [alertas, setAlertas] = useState([]);
  const alertaId = useRef(0);
  const alertasEnviadas = useRef({});

  const agregarAlerta = (mensaje, tipo) => {
    const id = alertaId.current++;
    setAlertas(prev => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => setAlertas(prev => prev.filter(a => a.id !== id)), 8000);
  };

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

      // Monitor tiempo real de TP y SL
      nuevosDatos.forEach(m => {
        const sig = senales[m.simbolo];
        if (!sig) return;

        const key = `${m.simbolo}-${sig.operacion}`;

        if (sig.operacion === 'LONG') {
          if (m.precio >= sig.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
            alertasEnviadas.current[`${key}-tp`] = true;
            agregarAlerta(`✅ ¡VENDE ${m.simbolo} AHORA! Llegó al Take Profit $${sig.take_profit?.toLocaleString()} 🎉 ¡Asegura tus ganancias!`, 'comprar');
          }
          if (m.precio <= sig.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
            alertasEnviadas.current[`${key}-sl`] = true;
            agregarAlerta(`🛑 ¡SAL DE ${m.simbolo} AHORA! Llegó al Stop Loss $${sig.stop_loss?.toLocaleString()}. Evita más pérdidas.`, 'vender');
          }
        } else if (sig.operacion === 'SHORT') {
          if (m.precio <= sig.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
            alertasEnviadas.current[`${key}-tp`] = true;
            agregarAlerta(`✅ ¡CIERRA ${m.simbolo} AHORA! Llegó al Take Profit $${sig.take_profit?.toLocaleString()} 🎉`, 'comprar');
          }
          if (m.precio >= sig.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
            alertasEnviadas.current[`${key}-sl`] = true;
            agregarAlerta(`🛑 ¡CIERRA ${m.simbolo} AHORA! Stop Loss activado en $${sig.stop_loss?.toLocaleString()}.`, 'vender');
          }
        }
      });

    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchPrecios();
    const interval = setInterval(fetchPrecios, 5000);
    return () => clearInterval(interval);
  }, [senales]);

  const analizarTodas = async () => {
    setCargando(true);
    alertasEnviadas.current = {};
    agregarAlerta('⏳ Analizando todas las monedas con IA...', 'info');

    for (const moneda of MONEDAS) {
      try {
        const res = await fetch(`/api/signals?symbol=${moneda.simbolo}`);
        const data = await res.json();
        setSenales(prev => ({ ...prev, [moneda.simbolo]: data }));
        if (data.operacion === 'LONG') {
          agregarAlerta(`🟢 COMPRA ${moneda.simbolo} a $${data.precio_entrada?.toLocaleString()} · TP: $${data.take_profit?.toLocaleString()} · SL: $${data.stop_loss?.toLocaleString()} · Confianza: ${data.confianza}%`, 'comprar');
        } else {
          agregarAlerta(`🔴 SHORT ${moneda.simbolo} a $${data.precio_entrada?.toLocaleString()} · TP: $${data.take_profit?.toLocaleString()} · SL: $${data.stop_loss?.toLocaleString()} · Confianza: ${data.confianza}%`, 'vender');
        }
      } catch (e) { console.error(e); }
    }

    setCargando(false);
    agregarAlerta('✅ Análisis completo. Monitoreando TP y SL en tiempo real...', 'info');
  };

  const analizarUna = async (simbolo) => {
    alertasEnviadas.current[simbolo] = false;
    try {
      const res = await fetch(`/api/signals?symbol=${simbolo}`);
      const data = await res.json();
      setSenales(prev => ({ ...prev, [simbolo]: data }));
      if (data.operacion === 'LONG') {
        agregarAlerta(`🟢 COMPRA ${simbolo} a $${data.precio_entrada?.toLocaleString()} · TP: $${data.take_profit?.toLocaleString()} · SL: $${data.stop_loss?.toLocaleString()}`, 'comprar');
      } else {
        agregarAlerta(`🔴 SHORT ${simbolo} a $${data.precio_entrada?.toLocaleString()} · TP: $${data.take_profit?.toLocaleString()} · SL: $${data.stop_loss?.toLocaleString()}`, 'vender');
      }
    } catch (e) { console.error(e); }
  };

  const sig = senales[monedaSeleccionada];
  const monedaActual = datos.find(m => m.simbolo === monedaSeleccionada);

  const colorOp = (op) => op === 'LONG' ? '#0ecb81' : '#f6465d';

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Alertas flotantes */}
      <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '380px' }}>
        {alertas.map(a => (
          <div key={a.id} style={{
            background: a.tipo === 'comprar' ? '#0d2e1f' : a.tipo === 'vender' ? '#2d0f0f' : '#1a1f2e',
            border: `1px solid ${a.tipo === 'comprar' ? '#0ecb81' : a.tipo === 'vender' ? '#f6465d' : '#A855F7'}`,
            borderRadius: '10px', padding: '12px 16px', color: '#fff', fontSize: '13px', lineHeight: '1.5',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}>
            {a.mensaje}
          </div>
        ))}
      </div>

      {/* Navbar */}
      <div style={{ background: '#161a1e', borderBottom: '1px solid #2b2f36', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '42px', height: '42px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6D28D9 0%, #A855F7 50%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px #A855F766' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: '16px', color: '#fff', letterSpacing: '-1px' }}>JC</span>
            </div>
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', background: '#0ecb81', borderRadius: '50%', border: '2px solid #161a1e' }}></div>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>JACJ <span style={{ color: '#A855F7' }}>Signals</span></div>
            <div style={{ color: '#6D28D9', fontSize: '10px', letterSpacing: '1.5px' }}>by Johan Caro</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={analizarTodas} disabled={cargando} style={{ background: cargando ? '#2b2f36' : 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', boxShadow: '0 0 12px #A855F744' }}>
            {cargando ? '⏳ Analizando...' : '⚡ Analizar Todo'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', background: '#0ecb81', borderRadius: '50%' }}></div>
            <span style={{ color: '#848e9c', fontSize: '12px' }}>EN VIVO · {ultimaActualizacion}</span>
          </div>
        </div>
      </div>

      {/* Barra monedas */}
      <div style={{ background: '#161a1e', borderBottom: '1px solid #2b2f36', padding: '0 20px', display: 'flex', gap: '4px', overflowX: 'auto' }}>
        {datos.map(m => {
          const s = senales[m.simbolo];
          return (
            <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)} style={{ background: 'none', border: 'none', borderBottom: monedaSeleccionada === m.simbolo ? `2px solid ${m.color}` : '2px solid transparent', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#000' }}>{m.simbolo[0]}</div>
              <span style={{ color: monedaSeleccionada === m.simbolo ? '#fff' : '#848e9c', fontSize: '13px', fontWeight: '500' }}>{m.simbolo}/USDT</span>
              <span style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '12px' }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
              {s && <span style={{ background: colorOp(s.operacion) + '22', color: colorOp(s.operacion), padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{s.operacion}</span>}
            </button>
          );
        })}
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
                {sig && <span style={{ background: colorOp(sig.operacion) + '22', color: colorOp(sig.operacion), padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>{sig.operacion}</span>}
              </div>
              <div style={{ color: '#fff', fontSize: '28px', fontWeight: '700' }}>${monedaActual?.precio?.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>Cambio 24h</div>
                <div style={{ color: monedaActual?.cambio >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '600' }}>{monedaActual?.cambio >= 0 ? '+' : ''}{monedaActual?.cambio}%</div>
              </div>
              <div>
                <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>Volumen 24h</div>
                <div style={{ color: '#fff', fontWeight: '500', fontSize: '13px' }}>${monedaActual?.volumen?.toLocaleString()}</div>
              </div>
              {sig && <>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>RSI Real</div>
                  <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#fff', fontWeight: '600' }}>{sig.rsi}</div>
                </div>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>Confianza</div>
                  <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '600' }}>{sig.confianza}%</div>
                </div>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '2px' }}>Riesgo Liq.</div>
                  <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '600' }}>{sig.riesgo_liquidacion}%</div>
                </div>
              </>}
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
            <button onClick={() => analizarUna(monedaSeleccionada)} style={{ background: 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
              Analizar {monedaSeleccionada}
            </button>
          </div>

          <div style={{ padding: '16px', borderBottom: '1px solid #2b2f36' }}>
            <div style={{ color: '#A855F7', fontSize: '11px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>📋 Campos para Binance Spot</div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <div style={{ flex: 1, background: '#0ecb8122', border: '1px solid #0ecb81', borderRadius: '6px', padding: '8px', textAlign: 'center', color: '#0ecb81', fontWeight: '600', fontSize: '13px' }}>Comprar</div>
              <div style={{ flex: 1, background: '#2b2f36', border: '1px solid #2b2f36', borderRadius: '6px', padding: '8px', textAlign: 'center', color: '#848e9c', fontSize: '13px' }}>Vender</div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>Precio (USDT)</div>
              <div style={{ background: '#0b0e11', border: `1px solid ${sig ? '#3b82f6' : '#2b2f36'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: sig ? '#3b82f6' : '#848e9c', fontWeight: '600', fontSize: '15px' }}>
                  {sig ? sig.precio_entrada?.toLocaleString() : '— Analiza primero'}
                </span>
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>Monto ({monedaSeleccionada})</div>
              <div style={{ background: '#0b0e11', border: '1px solid #2b2f36', borderRadius: '6px', padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 5" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', flex: 1 }} />
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
              {monto && sig?.precio_entrada && (
                <div style={{ color: '#848e9c', fontSize: '11px', marginTop: '4px' }}>
                  = <span style={{ color: '#3b82f6', fontWeight: '600' }}>{(parseFloat(monto) / sig.precio_entrada).toFixed(6)}</span> {monedaSeleccionada}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>✅ Take Profit (TP) — Vende aquí para ganar</div>
              <div style={{ background: '#0d2e1f', border: `1px solid ${sig ? '#0ecb8166' : '#2b2f36'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: sig ? '#0ecb81' : '#848e9c', fontWeight: '600', fontSize: '15px' }}>{sig ? sig.take_profit?.toLocaleString() : '—'}</span>
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#848e9c', fontSize: '11px', marginBottom: '4px' }}>🛑 Stop Loss (SL) — Sal aquí para no perder más</div>
              <div style={{ background: '#2d0f0f', border: `1px solid ${sig ? '#f6465d66' : '#2b2f36'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: sig ? '#f6465d' : '#848e9c', fontWeight: '600', fontSize: '15px' }}>{sig ? sig.stop_loss?.toLocaleString() : '—'}</span>
                <span style={{ color: '#848e9c', fontSize: '12px' }}>USDT</span>
              </div>
            </div>

            {sig && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '8px', border: '1px solid #2b2f36', textAlign: 'center' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '2px' }}>RSI</div>
                  <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#fff', fontWeight: '700', fontSize: '14px' }}>{sig.rsi}</div>
                </div>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '8px', border: '1px solid #2b2f36', textAlign: 'center' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '2px' }}>Confianza</div>
                  <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700', fontSize: '14px' }}>{sig.confianza}%</div>
                </div>
                <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '8px', border: '1px solid #2b2f36', textAlign: 'center' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '2px' }}>Riesgo Liq.</div>
                  <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '700', fontSize: '14px' }}>{sig.riesgo_liquidacion}%</div>
                </div>
              </div>
            )}

            <button style={{ width: '100%', background: 'linear-gradient(135deg, #0ecb81, #0aa866)', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              Comprar {monedaSeleccionada}
            </button>
          </div>

          {sig && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: sig.operacion === 'LONG' ? '#0d2e1f' : '#2d0f0f', border: `1px solid ${colorOp(sig.operacion)}`, borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: colorOp(sig.operacion), fontWeight: '700', fontSize: '16px' }}>{sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}</div>
                  <div style={{ color: '#848e9c', fontSize: '11px' }}>{sig.temporalidad} · Apalancamiento {sig.apalancamiento}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>MACD</div>
                  <div style={{ color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '14px' }}>{sig.macd?.toUpperCase()}</div>
                </div>
              </div>

              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #A855F7' }}>
                <div style={{ color: '#A855F7', fontSize: '10px', marginBottom: '4px', fontWeight: '600' }}>⚡ ANÁLISIS IA — JACJ Signals</div>
                <p style={{ color: '#b7bdc6', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>{sig.razon}</p>
              </div>

              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '10px', border: '1px solid #2b2f36' }}>
                <div style={{ color: '#848e9c', fontSize: '10px', marginBottom: '6px' }}>📊 Progreso hacia TP/SL</div>
                {monedaActual && sig && (() => {
                  const precioActual = monedaActual.precio;
                  const entrada = sig.precio_entrada;
                  const tp = sig.take_profit;
                  const sl = sig.stop_loss;
                  const rango = Math.abs(tp - sl);
                  const progreso = sig.operacion === 'LONG'
                    ? ((precioActual - entrada) / (tp - entrada)) * 100
                    : ((entrada - precioActual) / (entrada - tp)) * 100;
                  const pct = Math.min(Math.max(progreso, 0), 100);
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#f6465d', fontSize: '11px' }}>SL ${sl?.toLocaleString()}</span>
                        <span style={{ color: '#fff', fontSize: '11px' }}>${precioActual?.toLocaleString()}</span>
                        <span style={{ color: '#0ecb81', fontSize: '11px' }}>TP ${tp?.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#2b2f36', borderRadius: '4px', height: '6px' }}>
                        <div style={{ background: pct > 50 ? '#0ecb81' : '#f0b90b', height: '6px', borderRadius: '4px', width: `${pct}%`, transition: 'width 0.5s' }}></div>
                      </div>
                      <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '4px', textAlign: 'center' }}>{pct.toFixed(1)}% hacia el objetivo</div>
                    </div>
                  );
                })()}
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