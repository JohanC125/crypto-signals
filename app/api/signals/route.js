
export const maxDuration = 60;

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function calcularRSIReal(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=15`);
    const velas = await res.json();
    const cierres = velas.map(v => parseFloat(v[4]));
    let ganancias = 0, perdidas = 0;
    for (let i = 1; i < cierres.length; i++) {
      const diff = cierres[i] - cierres[i - 1];
      if (diff > 0) ganancias += diff;
      else perdidas += Math.abs(diff);
    }
    const periodos = cierres.length - 1;
    const avgGanancia = ganancias / periodos;
    const avgPerdida = perdidas / periodos;
    if (avgPerdida === 0) return 100;
    const rs = avgGanancia / avgPerdida;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(2));
  } catch (e) { return 50; }
}

async function calcularMACD(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=35`);
    const velas = await res.json();
    const cierres = velas.map(v => parseFloat(v[4]));
    const ema = (datos, periodo) => {
      const k = 2 / (periodo + 1);
      let emaVal = datos[0];
      for (let i = 1; i < datos.length; i++) emaVal = datos[i] * k + emaVal * (1 - k);
      return emaVal;
    };
    return ema(cierres, 12) - ema(cierres, 26) > 0 ? 'alcista' : 'bajista';
  } catch (e) { return 'neutral'; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';

  const [tickerRes, rsi, macd] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`).then(r => r.json()),
    calcularRSIReal(symbol),
    calcularMACD(symbol),
  ]);

  const price = parseFloat(parseFloat(tickerRes.lastPrice).toFixed(2));
  const change = parseFloat(parseFloat(tickerRes.priceChangePercent).toFixed(2));
  const high = parseFloat(parseFloat(tickerRes.highPrice).toFixed(2));
  const low = parseFloat(parseFloat(tickerRes.lowPrice).toFixed(2));

  const operacion = (rsi < 50 && macd === 'bajista') ? 'SHORT' : 'LONG';
  const take_profit = operacion === 'LONG'
    ? parseFloat((price * 1.025).toFixed(2))
    : parseFloat((price * 0.975).toFixed(2));
  const stop_loss = operacion === 'LONG'
    ? parseFloat((price * 0.98).toFixed(2))
    : parseFloat((price * 1.02).toFixed(2));

  const chat = await groq.chat.completions.create({
    messages: [{
      role: "user",
      content: `Analiza ${symbol}/USDT: precio $${price}, cambio ${change}%, RSI ${rsi}, MACD ${macd}, max $${high}, min $${low}. La operacion es ${operacion}. Explica en 2 oraciones en español por qué es ${operacion} mencionando RSI y MACD. Solo devuelve el JSON: {"confianza": número 1-100, "apalancamiento": "5X" o "10X", "riesgo_liquidacion": número 1-100, "temporalidad": "1H" o "4H", "razon": "texto"}`,
    }],
    model: "llama-3.3-70b-versatile",
    max_tokens: 150,
  });

  try {
    const texto = chat.choices[0].message.content;
    const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);
    return Response.json({
      symbol,
      price,
      change,
      rsi,
      macd,
      operacion,
      precio_entrada: price,
      take_profit,
      stop_loss,
      confianza: json.confianza || 65,
      apalancamiento: json.apalancamiento || '5X',
      riesgo_liquidacion: json.riesgo_liquidacion || 30,
      temporalidad: json.temporalidad || '1H',
      razon: json.razon || 'Señal basada en indicadores técnicos.',
    });
  } catch (e) {
    return Response.json({
      symbol, price, change, rsi, macd,
      operacion,
      precio_entrada: price,
      take_profit,
      stop_loss,
      confianza: 60,
      apalancamiento: '5X',
      riesgo_liquidacion: 30,
      temporalidad: '1H',
      razon: 'Señal basada en RSI y MACD actuales.',
    });
  }
}