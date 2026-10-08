import Image from 'next/image';
import BackPageMark from '@/components/BackPageMark';
import IntroSplash from '@/components/IntroSplash';
import ReplayIntroButton from '@/components/ReplayIntroButton';

// Hub masthead: the club crest beside the goal photo. Phones stack the crest underneath.
// The data-intro-* attributes are where the intro animation lands.
export default function BackPageBanner() {
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 lg:gap-6">
      <div className="order-2 sm:order-1 shrink-0 w-28 h-28 sm:w-48 sm:h-48 lg:w-64 lg:h-64">
        <Image src="/brand/itf-logo.png" alt="ITF Fantasy League crest" width={260} height={260} priority className="w-full h-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]" />
      </div>
      <div className="order-1 sm:order-2 relative w-full h-44 sm:h-48 lg:h-64 rounded-2xl overflow-hidden border border-line shadow-lg">
        <Image data-intro-photo src="/brand/the-back-page-blank.jpg" alt="" fill priority sizes="(min-width: 1280px) 1000px, (min-width: 640px) 75vw, 100vw" className="object-cover object-[25%_50%] sm:object-[70%_50%]" />
        <div className="absolute inset-0 flex items-center pl-5 sm:pl-8 lg:pl-12">
          <div data-intro-lettering>
            <BackPageMark />
          </div>
        </div>
        <ReplayIntroButton />
      </div>
      <IntroSplash />
    </div>
  );
}
