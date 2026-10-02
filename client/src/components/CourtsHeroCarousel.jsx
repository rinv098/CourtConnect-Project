import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';

// Any photo placed in src/assets/hero/ shows up in the slider automatically, in file-name order
const photos = import.meta.glob('../assets/hero/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const IMAGES = Object.keys(photos).sort().map((path) => photos[path]);
const SLIDE_MS = 5000;

function HeroText() {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-orange-400 text-xs sm:text-sm font-semibold mb-1">
        <Trophy className="h-4 w-4 shrink-0" /> BARANGAY COURTS
      </p>
      <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">SAN JUAN COURTS</h1>
      <p className="hidden sm:block text-white/70 text-sm mt-1 max-w-md">
        Pick a court, grab an open slot, and play. Taken already? Hop on the waitlist and
        we'll let you know the second it opens up.
      </p>
    </div>
  );
}

function CourtsHeroCarousel() {
  // prev = the slide that is sliding out, dir = 1 (moving forward) or -1 (moving back)
  const [state, setState] = useState({ index: 0, prev: null, dir: 1 });
  const { index, prev, dir } = state;
  const count = IMAGES.length;

  // Slides on its own every few seconds. The timer restarts after every change, including manual ones.
  useEffect(() => {
    if (count < 2) return;
    const timer = setTimeout(() => {
      setState((s) => ({ index: (s.index + 1) % count, prev: s.index, dir: 1 }));
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, count]);

  // No photos added yet: keep a compact plain banner so the page still looks right
  if (count === 0) {
    return (
      <div className="rounded-2xl overflow-hidden bg-slate-900 text-white px-8 py-5">
        <HeroText />
      </div>
    );
  }

  function goTo(next, direction) {
    if (next !== index) setState({ index: next, prev: index, dir: direction });
  }

  const slideClass = (i) => {
    if (i === index) {
      if (prev === null) return '';
      return dir === 1
        ? 'animate-in slide-in-from-right-full duration-700 ease-in-out fill-mode-both motion-reduce:animate-none'
        : 'animate-in slide-in-from-left-full duration-700 ease-in-out fill-mode-both motion-reduce:animate-none';
    }
    if (i === prev) {
      return dir === 1
        ? 'animate-out slide-out-to-left-full duration-700 ease-in-out fill-mode-forwards motion-reduce:invisible'
        : 'animate-out slide-out-to-right-full duration-700 ease-in-out fill-mode-forwards motion-reduce:invisible';
    }
    return 'invisible';
  };

  return (
    <div className="group flex rounded-2xl overflow-hidden bg-slate-900 text-white h-32 sm:h-36">
      {/* text side */}
      <div className="flex-1 min-w-0 flex items-center px-5 sm:px-8">
        <HeroText />
      </div>

      {/* photo side: a fixed frame, so photos are never stretched across the whole page */}
      <div className="relative h-full w-2/5 sm:w-72 md:w-80 shrink-0 overflow-hidden">
        {IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Barangay court photo ${i + 1}`}
            aria-hidden={i !== index}
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover ${slideClass(i)}`}
          />
        ))}

        {/* soft edge so the photo blends into the dark panel */}
        <div className="absolute inset-y-0 left-0 w-10 bg-linear-to-r from-slate-900 to-transparent pointer-events-none" />

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => goTo((index - 1 + count) % count, -1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 p-1.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => goTo((index + 1) % count, 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 p-1.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {IMAGES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  onClick={() => goTo(i, i > index ? 1 : -1)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-orange-400' : 'w-1.5 bg-white/60 hover:bg-white'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CourtsHeroCarousel;