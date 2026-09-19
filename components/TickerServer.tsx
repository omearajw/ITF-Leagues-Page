import { getTickerData } from '@/lib/ticker-data';
import { TickerBar } from '@/components/Ticker';

export default async function TickerServer() {
  const data = await getTickerData();
  return <TickerBar motm={data.motm} live={data.live} />;
}
