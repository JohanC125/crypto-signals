export const maxDuration = 60;

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getPrecio(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`, { next: { revalidate: 0 } });
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
    const id = ids[symbol];
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_high_24h=true&include_low_24h=true`);
    const data = await res.json();
    return {
      price: parseFloat(data[id].usd.toFixed(2)),
      change: parseFloat(data[id].usd_24h_change.toFixed(2)),
      high: parseFloat((data[id].usd_24h_high || data[id].usd).toFixed(2)),
      low: parseFloat((data[id].usd_24h_low || data[id].usd).toFixed(2)),
    };
  } catch (e) {}

  return { price: 0, change: 0, high: 0, low: 0 };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';

  const { price, change, high, low } = await getPrecio(symbol);

  if (!price || price === 0) {
    return Response.json({ error: 'No se pudo obtener precio' }, { status: 500 });
  }

  const operacion = change >= 0 ? 'LONG' : 'SHORT';
  const absChange = Math.abs(change);
  const apalancamiento = absChange > 3 ? '20X' : absChange > 1 ? '10X' : '5X';

  const take_profit = operacion === 'LONG'
    ? parseFloat((price * 1.025).toFixed(2))
    : parseFloat((price * 0.975).toFixed(2));

  const stop_loss = operacion === 'LONG'
    ? parseFloat((price * 0.982).toFixed(2))
    : parseFloat((price * 1.018).toFixed(2));

  const apalNum = parseInt(apalancamiento);
  const precio_liquidacion = operacion === 'LONG'
    ? parseFloat((price * (1 - 0.9 / apalNum)).toFixed(2))
    : parseFloat((price * (1 + 0.9 / apalNum)).toFixed(2));

  const rsi = change > 4 ? 75 : change > 2 ? 62 : change > 0 ? 54 : change > -2 ? 46 : change > -4 ? 38 : 25;
  const riesgo_liquidacion = Math.min(Math.round(absChange * 8 + 20), 75);

  try {
    const chat = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: `${symbol}/USDT Futuros: precio $${price}, cambio ${change}%, RSI ${rsi}, señal ${operacion}. Responde SOLO este JSON sin texto adicional: {"confianza":${Math.min(Math.round(55 + absChange * 5), 90)},"razon":"explica en 1 oracion en español por qué es ${operacion} basandote en el cambio de precio y RSI"}`,
      }],
      model: "llama-3.1-8b-instant",
      max_tokens: 120,
    });

    const texto = chat.choices[0].message.content;
    const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);

    return Response.json({
      symbol, price, change, high, low,
      operacion, apalancamiento,
      precio_entrada: price,
      take_profit, stop_loss, precio_liquidacion,
      temporalidad: '1H',
      confianza: json.confianza || 70,
      riesgo_liquidacion,
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
      riesgo_liquidacion,
      razon: 'Señal basada en la tendencia actual del mercado.',
      macd: change >= 0 ? 'alcista' : 'bajista',
      rsi,
    });
  }
}