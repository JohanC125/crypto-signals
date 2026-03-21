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
    const macd = ema(cierres, 12) - ema(cierres, 26);
    return macd > 0 ? 'alcista' : 'bajista';
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
  const volume = parseFloat(parseFloat(tickerRes.quoteVolume).toFixed(0));

  const chat = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Eres un experto en trading de criptomonedas. Analiza ${symbol}/USDT:
- Precio actual: $${price}
- Cambio 24h: ${change}%
- Máximo 24h: $${high}
- Mínimo 24h: $${low}
- Volumen 24h: $${volume}
- RSI real: ${rsi}
- MACD: ${macd}

Siempre debes dar una señal LONG o SHORT basada en los indicadores.
Si RSI < 50 y MACD bajista → SHORT.
Si RSI > 50 y MACD alcista → LONG.
Si hay duda → usa el cambio 24h para decidir.

El take_profit debe ser entre 1% y 5% del precio actual.
El stop_loss debe ser entre 1% y 3% del precio actual.
El precio_entrada debe ser MUY cercano al precio actual ($${price}).

Responde SOLO en este formato JSON sin texto adicional:
{
  "operacion": "LONG" o "SHORT",
  "temporalidad": "1H" o "4H" o "1D",
  "precio_entrada": número muy cercano a ${price},
  "take_profit": número,
  "stop_loss": número,
  "apalancamiento": "5X" o "10X" o "20X",
  "riesgo_liquidacion": número del 1 al 100,
  "confianza": número del 1 al 100,
  "razon": "explicación en español de máximo 2 oraciones mencionando RSI y MACD"
}`,
      },
    ],
    model: "llama-3.3-70b-versatile",
    max_tokens: 250,
  });

  try {
    const texto = chat.choices[0].message.content;
    const json = JSON.parse(texto.match(/\{[\s\S]*\}/)[0]);
    json.precio_entrada = price;
    json.take_profit = json.operacion === 'LONG'
      ? parseFloat((price * 1.03).toFixed(2))
      : parseFloat((price * 0.97).toFixed(2));
    json.stop_loss = json.operacion === 'LONG'
      ? parseFloat((price * 0.98).toFixed(2))
      : parseFloat((price * 1.02).toFixed(2));
    return Response.json({ symbol, price, change, rsi, macd, ...json });
  } catch (e) {
    return Response.json({
      symbol, price, change, rsi, macd,
      operacion: change >= 0 ? 'LONG' : 'SHORT',
      temporalidad: '1H',
      precio_entrada: price,
      take_profit: parseFloat((price * 1.03).toFixed(2)),
      stop_loss: parseFloat((price * 0.98).toFixed(2)),
      apalancamiento: '5X',
      riesgo_liquidacion: 30,
      confianza: 55,
      razon: 'Señal basada en tendencia del mercado actual.',
    });
  }
}