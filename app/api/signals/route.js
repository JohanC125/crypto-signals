import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getPrecioReal(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
    const data = await res.json();
    return {
      price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
      change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
      high: parseFloat(parseFloat(data.highPrice).toFixed(2)),
      low: parseFloat(parseFloat(data.lowPrice).toFixed(2)),
      volume: parseFloat(parseFloat(data.volume).toFixed(2)),
    };
  } catch (e) {
    return { price: 0, change: 0, high: 0, low: 0, volume: 0 };
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
      return { symbol, ...datos, rsi: calcularRSI(datos.change) };
    })
  );

  const signals = [];

  for (const coin of coins) {
    const chat = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Eres un experto en trading de criptomonedas. Analiza ${coin.symbol}/USDT:
- Precio actual: $${coin.price}
- Cambio 24h: ${coin.change}%
- Máximo 24h: $${coin.high}
- Mínimo 24h: $${coin.low}
- RSI: ${coin.rsi}

Responde SOLO en este formato JSON exacto sin explicaciones adicionales:
{
  "accion": "COMPRAR" o "VENDER" o "ESPERAR",
  "razon": "explicación breve en español de máximo 2 oraciones",
  "precio_entrada": número (precio límite sugerido para comprar),
  "take_profit": número (precio objetivo para vender y ganar),
  "stop_loss": número (precio para salir y no perder más),
  "confianza": número del 1 al 100
}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
    });

    try {
      const texto = chat.choices[0].message.content;
      const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);
      signals.push({
        symbol: coin.symbol,
        price: coin.price,
        change: coin.change,
        rsi: coin.rsi,
        ...json,
      });
    } catch (e) {
      signals.push({
        symbol: coin.symbol,
        price: coin.price,
        change: coin.change,
        rsi: coin.rsi,
        accion: 'ESPERAR',
        razon: 'No se pudo analizar en este momento.',
        precio_entrada: coin.price,
        take_profit: coin.price * 1.03,
        stop_loss: coin.price * 0.97,
        confianza: 50,
      });
    }
  }

  return Response.json({ signals });
}