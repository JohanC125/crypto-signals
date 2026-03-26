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
  const [operacionesAbiertas, setOperacionesAbiertas] = useState([]);
  const alertaId = useRef(0);
  const alertasEnviadas = useRef({});

  const agregarAlerta = (mensaje, tipo) => {
    const id = alertaId.current++;
    setAlertas(prev => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => setAlertas(prev => prev.filter(a => a.id !== id)), 10000);
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

      nuevosDatos.forEach(m => {
        operacionesAbiertas.forEach(op => {
          if (op.symbol !== m.simbolo) return;
          const key = `${op.id}`;
          if (op.tipo === 'LONG') {
            if (m.precio >= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
              alertasEnviadas.current[`${key}-tp`] = true;
              agregarAlerta(`✅ ¡CIERRA TU LONG DE ${m.simbolo} AHORA!\nPrecio actual: $${m.precio.toLocaleString()}\nTu TP era: $${op.take_profit.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'tp');
            }
            if (m.precio <= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
              alertasEnviadas.current[`${key}-sl`] = true;
              agregarAlerta(`🛑 ¡SAL DE TU LONG DE ${m.simbolo} AHORA!\nPrecio actual: $${m.precio.toLocaleString()}\nTu SL era: $${op.stop_loss.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'sl');
            }
          } else {
            if (m.precio <= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
              alertasEnviadas.current[`${key}-tp`] = true;
              agregarAlerta(`✅ ¡CIERRA TU SHORT DE ${m.simbolo} AHORA!\nPrecio actual: $${m.precio.toLocaleString()}\nTu TP era: $${op.take_profit.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'tp');
            }
            if (m.precio >= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
              alertasEnviadas.current[`${key}-sl`] = true;
              agregarAlerta(`🛑 ¡CIERRA TU SHORT DE ${m.simbolo} AHORA!\nPrecio actual: $${m.precio.toLocaleString()}\nTu SL era: $${op.stop_loss.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'sl');
            }
          }
        });
      });
    } catch (e) { console.error(e); }
  };

  // Actualizar señal en tiempo real cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (monedaSeleccionada && senales[monedaSeleccionada]) {
        fetch(`/api/signals?symbol=${monedaSeleccionada}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.precio_entrada) {
              setSenales(prev => ({ ...prev, [monedaSeleccionada]: data }));
            }
          })
          .catch(e => console.error(e));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [monedaSeleccionada, senales]);

  useEffect(() => {
    fetchPrecios();
    const interval = setInterval(fetchPrecios, 5000);
    return () => clearInterval(interval);
  }, [operacionesAbiertas]);

  const analizarUna = async (simbolo) => {
    setCargando(true);
    try {
      const res = await fetch(`/api/signals?symbol=${simbolo}`);
      const data = await res.json();
      if (!data || !data.precio_entrada) return;
      setSenales(prev => ({ ...prev, [simbolo]: data }));
      agregarAlerta(
        `${data.operacion === 'LONG' ? '🟢' : '🔴'} SEÑAL ${data.operacion} ${simbolo}\nEntrada: $${data.precio_entrada.toLocaleString()} · TP: $${data.take_profit.toLocaleString()} · SL: $${data.stop_loss.toLocaleString()}\nApalancamiento: ${data.apalancamiento} · Confianza: ${data.confianza}%`,
        data.operacion === 'LONG' ? 'long' : 'short'
      );
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  const analizarTodas = async () => {
    setCargando(true);
    alertasEnviadas.current = {};
    for (const moneda of MONEDAS) {
      try {
        const res = await fetch(`/api/signals?symbol=${moneda.simbolo}`);
        const data = await res.json();
        if (!data || !data.precio_entrada) continue;
        setSenales(prev => ({ ...prev, [moneda.simbolo]: data }));
        agregarAlerta(
          `${data.operacion === 'LONG' ? '🟢' : '🔴'} ${data.operacion} ${moneda.simbolo} · $${data.precio_entrada.toLocaleString()} · TP $${data.take_profit.toLocaleString()} · SL $${data.stop_loss.toLocaleString()}`,
          data.operacion === 'LONG' ? 'long' : 'short'
        );
      } catch (e) { console.error(e); }
    }
    setCargando(false);
  };

  const registrarOperacion = () => {
    const sig = senales[monedaSeleccionada];
    if (!sig || !monto) return;
    const nueva = {
      id: Date.now(),
      symbol: monedaSeleccionada,
      tipo: sig.operacion,
      entrada: sig.precio_entrada,
      take_profit: sig.take_profit,
      stop_loss: sig.stop_loss,
      liquidacion: sig.precio_liquidacion,
      monto: parseFloat(monto),
      apalancamiento: sig.apalancamiento,
      tiempo: new Date().toLocaleTimeString(),
    };
    setOperacionesAbiertas(prev => [...prev, nueva]);
    agregarAlerta(`📝 Operación registrada: ${sig.operacion} ${monedaSeleccionada}\nTe avisaré cuando llegue al TP ($${sig.take_profit.toLocaleString()}) o SL ($${sig.stop_loss.toLocaleString()})`, 'info');
  };

  const cerrarOperacion = (id) => {
    const op = operacionesAbiertas.find(o => o.id === id);
    const precioActual = datos.find(d => d.simbolo === op?.symbol)?.precio || 0;
    if (op) {
      agregarAlerta(`🔒 CIERRE DE ${op.tipo} ${op.symbol}\nPrecio de cierre: $${precioActual.toLocaleString()}\nEn Binance: Ve a Posiciones → ${op.symbol}USDT → Cierra al mercado`, 'info');
    }
    setOperacionesAbiertas(prev => prev.filter(o => o.id !== id));
    delete alertasEnviadas.current[`${id}-tp`];
    delete alertasEnviadas.current[`${id}-sl`];
  };

  const sig = senales[monedaSeleccionada];
  const monedaActual = datos.find(m => m.simbolo === monedaSeleccionada);
  const colorOp = (op) => op === 'LONG' ? '#0ecb81' : '#f6465d';

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Alertas flotantes */}
      <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
        {alertas.map(a => (
          <div key={a.id} onClick={() => setAlertas(prev => prev.filter(al => al.id !== a.id))} style={{ background: a.tipo === 'tp' || a.tipo === 'long' ? '#0d2e1f' : a.tipo === 'sl' || a.tipo === 'short' ? '#2d0f0f' : '#1a1f2e', border: `1px solid ${a.tipo === 'tp' || a.tipo === 'long' ? '#0ecb81' : a.tipo === 'sl' || a.tipo === 'short' ? '#f6465d' : '#A855F7'}`, borderRadius: '10px', padding: '12px 16px', color: '#fff', fontSize: '12px', lineHeight: '1.6', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', cursor: 'pointer', whiteSpace: 'pre-line' }}>
            {a.mensaje}
            <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '4px' }}>Toca para cerrar</div>
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
            <div style={{ color: '#6D28D9', fontSize: '10px', letterSpacing: '1.5px' }}>by Johan Caro · Futuros</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={analizarTodas} disabled={cargando} style={{ background: cargando ? '#2b2f36' : 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
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
          const opAbierta = operacionesAbiertas.find(o => o.symbol === m.simbolo);
          return (
            <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)} style={{ background: 'none', border: 'none', borderBottom: monedaSeleccionada === m.simbolo ? `2px solid ${m.color}` : '2px solid transparent', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#000' }}>{m.simbolo[0]}</div>
              <span style={{ color: monedaSeleccionada === m.simbolo ? '#fff' : '#848e9c', fontSize: '13px', fontWeight: '500' }}>{m.simbolo}/USDT</span>
              <span style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '12px' }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
              {s && <span style={{ background: colorOp(s.operacion) + '22', color: colorOp(s.operacion), padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{s.operacion}</span>}
              {opAbierta && <span style={{ background: '#f0b90b22', color: '#f0b90b', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>●</span>}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, overflow: 'hidden' }}>

        {/* Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #2b2f36' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #2b2f36', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: monedaActual?.color || '#fff' }}></div>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>{monedaSeleccionada}/USDT Perp</span>
                {sig && <span style={{ background: colorOp(sig.operacion) + '22', color: colorOp(sig.operacion), padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{sig.operacion}</span>}
              </div>
              <div style={{ color: '#fff', fontSize: '24px', fontWeight: '700' }}>${monedaActual?.precio?.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div>
                <div style={{ color: '#848e9c', fontSize: '10px' }}>Cambio 24h</div>
                <div style={{ color: monedaActual?.cambio >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '600', fontSize: '13px' }}>{monedaActual?.cambio >= 0 ? '+' : ''}{monedaActual?.cambio}%</div>
              </div>
              {sig && <>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>RSI</div>
                  <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#fff', fontWeight: '600', fontSize: '13px' }}>{sig.rsi}</div>
                </div>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>MACD</div>
                  <div style={{ color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', fontWeight: '600', fontSize: '13px' }}>{sig.macd?.toUpperCase()}</div>
                </div>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>Confianza</div>
                  <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '600', fontSize: '13px' }}>{sig.confianza}%</div>
                </div>
                <div>
                  <div style={{ color: '#848e9c', fontSize: '10px' }}>Liq. estimada</div>
                  <div style={{ color: '#f6465d', fontWeight: '600', fontSize: '13px' }}>${sig.precio_liquidacion?.toLocaleString()}</div>
                </div>
              </>}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>

          {/* Operaciones abiertas */}
          {operacionesAbiertas.length > 0 && (
            <div style={{ borderTop: '1px solid #2b2f36', padding: '12px 20px', maxHeight: '200px', overflow: 'auto' }}>
              <div style={{ color: '#f0b90b', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>📊 Operaciones abiertas — monitoreando en tiempo real</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {operacionesAbiertas.map(op => {
                  const precioActual = datos.find(d => d.simbolo === op.symbol)?.precio || 0;
                  const apalNum = parseInt(op.apalancamiento) || 10;
                  const pnl = op.tipo === 'LONG'
                    ? ((precioActual - op.entrada) / op.entrada * 100 * apalNum).toFixed(2)
                    : ((op.entrada - precioActual) / op.entrada * 100 * apalNum).toFixed(2);
                  const progreso = op.tipo === 'LONG'
                    ? Math.min(Math.max(((precioActual - op.entrada) / (op.take_profit - op.entrada)) * 100, 0), 100)
                    : Math.min(Math.max(((op.entrada - precioActual) / (op.entrada - op.take_profit)) * 100, 0), 100);
                  return (
                    <div key={op.id} style={{ background: '#0b0e11', borderRadius: '8px', padding: '10px 14px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8144' : '#f6465d44'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ color: colorOp(op.tipo), fontWeight: '700' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol}</span>
                          <span style={{ color: '#848e9c', fontSize: '11px' }}>Entrada: ${op.entrada.toLocaleString()}</span>
                          <span style={{ color: '#848e9c', fontSize: '11px' }}>Apal: {op.apalancamiento}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '14px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</span>
                          <button onClick={() => cerrarOperacion(op.id)} style={{ background: '#f6465d22', border: '1px solid #f6465d44', borderRadius: '6px', padding: '4px 10px', color: '#f6465d', fontSize: '11px', cursor: 'pointer' }}>Cerrar</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#f6465d', fontSize: '10px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                        <span style={{ color: '#fff', fontSize: '10px' }}>${precioActual.toLocaleString()}</span>
                        <span style={{ color: '#0ecb81', fontSize: '10px' }}>TP ${op.take_profit.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#2b2f36', borderRadius: '4px', height: '4px' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '4px', borderRadius: '4px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Derecha */}
        <div style={{ background: '#161a1e', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #2b2f36' }}>
            <div style={{ flex: 1, padding: '14px', textAlign: 'center', color: '#0ecb81', fontWeight: '700', fontSize: '14px', borderBottom: '2px solid #0ecb81' }}>🟢 LONG</div>
            <div style={{ flex: 1, padding: '14px', textAlign: 'center', color: '#848e9c', fontSize: '14px' }}>🔴 SHORT</div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <button onClick={() => analizarUna(monedaSeleccionada)} disabled={cargando} style={{ width: '100%', background: cargando ? '#2b2f36' : 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
              {cargando ? '⏳ Analizando...' : `⚡ Analizar ${monedaSeleccionada} con IA`}
            </button>

            {/* Señal */}
            {sig && (
              <div style={{ background: sig.operacion === 'LONG' ? '#0d2e1f' : '#2d0f0f', border: `1px solid ${colorOp(sig.operacion)}`, borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ color: colorOp(sig.operacion), fontWeight: '700', fontSize: '15px' }}>
                    {sig.operacion === 'LONG' ? '🟢 LONG' : '🔴 SHORT'} — {sig.temporalidad}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#848e9c', fontSize: '10px' }}>Confianza</div>
                    <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700', fontSize: '16px' }}>{sig.confianza}%</div>
                  </div>
                </div>
                <div style={{ color: '#b7bdc6', fontSize: '12px', lineHeight: '1.5', marginBottom: '8px' }}>{sig.razon}</div>
                <div style={{ background: '#0b0e11', borderRadius: '6px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#848e9c', fontSize: '10px' }}>Apalancamiento</div>
                    <div style={{ color: '#F3BA2F', fontWeight: '700', fontSize: '14px' }}>{sig.apalancamiento}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#848e9c', fontSize: '10px' }}>RSI</div>
                    <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#fff', fontWeight: '700', fontSize: '14px' }}>{sig.rsi}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#848e9c', fontSize: '10px' }}>MACD</div>
                    <div style={{ color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '14px' }}>{sig.macd?.toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#848e9c', fontSize: '10px' }}>Riesgo Liq.</div>
                    <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '700', fontSize: '14px' }}>{sig.riesgo_liquidacion}%</div>
                  </div>
                </div>
              </div>
            )}

            {/* Precio entrada */}
            <div>
              <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>📌 Precio de entrada</div>
              <div style={{ background: '#0b0e11', border: `1px solid ${sig ? '#3b82f6' : '#2b2f36'}`, borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: sig ? '#3b82f6' : '#848e9c', fontWeight: '700', fontSize: '20px' }}>
                  {sig ? sig.precio_entrada.toLocaleString() : '— Analiza primero'}
                </span>
                <span style={{ color: '#848e9c', fontSize: '13px' }}>USDT</span>
              </div>
              {sig && <div style={{ color: '#3b82f6', fontSize: '10px', marginTop: '3px' }}>↑ En Binance Futuros → Limit → campo Precio</div>}
            </div>

            {/* Monto */}
            <div>
              <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>💵 Tu margen (cuánto pones)</div>
              <div style={{ background: '#0b0e11', border: '1px solid #2b2f36', borderRadius: '8px', padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 10" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '16px', outline: 'none', flex: 1 }} />
                <span style={{ color: '#848e9c', fontSize: '13px' }}>USDT</span>
              </div>
              {monto && sig?.apalancamiento && (
                <div style={{ color: '#848e9c', fontSize: '11px', marginTop: '3px' }}>
                  Posición total con {sig.apalancamiento}: <span style={{ color: '#F3BA2F', fontWeight: '600' }}>${(parseFloat(monto) * parseInt(sig.apalancamiento)).toLocaleString()} USDT</span>
                </div>
              )}
            </div>

            {/* TP */}
            <div>
              <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>✅ Take Profit (TP)</div>
              <div style={{ background: '#0d2e1f', border: `1px solid ${sig ? '#0ecb8166' : '#2b2f36'}`, borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: sig ? '#0ecb81' : '#848e9c', fontWeight: '700', fontSize: '20px' }}>{sig ? sig.take_profit.toLocaleString() : '—'}</span>
                <span style={{ color: '#848e9c', fontSize: '13px' }}>USDT</span>
              </div>
              {sig && <div style={{ color: '#0ecb81', fontSize: '10px', marginTop: '3px' }}>En Binance: TP/SL → Take Profit → pon este precio</div>}
            </div>

            {/* SL */}
            <div>
              <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '6px' }}>🛑 Stop Loss (SL)</div>
              <div style={{ background: '#2d0f0f', border: `1px solid ${sig ? '#f6465d66' : '#2b2f36'}`, borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: sig ? '#f6465d' : '#848e9c', fontWeight: '700', fontSize: '20px' }}>{sig ? sig.stop_loss.toLocaleString() : '—'}</span>
                <span style={{ color: '#848e9c', fontSize: '13px' }}>USDT</span>
              </div>
              {sig && <div style={{ color: '#f6465d', fontSize: '10px', marginTop: '3px' }}>En Binance: TP/SL → Stop Loss → pon este precio</div>}
            </div>

            {/* Precio liquidación */}
            {sig && (
              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '12px 14px', border: '1px solid #f6465d22' }}>
                <div style={{ color: '#848e9c', fontSize: '12px', marginBottom: '4px' }}>☠️ Precio de liquidación estimado</div>
                <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '18px' }}>${sig.precio_liquidacion?.toLocaleString()}</div>
                <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '2px' }}>Si el precio llega aquí perderás todo tu margen</div>
              </div>
            )}

            {/* Guía paso a paso */}
            {sig && (
              <div style={{ background: '#0b0e11', borderRadius: '8px', padding: '14px', border: '1px solid #2b2f36' }}>
                <div style={{ color: '#A855F7', fontSize: '11px', fontWeight: '600', marginBottom: '10px' }}>📋 PASOS EN BINANCE FUTUROS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { paso: '1', texto: `Binance → Futuros → ${monedaSeleccionada}USDT Perpetuo`, color: '#3b82f6' },
                    { paso: '2', texto: `Apalancamiento recomendado: ${sig.apalancamiento}`, color: '#F3BA2F' },
                    { paso: '3', texto: `Clic en ${sig.operacion === 'LONG' ? 'COMPRAR/LONG' : 'VENDER/SHORT'} → Tipo: Limit`, color: colorOp(sig.operacion) },
                    { paso: '4', texto: `Precio: $${sig.precio_entrada.toLocaleString()} · Cantidad: ${monto || 'tu monto'} USDT`, color: '#3b82f6' },
                    { paso: '5', texto: `TP: $${sig.take_profit.toLocaleString()} · SL: $${sig.stop_loss.toLocaleString()}`, color: '#0ecb81' },
                    { paso: '6', texto: 'Registra aquí abajo y te aviso cuando cerrar', color: '#A855F7' },
                  ].map(item => (
                    <div key={item.paso} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: item.color + '22', border: `1px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: item.color, fontWeight: '700', flexShrink: 0 }}>{item.paso}</div>
                      <span style={{ color: '#b7bdc6', fontSize: '12px', lineHeight: '1.5' }}>{item.texto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón registrar */}
            {sig && monto && (
              <button onClick={registrarOperacion} style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #0ecb81, #0aa866)' : 'linear-gradient(135deg, #f6465d, #c73c4f)', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
                {sig.operacion === 'LONG' ? '🟢 Registrar LONG' : '🔴 Registrar SHORT'} — Monitorear en tiempo real
              </button>
            )}

            <div style={{ background: '#1a1600', borderRadius: '8px', padding: '8px', fontSize: '10px', color: '#f0b90b', textAlign: 'center' }}>
              ⚠️ Análisis educativo. No es asesoría financiera. Opera con precaución.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}