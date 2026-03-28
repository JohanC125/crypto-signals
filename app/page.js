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
  const operacionesRef = useRef([]);

  useEffect(() => {
    operacionesRef.current = operacionesAbiertas;
  }, [operacionesAbiertas]);

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => {
        notificacionPermiso.current = p === 'granted';
      });
    }
  }, []);

  const notificar = (titulo, cuerpo) => {
    if (notificacionPermiso.current) {
      try { new Notification(titulo, { body: cuerpo }); } catch (e) {}
    }
  };

  const agregarAlerta = (mensaje, tipo) => {
    const id = alertaId.current++;
    setAlertas(prev => [{ id, mensaje, tipo }, ...prev].slice(0, 6));
    setTimeout(() => setAlertas(prev => prev.filter(a => a.id !== id)), 15000);
  };

  useEffect(() => {
    const fetchPrecios = async () => {
      try {
        const resultados = await Promise.all(
          MONEDAS.map(m => fetch(`/api/precios?symbol=${m.simbolo}`).then(r => r.json()))
        );
        const nuevosDatos = resultados.map((d, i) => ({
          ...MONEDAS[i],
          precio: d.price || 0,
          cambio: d.change || 0,
          high: d.high || 0,
          low: d.low || 0,
          volumen: d.volume || 0,
        }));

        setDatos(prev => {
          const animados = {};
          nuevosDatos.forEach(m => {
            const anterior = prev.find(p => p.simbolo === m.simbolo);
            if (anterior && anterior.precio !== m.precio && m.precio > 0) {
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

        nuevosDatos.forEach(m => {
          operacionesRef.current.forEach(op => {
            if (op.symbol !== m.simbolo || !m.precio) return;
            const key = op.id;
            if (op.tipo === 'LONG') {
              if (m.precio >= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
                alertasEnviadas.current[`${key}-tp`] = true;
                agregarAlerta(`✅ CIERRA TU LONG DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} llegó al TP\nBinance: Posiciones → ${m.simbolo}USDT → Cierra al mercado`, 'tp');
                notificar(`✅ TP alcanzado — ${m.simbolo}`, `Cierra tu LONG. Precio: $${m.precio.toLocaleString()}`);
              }
              if (m.precio <= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
                alertasEnviadas.current[`${key}-sl`] = true;
                agregarAlerta(`🛑 SAL DE TU LONG DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} tocó el SL\nBinance: Posiciones → ${m.simbolo}USDT → Cierra al mercado`, 'sl');
                notificar(`🛑 SL activado — ${m.simbolo}`, `Sal de tu LONG. Precio: $${m.precio.toLocaleString()}`);
              }
            } else {
              if (m.precio <= op.take_profit && !alertasEnviadas.current[`${key}-tp`]) {
                alertasEnviadas.current[`${key}-tp`] = true;
                agregarAlerta(`✅ CIERRA TU SHORT DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} llegó al TP\nBinance: Posiciones → ${m.simbolo}USDT → Cierra al mercado`, 'tp');
                notificar(`✅ TP alcanzado — ${m.simbolo}`, `Cierra tu SHORT. Precio: $${m.precio.toLocaleString()}`);
              }
              if (m.precio >= op.stop_loss && !alertasEnviadas.current[`${key}-sl`]) {
                alertasEnviadas.current[`${key}-sl`] = true;
                agregarAlerta(`🛑 CIERRA TU SHORT DE ${m.simbolo}\nPrecio: $${m.precio.toLocaleString()} tocó el SL\nBinance: Posiciones → ${m.simbolo}USDT → Cierra al mercado`, 'sl');
                notificar(`🛑 SL activado — ${m.simbolo}`, `Sal de tu SHORT. Precio: $${m.precio.toLocaleString()}`);
              }
            }
          });
        });
      } catch (e) { console.error(e); }
    };

    fetchPrecios();
    const interval = setInterval(fetchPrecios, 5000);
    return () => clearInterval(interval);
  }, []);

  const analizarTodas = async () => {
    if (analizando) return;
    setAnalizando(true);
    setContadorAnalisis(300);
    for (const m of MONEDAS) {
      try {
        const res = await fetch(`/api/signals?symbol=${m.simbolo}`);
        const data = await res.json();
        if (data?.precio_entrada) {
          setSenales(prev => ({ ...prev, [m.simbolo]: data }));
        }
      } catch (e) { console.error(e); }
    }
    setAnalizando(false);
  };

  useEffect(() => {
    analizarTodas();
    const interval = setInterval(analizarTodas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setContadorAnalisis(prev => {
        if (prev <= 1) { analizarTodas(); return 300; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
    agregarAlerta(`📝 ${sig.operacion} ${monedaSeleccionada} registrado\nMonitoreando TP $${sig.take_profit.toLocaleString()} y SL $${sig.stop_loss.toLocaleString()}`, 'info');
    setTabDerecha('posiciones');
    setMonto('');
  };

  const cerrarOperacion = (id) => {
    const op = operacionesRef.current.find(o => o.id === id);
    const precioActual = datos.find(d => d.simbolo === op?.symbol)?.precio || 0;
    if (op) {
      agregarAlerta(`🔒 CIERRE ${op.tipo} ${op.symbol}\nPrecio actual: $${precioActual.toLocaleString()}\n\nEn Binance Futuros:\n1. Ve a "Posiciones"\n2. Busca ${op.symbol}USDT\n3. Clic en "Cerrar"\n4. Precio de mercado\n5. Confirma`, 'info');
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
        @keyframes fadeDown { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes priceUp { 0%{background:#0ecb8133;} 100%{background:transparent;} }
        @keyframes priceDown { 0%{background:#f6465d33;} 100%{background:transparent;} }
        .fade-down{animation:fadeDown 0.3s ease;}
        .price-up{animation:priceUp 1s ease;}
        .price-down{animation:priceDown 1s ease;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:#0b0e11;}
        ::-webkit-scrollbar-thumb{background:#2b2f36;border-radius:2px;}
        input::placeholder{color:#3d4450;}
        button:hover{opacity:0.9;}
      `}</style>

      {/* Alertas */}
      <div style={{ position: 'fixed', top: '64px', right: '14px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px', width: '100%' }}>
        {alertas.map(a => (
          <div key={a.id} onClick={() => setAlertas(prev => prev.filter(al => al.id !== a.id))} className="fade-down"
            style={{ background: a.tipo === 'tp' ? '#0a2218' : a.tipo === 'sl' ? '#220a0a' : a.tipo === 'long' ? '#0a2218' : a.tipo === 'short' ? '#220a0a' : '#161b22', border: `1px solid ${a.tipo === 'tp' || a.tipo === 'long' ? '#0ecb81' : a.tipo === 'sl' || a.tipo === 'short' ? '#f6465d' : '#9333EA'}`, borderRadius: '10px', padding: '10px 12px', color: '#fff', fontSize: '11px', lineHeight: '1.6', boxShadow: '0 8px 24px rgba(0,0,0,0.7)', cursor: 'pointer', whiteSpace: 'pre-line' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{a.mensaje}</span>
              <span style={{ color: '#5d6673', fontSize: '10px', marginLeft: '8px' }}>✕</span>
            </div>
          </div>
        ))}
      </div>

      {/* Navbar */}
      <div style={{ background: '#0f1318', borderBottom: '1px solid #1e2329', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '54px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #5B21B6, #9333EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px #9333EA44' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: '12px', color: '#fff' }}>JC</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '700', fontSize: '13px', lineHeight: '1' }}>JACJ <span style={{ color: '#9333EA' }}>Signals</span></div>
            <div style={{ color: '#4a3f6b', fontSize: '8px', letterSpacing: '1px' }}>FUTUROS · by Johan Caro</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {analizando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#9333EA22', border: '1px solid #9333EA44', borderRadius: '6px', padding: '3px 8px' }}>
              <div style={{ width: '8px', height: '8px', border: '2px solid #9333EA', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
              <span style={{ color: '#9333EA', fontSize: '10px', fontWeight: '600' }}>Analizando...</span>
            </div>
          ) : (
            <div style={{ background: '#161b22', borderRadius: '6px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#5d6673', fontSize: '9px' }}>Próximo análisis</span>
              <span style={{ color: '#9333EA', fontSize: '10px', fontWeight: '700' }}>{mins}:{secs.toString().padStart(2, '0')}</span>
            </div>
          )}
          {operacionesAbiertas.length > 0 && (
            <div onClick={() => setTabDerecha('posiciones')} style={{ background: '#f0b90b22', border: '1px solid #f0b90b44', borderRadius: '6px', padding: '3px 8px', color: '#f0b90b', fontSize: '10px', fontWeight: '700', cursor: 'pointer', animation: 'pulse 2s infinite' }}>
              {operacionesAbiertas.length} activa{operacionesAbiertas.length > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '5px', height: '5px', background: '#0ecb81', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
            <span style={{ color: '#3d4450', fontSize: '10px' }}>{ultimaActualizacion}</span>
          </div>
        </div>
      </div>

      {/* Barra monedas */}
      <div style={{ background: '#0f1318', borderBottom: '1px solid #1e2329', padding: '0 16px', display: 'flex', overflowX: 'auto' }}>
        {datos.map(m => {
          const s = senales[m.simbolo];
          const opAbierta = operacionesAbiertas.find(o => o.symbol === m.simbolo);
          const sel = monedaSeleccionada === m.simbolo;
          const animDir = preciosAnimados[m.simbolo];
          return (
            <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)}
              className={animDir === 'up' ? 'price-up' : animDir === 'down' ? 'price-down' : ''}
              style={{ background: 'none', border: 'none', borderBottom: sel ? `2px solid ${m.color}` : '2px solid transparent', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', transition: 'all 0.15s', opacity: sel ? 1 : 0.7 }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: m.color + '22', border: `1px solid ${m.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700', color: m.color }}>{m.icono}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: sel ? '#fff' : '#848e9c', fontSize: '11px', fontWeight: '600' }}>{m.simbolo}</span>
                  {s && <span style={{ background: colorOp(s.operacion) + '22', color: colorOp(s.operacion), padding: '1px 4px', borderRadius: '2px', fontSize: '8px', fontWeight: '700' }}>{s.operacion}</span>}
                  {opAbierta && <div style={{ width: '4px', height: '4px', background: '#f0b90b', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>}
                </div>
                <div style={{ color: m.cambio >= 0 ? '#0ecb81' : '#f6465d', fontSize: '9px' }}>
                  {m.precio > 0 ? `$${m.precio.toLocaleString()}` : '...'} <span style={{ opacity: 0.7 }}>{m.cambio >= 0 ? '+' : ''}{m.cambio}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2329', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2329', background: '#0f1318', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: monedaActual?.color + '22', border: `1.5px solid ${monedaActual?.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: monedaActual?.color, fontWeight: '700' }}>{monedaActual?.icono}</div>
                <span style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>{monedaSeleccionada}/USDT Perp</span>
                {sig && <span style={{ background: colorOp(sig.operacion) + '22', color: colorOp(sig.operacion), padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: '700', border: `1px solid ${colorOp(sig.operacion)}33` }}>{sig.operacion}</span>}
              </div>
              <div className={preciosAnimados[monedaSeleccionada] === 'up' ? 'price-up' : preciosAnimados[monedaSeleccionada] === 'down' ? 'price-down' : ''}
                style={{ color: '#fff', fontSize: '22px', fontWeight: '700' }}>
                {monedaActual?.precio > 0 ? `$${monedaActual.precio.toLocaleString()}` : '...'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { label: '24h', valor: `${monedaActual?.cambio >= 0 ? '+' : ''}${monedaActual?.cambio}%`, color: monedaActual?.cambio >= 0 ? '#0ecb81' : '#f6465d' },
                { label: 'Máx', valor: monedaActual?.high > 0 ? `$${monedaActual.high.toLocaleString()}` : '...', color: '#0ecb81' },
                { label: 'Mín', valor: monedaActual?.low > 0 ? `$${monedaActual.low.toLocaleString()}` : '...', color: '#f6465d' },
                ...(sig ? [
                  { label: 'RSI', valor: sig.rsi, color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#848e9c' },
                  { label: 'MACD', valor: sig.macd === 'alcista' ? 'ALC' : 'BAJ', color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d' },
                  { label: 'IA', valor: `${sig.confianza}%`, color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b' },
                ] : []),
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: '#3d4450', fontSize: '8px', marginBottom: '1px' }}>{item.label}</div>
                  <div style={{ color: item.color, fontWeight: '600', fontSize: '11px' }}>{item.valor}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>

          {operacionesAbiertas.length > 0 && (
            <div style={{ borderTop: '1px solid #1e2329', background: '#0a0d10', padding: '8px 14px', maxHeight: '150px', overflow: 'auto' }}>
              <div style={{ color: '#f0b90b', fontSize: '9px', fontWeight: '700', marginBottom: '6px', letterSpacing: '0.5px' }}>📊 MONITOREANDO EN TIEMPO REAL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {operacionesAbiertas.map(op => {
                  const precioActual = datos.find(d => d.simbolo === op.symbol)?.precio || 0;
                  const apalNum = parseInt(op.apalancamiento) || 10;
                  const pnl = precioActual > 0 ? (op.tipo === 'LONG'
                    ? ((precioActual - op.entrada) / op.entrada * 100 * apalNum).toFixed(2)
                    : ((op.entrada - precioActual) / op.entrada * 100 * apalNum).toFixed(2)) : '0.00';
                  const progreso = precioActual > 0 ? (op.tipo === 'LONG'
                    ? Math.min(Math.max(((precioActual - op.entrada) / (op.take_profit - op.entrada)) * 100, 0), 100)
                    : Math.min(Math.max(((op.entrada - precioActual) / (op.entrada - op.take_profit)) * 100, 0), 100)) : 0;
                  return (
                    <div key={op.id} style={{ background: '#161b22', borderRadius: '6px', padding: '7px 10px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8122' : '#f6465d22'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '11px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol} · {op.apalancamiento}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '12px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</span>
                          <button onClick={() => cerrarOperacion(op.id)} style={{ background: 'none', border: '1px solid #f6465d33', borderRadius: '3px', padding: '1px 6px', color: '#f6465d', fontSize: '9px', cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: '#f6465d', fontSize: '8px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                        <span style={{ color: '#848e9c', fontSize: '8px' }}>{precioActual > 0 ? `$${precioActual.toLocaleString()}` : '...'}</span>
                        <span style={{ color: '#0ecb81', fontSize: '8px' }}>TP ${op.take_profit.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#0b0e11', borderRadius: '2px', height: '3px' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '3px', borderRadius: '2px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
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
          <div style={{ display: 'flex', borderBottom: '1px solid #1e2329', background: '#0a0d10' }}>
            {[
              { id: 'senal', label: '⚡ Señal' },
              { id: 'operar', label: '📋 Operar' },
              { id: 'posiciones', label: operacionesAbiertas.length > 0 ? `📊 (${operacionesAbiertas.length})` : '📊' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setTabDerecha(tab.id)}
                style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', borderBottom: tabDerecha === tab.id ? '2px solid #9333EA' : '2px solid transparent', color: tabDerecha === tab.id ? '#9333EA' : '#5d6673', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>

            {/* SEÑAL */}
            {tabDerecha === 'senal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analizando && !sig ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ width: '28px', height: '28px', border: '2px solid #9333EA', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }}></div>
                    <div style={{ color: '#9333EA', fontSize: '12px', fontWeight: '600' }}>Analizando mercado...</div>
                    <div style={{ color: '#5d6673', fontSize: '10px', marginTop: '4px' }}>Automático — no necesitas hacer nada</div>
                  </div>
                ) : sig ? (
                  <>
                    <div className="fade-down" style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}55`, borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ color: colorOp(sig.operacion), fontWeight: '800', fontSize: '22px' }}>
                          {sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#5d6673', fontSize: '9px' }}>Confianza IA</div>
                          <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '800', fontSize: '26px' }}>{sig.confianza}%</div>
                        </div>
                      </div>
                      <div style={{ color: '#7a8490', fontSize: '11px', lineHeight: '1.5', borderTop: `1px solid ${colorOp(sig.operacion)}22`, paddingTop: '8px' }}>{sig.razon}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                      {[
                        { label: 'RSI', valor: sig.rsi, color: sig.rsi < 30 ? '#0ecb81' : sig.rsi > 70 ? '#f6465d' : '#c0c6cf' },
                        { label: 'MACD', valor: sig.macd === 'alcista' ? 'ALC' : 'BAJ', color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d' },
                        { label: 'Apal.', valor: sig.apalancamiento, color: '#F3BA2F' },
                        { label: 'Riesgo', valor: `${sig.riesgo_liquidacion}%`, color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#161b22', borderRadius: '7px', padding: '8px 6px', border: '1px solid #1e2329', textAlign: 'center' }}>
                          <div style={{ color: '#5d6673', fontSize: '8px', marginBottom: '3px' }}>{item.label}</div>
                          <div style={{ color: item.color, fontWeight: '700', fontSize: '13px' }}>{item.valor}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#131823', borderRadius: '8px', padding: '10px 12px', border: '1px solid #1e3a5f' }}>
                      <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '3px' }}>📌 PRECIO DE ENTRADA</div>
                      <div style={{ color: '#3b82f6', fontWeight: '800', fontSize: '22px' }}>${sig.precio_entrada.toLocaleString()}</div>
                      <div style={{ color: '#3d4450', fontSize: '9px' }}>Campo "Precio" en Binance Futuros → Limit</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ background: '#0a1f12', borderRadius: '8px', padding: '10px', border: '1px solid #0ecb8122' }}>
                        <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '3px' }}>✅ TAKE PROFIT</div>
                        <div style={{ color: '#0ecb81', fontWeight: '700', fontSize: '16px' }}>${sig.take_profit.toLocaleString()}</div>
                        <div style={{ color: '#3d4450', fontSize: '8px', marginTop: '2px' }}>Campo TP en Binance</div>
                      </div>
                      <div style={{ background: '#1f0a0a', borderRadius: '8px', padding: '10px', border: '1px solid #f6465d22' }}>
                        <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '3px' }}>🛑 STOP LOSS</div>
                        <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '16px' }}>${sig.stop_loss.toLocaleString()}</div>
                        <div style={{ color: '#3d4450', fontSize: '8px', marginTop: '2px' }}>Campo SL en Binance</div>
                      </div>
                    </div>

                    <div style={{ background: '#131823', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f6465d22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#5d6673', fontSize: '9px', marginBottom: '2px' }}>☠️ PRECIO LIQUIDACIÓN</div>
                        <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '16px' }}>${sig.precio_liquidacion?.toLocaleString()}</div>
                        <div style={{ color: '#3d4450', fontSize: '8px' }}>No cruces este nivel</div>
                      </div>
                      <div style={{ background: `${sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b'}11`, borderRadius: '6px', padding: '8px 12px', textAlign: 'center', border: `1px solid ${sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b'}33` }}>
                        <div style={{ color: '#5d6673', fontSize: '8px' }}>Riesgo</div>
                        <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '800', fontSize: '18px' }}>{sig.riesgo_liquidacion}%</div>
                      </div>
                    </div>

                    <button onClick={() => setTabDerecha('operar')}
                      style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #059669, #0ecb81)' : 'linear-gradient(135deg, #dc2626, #f6465d)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: `0 4px 14px ${colorOp(sig.operacion)}33` }}>
                      {sig.operacion === 'LONG' ? '🟢 Quiero operar este LONG →' : '🔴 Quiero operar este SHORT →'}
                    </button>
                  </>
                ) : null}
              </div>
            )}

            {/* OPERAR */}
            {tabDerecha === 'operar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sig ? (
                  <>
                    <div style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}33`, borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: colorOp(sig.operacion), fontWeight: '700', fontSize: '13px' }}>{sig.operacion === 'LONG' ? '🟢 LONG' : '🔴 SHORT'} — {monedaSeleccionada}</span>
                      <span style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700' }}>{sig.confianza}%</span>
                    </div>

                    <div style={{ background: '#161b22', borderRadius: '10px', padding: '12px', border: '1px solid #1e2329' }}>
                      <div style={{ color: '#9333EA', fontSize: '10px', fontWeight: '700', marginBottom: '10px', letterSpacing: '0.5px' }}>📋 PASOS EN BINANCE FUTUROS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { n: '1', texto: `Binance → Futuros → ${monedaSeleccionada}USDT Perpetuo`, color: '#3b82f6' },
                          { n: '2', texto: `Ajusta apalancamiento a ${sig.apalancamiento}`, color: '#F3BA2F' },
                          { n: '3', texto: `Selecciona ${sig.operacion === 'LONG' ? 'COMPRAR / LONG' : 'VENDER / SHORT'} → Tipo: Limit`, color: colorOp(sig.operacion) },
                          { n: '4', texto: `Precio: $${sig.precio_entrada.toLocaleString()} · Cantidad: lo que pongas abajo`, color: '#3b82f6' },
                          { n: '5', texto: `Activa TP: $${sig.take_profit.toLocaleString()} y SL: $${sig.stop_loss.toLocaleString()}`, color: '#0ecb81' },
                          { n: '6', texto: 'Pon tu monto abajo y registra — te avisamos automáticamente', color: '#9333EA' },
                        ].map(item => (
                          <div key={item.n} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: item.color + '22', border: `1px solid ${item.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: item.color, fontWeight: '700', flexShrink: 0, marginTop: '2px' }}>{item.n}</div>
                            <span style={{ color: '#7a8490', fontSize: '11px', lineHeight: '1.5' }}>{item.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '5px' }}>💵 Tu margen (cuánto pones en USDT)</div>
                      <div style={{ background: '#161b22', border: '1px solid #1e2329', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#5d6673' }}>$</span>
                        <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 10"
                          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '16px', outline: 'none', flex: 1 }} />
                        <span style={{ color: '#5d6673', fontSize: '12px' }}>USDT</span>
                      </div>
                      {monto && sig?.apalancamiento && (
                        <div style={{ color: '#5d6673', fontSize: '10px', marginTop: '3px' }}>
                          Posición total: <span style={{ color: '#F3BA2F', fontWeight: '700' }}>${(parseFloat(monto) * parseInt(sig.apalancamiento)).toLocaleString()} USDT</span>
                        </div>
                      )}
                    </div>

                    {monto && parseFloat(monto) > 0 && (
                      <button onClick={registrarOperacion}
                        style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #059669, #0ecb81)' : 'linear-gradient(135deg, #dc2626, #f6465d)', color: '#fff', border: 'none', padding: '13px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: `0 4px 14px ${colorOp(sig.operacion)}33` }}>
                        {sig.operacion === 'LONG' ? '🟢 Registrar LONG — Monitorear automáticamente' : '🔴 Registrar SHORT — Monitorear automáticamente'}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px' }}>
                    <div style={{ width: '24px', height: '24px', border: '2px solid #9333EA', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }}></div>
                    <div style={{ color: '#9333EA', fontSize: '12px' }}>Analizando automáticamente...</div>
                  </div>
                )}
                <div style={{ background: '#130f00', borderRadius: '7px', padding: '6px 10px', fontSize: '9px', color: '#6b5100', textAlign: 'center', border: '1px solid #f0b90b11' }}>
                  ⚠️ Análisis educativo. No es asesoría financiera.
                </div>
              </div>
            )}

            {/* POSICIONES */}
            {tabDerecha === 'posiciones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {operacionesAbiertas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                    <div style={{ color: '#848e9c', fontWeight: '600', fontSize: '12px', marginBottom: '4px' }}>Sin posiciones registradas</div>
                    <div style={{ color: '#5d6673', fontSize: '10px', marginBottom: '12px' }}>Registra una operación para monitorearla</div>
                    <button onClick={() => setTabDerecha('operar')} style={{ background: 'linear-gradient(135deg, #5B21B6, #9333EA)', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                      Ir a operar →
                    </button>
                  </div>
                ) : (
                  operacionesAbiertas.map(op => {
                    const precioActual = datos.find(d => d.simbolo === op.symbol)?.precio || 0;
                    const apalNum = parseInt(op.apalancamiento) || 10;
                    const pnl = precioActual > 0 ? (op.tipo === 'LONG'
                      ? ((precioActual - op.entrada) / op.entrada * 100 * apalNum).toFixed(2)
                      : ((op.entrada - precioActual) / op.entrada * 100 * apalNum).toFixed(2)) : '0.00';
                    const pnlUsdt = ((parseFloat(pnl) / 100) * op.monto).toFixed(2);
                    const progreso = precioActual > 0 ? (op.tipo === 'LONG'
                      ? Math.min(Math.max(((precioActual - op.entrada) / (op.take_profit - op.entrada)) * 100, 0), 100)
                      : Math.min(Math.max(((op.entrada - precioActual) / (op.entrada - op.take_profit)) * 100, 0), 100)) : 0;
                    return (
                      <div key={op.id} className="fade-down" style={{ background: '#161b22', borderRadius: '10px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8122' : '#f6465d22'}`, overflow: 'hidden' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0a1f12' : '#1f0a0a', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '13px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol}/USDT</span>
                            <div style={{ color: '#5d6673', fontSize: '9px', marginTop: '1px' }}>Desde {op.tiempo} · {op.apalancamiento}</div>
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
                              { label: 'Actual', valor: precioActual > 0 ? `$${precioActual.toLocaleString()}` : '...', color: '#fff' },
                              { label: 'Margen', valor: `$${op.monto}`, color: '#F3BA2F' },
                            ].map(item => (
                              <div key={item.label} style={{ background: '#0b0e11', borderRadius: '5px', padding: '5px 6px', textAlign: 'center' }}>
                                <div style={{ color: '#5d6673', fontSize: '8px', marginBottom: '1px' }}>{item.label}</div>
                                <div style={{ color: item.color, fontWeight: '600', fontSize: '10px' }}>{item.valor}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#f6465d', fontSize: '9px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                            <span style={{ color: '#848e9c', fontSize: '9px' }}>{precioActual > 0 ? `$${precioActual.toLocaleString()}` : '...'}</span>
                            <span style={{ color: '#0ecb81', fontSize: '9px' }}>TP ${op.take_profit.toLocaleString()}</span>
                          </div>
                          <div style={{ background: '#0b0e11', borderRadius: '3px', height: '5px' }}>
                            <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '5px', borderRadius: '3px', width: `${progreso}%`, transition: 'width 0.5s' }}></div>
                          </div>
                          <div style={{ color: '#5d6673', fontSize: '9px', textAlign: 'center' }}>{progreso.toFixed(1)}% hacia el objetivo</div>
                          <button onClick={() => cerrarOperacion(op.id)}
                            style={{ width: '100%', background: 'none', border: '1px solid #f6465d22', borderRadius: '7px', padding: '8px', color: '#f6465d', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
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