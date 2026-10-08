import DivisionPage from '@/components/DivisionPage';

export default function Page({ searchParams }: { searchParams: Promise<{ gw?: string }> }) {
  return <DivisionPage slug="league-one" searchParams={searchParams} />;
}
