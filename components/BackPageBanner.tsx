import Image from 'next/image';
import BackPageMark from '@/components/BackPageMark';
import IntroSplash from '@/components/IntroSplash';
import ReplayIntroButton from '@/components/ReplayIntroButton';
import ShrinkingBanner from '@/components/ShrinkingBanner';

// Hub masthead: the goal photo with the lettering. The data-intro-* attributes are where the
// intro animation lands.
export default function BackPageBanner() {
  return (
    <>
      <ShrinkingBanner className="h-32 sm:h-40 lg:h-44">
        <div className="relative h-full rounded-sm overflow-hidden border border-line">
          <Image data-intro-photo src="/brand/the-back-page-blank.jpg" alt="" fill priority sizes="(min-width: 1280px) 1216px, 100vw" className="object-cover object-[25%_50%] sm:object-[70%_50%]" />
          <div className="absolute inset-0 flex items-center pl-5 sm:pl-8 lg:pl-12">
            <div data-intro-lettering className="h-[74%]">
              <BackPageMark id="banner" />
            </div>
          </div>
          <ReplayIntroButton />
        </div>
      </ShrinkingBanner>
      <IntroSplash />
    </>
  );
}
