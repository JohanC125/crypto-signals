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
  const [tab, setTab] = useState('senal');
  const [preciosAnimados, setPreciosAnimados] = useState({});
  const [contador, setContador] = useState(300);
  const alertaId = useRef(0);
  const alertasEnviadas = useRef({});
  const notifPermiso = useRef(false);
  const opsRef = useRef([]);
  const datosRef = useRef([]);

  useEffect(() => { opsRef.current = operacionesAbiertas; }, [operacionesAbiertas]);
  useEffect(() => { datosRef.current = datos; }, [datos]);

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => { notifPermiso.current = p === 'granted'; });
    }
  }, []);

  const notificar = (titulo, cuerpo) => {
    if (notifPermiso.current) {
      try { new Notification(titulo, { body: cuerpo }); } catch (e) {}
    }
  };

  const alerta = (mensaje, tipo) => {
    const id = alertaId.current++;
    setAlertas(prev => [{ id, mensaje, tipo }, ...prev].slice(0, 5));
    setTimeout(() => setAlertas(prev => prev.filter(a => a.id !== id)), 15000);
  };

  // Fetch precios cada 5 segundos
  useEffect(() => {
    const fetchPrecios = async () => {
      try {
        const res = await Promise.all(
          MONEDAS.map(m => fetch(`/api/precios?symbol=${m.simbolo}`).then(r => r.json()).catch(() => ({})))
        );
        const nuevos = res.map((d, i) => ({
          ...MONEDAS[i],
          precio: d.price || 0,
          cambio: d.change || 0,
          high: d.high || 0,
          low: d.low || 0,
          volumen: d.volume || 0,
        }));

        setDatos(prev => {
          const anim = {};
          nuevos.forEach(m => {
            const ant = prev.find(p => p.simbolo === m.simbolo);
            if (ant && ant.precio && m.precio && ant.precio !== m.precio) {
              anim[m.simbolo] = m.precio > ant.precio ? 'up' : 'down';
            }
          });
          if (Object.keys(anim).length > 0) {
            setPreciosAnimados(anim);
            setTimeout(() => setPreciosAnimados({}), 800);
          }
          return nuevos;
        });

        setUltimaActualizacion(new Date().toLocaleTimeString());

        // Monitorear TP/SL
        nuevos.forEach(m => {
          if (!m.precio) return;
          opsRef.current.forEach(op => {
            if (op.symbol !== m.simbolo) return;
            const k = op.id;
            if (op.tipo === 'LONG') {
              if (m.precio >= op.take_profit && !alertasEnviadas.current[`${k}-tp`]) {
                alertasEnviadas.current[`${k}-tp`] = true;
                alerta(`✅ ¡CIERRA TU LONG DE ${m.simbolo}!\nPrecio $${m.precio.toLocaleString()} alcanzó TP $${op.take_profit.toLocaleString()}\n📱 Binance → Posiciones → ${m.simbolo}USDT → Cerrar`, 'tp');
                notificar(`✅ TP ALCANZADO — ${m.simbolo}`, `Cierra tu LONG. Precio: $${m.precio.toLocaleString()}`);
              }
              if (m.precio <= op.stop_loss && !alertasEnviadas.current[`${k}-sl`]) {
                alertasEnviadas.current[`${k}-sl`] = true;
                alerta(`🛑 ¡SAL DE TU LONG DE ${m.simbolo}!\nPrecio $${m.precio.toLocaleString()} tocó SL $${op.stop_loss.toLocaleString()}\n📱 Binance → Posiciones → ${m.simbolo}USDT → Cerrar`, 'sl');
                notificar(`🛑 SL ACTIVADO — ${m.simbolo}`, `Sal de tu LONG. Precio: $${m.precio.toLocaleString()}`);
              }
            } else {
              if (m.precio <= op.take_profit && !alertasEnviadas.current[`${k}-tp`]) {
                alertasEnviadas.current[`${k}-tp`] = true;
                alerta(`✅ ¡CIERRA TU SHORT DE ${m.simbolo}!\nPrecio $${m.precio.toLocaleString()} alcanzó TP $${op.take_profit.toLocaleString()}\n📱 Binance → Posiciones → ${m.simbolo}USDT → Cerrar`, 'tp');
                notificar(`✅ TP ALCANZADO — ${m.simbolo}`, `Cierra tu SHORT. Precio: $${m.precio.toLocaleString()}`);
              }
              if (m.precio >= op.stop_loss && !alertasEnviadas.current[`${k}-sl`]) {
                alertasEnviadas.current[`${k}-sl`] = true;
                alerta(`🛑 ¡CIERRA TU SHORT DE ${m.simbolo}!\nPrecio $${m.precio.toLocaleString()} tocó SL $${op.stop_loss.toLocaleString()}\n📱 Binance → Posiciones → ${m.simbolo}USDT → Cerrar`, 'sl');
                notificar(`🛑 SL ACTIVADO — ${m.simbolo}`, `Sal de tu SHORT. Precio: $${m.precio.toLocaleString()}`);
              }
            }
          });
        });
      } catch (e) { console.error(e); }
    };
    fetchPrecios();
    const iv = setInterval(fetchPrecios, 5000);
    return () => clearInterval(iv);
  }, []);

  // Auto-analizar
  const analizarTodas = async () => {
    if (analizando) return;
    setAnalizando(true);
    setContador(300);
    for (const m of MONEDAS) {
      try {
        const res = await fetch(`/api/signals?symbol=${m.simbolo}`);
        const data = await res.json();
        if (data?.precio_entrada) setSenales(prev => ({ ...prev, [m.simbolo]: data }));
      } catch (e) { console.error(e); }
    }
    setAnalizando(false);
  };

  useEffect(() => {
    analizarTodas();
    const iv = setInterval(analizarTodas, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setContador(prev => {
        if (prev <= 1) { analizarTodas(); return 300; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const registrar = () => {
    const sig = senales[monedaSeleccionada];
    if (!sig || !monto || parseFloat(monto) <= 0) return;
    const op = {
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
    setOperacionesAbiertas(prev => [...prev, op]);
    alerta(`📝 ${sig.operacion} ${monedaSeleccionada} registrado\nTP: $${sig.take_profit.toLocaleString()} · SL: $${sig.stop_loss.toLocaleString()}\nTe avisaré automáticamente cuando cerrar`, 'info');
    setTab('posiciones');
    setMonto('');
  };

  const cerrar = (id) => {
    const op = opsRef.current.find(o => o.id === id);
    const precio = datosRef.current.find(d => d.simbolo === op?.symbol)?.precio || 0;
    if (op) {
      alerta(`🔒 INSTRUCCIONES DE CIERRE — ${op.tipo} ${op.symbol}\nPrecio actual: $${precio.toLocaleString()}\n\n1. Binance → Futuros → Posiciones\n2. Busca ${op.symbol}USDT\n3. Clic en "Cerrar todo"\n4. Selecciona mercado → Confirma`, 'info');
    }
    setOperacionesAbiertas(prev => prev.filter(o => o.id !== id));
    delete alertasEnviadas.current[`${id}-tp`];
    delete alertasEnviadas.current[`${id}-sl`];
  };

  const sig = senales[monedaSeleccionada];
  const monedaActual = datos.find(m => m.simbolo === monedaSeleccionada);
  const colorOp = (op) => op === 'LONG' ? '#0ecb81' : '#f6465d';
  const bgOp = (op) => op === 'LONG' ? '#071a10' : '#1a0707';
  const mins = Math.floor(contador / 60);
  const secs = contador % 60;

  const StatCard = ({ label, valor, color }) => (
    <div style={{ background: '#0f1318', borderRadius: '6px', padding: '7px 8px', border: '1px solid #1a1f28', textAlign: 'center' }}>
      <div style={{ color: '#3d4450', fontSize: '8px', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ color: color || '#c0c6cf', fontWeight: '700', fontSize: '12px' }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ background: '#070a0e', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeSlide { from{opacity:0;transform:translateY(-6px);} to{opacity:1;transform:translateY(0);} }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes spin { to{transform:rotate(360deg);} }
        @keyframes flashGreen { 0%{box-shadow:0 0 0 0 #0ecb8144;} 100%{box-shadow:0 0 0 6px transparent;} }
        @keyframes flashRed { 0%{box-shadow:0 0 0 0 #f6465d44;} 100%{box-shadow:0 0 0 6px transparent;} }
        .anim-in{animation:fadeSlide 0.25s ease;}
        .flash-g{animation:flashGreen 0.8s ease;}
        .flash-r{animation:flashRed 0.8s ease;}
        ::-webkit-scrollbar{width:2px;height:2px;}
        ::-webkit-scrollbar-thumb{background:#1e2329;border-radius:2px;}
        input::placeholder{color:#2a2f38;}
        *{box-sizing:border-box;}
      `}</style>

      {/* Alertas flotantes */}
      <div style={{ position: 'fixed', top: '60px', right: '12px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '300px' }}>
        {alertas.map(a => (
          <div key={a.id} onClick={() => setAlertas(prev => prev.filter(x => x.id !== a.id))}
            className="anim-in"
            style={{
              background: a.tipo === 'tp' ? '#061510' : a.tipo === 'sl' ? '#150606' : '#0c1018',
              border: `1px solid ${a.tipo === 'tp' ? '#0ecb8166' : a.tipo === 'sl' ? '#f6465d66' : '#9333EA66'}`,
              borderLeft: `3px solid ${a.tipo === 'tp' ? '#0ecb81' : a.tipo === 'sl' ? '#f6465d' : '#9333EA'}`,
              borderRadius: '8px', padding: '10px 12px', color: '#c0c6cf', fontSize: '11px',
              lineHeight: '1.6', cursor: 'pointer', whiteSpace: 'pre-line',
              boxShadow: `0 4px 20px ${a.tipo === 'tp' ? '#0ecb8122' : a.tipo === 'sl' ? '#f6465d22' : '#00000066'}`
            }}>
            {a.mensaje}
            <div style={{ color: '#2a2f38', fontSize: '9px', marginTop: '3px' }}>Toca para cerrar</div>
          </div>
        ))}
      </div>

      {/* Navbar */}
      <nav style={{ background: '#0b0e13', borderBottom: '1px solid #141820', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #4C1D95, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px #7C3AED33' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: '11px', color: '#E9D5FF' }}>JC</span>
          </div>
          <div>
            <div style={{ color: '#E9D5FF', fontWeight: '700', fontSize: '13px', lineHeight: 1 }}>JACJ <span style={{ color: '#7C3AED' }}>Signals</span></div>
            <div style={{ color: '#3d3560', fontSize: '8px', letterSpacing: '0.8px' }}>FUTUROS · by Johan Caro</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {analizando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#1a0f2e', border: '1px solid #4C1D9544', borderRadius: '6px', padding: '3px 8px' }}>
              <div style={{ width: '7px', height: '7px', border: '1.5px solid #7C3AED', borderTop: '1.5px solid transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}></div>
              <span style={{ color: '#7C3AED', fontSize: '10px', fontWeight: '600' }}>Analizando...</span>
            </div>
          ) : (
            <div style={{ background: '#0e1116', border: '1px solid #141820', borderRadius: '6px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#2a2f38', fontSize: '9px' }}>Próximo</span>
              <span style={{ color: '#7C3AED', fontSize: '10px', fontWeight: '700' }}>{mins}:{secs.toString().padStart(2, '0')}</span>
            </div>
          )}
          {operacionesAbiertas.length > 0 && (
            <div onClick={() => setTab('posiciones')}
              style={{ background: '#1a1200', border: '1px solid #f0b90b33', borderRadius: '6px', padding: '3px 8px', color: '#f0b90b', fontSize: '10px', fontWeight: '700', cursor: 'pointer', animation: 'blink 2s infinite' }}>
              {operacionesAbiertas.length} pos. activa{operacionesAbiertas.length > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '5px', height: '5px', background: '#0ecb81', borderRadius: '50%', animation: 'blink 2s infinite' }}></div>
            <span style={{ color: '#1e2329', fontSize: '10px' }}>{ultimaActualizacion}</span>
          </div>
        </div>
      </nav>

      {/* Barra monedas */}
      <div style={{ background: '#0b0e13', borderBottom: '1px solid #141820', padding: '0 16px', display: 'flex', overflowX: 'auto', gap: '2px' }}>
        {datos.map(m => {
          const s = senales[m.simbolo];
          const op = operacionesAbiertas.find(o => o.symbol === m.simbolo);
          const sel = monedaSeleccionada === m.simbolo;
          const anim = preciosAnimados[m.simbolo];
          return (
            <button key={m.simbolo} onClick={() => setMonedaSeleccionada(m.simbolo)}
              className={anim === 'up' ? 'flash-g' : anim === 'down' ? 'flash-r' : ''}
              style={{ background: sel ? '#0e1218' : 'none', border: 'none', borderBottom: `2px solid ${sel ? m.color : 'transparent'}`, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', borderRadius: sel ? '4px 4px 0 0' : '0', transition: 'all 0.15s' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: m.color + '18', border: `1px solid ${m.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: '700', color: m.color }}>{m.icono}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ color: sel ? '#e0e4ec' : '#4a5260', fontSize: '11px', fontWeight: '600' }}>{m.simbolo}</span>
                  {s && <span style={{ background: colorOp(s.operacion) + '18', color: colorOp(s.operacion), padding: '0px 3px', borderRadius: '2px', fontSize: '7px', fontWeight: '700' }}>{s.operacion}</span>}
                  {op && <div style={{ width: '4px', height: '4px', background: '#f0b90b', borderRadius: '50%', animation: 'blink 1.5s infinite' }}></div>}
                </div>
                <div style={{ fontSize: '9px', color: m.cambio >= 0 ? '#0ecb81' : '#f6465d' }}>
                  {m.precio > 0 ? `$${m.precio.toLocaleString()}` : '—'} <span style={{ opacity: 0.6 }}>{m.cambio > 0 ? '+' : ''}{m.cambio}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Layout principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 370px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* IZQUIERDA — gráfico */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #141820', overflow: 'hidden' }}>

          {/* Info precio */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #141820', background: '#0b0e13', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: monedaActual?.color + '18', border: `1px solid ${monedaActual?.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: monedaActual?.color, fontWeight: '700' }}>{monedaActual?.icono}</div>
                <span style={{ color: '#c0c6cf', fontWeight: '700', fontSize: '12px' }}>{monedaSeleccionada}/USDT Perp</span>
                {sig && <span style={{ background: colorOp(sig.operacion) + '18', color: colorOp(sig.operacion), padding: '1px 5px', borderRadius: '3px', fontSize: '8px', fontWeight: '700', border: `1px solid ${colorOp(sig.operacion)}22` }}>{sig.operacion}</span>}
              </div>
              <div className={preciosAnimados[monedaSeleccionada] ? (preciosAnimados[monedaSeleccionada] === 'up' ? 'flash-g' : 'flash-r') : ''}
                style={{ color: '#e0e4ec', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                {monedaActual?.precio > 0 ? `$${monedaActual.precio.toLocaleString()}` : <span style={{ color: '#2a2f38' }}>Cargando...</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { label: '24h', valor: `${monedaActual?.cambio > 0 ? '+' : ''}${monedaActual?.cambio || 0}%`, color: (monedaActual?.cambio || 0) >= 0 ? '#0ecb81' : '#f6465d' },
                { label: 'Máx', valor: monedaActual?.high > 0 ? `$${monedaActual.high.toLocaleString()}` : '—', color: '#0ecb81' },
                { label: 'Mín', valor: monedaActual?.low > 0 ? `$${monedaActual.low.toLocaleString()}` : '—', color: '#f6465d' },
                ...(sig ? [
                  { label: 'RSI', valor: String(sig.rsi), color: sig.rsi < 35 ? '#0ecb81' : sig.rsi > 65 ? '#f6465d' : '#7a8490' },
                  { label: 'MACD', valor: sig.macd === 'alcista' ? '↑ ALC' : '↓ BAJ', color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d' },
                  { label: 'Confianza', valor: `${sig.confianza}%`, color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b' },
                ] : []),
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: '#1e2329', fontSize: '7px', marginBottom: '1px', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ color: item.color, fontWeight: '600', fontSize: '11px' }}>{item.valor}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Grafico simbolo={monedaSeleccionada} />
          </div>

          {/* Posiciones mini */}
          {operacionesAbiertas.length > 0 && (
            <div style={{ borderTop: '1px solid #141820', background: '#090c10', padding: '6px 14px', maxHeight: '140px', overflow: 'auto' }}>
              <div style={{ color: '#f0b90b', fontSize: '8px', fontWeight: '700', marginBottom: '5px', letterSpacing: '0.5px' }}>⚡ MONITOREANDO EN TIEMPO REAL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {operacionesAbiertas.map(op => {
                  const precio = datos.find(d => d.simbolo === op.symbol)?.precio || 0;
                  const apalNum = parseInt(op.apalancamiento) || 10;
                  const pnl = precio > 0 ? (op.tipo === 'LONG'
                    ? ((precio - op.entrada) / op.entrada * 100 * apalNum).toFixed(2)
                    : ((op.entrada - precio) / op.entrada * 100 * apalNum).toFixed(2)) : '0.00';
                  const prog = precio > 0 ? (op.tipo === 'LONG'
                    ? Math.min(Math.max(((precio - op.entrada) / (op.take_profit - op.entrada)) * 100, 0), 100)
                    : Math.min(Math.max(((op.entrada - precio) / (op.entrada - op.take_profit)) * 100, 0), 100)) : 0;
                  return (
                    <div key={op.id} style={{ background: '#0e1218', borderRadius: '5px', padding: '6px 10px', border: `1px solid ${parseFloat(pnl) >= 0 ? '#0ecb8118' : '#f6465d18'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ color: colorOp(op.tipo), fontSize: '10px', fontWeight: '700' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol} · {op.apalancamiento}</span>
                        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                          <span style={{ color: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: '700', fontSize: '11px' }}>{parseFloat(pnl) >= 0 ? '+' : ''}{pnl}%</span>
                          <button onClick={() => cerrar(op.id)} style={{ background: 'none', border: '1px solid #f6465d22', borderRadius: '3px', padding: '1px 5px', color: '#f6465d', fontSize: '8px', cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ color: '#f6465d', fontSize: '7px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                        <span style={{ color: '#4a5260', fontSize: '7px' }}>{precio > 0 ? `$${precio.toLocaleString()}` : '...'}</span>
                        <span style={{ color: '#0ecb81', fontSize: '7px' }}>TP ${op.take_profit.toLocaleString()}</span>
                      </div>
                      <div style={{ background: '#060809', borderRadius: '2px', height: '2px' }}>
                        <div style={{ background: parseFloat(pnl) >= 0 ? '#0ecb81' : '#f6465d', height: '2px', borderRadius: '2px', width: `${prog}%`, transition: 'width 0.5s' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* DERECHA — panel */}
        <div style={{ background: '#0b0e13', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #141820', background: '#090c10' }}>
            {[
              { id: 'senal', label: '⚡ Señal' },
              { id: 'operar', label: '📋 Operar' },
              { id: 'posiciones', label: operacionesAbiertas.length > 0 ? `📊 (${operacionesAbiertas.length})` : '📊 Posiciones' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #7C3AED' : '2px solid transparent', color: tab === t.id ? '#A78BFA' : '#2a2f38', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* === TAB SEÑAL === */}
            {tab === 'senal' && (
              <>
                {analizando && !sig ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ width: '26px', height: '26px', border: '2px solid #7C3AED', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
                    <div style={{ color: '#7C3AED', fontSize: '12px', fontWeight: '600' }}>Analizando mercado...</div>
                    <div style={{ color: '#1e2329', fontSize: '10px', marginTop: '4px' }}>Automático — sin tocar nada</div>
                  </div>
                ) : sig ? (
                  <>
                    {/* Badge señal */}
                    <div className="anim-in" style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}33`, borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ color: colorOp(sig.operacion), fontWeight: '800', fontSize: '20px' }}>
                          {sig.operacion === 'LONG' ? '🟢' : '🔴'} {sig.operacion}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#1e2329', fontSize: '8px' }}>Confianza IA</div>
                          <div style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '800', fontSize: '24px' }}>{sig.confianza}%</div>
                        </div>
                      </div>
                      <div style={{ color: '#4a5260', fontSize: '11px', lineHeight: '1.5', borderTop: `1px solid ${colorOp(sig.operacion)}18`, paddingTop: '8px' }}>{sig.razon}</div>
                    </div>

                    {/* Indicadores */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '5px' }}>
                      {[
                        { label: 'RSI', valor: String(sig.rsi), color: sig.rsi < 35 ? '#0ecb81' : sig.rsi > 65 ? '#f6465d' : '#7a8490' },
                        { label: 'MACD', valor: sig.macd === 'alcista' ? '↑ ALC' : '↓ BAJ', color: sig.macd === 'alcista' ? '#0ecb81' : '#f6465d' },
                        { label: 'Apal.', valor: sig.apalancamiento, color: '#F3BA2F' },
                        { label: 'Riesgo', valor: `${sig.riesgo_liquidacion}%`, color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b' },
                      ].map(item => (
                        <StatCard key={item.label} {...item} />
                      ))}
                    </div>

                    {/* Precio entrada */}
                    <div style={{ background: '#0a0f18', borderRadius: '8px', padding: '10px 12px', border: '1px solid #1a2a3a' }}>
                      <div style={{ color: '#1e2329', fontSize: '8px', marginBottom: '2px', textTransform: 'uppercase' }}>📌 Precio de entrada</div>
                      <div style={{ color: '#3b82f6', fontWeight: '800', fontSize: '22px' }}>${sig.precio_entrada.toLocaleString()}</div>
                      <div style={{ color: '#1a2030', fontSize: '8px', marginTop: '1px' }}>Campo "Precio" → Limit en Binance Futuros</div>
                    </div>

                    {/* TP y SL */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                      <div style={{ background: '#040e09', borderRadius: '8px', padding: '10px', border: '1px solid #0ecb8118' }}>
                        <div style={{ color: '#1e2329', fontSize: '8px', marginBottom: '2px' }}>✅ TAKE PROFIT</div>
                        <div style={{ color: '#0ecb81', fontWeight: '700', fontSize: '15px' }}>${sig.take_profit.toLocaleString()}</div>
                        <div style={{ color: '#0a1f12', fontSize: '7px', marginTop: '1px' }}>Campo TP en Binance</div>
                      </div>
                      <div style={{ background: '#0e0404', borderRadius: '8px', padding: '10px', border: '1px solid #f6465d18' }}>
                        <div style={{ color: '#1e2329', fontSize: '8px', marginBottom: '2px' }}>🛑 STOP LOSS</div>
                        <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '15px' }}>${sig.stop_loss.toLocaleString()}</div>
                        <div style={{ color: '#1f0a0a', fontSize: '7px', marginTop: '1px' }}>Campo SL en Binance</div>
                      </div>
                    </div>

                    {/* Liquidación */}
                    <div style={{ background: '#0a0f18', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f6465d18', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#1e2329', fontSize: '8px', marginBottom: '2px' }}>☠️ Precio de liquidación</div>
                        <div style={{ color: '#f6465d', fontWeight: '700', fontSize: '15px' }}>${sig.precio_liquidacion?.toLocaleString()}</div>
                        <div style={{ color: '#1e1010', fontSize: '7px' }}>Evita llegar aquí</div>
                      </div>
                      <div style={{ textAlign: 'center', background: '#0e0a04', borderRadius: '6px', padding: '6px 10px', border: '1px solid #f0b90b18' }}>
                        <div style={{ color: '#1e1a04', fontSize: '7px' }}>Riesgo</div>
                        <div style={{ color: sig.riesgo_liquidacion > 50 ? '#f6465d' : '#f0b90b', fontWeight: '800', fontSize: '17px' }}>{sig.riesgo_liquidacion}%</div>
                      </div>
                    </div>

                    <button onClick={() => setTab('operar')}
                      style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #064e2f, #0ecb81)' : 'linear-gradient(135deg, #4e0606, #f6465d)', color: '#fff', border: 'none', padding: '11px', borderRadius: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.3px' }}>
                      {sig.operacion === 'LONG' ? '🟢 Quiero operar este LONG →' : '🔴 Quiero operar este SHORT →'}
                    </button>
                  </>
                ) : null}
              </>
            )}

            {/* === TAB OPERAR === */}
            {tab === 'operar' && (
              <>
                {sig ? (
                  <>
                    <div style={{ background: bgOp(sig.operacion), border: `1px solid ${colorOp(sig.operacion)}22`, borderRadius: '8px', padding: '9px 12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: colorOp(sig.operacion), fontWeight: '700', fontSize: '12px' }}>{sig.operacion === 'LONG' ? '🟢 LONG' : '🔴 SHORT'} — {monedaSeleccionada}/USDT</span>
                      <span style={{ color: sig.confianza >= 70 ? '#0ecb81' : '#f0b90b', fontWeight: '700', fontSize: '12px' }}>{sig.confianza}%</span>
                    </div>

                    {/* Guía pasos */}
                    <div style={{ background: '#0c1018', borderRadius: '9px', padding: '12px', border: '1px solid #141820' }}>
                      <div style={{ color: '#7C3AED', fontSize: '9px', fontWeight: '700', marginBottom: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>📋 Pasos en Binance Futuros</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {[
                          { n: '1', texto: `Binance → Futuros → ${monedaSeleccionada}USDT Perpetuo`, color: '#3b82f6' },
                          { n: '2', texto: `Ajusta el apalancamiento a ${sig.apalancamiento}`, color: '#F3BA2F' },
                          { n: '3', texto: `Clic en ${sig.operacion === 'LONG' ? 'COMPRAR / LONG' : 'VENDER / SHORT'} → Tipo: Limit`, color: colorOp(sig.operacion) },
                          { n: '4', texto: `Precio: $${sig.precio_entrada.toLocaleString()} · Monto: lo que pongas abajo`, color: '#3b82f6' },
                          { n: '5', texto: `Activa TP: $${sig.take_profit.toLocaleString()} · SL: $${sig.stop_loss.toLocaleString()}`, color: '#0ecb81' },
                          { n: '6', texto: 'Confirma la orden, luego registra aquí — te avisamos al TP y SL', color: '#7C3AED' },
                        ].map(item => (
                          <div key={item.n} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                            <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: item.color + '18', border: `1px solid ${item.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: item.color, fontWeight: '700', flexShrink: 0, marginTop: '2px' }}>{item.n}</div>
                            <span style={{ color: '#4a5260', fontSize: '11px', lineHeight: '1.5' }}>{item.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Monto */}
                    <div>
                      <div style={{ color: '#2a2f38', fontSize: '9px', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>💵 Tu margen (cuánto pones en USDT)</div>
                      <div style={{ background: '#0c1018', border: '1px solid #1a1f28', borderRadius: '8px', padding: '9px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#2a2f38', fontSize: '14px' }}>$</span>
                        <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 10"
                          style={{ background: 'none', border: 'none', color: '#e0e4ec', fontSize: '16px', outline: 'none', flex: 1 }} />
                        <span style={{ color: '#2a2f38', fontSize: '11px' }}>USDT</span>
                      </div>
                      {monto && parseFloat(monto) > 0 && sig?.apalancamiento && (
                        <div style={{ color: '#2a2f38', fontSize: '9px', marginTop: '3px' }}>
                          Posición total: <span style={{ color: '#F3BA2F', fontWeight: '700' }}>${(parseFloat(monto) * parseInt(sig.apalancamiento)).toLocaleString()} USDT</span>
                        </div>
                      )}
                    </div>

                    {monto && parseFloat(monto) > 0 && (
                      <button onClick={registrar}
                        style={{ width: '100%', background: sig.operacion === 'LONG' ? 'linear-gradient(135deg, #064e2f, #0ecb81)' : 'linear-gradient(135deg, #4e0606, #f6465d)', color: '#fff', border: 'none', padding: '13px', borderRadius: '9px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', letterSpacing: '0.3px' }}>
                        {sig.operacion === 'LONG' ? '🟢 Registrar LONG — Monitorear automáticamente' : '🔴 Registrar SHORT — Monitorear automáticamente'}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ width: '22px', height: '22px', border: '2px solid #7C3AED', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }}></div>
                    <div style={{ color: '#7C3AED', fontSize: '12px' }}>Analizando automáticamente...</div>
                  </div>
                )}
                <div style={{ background: '#0a0800', borderRadius: '6px', padding: '6px 10px', fontSize: '9px', color: '#2a2000', textAlign: 'center', border: '1px solid #f0b90b0a', marginTop: 'auto' }}>
                  ⚠️ Análisis educativo. No es asesoría financiera.
                </div>
              </>
            )}

            {/* === TAB POSICIONES === */}
            {tab === 'posiciones' && (
              <>
                {operacionesAbiertas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                    <div style={{ color: '#4a5260', fontWeight: '600', fontSize: '12px', marginBottom: '4px' }}>Sin posiciones activas</div>
                    <div style={{ color: '#1e2329', fontSize: '10px', marginBottom: '12px' }}>Registra una operación para monitorearla en tiempo real</div>
                    <button onClick={() => setTab('operar')} style={{ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)', color: '#E9D5FF', border: 'none', padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                      Ir a operar →
                    </button>
                  </div>
                ) : (
                  operacionesAbiertas.map(op => {
                    const precio = datos.find(d => d.simbolo === op.symbol)?.precio || 0;
                    const apalNum = parseInt(op.apalancamiento) || 10;
                    const pnl = precio > 0 ? (op.tipo === 'LONG'
                      ? ((precio - op.entrada) / op.entrada * 100 * apalNum).toFixed(2)
                      : ((op.entrada - precio) / op.entrada * 100 * apalNum).toFixed(2)) : '0.00';
                    const pnlUsdt = ((parseFloat(pnl) / 100) * op.monto).toFixed(2);
                    const prog = precio > 0 ? (op.tipo === 'LONG'
                      ? Math.min(Math.max(((precio - op.entrada) / (op.take_profit - op.entrada)) * 100, 0), 100)
                      : Math.min(Math.max(((op.entrada - precio) / (op.entrada - op.take_profit)) * 100, 0), 100)) : 0;
                    const enGanancia = parseFloat(pnl) >= 0;
                    return (
                      <div key={op.id} className="anim-in" style={{ background: '#0c1018', borderRadius: '10px', border: `1px solid ${enGanancia ? '#0ecb8118' : '#f6465d18'}`, overflow: 'hidden' }}>
                        <div style={{ background: enGanancia ? '#040e09' : '#0e0404', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ color: colorOp(op.tipo), fontWeight: '700', fontSize: '13px' }}>{op.tipo === 'LONG' ? '🟢' : '🔴'} {op.tipo} {op.symbol}/USDT</div>
                            <div style={{ color: '#1e2329', fontSize: '8px', marginTop: '1px' }}>Registrado a las {op.tiempo} · {op.apalancamiento}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: enGanancia ? '#0ecb81' : '#f6465d', fontWeight: '800', fontSize: '18px' }}>{enGanancia ? '+' : ''}{pnl}%</div>
                            <div style={{ color: parseFloat(pnlUsdt) >= 0 ? '#0ecb81' : '#f6465d', fontSize: '10px' }}>{parseFloat(pnlUsdt) >= 0 ? '+' : ''}${pnlUsdt} USDT</div>
                          </div>
                        </div>
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                            <StatCard label="Entrada" valor={`$${op.entrada.toLocaleString()}`} color="#3b82f6" />
                            <StatCard label="Actual" valor={precio > 0 ? `$${precio.toLocaleString()}` : '...'} color="#e0e4ec" />
                            <StatCard label="Margen" valor={`$${op.monto}`} color="#F3BA2F" />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#f6465d', fontSize: '9px' }}>SL ${op.stop_loss.toLocaleString()}</span>
                            <span style={{ color: '#4a5260', fontSize: '9px', fontWeight: '600' }}>{precio > 0 ? `$${precio.toLocaleString()}` : '...'}</span>
                            <span style={{ color: '#0ecb81', fontSize: '9px' }}>TP ${op.take_profit.toLocaleString()}</span>
                          </div>
                          <div style={{ background: '#060809', borderRadius: '3px', height: '4px' }}>
                            <div style={{ background: enGanancia ? '#0ecb81' : '#f6465d', height: '4px', borderRadius: '3px', width: `${prog}%`, transition: 'width 0.5s' }}></div>
                          </div>
                          <div style={{ color: '#1e2329', fontSize: '8px', textAlign: 'center' }}>{prog.toFixed(1)}% hacia el objetivo</div>
                          <button onClick={() => cerrar(op.id)}
                            style={{ width: '100%', background: 'none', border: '1px solid #f6465d18', borderRadius: '7px', padding: '8px', color: '#f6465d', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                            🔒 Cerrar — Ver instrucciones paso a paso
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}