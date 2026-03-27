export const maxDuration = 60;

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getPrecio(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
    const data = await res.json();
    if (data.lastPrice && parseFloat(data.lastPrice) > 0) {
      return {
        price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
        change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
        high: parseFloat(parseFloat(data.highPrice).toFixed(2)),
        low: parseFloat(parseFloat(data.lowPrice).toFixed(2)),
      };
    }
  } catch (e) {}

  try {
    const ids = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple' };
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids[symbol]}&vs_currencies=usd&include_24hr_change=true`);
    const data = await res.json();
    const id = ids[symbol];
    return {
      price: parseFloat(data[id].usd.toFixed(2)),
      change: parseFloat(data[id].usd_24h_change.toFixed(2)),
      high: parseFloat(data[id].usd.toFixed(2)),
      low: parseFloat(data[id].usd.toFixed(2)),
    };
  } catch (e) {
    return { price: 0, change: 0, high: 0, low: 0 };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';

  const { price, change, high, low } = await getPrecio(symbol);

  if (!price || price === 0) {
    return Response.json({ error: 'No se pudo obtener el precio' }, { status: 500 });
  }

  const operacion = change >= 0 ? 'LONG' : 'SHORT';
  const apalancamiento = Math.abs(change) > 3 ? '20X' : Math.abs(change) > 1 ? '10X' : '5X';
  const take_profit = operacion === 'LONG'
    ? parseFloat((price * 1.03).toFixed(2))
    : parseFloat((price * 0.97).toFixed(2));
  const stop_loss = operacion === 'LONG'
    ? parseFloat((price * 0.98).toFixed(2))
    : parseFloat((price * 1.02).toFixed(2));
  const precio_liquidacion = operacion === 'LONG'
    ? parseFloat((price * 0.95).toFixed(2))
    : parseFloat((price * 1.05).toFixed(2));
  const rsi = change > 3 ? 72 : change > 1 ? 58 : change < -3 ? 28 : change < -1 ? 42 : 50;

  try {
    const chat = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: `${symbol} $${price} cambio ${change}% operacion ${operacion}. JSON solo: {"confianza":75,"riesgo_liquidacion":30,"razon":"1 oracion en español"}`,
      }],
      model: "llama-3.1-8b-instant",
      max_tokens: 80,
    });

    const texto = chat.choices[0].message.content;
    const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);

    return Response.json({
      symbol, price, change, high, low,
      operacion, apalancamiento,
      precio_entrada: price,
      take_profit, stop_loss, precio_liquidacion,
      temporalidad: '1H',
      confianza: Math.min(Math.max(json.confianza || 70, 50), 95),
      riesgo_liquidacion: json.riesgo_liquidacion || 30,
      razon: json.razon || 'Señal basada en tendencia del mercado.',
      macd: change >= 0 ? 'alcista' : 'bajista',
      rsi,
    });
  } catch (e) {
    return Response.json({
      symbol, price, change, high, low,
      operacion, apalancamiento,
      precio_entrada: price,
      take_profit, stop_loss, precio_liquidacion,
      temporalidad: '1H',
      confianza: 65,
      riesgo_liquidacion: 30,
      razon: 'Señal basada en tendencia del mercado actual.',
      macd: change >= 0 ? 'alcista' : 'bajista',
      rsi,
    });
  }
}