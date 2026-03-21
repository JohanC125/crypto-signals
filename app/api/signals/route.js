export const maxDuration = 60;

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getPrecio(symbol) {
  const urls = [
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`,
    `https://api.binance.us/api/v3/ticker/24hr?symbol=${symbol}USDT`,
  ];
  
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (data.lastPrice && parseFloat(data.lastPrice) > 0) {
        return {
          price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
          change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
        };
      }
    } catch (e) { continue; }
  }

  // Si Binance falla usar CoinGecko
  try {
    const ids = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple' };
    const id = ids[symbol];
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`);
    const data = await res.json();
    return {
      price: parseFloat(data[id].usd.toFixed(2)),
      change: parseFloat(data[id].usd_24h_change.toFixed(2)),
    };
  } catch (e) {
    return { price: 0, change: 0 };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';

  const { price, change } = await getPrecio(symbol);

  if (!price || price === 0) {
    return Response.json({ error: 'No se pudo obtener el precio' }, { status: 500 });
  }

  const operacion = change >= 0 ? 'LONG' : 'SHORT';
  const take_profit = operacion === 'LONG'
    ? parseFloat((price * 1.025).toFixed(2))
    : parseFloat((price * 0.975).toFixed(2));
  const stop_loss = operacion === 'LONG'
    ? parseFloat((price * 0.98).toFixed(2))
    : parseFloat((price * 1.02).toFixed(2));

  try {
    const chat = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: `En 1 oración explica por qué ${symbol} con precio $${price} y cambio de ${change}% en 24h sugiere ${operacion}. Solo devuelve JSON: {"confianza":75,"riesgo_liquidacion":30,"razon":"texto"}`,
      }],
      model: "llama-3.1-8b-instant",
      max_tokens: 80,
    });

    const texto = chat.choices[0].message.content;
    const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);

    return Response.json({
      symbol, price, change,
      operacion,
      precio_entrada: price,
      take_profit,
      stop_loss,
      temporalidad: '1H',
      apalancamiento: '5X',
      confianza: json.confianza || 70,
      riesgo_liquidacion: json.riesgo_liquidacion || 30,
      razon: json.razon || 'Señal basada en tendencia del mercado.',
      macd: change >= 0 ? 'alcista' : 'bajista',
      rsi: change > 2 ? 65 : change < -2 ? 35 : 50,
    });
  } catch (e) {
    return Response.json({
      symbol, price, change,
      operacion,
      precio_entrada: price,
      take_profit,
      stop_loss,
      temporalidad: '1H',
      apalancamiento: '5X',
      confianza: 65,
      riesgo_liquidacion: 30,
      razon: 'Señal basada en tendencia del mercado actual.',
      macd: change >= 0 ? 'alcista' : 'bajista',
      rsi: 50,
    });
  }
}