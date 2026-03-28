export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';

  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}USDT`);
    const data = await res.json();
    if (data.lastPrice && parseFloat(data.lastPrice) > 0) {
      return Response.json({
        price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
        change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
        high: parseFloat(parseFloat(data.highPrice).toFixed(2)),
        low: parseFloat(parseFloat(data.lowPrice).toFixed(2)),
        volume: parseFloat(parseFloat(data.volume).toFixed(2)),
      });
    }
  } catch (e) {}

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
    const data = await res.json();
    return Response.json({
      price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
      change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
      high: parseFloat(parseFloat(data.highPrice).toFixed(2)),
      low: parseFloat(parseFloat(data.lowPrice).toFixed(2)),
      volume: parseFloat(parseFloat(data.volume).toFixed(2)),
    });
  } catch (e) {
    return Response.json({ error: 'No se pudo obtener precio' }, { status: 500 });
  }
}