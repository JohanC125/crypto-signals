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
  } catch (e) {
    return 50;
  }
}

async function calcularMACD(symbol) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=35`);
    const velas = await res.json();
    const cierres = velas.map(v => parseFloat(v[4]));

    const ema = (datos, periodo) => {
      const k = 2 / (periodo + 1);
      let emaVal = datos[0];
      for (let i = 1; i < datos.length; i++) {
        emaVal = datos[i] * k + emaVal * (1 - k);
      }
      return emaVal;
    };

    const ema12 = ema(cierres, 12);
    const ema26 = ema(cierres, 26);
    const macd = ema12 - ema26;

    return macd > 0 ? 'alcista' : 'bajista';
  } catch (e) {
    return 'neutral';
  }
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
  const volume = parseFloat(parseFloat(tickerRes.quoteVolume).toFixed(0));

  const chat = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Eres un experto en trading de criptomonedas. Analiza ${symbol}/USDT con estos datos reales:
- Precio actual: $${price}
- Cambio 24h: ${change}%
- Máximo 24h: $${high}
- Mínimo 24h: $${low}
- Volumen 24h: $${volume}
- RSI (14 periodos real): ${rsi}
- MACD: ${macd}

Con base en estos indicadores reales responde SOLO en este formato JSON sin texto adicional:
{
  "operacion": "LONG" o "SHORT",
  "temporalidad": "1H" o "4H" o "1D",
  "precio_entrada": número,
  "take_profit": número,
  "stop_loss": número,
  "apalancamiento": "5X" o "10X" o "20X",
  "riesgo_liquidacion": número del 1 al 100,
  "confianza": número del 1 al 100,
  "razon": "explicación breve en español de máximo 2 oraciones mencionando el RSI y MACD"
}`,
      },
    ],
    model: "llama-3.3-70b-versatile",
    max_tokens: 250,
  });

  const texto = chat.choices[0].message.content;
  const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);

  return Response.json({
    symbol,
    price,
    change,
    rsi,
    macd,
    ...json,
  });
}