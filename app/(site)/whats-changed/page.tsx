import { cacheLife, cacheTag } from 'next/cache';
import { Suspense } from 'react';
import { createPublicClient } from '@/utils/supabase/public';
import { SITE_DATA_TAG } from '@/lib/site-cache';
import PageHeader from '@/components/PageHeader';
import RichText from '@/components/RichText';
import { FeedbackPrompt } from '@/components/Feedback';
import { WHATS_CHANGED } from '@/lib/site-pages';

export const metadata = { title: "What's changed · ITF Fantasy Football" };

export default function WhatsChangedPage() {
  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-8 font-sans">
      <Suspense fallback={<PageHeader title="What's changed" pending />}>
        <WhatsChangedContent />
      </Suspense>
    </div>
  );
}

async function WhatsChangedContent() {
  'use cache';
  cacheTag(SITE_DATA_TAG);
  cacheLife('league');
  const { data } = await createPublicClient()
    .from('page_content')
    .select('content, updated_at')
    .eq('id', WHATS_CHANGED.id)
    .eq('gw_number', WHATS_CHANGED.gw_number)
    .maybeSingle();
  const updated = data?.updated_at
    ? new Date(data.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })
    : null;

  return (
    <PageHeader title="What's changed">
      {updated && <p className="-mt-2 text-sm text-dim">Last updated {updated}</p>}
      <article className="max-w-[34rem] border-t border-line pt-5 mt-5 text-[15px] leading-relaxed text-ink-2">
        {data?.content ? <RichText content={data.content} /> : <p className="text-dim">Nothing here yet.</p>}
        <FeedbackPrompt>Spotted something broken, or got an idea?</FeedbackPrompt>
      </article>
    </PageHeader>
  );
}
