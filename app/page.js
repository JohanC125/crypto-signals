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
  const [analizando, setAnalizando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('BTC');
  const [monto, setMonto] = useState('');
  const [alertas, setAlertas] = useState([]);
  const [operacionesAbiertas, setOperacionesAbiertas] = useState([]);
  const [tabDerecha, setTabDerecha] = useState('senal');
  const [preciosAnimados, setPreciosAnimados] = useState({});
  const [contadorAnalisis, setContadorAnalisis] = useState(300);
  const alertaId = useRef(0);
  const alertasEnviadas = useRef({});
  const notificacionPermiso = useRef(false);

  // Pedir permiso notificaciones
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => {
        notificacionPermiso.current = p === 'granted';
      });
    }
  }, []);

  const notificar = (titulo, cuerpo, tipo) => {
    if (notificacionPermiso.current) {
      new Notification(titulo, { body: cuerpo, icon: tipo === 'tp' ? '✅' : '🛑' });
    }
  };

  const agregarAlerta = (mensaje, tipo) => {
    const id = alertaId.current++;
    setAlertas(prev => [{ id, mensaje, tipo }, ...prev].slice(0, 8));
    setTimeout(() => setAlertas(prev => prev.filter(a => a.id !== id)), 12000);
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

      // Detectar cambios de precio para animación
      setDatos(prev => {
        const animados = {};
        nuevosDatos.forEach(m => {
          const anterior = prev.find(p => p.simbolo === m.simbolo);
          if (anterior && anterior.precio !== m.precio) {
            animados[m.simbolo] = m.precio > anterior.precio ? 'up' : 'down';
          }
        });
        if (Object.keys(animados).length > 0) {
          setPreciosAnimados(animados);
          setTimeout(() => setPreciosAnimados({}), 1000);
        }
        return nuevosDatos;
      });

      setUltimaActualizacion(new Date().toLocaleTimeString());

      // Monitor TP/SL
      nuevosDatos.forEach(m => {
        operacionesAbiertas.forEach(op => {
          if (op.symbol !== m.simbolo) return;
          const key = op.id;
          if (op.tipo === 'LONG') {
            if (m.precio >= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
              alertasEnviadas.current[`${key}-tp`] = true;
              const msg = `✅ CIERRA TU LONG DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} alcanzó TP $${op.take_profit.toLocaleString()}\nBinance: Posiciones → Cierra al mercado`;
              agregarAlerta(msg, 'tp');
              notificar(`✅ TP alcanzado — ${m.simbolo}`, `Cierra tu LONG. Precio: $${m.precio.toLocaleString()}`, 'tp');
            }
            if (m.precio <= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
              alertasEnviadas.current[`${key}-sl`] = true;
              const msg = `🛑 SAL DE TU LONG DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} tocó SL $${op.stop_loss.toLocaleString()}\nBinance: Posiciones → Cierra al mercado`;
              agregarAlerta(msg, 'sl');
              notificar(`🛑 SL activado — ${m.simbolo}`, `Sal de tu LONG. Precio: $${m.precio.toLocaleString()}`, 'sl');
            }
          } else {
            if (m.precio <= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
              alertasEnviadas.current[`${key}-tp`] = true;
              const msg = `✅ CIERRA TU SHORT DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} alcanzó TP $${op.take_profit.toLocaleString()}\nBinance: Posiciones → Cierra al mercado`;
              agregarAlerta(msg, 'tp');
              notificar(`✅ TP alcanzado — ${m.simbolo}`, `Cierra tu SHORT. Precio: $${m.precio.toLocaleString()}`, 'tp');
            }
            if (m.precio >= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
              alertasEnviadas.current[`${key}-sl`] = true;
              const msg = `🛑 SAL DE TU SHORT DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} tocó SL $${op.stop_loss.toLocaleString()}\nBinance: Posiciones → Cierra al mercado`;
              agregarAlerta(msg, 'sl');
              notificar(`🛑 SL activado — ${m.simbolo}`, `Sal de tu SHORT. Precio: $${m.precio.toLocaleString()}`, 'sl');
            }
          }
        });
      });
    } catch (e) { console.error(e); }
  };

  const analizarTodas = async () => {
    setAnalizando(true);
    setContadorAnalisis(300);
    for (const m of MONEDAS) {
      try {
        const res = await fetch(`/api/signals?symbol=${m.simbolo}`);
        const data = await res.json();
        if (!data?.precio_entrada) continue;
        setSenales(prev => ({ ...prev, [m.simbolo]: data }));
      } catch (e) { console.error(e); }
    }
    setAnalizando(false);
  };

  // Auto-analizar al cargar y cada 5 minutos
  useEffect(() => {
    analizarTodas();
    const interval = setInterval(analizarTodas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Contador regresivo
  useEffect(() => {
    const interval = setInterval(() => {
      setContadorAnalisis(prev => prev > 0 ? prev - 1 : 300);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Actualizar precios cada 5 segundos
  useEffect(() => {
    fetchPrecios();
    const interval = setInterval(fetchPrecios, 5000);
    return () => clearInterval(interval);
  }, [operacionesAbiertas]);

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
      agregarAlerta(`🔒 CIERRE ${op.tipo} ${op.symbol}\nPrecio cierre: $${precioActual.toLocaleString()}\nBinance → Posiciones → ${op.symbol}USDT → Cierra al mercado`, 'info');
    }
    setOperacionesAbiertas(prev => prev.filter(o => o.id !== id));
    delete alertasEnviadas.current[`${id}-tp`];
    delete alertasEnviadas.current[`${id}-sl`];
  };

  const sig = senales[monedaSeleccionada];
  const monedaActual = datos.find(m => m.simbolo === monedaSeleccionada);
  const colorOp = (op) => op === 'LONG' ? '#0ecb81' : '#f6465d';
  const bgOp = (op) => op === 'LONG' ? '#0d2e1f' : '#2d0f0f';
  const mins = Math.floor(contadorAnalisis / 60);
  const secs = contadorAnalisis % 60;

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes priceUp { 0% { color:#0ecb81; } 100% { color:inherit; } }
        @keyframes priceDown { 0% { color:#f6465d; } 100% { color:inherit; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .price-up { animation: priceUp 1s ease; }
        .price-down { animation: priceDown 1s ease; }
        .fade-in { animation: fadeInDown 0.3s ease; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0b0e11; }
        ::-webkit-scrollbar-thumb { background: #2b2f36; border-radius: 2px; }
      `}</style>

      {/* Alertas flotantes */}
      <div style={{ position: 'fixed', top: '66px', right: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
        {alertas.map(a => (
          <div key={a.id} onClick={() => setAlertas(prev => prev.filter(al => al.id !== a.id))}
            className="fade-in"
            style={{ background: a.tipo === 'tp' || a.tipo === 'long' ? '#0d2e1f' : a.tipo === 'sl' || a.tipo === 'short' ? '#2d0f0f' : '#161b22', border: `1px solid ${a.tipo === 'tp' || a.tipo === 'long' ? '#0ecb81' : a.tipo === 'sl' || a.tipo === 'short' ? '#f6465d' : '#A855F7'}`, borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '12px', lineHeight: '1.6', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'pointer', whiteSpace: 'pre-line' }}>
            {a.mensaje}
          </div>
        ))}
      </div>

      {/* Navbar */}
      <div style={{ background: '#0f1318', borderBottom: '1px solid #1e2329', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg, #6D28D9, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px #A855F755' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: '13px', color: '#fff' }}>JC</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '14px', lineHeight: '1' }}>JACJ <span style={{ color: '#A855F7' }}>Signals</span></div>
            <div style={{ color: '#5a4d8a', fontSize: '9px', letterSpacing: '1px' }}>FUTUROS · by Johan Caro</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {analizando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#A855F722', border: '1px solid #A855F744', borderRadius: '8px', padding: '4px 10px' }}>
              <div style={{ width: '10px', height: '10px', border: '2px solid #A855F7', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
              <span style={{ color: '#A855F7', fontSize: '11px', fontWeight: '600' }}>Analizando...</span>
            </div>
          )}
          {!analizando && (
            <div style={{ background: '#1e2329', borderRadius: '8px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: '#5d6673', fontSize: '10px' }}>Próximo análisis:</span>
              <span style={{ color: '#A855F7', fontSize: '11px', fontWeight: '700' }}>{mins}:{secs.toString().padStart(2, '0')}</span>
            </div>
          )}
          {operacionesAbiertas.length > 0 && (
            <div style={{ background: '#f0b90b22', border: '1px solid #f0b90b44', borderRadius: '8px', padding: '4px 10px', color: '#f0b90b', fontSize: '11px', fontWeight: '700', animation: 'pulse 2s infinite' }}>
              {operacionesAbiertas.length} pos. abierta{operacionesAbiertas.length > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', background: '#0ecb81', borderRadius: '50%', boxShadow: '0 0 6px #0ecb81', animation: 'pulse 2s infinite' }}></div>
            <span style={{ color: '#5d6673', fontSize: '11px' }}>EN VIVO · {ultimaActualizacion}</span>
          </div>
        </div>
      </div>

      {/* Barra monedas */}
      <div style={{ background: '#0f1318', borderBottom: '1px solid #1e2329', padding: '0 20px', display: 'flex', gap: '2px', overflowX: 'auto' }}>
        {datos.map(m => {
          const s = senales[m.simbolo];
          const opAbierta = operacionesAbiertas.find(o => o.symbol === m.simbolo);
          const sel = monedaSeleccionada === m.simbolo;
          const animDir = preciosAnimados[m.simbolo];
          return (
            <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)}
              style={{ background: sel ? '#161b22' : 'none', border: 'none', borderBottom: sel ? `2px solid ${m.color}` : '2px solid transparent', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: m.color + '22', border: `1px solid ${m.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: m.color }}>{m.icono}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: sel ? '#fff' : '#848e9c', fontSize: '12px', fontWeight: '600' }}>{m.simbolo}</span>
                  {s && <span style={{ background: colorOp(s.operacion) + '22', color: colorOp(s.operacion), padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }}>{s.operacion}</span>}
                  {opAbierta && <div style={{ width: '5px', height: '5px', background: '#f0b90b', borderRadius: '50%' }}></div>}
                </div>
                <div className={animDir === 'up' ? 'price-up' : animDir === 'down' ? 'price-down' : ''} style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '10px' }}>
                  ${m.precio?.toLocaleString()} <span style={{ fontSize: '9px' }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', flex: 1, minHeight: 0 }}>

        {/* Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2329', overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e2329', background: '#0f1318', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: monedaActual?.color + '22', border: `1.5px solid ${monedaActual?.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: monedaActual?.color, fontWeight: '700' }}>{monedaActual?.icono}</div>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{monedaSeleccionada}/USDT Perpetuo</span>
                {sig && <span style={{ background: colorOp(sig.operacion) + '22', color: colorOp(sig.operacion), padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', border: `1px solid ${colorOp(sig.operacion)}33` }}>{sig.operacion}</span>}
              </div>
              <div className={preciosAnimados[monedaSeleccionada] === 'up' ? 'price-up' : preciosAnimados[monedaSeleccionada] === 'down' ? 'price-down' : ''} style={{ color: '#fff', fontSize: '24px', fontWeight: '700' }}>${monedaActual?.precio?.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Cambio 24h', valor: `${monedaActual?.cambio >= 0 ? '+' : ''}${monedaActual?.cambio}%`, color: monedaActual?.cambio >= 0 ? '#0ecb81' : '#f6465d' },
                { label: 'Máx 24h', valor: `$${monedaActual?.high?.toLocaleString()}`, color: '#c0c6cf' },
                { label: 'Mín 24h', valor: `$${monedaActual?.low?.toLocaleString()}`, color: '#c0c6cf' },
                ...(sig ? [
                  { label: 'RSI', valor: sig.rsi, color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#c0c6cf' },
                  { label: 'MACD', valor: sig.macd?.toUpperCase(), color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d' },
                  { label: 'Confianza', valor: `${sig.confianza}%`, color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b' },
                ] : []),
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '1px' }}>{item.label}</div>
                  <div style={{ color: item.color, fontWeight: '600', fontSize: '12px' }}>{item.valor}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>

          {operacionesAbiertas.length > 0 && (
            <div style={{ borderTop: '1px solid #1e2329', background: '#0f1318', padding: '8px 16px', maxHeight: '160px', overflow: 'auto' }}>
              <div style={{ color: '#f0b90b', fontSize: '10px', fontWeight: '700', marginBottom: '6px', letterSpacing: '0.5px' }}>📊 POSICIONES ACTIVAS — MONITOREANDO EN TIEMPO REAL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                    <div key={op.id} style={{ background: '#161b22', borderRadius: '7px', padding: '8px 12px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8133' : '#f6465d33'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '12px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol}</span>
                          <span style={{ color: '#5d6673', fontSize: '10px' }}>Entrada $${op.entrada.toLocaleString()} · {op.apalancamiento}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '13px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</span>
                          <button onClick={() => cerrarOperacion(op.id)} style={{ background: 'none', border: '1px solid #f6465d33', borderRadius: '4px', padding: '2px 7px', color: '#f6465d', fontSize: '10px', cursor: 'pointer' }}>Cerrar</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: '#f6465d', fontSize: '9px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                        <span style={{ color: '#c0c6cf', fontSize: '9px' }}>${precioActual.toLocaleString()}</span>
                        <span style={{ color: '#0ecb81', fontSize: '9px' }}>TP ${op.take_profit.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#0b0e11', borderRadius: '3px', height: '3px' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '3px', borderRadius: '3px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
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
          <div style={{ display: 'flex', borderBottom: '1px solid #1e2329', background: '#0b0e11' }}>
            {[
              { id: 'senal', label: '⚡ Señal' },
              { id: 'operar', label: '📋 Operar' },
              { id: 'posiciones', label: `📊${operacionesAbiertas.length > 0 ? ` (${operacionesAbiertas.length})` : ''}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setTabDerecha(tab.id)}
                style={{ flex: 1, padding: '11px 6px', background: 'none', border: 'none', borderBottom: tabDerecha === tab.id ? '2px solid #A855F7' : '2px solid transparent', color: tabDerecha === tab.id ? '#A855F7' : '#5d6673', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>

            {/* SEÑAL */}
            {tabDerecha === 'senal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analizando && !sig && (
                  <div style={{ textAlign: 'center', padding: '30px' }}>
                    <div style={{ width: '32px', height: '32px', border: '3px solid #A855F7', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
                    <div style={{ color: '#A855F7', fontSize: '13px', fontWeight: '600' }}>Analizando mercado...</div>
                  </div>
                )}

                {sig && (
                  <>
                    <div className="fade-in" style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}44`, borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ color: colorOp(sig.operacion), fontWeight: '800', fontSize: '20px' }}>
                          {sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#5d6673', fontSize: '9px' }}>Confianza</div>
                          <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '800', fontSize: '24px' }}>{sig.confianza}%</div>
                        </div>
                      </div>
                      <div style={{ color: '#8b9098', fontSize: '12px', lineHeight: '1.5', borderTop: `1px solid ${colorOp(sig.operacion)}22`, paddingTop: '8px' }}>{sig.razon}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                      {[
                        { label: 'RSI', valor: sig.rsi, color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#c0c6cf' },
                        { label: 'MACD', valor: sig.macd?.slice(0,3).toUpperCase(), color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d' },
                        { label: 'Apal.', valor: sig.apalancamiento, color: '#F3BA2F' },
                        { label: 'Riesgo', valor: `${sig.riesgo_liquidacion}%`, color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#161b22', borderRadius: '7px', padding: '8px', border: '1px solid #1e2329', textAlign: 'center' }}>
                          <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '3px' }}>{item.label}</div>
                          <div style={{ color: item.color, fontWeight: '700', fontSize: '13px' }}>{item.valor}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#161b22', borderRadius: '8px', padding: '10px 12px', border: '1px solid #2d6af633', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#5d6673', fontSize: '10px' }}>📌 Precio entrada</div>
                        <div style={{ color: '#3b82f6', fontWeight: '700', fontSize: '20px' }}>${sig.precio_entrada.toLocaleString()}</div>
                        <div style={{ color: '#5d6673', fontSize: '9px' }}>Campo Precio en Binance Futuros</div>
                      </div>
                      <div style={{ color: '#5d6673', fontSize: '20px' }}>→</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ background: '#0d2e1f', borderRadius: '8px', padding: '10px', border: '1px solid #0ecb8133' }}>
                        <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '3px' }}>✅ Take Profit</div>
                        <div style={{ color: '#0ecb81', fontWeight: '700', fontSize: '16px' }}>${sig.take_profit.toLocaleString()}</div>
                        <div style={{ color: '#5d6673', fontSize: '9px' }}>TP en Binance</div>
                      </div>
                      <div style={{ background: '#2d0f0f', borderRadius: '8px', padding: '10px', border: '1px solid #f6465d33' }}>
                        <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '3px' }}>🛑 Stop Loss</div>
                        <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '16px' }}>${sig.stop_loss.toLocaleString()}</div>
                        <div style={{ color: '#5d6673', fontSize: '9px' }}>SL en Binance</div>
                      </div>
                    </div>

                    <div style={{ background: '#161b22', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f6465d22', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ color: '#5d6673', fontSize: '9px' }}>☠️ Liquidación estimada</div>
                        <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '16px' }}>${sig.precio_liquidacion?.toLocaleString()}</div>
                      </div>
                      <div style={{ background: `${sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b'}22`, borderRadius: '6px', padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ color: '#5d6673', fontSize: '9px' }}>Riesgo</div>
                        <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '700', fontSize: '16px' }}>{sig.riesgo_liquidacion}%</div>
                      </div>
                    </div>

                    <button onClick={() => setTabDerecha('operar')}
                      style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #0ecb81, #0aa866)' : 'linear-gradient(135deg, #f6465d, #c73c4f)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: `0 4px 16px ${colorOp(sig.operacion)}44` }}>
                      {sig.operacion === 'LONG' ? '🟢 Quiero operar este LONG →' : '🔴 Quiero operar este SHORT →'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* OPERAR */}
            {tabDerecha === 'operar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sig ? (
                  <>
                    <div style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}33`, borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: colorOp(sig.operacion), fontWeight: '700', fontSize: '13px' }}>{sig.operacion === 'LONG' ? '🟢 LONG' : '🔴 SHORT'} — {monedaSeleccionada}</span>
                      <span style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700', fontSize: '13px' }}>{sig.confianza}%</span>
                    </div>

                    <div style={{ background: '#161b22', borderRadius: '10px', padding: '12px', border: '1px solid #1e2329' }}>
                      <div style={{ color: '#A855F7', fontSize: '10px', fontWeight: '700', marginBottom: '10px', letterSpacing: '0.5px' }}>📋 PASOS EN BINANCE FUTUROS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { n: '1', texto: `Binance → Futuros → ${monedaSeleccionada}USDT Perpetuo`, color: '#3b82f6' },
                          { n: '2', texto: `Ajusta apalancamiento a ${sig.apalancamiento}`, color: '#F3BA2F' },
                          { n: '3', texto: `Selecciona ${sig.operacion === 'LONG' ? 'COMPRAR/LONG' : 'VENDER/SHORT'} → Tipo: Limit`, color: colorOp(sig.operacion) },
                          { n: '4', texto: `Precio: $${sig.precio_entrada.toLocaleString()} · Cantidad: el monto de abajo`, color: '#3b82f6' },
                          { n: '5', texto: `TP: $${sig.take_profit.toLocaleString()} · SL: $${sig.stop_loss.toLocaleString()}`, color: '#0ecb81' },
                          { n: '6', texto: 'Registra aquí y te avisamos automáticamente cuando cerrar', color: '#A855F7' },
                        ].map(item => (
                          <div key={item.n} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: item.color + '22', border: `1px solid ${item.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: item.color, fontWeight: '700', flexShrink: 0, marginTop: '2px' }}>{item.n}</div>
                            <span style={{ color: '#8b9098', fontSize: '11px', lineHeight: '1.5' }}>{item.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#5d6673', fontSize: '11px', marginBottom: '5px' }}>💵 ¿Cuánto vas a poner? (tu margen en USDT)</div>
                      <div style={{ background: '#161b22', border: '1px solid #1e2329', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#5d6673', fontSize: '14px' }}>$</span>
                        <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 10" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '16px', outline: 'none', flex: 1 }} />
                        <span style={{ color: '#5d6673', fontSize: '12px' }}>USDT</span>
                      </div>
                      {monto && sig?.apalancamiento && (
                        <div style={{ color: '#5d6673', fontSize: '10px', marginTop: '3px' }}>
                          Posición total: <span style={{ color: '#F3BA2F', fontWeight: '700' }}>${(parseFloat(monto) * parseInt(sig.apalancamiento)).toLocaleString()} USDT</span>
                        </div>
                      )}
                    </div>

                    {monto && (
                      <button onClick={registrarOperacion}
                        style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #0ecb81, #0aa866)' : 'linear-gradient(135deg, #f6465d, #c73c4f)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: `0 4px 16px ${colorOp(sig.operacion)}44` }}>
                        {sig.operacion === 'LONG' ? '🟢 Registrar y monitorear LONG' : '🔴 Registrar y monitorear SHORT'}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ width: '32px', height: '32px', border: '3px solid #A855F7', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
                    <div style={{ color: '#A855F7', fontSize: '13px' }}>Analizando mercado automáticamente...</div>
                  </div>
                )}

                <div style={{ background: '#1a1600', borderRadius: '8px', padding: '7px 10px', fontSize: '10px', color: '#856404', textAlign: 'center', border: '1px solid #f0b90b22' }}>
                  ⚠️ Análisis educativo. No es asesoría financiera.
                </div>
              </div>
            )}

            {/* POSICIONES */}
            {tabDerecha === 'posiciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {operacionesAbiertas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
                    <div style={{ color: '#c0c6cf', fontWeight: '600', fontSize: '13px', marginBottom: '5px' }}>Sin posiciones registradas</div>
                    <div style={{ color: '#5d6673', fontSize: '11px', marginBottom: '12px' }}>Registra una operación y la monitoreamos en tiempo real</div>
                    <button onClick={() => setTabDerecha('operar')} style={{ background: 'linear-gradient(135deg, #6D28D9, #A855F7)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                      Ir a operar →
                    </button>
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
                      <div key={op.id} className="fade-in" style={{ background: '#161b22', borderRadius: '10px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8133' : '#f6465d33'}`, overflow: 'hidden' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0d2e1f' : '#2d0f0f', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '13px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '800', fontSize: '18px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</div>
                            <div style={{ color: parseFloat(pnlUsdt) >= 0 ? '#0ecb81' : '#f6465d', fontSize: '10px' }}>{parseFloat(pnlUsdt) >= 0 ? '+' : ''}${pnlUsdt} USDT</div>
                          </div>
                        </div>
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                            {[
                              { label: 'Entrada', valor: `$${op.entrada.toLocaleString()}`, color: '#3b82f6' },
                              { label: 'Apal.', valor: op.apalancamiento, color: '#F3BA2F' },
                              { label: 'Margen', valor: `$${op.monto}`, color: '#c0c6cf' },
                            ].map(item => (
                              <div key={item.label} style={{ background: '#0b0e11', borderRadius: '5px', padding: '5px 7px', textAlign: 'center' }}>
                                <div style={{ color: '#5d6673', fontSize: '8px', marginBottom: '1px' }}>{item.label}</div>
                                <div style={{ color: item.color, fontWeight: '600', fontSize: '11px' }}>{item.valor}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#f6465d', fontSize: '10px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                            <span style={{ color: '#c0c6cf', fontSize: '10px', fontWeight: '600' }}>${precioActual.toLocaleString()}</span>
                            <span style={{ color: '#0ecb81', fontSize: '10px' }}>TP ${op.take_profit.toLocaleString()}</span>
                          </div>
                          <div style={{ background: '#0b0e11', borderRadius: '3px', height: '5px' }}>
                            <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '5px', borderRadius: '3px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
                          </div>
                          <div style={{ color: '#5d6673', fontSize: '9px', textAlign: 'center' }}>{progreso.toFixed(1)}% hacia objetivo · {op.tiempo}</div>
                          <button onClick={() => cerrarOperacion(op.id)}
                            style={{ width: '100%', background: 'none', border: '1px solid #f6465d33', borderRadius: '7px', padding: '8px', color: '#f6465d', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                            🔒 Cerrar — Ver instrucciones en Binance
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