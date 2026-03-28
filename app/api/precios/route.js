export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTC';

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
    const data = await res.json();
    if (data.lastPrice && parseFloat(data.lastPrice) > 0) {
      return Response.json({
        price: parseFloat(parseFloat(data.lastPrice).toFixed(2)),
        change: parseFloat(parseFloat(data.priceChangePercent).toFixed(2)),
        high: parseFloat(parseFloat(data.highPrice).toFixed(2)),
        low: parseFloat(parseFloat(data.lowPrice).toFixed(2)),
        volume: parseFloat(parseFloat(data.quoteVolume).toFixed(2)),
      });
    }
  } catch (e) {}

  try {
    const ids = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple' };
    const id = ids[symbol];
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24h=true&include_low_24h=true`);
    const data = await res.json();
    return Response.json({
      price: parseFloat(data[id].usd.toFixed(2)),
      change: parseFloat(data[id].usd_24h_change.toFixed(2)),
      high: parseFloat(data[id].usd_24h_high?.toFixed(2) || data[id].usd.toFixed(2)),
      low: parseFloat(data[id].usd_24h_low?.toFixed(2) || data[id].usd.toFixed(2)),
      volume: parseFloat(data[id].usd_24h_vol?.toFixed(2) || 0),
    });
  } catch (e) {}

  return Response.json({ price: null, change: null, high: null, low: null, volume: null }, { status: 500 });
}