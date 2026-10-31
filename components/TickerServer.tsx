import { connection } from 'next/server';
import { getTickerData } from '@/lib/ticker-data';
import { TickerBar } from '@/components/Ticker';

export default async function TickerServer() {
  // Always built per request: it sits in the layout of every page, and during a live week its
  // scores are too short-lived to be built into each page ahead of time.
  await connection();
  const data = await getTickerData();
  return <TickerBar motm={data.motm} live={data.live} />;
}
