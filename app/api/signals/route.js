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
    };
  } catch (e) {
    return { price: 0, change: 0, high: 0, low: 0 };
  }
}

export async function GET() {
  const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

  const coins = await Promise.all(
    symbols.map(async (symbol) => {
      const datos = await getPrecioReal(symbol);
      return { symbol, ...datos };
    })
  );

  const signals = [];

  for (const coin of coins) {
    const chat = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Eres un experto en trading. Analiza ${coin.symbol}/USDT:
- Precio actual: $${coin.price}
- Cambio 24h: ${coin.change}%
- Máximo 24h: $${coin.high}
- Mínimo 24h: $${coin.low}

Responde SOLO en este formato JSON sin texto adicional:
{
  "operacion": "LONG" o "SHORT",
  "temporalidad": "1H" o "4H" o "1D",
  "precio_entrada": número,
  "take_profit": número,
  "stop_loss": número,
  "apalancamiento": "5X" o "10X" o "20X",
  "riesgo_liquidacion": número del 1 al 100,
  "confianza": número del 1 al 100,
  "razon": "explicación breve en español de máximo 2 oraciones"
}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 250,
    });

    try {
      const texto = chat.choices[0].message.content;
      const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);
      signals.push({
        symbol: coin.symbol,
        price: coin.price,
        change: coin.change,
        ...json,
      });
    } catch (e) {
      signals.push({
        symbol: coin.symbol,
        price: coin.price,
        change: coin.change,
        operacion: 'LONG',
        temporalidad: '1H',
        precio_entrada: coin.price,
        take_profit: parseFloat((coin.price * 1.03).toFixed(2)),
        stop_loss: parseFloat((coin.price * 0.97).toFixed(2)),
        apalancamiento: '10X',
        riesgo_liquidacion: 30,
        confianza: 50,
        razon: 'No se pudo analizar en este momento.',
      });
    }
  }

  return Response.json({ signals });
}