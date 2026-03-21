import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function GET() {
  const coins = [
    { symbol: "BTC", price: 64500, rsi: 34, macd: "alcista", volumen: "alto" },
    { symbol: "ETH", price: 3200, rsi: 78, macd: "bajista", volumen: "medio" },
    { symbol: "SOL", price: 151, rsi: 52, macd: "neutral", volumen: "bajo" },
    { symbol: "BNB", price: 641, rsi: 61, macd: "alcista", volumen: "medio" },
    { symbol: "XRP", price: 1.44, rsi: 50, macd: "neutral", volumen: "alto" },
  ];

  const signals = [];

  for (const coin of coins) {
    const chat = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Analiza: ${coin.symbol}, precio $${coin.price}, RSI ${coin.rsi}, MACD ${coin.macd}. Responde en español en 2 oraciones. Empieza con COMPRAR, VENDER o ESPERAR.`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 100,
    });

    signals.push({
      symbol: coin.symbol,
      price: coin.price,
      rsi: coin.rsi,
      signal: chat.choices[0].message.content,
    });
  }

  return Response.json({ signals });
}