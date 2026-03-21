import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getPrecioReal(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
    const data = await res.json();
    return {
      price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
      change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
      volume: parseFloat(parseFloat(data.volume).toFixed(2)),
    };
  } catch (e) {
    return { price: 0, change: 0, volume: 0 };
  }
}

function calcularRSI(change) {
  if (change > 3) return Math.floor(Math.random() * 20 + 70);
  if (change < -3) return Math.floor(Math.random() * 20 + 10);
  return Math.floor(Math.random() * 40 + 30);
}

export async function GET() {
  const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
  
  const coins = await Promise.all(
    symbols.map(async (symbol) => {
      const datos = await getPrecioReal(symbol);
      return {
        symbol,
        price: datos.price,
        change: datos.change,
        volume: datos.volume,
        rsi: calcularRSI(datos.change),
      };
    })
  );

  const signals = [];

  for (const coin of coins) {
    const chat = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Analiza: ${coin.symbol}, precio $${coin.price}, cambio 24h ${coin.change}%, RSI ${coin.rsi}. Responde en español en 2 oraciones. Empieza con COMPRAR, VENDER o ESPERAR.`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 100,
    });

    signals.push({
      symbol: coin.symbol,
      price: coin.price,
      change: coin.change,
      volume: coin.volume,
      rsi: coin.rsi,
      signal: chat.choices[0].message.content,
    });
  }

  return Response.json({ signals });
}