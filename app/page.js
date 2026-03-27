'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const Grafico = dynamic(() => import('./components/Grafico'), { ssr: false });

const MONEDAS = [
  { simbolo: 'BTC', nombre: 'Bitcoin', color: '#F7931A', icono: '₿' },
  { simbolo: 'ETH', nombre: 'Ethereum', color: '#627EEA', icono: 'Ξ' },
  { simbolo: 'SOL', nombre: 'Solana', color: '#9945FF', icono: '◎' },
  { simbolo: 'BNB', nombre: 'BNB', color: '#F3BA2F', icono: 'B' },
  { simbolo: 'XRP', nombre: 'Ripple', color: '#00AAE4', icono: 'X' },
];

export default function Home() {
  const [datos, setDatos] = useState([]);
  const [senales, setSenales] = useState({});
  const [cargando, setCargando] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('BTC');
  const [monto, setMonto] = useState('');
  const [alertas, setAlertas] = useState([]);
  const [operacionesAbiertas, setOperacionesAbiertas] = useState([]);
  const [tabDerecha, setTabDerecha] = useState('senal');
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
        high: parseFloat(parseFloat(d.highPrice).toFixed(2)),
        low: parseFloat(parseFloat(d.lowPrice).toFixed(2)),
      }));
      setDatos(nuevosDatos);
      setUltimaActualizacion(new Date().toLocaleTimeString());

      nuevosDatos.forEach(m => {
        operacionesAbiertas.forEach(op => {
          if (op.symbol !== m.simbolo) return;
          const key = op.id;
          if (op.tipo === 'LONG') {
            if (m.precio >= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
              alertasEnviadas.current[`${key}-tp`] = true;
              agregarAlerta(`✅ ¡CIERRA TU LONG DE ${m.simbolo}!\nPrecio: $${m.precio.toLocaleString()} alcanzó TP $${op.take_profit.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'tp');
            }
            if (m.precio <= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
              alertasEnviadas.current[`${key}-sl`] = true;
              agregarAlerta(`🛑 ¡SAL DE TU LONG DE ${m.simbolo}!\nPrecio: $${m.precio.toLocaleString()} tocó SL $${op.stop_loss.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'sl');
            }
          } else {
            if (m.precio <= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
              alertasEnviadas.current[`${key}-tp`] = true;
              agregarAlerta(`✅ ¡CIERRA TU SHORT DE ${m.simbolo}!\nPrecio: $${m.precio.toLocaleString()} alcanzó TP $${op.take_profit.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'tp');
            }
            if (m.precio >= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
              alertasEnviadas.current[`${key}-sl`] = true;
              agregarAlerta(`🛑 ¡CIERRA TU SHORT DE ${m.simbolo}!\nPrecio: $${m.precio.toLocaleString()} tocó SL $${op.stop_loss.toLocaleString()}\nEn Binance: Posiciones → Cierra al mercado`, 'sl');
            }
          }
        });
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchPrecios();
    const interval = setInterval(fetchPrecios, 5000);
    return () => clearInterval(interval);
  }, [operacionesAbiertas]);

  const analizarMoneda = async (simbolo) => {
    setCargando(simbolo);
    try {
      const res = await fetch(`/api/signals?symbol=${simbolo}`);
      const data = await res.json();
      if (!data?.precio_entrada) return;
      setSenales(prev => ({ ...prev, [simbolo]: data }));
      agregarAlerta(
        `${data.operacion === 'LONG' ? '🟢' : '🔴'} ${data.operacion} ${simbolo}\nEntrada: $${data.precio_entrada.toLocaleString()} · TP: $${data.take_profit.toLocaleString()} · SL: $${data.stop_loss.toLocaleString()}\nConfianza: ${data.confianza}% · Apal: ${data.apalancamiento}`,
        data.operacion === 'LONG' ? 'long' : 'short'
      );
    } catch (e) { console.error(e); }
    setCargando(null);
  };

  const analizarTodas = async () => {
    setCargando('todas');
    for (const m of MONEDAS) {
      try {
        const res = await fetch(`/api/signals?symbol=${m.simbolo}`);
        const data = await res.json();
        if (!data?.precio_entrada) continue;
        setSenales(prev => ({ ...prev, [m.simbolo]: data }));
        agregarAlerta(
          `${data.operacion === 'LONG' ? '🟢' : '🔴'} ${data.operacion} ${m.simbolo} · $${data.precio_entrada.toLocaleString()} · TP $${data.take_profit.toLocaleString()} · SL $${data.stop_loss.toLocaleString()}`,
          data.operacion === 'LONG' ? 'long' : 'short'
        );
      } catch (e) { console.error(e); }
    }
    setCargando(null);
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
      color: MONEDAS.find(m => m.simbolo === monedaSeleccionada)?.color,
    };
    setOperacionesAbiertas(prev => [...prev, nueva]);
    agregarAlerta(`📝 ${sig.operacion} ${monedaSeleccionada} registrado\nTe avisaré al TP ($${sig.take_profit.toLocaleString()}) y SL ($${sig.stop_loss.toLocaleString()})`, 'info');
    setTabDerecha('posiciones');
  };

  const cerrarOperacion = (id) => {
    const op = operacionesAbiertas.find(o => o.id === id);
    const precioActual = datos.find(d => d.simbolo === op?.symbol)?.precio || 0;
    if (op) {
      agregarAlerta(`🔒 CIERRE ${op.tipo} ${op.symbol}\nPrecio de cierre: $${precioActual.toLocaleString()}\nEn Binance → Posiciones → ${op.symbol}USDT → Cierra al mercado`, 'info');
    }
    setOperacionesAbiertas(prev => prev.filter(o => o.id !== id));
    delete alertasEnviadas.current[`${id}-tp`];
    delete alertasEnviadas.current[`${id}-sl`];
  };

  const sig = senales[monedaSeleccionada];
  const monedaActual = datos.find(m => m.simbolo === monedaSeleccionada);
  const colorOp = (op) => op === 'LONG' ? '#0ecb81' : '#f6465d';
  const bgOp = (op) => op === 'LONG' ? '#0d2e1f' : '#2d0f0f';

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Alertas */}
      <div style={{ position: 'fixed', top: '70px', right: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
        {alertas.map(a => (
          <div key={a.id} onClick={() => setAlertas(prev => prev.filter(al => al.id !== a.id))}
            style={{ background: a.tipo === 'tp' || a.tipo === 'long' ? '#0d2e1f' : a.tipo === 'sl' || a.tipo === 'short' ? '#2d0f0f' : '#1a1f2e', border: `1px solid ${a.tipo === 'tp' || a.tipo === 'long' ? '#0ecb81' : a.tipo === 'sl' || a.tipo === 'short' ? '#f6465d' : '#A855F7'}`, borderRadius: '12px', padding: '12px 14px', color: '#fff', fontSize: '12px', lineHeight: '1.6', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', cursor: 'pointer', whiteSpace: 'pre-line', backdropFilter: 'blur(10px)' }}>
            {a.mensaje}
            <div style={{ color: '#848e9c', fontSize: '10px', marginTop: '4px' }}>Toca para cerrar</div>
          </div>
        ))}
      </div>

      {/* Navbar */}
      <div style={{ background: '#0f1318', borderBottom: '1px solid #1e2329', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6D28D9, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px #A855F755' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: '14px', color: '#fff' }}>JC</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px', lineHeight: '1' }}>JACJ <span style={{ color: '#A855F7' }}>Signals</span></div>
            <div style={{ color: '#5a4d8a', fontSize: '9px', letterSpacing: '1.5px', lineHeight: '1.2' }}>FUTUROS · by Johan Caro</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {operacionesAbiertas.length > 0 && (
            <div style={{ background: '#f0b90b22', border: '1px solid #f0b90b44', borderRadius: '8px', padding: '4px 10px', color: '#f0b90b', fontSize: '12px', fontWeight: '600' }}>
              {operacionesAbiertas.length} posición{operacionesAbiertas.length > 1 ? 'es' : ''} abierta{operacionesAbiertas.length > 1 ? 's' : ''}
            </div>
          )}
          <button onClick={analizarTodas} disabled={cargando === 'todas'}
            style={{ background: cargando === 'todas' ? '#1e2329' : 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', boxShadow: cargando === 'todas' ? 'none' : '0 0 12px #A855F733' }}>
            {cargando === 'todas' ? '⏳ Analizando...' : '⚡ Analizar Todo'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', background: '#0ecb81', borderRadius: '50%', boxShadow: '0 0 6px #0ecb81' }}></div>
            <span style={{ color: '#5d6673', fontSize: '11px' }}>{ultimaActualizacion}</span>
          </div>
        </div>
      </div>

      {/* Barra monedas */}
      <div style={{ background: '#0f1318', borderBottom: '1px solid #1e2329', padding: '0 24px', display: 'flex', gap: '2px', overflowX: 'auto' }}>
        {datos.map(m => {
          const s = senales[m.simbolo];
          const opAbierta = operacionesAbiertas.find(o => o.symbol === m.simbolo);
          const seleccionada = monedaSeleccionada === m.simbolo;
          return (
            <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)}
              style={{ background: seleccionada ? '#1e2329' : 'none', border: 'none', borderBottom: seleccionada ? `2px solid ${m.color}` : '2px solid transparent', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', borderRadius: seleccionada ? '4px 4px 0 0' : '0', transition: 'all 0.2s' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: m.color + '33', border: `1px solid ${m.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: m.color }}>{m.icono}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ color: seleccionada ? '#fff' : '#848e9c', fontSize: '12px', fontWeight: '600', lineHeight: '1' }}>{m.simbolo}</span>
                <span style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '10px', lineHeight: '1.2' }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
              </div>
              {s && <span style={{ background: colorOp(s.operacion) + '22', color: colorOp(s.operacion), padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }}>{s.operacion}</span>}
              {opAbierta && <div style={{ width: '6px', height: '6px', background: '#f0b90b', borderRadius: '50%', boxShadow: '0 0 4px #f0b90b' }}></div>}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', flex: 1, minHeight: 0 }}>

        {/* Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2329', overflow: 'hidden' }}>

          {/* Info precio */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2329', background: '#0f1318', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: monedaActual?.color + '22', border: `1.5px solid ${monedaActual?.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: monedaActual?.color, fontWeight: '700' }}>{monedaActual?.icono}</div>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>{monedaSeleccionada}/USDT</span>
                <span style={{ color: '#5d6673', fontSize: '12px' }}>Perpetuo</span>
                {sig && <span style={{ background: colorOp(sig.operacion) + '22', color: colorOp(sig.operacion), padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', border: `1px solid ${colorOp(sig.operacion)}44` }}>{sig.operacion}</span>}
              </div>
              <div style={{ color: '#fff', fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px' }}>${monedaActual?.precio?.toLocaleString()}</div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '2px' }}>Cambio 24h</div>
                <div style={{ color: monedaActual?.cambio >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '600', fontSize: '14px' }}>{monedaActual?.cambio >= 0 ? '+' : ''}{monedaActual?.cambio}%</div>
              </div>
              <div>
                <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '2px' }}>Máx 24h</div>
                <div style={{ color: '#fff', fontWeight: '500', fontSize: '13px' }}>${monedaActual?.high?.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '2px' }}>Mín 24h</div>
                <div style={{ color: '#fff', fontWeight: '500', fontSize: '13px' }}>${monedaActual?.low?.toLocaleString()}</div>
              </div>
              {sig && <>
                <div>
                  <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '2px' }}>RSI</div>
                  <div style={{ color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#c0c6cf', fontWeight: '600', fontSize: '13px' }}>{sig.rsi}</div>
                </div>
                <div>
                  <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '2px' }}>MACD</div>
                  <div style={{ color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', fontWeight: '600', fontSize: '13px' }}>{sig.macd?.toUpperCase()}</div>
                </div>
                <div>
                  <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '2px' }}>Confianza</div>
                  <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '600', fontSize: '13px' }}>{sig.confianza}%</div>
                </div>
              </>}
            </div>
          </div>

          {/* Gráfico */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>

          {/* Posiciones abiertas */}
          {operacionesAbiertas.length > 0 && (
            <div style={{ borderTop: '1px solid #1e2329', background: '#0f1318', padding: '10px 20px', maxHeight: '180px', overflow: 'auto' }}>
              <div style={{ color: '#f0b90b', fontSize: '11px', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>📊 POSICIONES ABIERTAS — MONITOREANDO EN TIEMPO REAL</div>
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
                    <div key={op.id} style={{ background: '#161b22', borderRadius: '8px', padding: '10px 12px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8133' : '#f6465d33'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '12px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol}</span>
                          <span style={{ color: '#5d6673', fontSize: '11px' }}>Entrada: ${op.entrada.toLocaleString()}</span>
                          <span style={{ color: '#5d6673', fontSize: '11px' }}>Apal: {op.apalancamiento}</span>
                          <span style={{ color: '#5d6673', fontSize: '11px' }}>{op.tiempo}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '14px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</span>
                          <button onClick={() => cerrarOperacion(op.id)} style={{ background: 'none', border: '1px solid #f6465d44', borderRadius: '5px', padding: '3px 8px', color: '#f6465d', fontSize: '10px', cursor: 'pointer' }}>Cerrar</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: '#f6465d', fontSize: '10px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                        <span style={{ color: '#c0c6cf', fontSize: '10px' }}>${precioActual.toLocaleString()}</span>
                        <span style={{ color: '#0ecb81', fontSize: '10px' }}>TP ${op.take_profit.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#0b0e11', borderRadius: '3px', height: '4px' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '4px', borderRadius: '3px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Derecha */}
        <div style={{ background: '#0f1318', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e2329', background: '#0b0e11' }}>
            {[
              { id: 'senal', label: '⚡ Señal IA' },
              { id: 'operar', label: '📋 Operar' },
              { id: 'posiciones', label: `📊 Posiciones${operacionesAbiertas.length > 0 ? ` (${operacionesAbiertas.length})` : ''}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setTabDerecha(tab.id)}
                style={{ flex: 1, padding: '12px 6px', background: 'none', border: 'none', borderBottom: tabDerecha === tab.id ? '2px solid #A855F7' : '2px solid transparent', color: tabDerecha === tab.id ? '#A855F7' : '#5d6673', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

            {/* TAB: SEÑAL IA */}
            {tabDerecha === 'senal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={() => analizarMoneda(monedaSeleccionada)} disabled={cargando === monedaSeleccionada}
                  style={{ width: '100%', background: cargando === monedaSeleccionada ? '#1e2329' : 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', boxShadow: '0 4px 12px #6D28D933' }}>
                  {cargando === monedaSeleccionada ? '⏳ Analizando...' : `⚡ Analizar ${monedaSeleccionada} con IA`}
                </button>

                {sig ? (
                  <>
                    {/* Badge operación */}
                    <div style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}44`, borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ color: colorOp(sig.operacion), fontWeight: '800', fontSize: '18px' }}>
                          {sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#5d6673', fontSize: '10px' }}>Confianza IA</div>
                          <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '800', fontSize: '22px' }}>{sig.confianza}%</div>
                        </div>
                      </div>
                      <div style={{ color: '#8b9098', fontSize: '12px', lineHeight: '1.5', borderTop: `1px solid ${colorOp(sig.operacion)}22`, paddingTop: '8px' }}>{sig.razon}</div>
                    </div>

                    {/* Indicadores */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { label: 'RSI', valor: sig.rsi, color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#c0c6cf', sub: sig.rsi < 30 ? 'Sobreventa' : sig.rsi > 70 ? 'Sobrecompra' : 'Neutral' },
                        { label: 'MACD', valor: sig.macd?.toUpperCase(), color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d', sub: sig.macd === 'alcista' ? 'Sube' : 'Baja' },
                        { label: 'Apal.', valor: sig.apalancamiento, color: '#F3BA2F', sub: 'Sugerido' },
                        { label: 'Riesgo', valor: `${sig.riesgo_liquidacion}%`, color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', sub: sig.riesgo_liquidacion > 50 ? 'Alto' : 'Medio' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#161b22', borderRadius: '8px', padding: '10px', border: '1px solid #1e2329', textAlign: 'center' }}>
                          <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                          <div style={{ color: item.color, fontWeight: '700', fontSize: '14px' }}>{item.valor}</div>
                          <div style={{ color: '#5d6673', fontSize: '9px', marginTop: '2px' }}>{item.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Precios clave */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#161b22', borderRadius: '8px', padding: '10px 12px', border: '1px solid #2d6af633', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#5d6673', fontSize: '10px' }}>📌 Precio de entrada</div>
                          <div style={{ color: '#3b82f6', fontWeight: '700', fontSize: '18px' }}>${sig.precio_entrada.toLocaleString()}</div>
                        </div>
                        <div style={{ color: '#5d6673', fontSize: '11px', textAlign: 'right' }}>Límite en<br/>Binance Futuros</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#0d2e1f', borderRadius: '8px', padding: '10px 12px', border: '1px solid #0ecb8133' }}>
                          <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '3px' }}>✅ Take Profit</div>
                          <div style={{ color: '#0ecb81', fontWeight: '700', fontSize: '16px' }}>${sig.take_profit.toLocaleString()}</div>
                          <div style={{ color: '#5d6673', fontSize: '9px', marginTop: '2px' }}>TP en Binance</div>
                        </div>
                        <div style={{ background: '#2d0f0f', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f6465d33' }}>
                          <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '3px' }}>🛑 Stop Loss</div>
                          <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '16px' }}>${sig.stop_loss.toLocaleString()}</div>
                          <div style={{ color: '#5d6673', fontSize: '9px', marginTop: '2px' }}>SL en Binance</div>
                        </div>
                      </div>
                      <div style={{ background: '#161b22', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f6465d22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#5d6673', fontSize: '10px' }}>☠️ Precio de liquidación</div>
                          <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '16px' }}>${sig.precio_liquidacion?.toLocaleString()}</div>
                        </div>
                        <div style={{ color: '#5d6673', fontSize: '10px', textAlign: 'right' }}>No cruces<br/>este nivel</div>
                      </div>
                    </div>

                    <button onClick={() => setTabDerecha('operar')}
                      style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #0ecb81, #0aa866)' : 'linear-gradient(135deg, #f6465d, #c73c4f)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                      {sig.operacion === 'LONG' ? '🟢 Ir a operar LONG →' : '🔴 Ir a operar SHORT →'}
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
                    <div style={{ color: '#c0c6cf', fontWeight: '600', fontSize: '14px', marginBottom: '6px' }}>Sin señal aún</div>
                    <div style={{ color: '#5d6673', fontSize: '12px' }}>Presiona "Analizar" para obtener la señal de trading</div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: OPERAR */}
            {tabDerecha === 'operar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sig ? (
                  <>
                    <div style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}44`, borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: colorOp(sig.operacion), fontWeight: '700' }}>{sig.operacion === 'LONG' ? '🟢 LONG' : '🔴 SHORT'} — {monedaSeleccionada}</span>
                      <span style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700' }}>{sig.confianza}% confianza</span>
                    </div>

                    {/* Guía paso a paso */}
                    <div style={{ background: '#161b22', borderRadius: '10px', padding: '14px', border: '1px solid #1e2329' }}>
                      <div style={{ color: '#A855F7', fontSize: '11px', fontWeight: '700', marginBottom: '12px', letterSpacing: '0.5px' }}>📋 PASOS EN BINANCE FUTUROS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                          { n: '1', texto: `Binance → Futuros → busca ${monedaSeleccionada}USDT Perpetuo`, color: '#3b82f6' },
                          { n: '2', texto: `Ajusta apalancamiento a ${sig.apalancamiento}`, color: '#F3BA2F' },
                          { n: '3', texto: `Selecciona ${sig.operacion === 'LONG' ? 'COMPRAR / LONG' : 'VENDER / SHORT'} → Tipo: Limit`, color: colorOp(sig.operacion) },
                          { n: '4', texto: `Precio: $${sig.precio_entrada.toLocaleString()} · Cantidad: el monto que pongas abajo`, color: '#3b82f6' },
                          { n: '5', texto: `Activa TP: $${sig.take_profit.toLocaleString()} y SL: $${sig.stop_loss.toLocaleString()}`, color: '#0ecb81' },
                          { n: '6', texto: 'Confirma y registra aquí abajo para monitorear', color: '#A855F7' },
                        ].map(item => (
                          <div key={item.n} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: item.color + '22', border: `1px solid ${item.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: item.color, fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>{item.n}</div>
                            <span style={{ color: '#8b9098', fontSize: '12px', lineHeight: '1.5' }}>{item.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Monto */}
                    <div>
                      <div style={{ color: '#5d6673', fontSize: '11px', marginBottom: '6px' }}>💵 Tu margen (cuánto pones tú en USDT)</div>
                      <div style={{ background: '#161b22', border: '1px solid #1e2329', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 10" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '16px', outline: 'none', flex: 1 }} />
                        <span style={{ color: '#5d6673', fontSize: '13px' }}>USDT</span>
                      </div>
                      {monto && sig?.apalancamiento && (
                        <div style={{ color: '#5d6673', fontSize: '11px', marginTop: '4px' }}>
                          Posición total con {sig.apalancamiento}: <span style={{ color: '#F3BA2F', fontWeight: '700' }}>${(parseFloat(monto) * parseInt(sig.apalancamiento)).toLocaleString()} USDT</span>
                        </div>
                      )}
                    </div>

                    {monto && (
                      <button onClick={registrarOperacion}
                        style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #0ecb81, #0aa866)' : 'linear-gradient(135deg, #f6465d, #c73c4f)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: `0 4px 16px ${colorOp(sig.operacion)}44` }}>
                        {sig.operacion === 'LONG' ? '🟢 Registrar LONG' : '🔴 Registrar SHORT'} — Te aviso en TP/SL
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                    <div style={{ color: '#c0c6cf', fontWeight: '600', marginBottom: '6px' }}>Primero analiza la moneda</div>
                    <button onClick={() => setTabDerecha('senal')} style={{ background: 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
                      Ir a Señal IA →
                    </button>
                  </div>
                )}

                <div style={{ background: '#1a1600', borderRadius: '8px', padding: '8px 12px', fontSize: '10px', color: '#856404', textAlign: 'center', border: '1px solid #f0b90b22' }}>
                  ⚠️ Análisis educativo. No es asesoría financiera. Opera con precaución.
                </div>
              </div>
            )}

            {/* TAB: POSICIONES */}
            {tabDerecha === 'posiciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {operacionesAbiertas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
                    <div style={{ color: '#c0c6cf', fontWeight: '600', marginBottom: '6px' }}>Sin posiciones abiertas</div>
                    <div style={{ color: '#5d6673', fontSize: '12px' }}>Analiza una moneda y registra tu operación</div>
                  </div>
                ) : (
                  operacionesAbiertas.map(op => {
                    const precioActual = datos.find(d => d.simbolo === op.symbol)?.precio || 0;
                    const apalNum = parseInt(op.apalancamiento) || 10;
                    const pnl = op.tipo === 'LONG'
                      ? ((precioActual - op.entrada) / op.entrada * 100 * apalNum).toFixed(2)
                      : ((op.entrada - precioActual) / op.entrada * 100 * apalNum).toFixed(2);
                    const pnlUsdt = ((parseFloat(pnl) / 100) * op.monto).toFixed(2);
                    const progreso = op.tipo === 'LONG'
                      ? Math.min(Math.max(((precioActual - op.entrada) / (op.take_profit - op.entrada)) * 100, 0), 100)
                      : Math.min(Math.max(((op.entrada - precioActual) / (op.entrada - op.take_profit)) * 100, 0), 100);
                    return (
                      <div key={op.id} style={{ background: '#161b22', borderRadius: '10px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8133' : '#f6465d33'}`, overflow: 'hidden' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0d2e1f' : '#2d0f0f', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '14px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo}</span>
                            <span style={{ color: '#c0c6cf', fontSize: '14px', fontWeight: '600' }}>{op.symbol}/USDT</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '800', fontSize: '18px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</div>
                            <div style={{ color: parseFloat(pnlUsdt) >= 0 ? '#0ecb81' : '#f6465d', fontSize: '11px' }}>{parseFloat(pnlUsdt) >= 0 ? '+' : ''}${pnlUsdt} USDT</div>
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            {[
                              { label: 'Entrada', valor: `$${op.entrada.toLocaleString()}`, color: '#3b82f6' },
                              { label: 'Apal.', valor: op.apalancamiento, color: '#F3BA2F' },
                              { label: 'Margen', valor: `$${op.monto}`, color: '#c0c6cf' },
                            ].map(item => (
                              <div key={item.label} style={{ background: '#0b0e11', borderRadius: '6px', padding: '6px 8px', textAlign: 'center' }}>
                                <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '2px' }}>{item.label}</div>
                                <div style={{ color: item.color, fontWeight: '600', fontSize: '12px' }}>{item.valor}</div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#f6465d', fontSize: '11px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                            <span style={{ color: '#c0c6cf', fontSize: '11px', fontWeight: '600' }}>Actual ${precioActual.toLocaleString()}</span>
                            <span style={{ color: '#0ecb81', fontSize: '11px' }}>TP ${op.take_profit.toLocaleString()}</span>
                          </div>
                          <div style={{ background: '#0b0e11', borderRadius: '4px', height: '6px' }}>
                            <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '6px', borderRadius: '4px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
                          </div>
                          <div style={{ color: '#5d6673', fontSize: '10px', textAlign: 'center' }}>{progreso.toFixed(1)}% hacia el objetivo · Desde {op.tiempo}</div>

                          <button onClick={() => cerrarOperacion(op.id)}
                            style={{ width: '100%', background: 'none', border: '1px solid #f6465d44', borderRadius: '7px', padding: '8px', color: '#f6465d', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                            🔒 Cerrar posición — Ver instrucciones
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}