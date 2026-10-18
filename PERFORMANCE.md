# Performance verification history

The earlier passes are retained below as historical measurements. The third pass at the end records the 18 October 2026 implementation.

# Performance verification — 2026-10-16

The first pass is recorded below. The second pass at the end describes the current implementation and its separate measurements.

Measured against the running version before this optimization, on this computer, using the production build and the same Chrome tab.

| Measurement | Before | After | Improvement |
| --- | ---: | ---: | ---: |
| Playback JavaScript execution per second | 36.5 ms | 10.4 ms | 71% less |
| JavaScript execution during 12 word selections | 430.9 ms | 188.1 ms | 56% less |
| Lesson API median | 5.10 ms | 2.08 ms | 2.5x faster |
| Dictionary API median | 0.80 ms | 0.39 ms | 2.1x faster |
| HSK 5 vocabulary API median | 9.01 ms | 0.65 ms | 13.9x faster |
| Vocabulary search API median | 26.51 ms | 0.66 ms | 40.2x faster |
| 64 KB audio range API median | 6.68 ms | 1.27 ms | 5.3x faster |

## Method

Browser measurements use Chrome DevTools `Performance.getMetrics`. Playback starts at the first word of lesson 4 (425 word buttons), with its word pop-up open. Sampling windows were 19.50 seconds before and 21.94 seconds after, so playback script cost is normalized by elapsed time. Selection measurements repeat the first three words four times; the sequence took 11.28 seconds before and 11.25 seconds after. Both include browser automation overhead and ongoing playback. These are local samples of JavaScript work, not field INP measurements or claims that every interaction is 71% faster.

API measurements use 20 warmed requests per endpoint after one excluded warm-up, consuming each response body. `node scripts/benchmark-api.mjs output/api-optimized.json` reproduces the endpoint benchmark. The audio case requests bytes 0–65535. These endpoint timings include local fetch/body handling, not audio device output latency. Browser memory hits additionally skip requests altogether. OS cache, background activity and sentence translation cache state can affect the results.

Raw measurements: `output/performance-baseline.json`, `output/performance-comparison.json`, `output/api-baseline.json`, `output/api-optimized.json`.

## Changes

- The passage is memoized separately from the clock, progress controls, translations and pop-ups. Token objects and grammar matches are prepared once for each lesson version, with one delegated click handler.
- Audio tracking uses an indexed lookup and a cancellable animation-frame loop. Only the old and new word highlights change; sentence state changes only at sentence boundaries. Paused/text-only readers have no continuous animation loop.
- The current recording preloads fully and retains its buffer and playback position when visiting the library. Versioned audio URLs allow immutable browser caching while audio replacement gets a new URL. Range requests remain supported.
- Bounded client caches coalesce concurrent lesson, dictionary and vocabulary requests. Card focus/hover and the next lesson warm lesson data. Successful edits invalidate lesson caches; processing polls bypass cached data.
- Server file snapshots validate file modification time/size. Vocabulary meanings are indexed once, and bounded response caches reuse serialized JSON, gzip and ETags. Hashed build assets have immutable caching. Original search results and page order are preserved.
- Previously translated sentences arrive with lesson data, are reused in memory, and share in-flight requests. The next sentence can warm in advance. The artificial 250 ms translation delay is removed. The existing local translation model and decoding settings are unchanged; genuinely new sentences still require inference.
- Study data writes run during idle time, with a page-hide flush. Vocabulary search uses an 80 ms typing debounce and opens without its previous 200 ms delay.

## Regression checks

All 13 Node tests pass. Tests compare indexed lookup against the previous linear lookup at token boundaries throughout all 36 recordings, preserve vocabulary search/pagination, validate response compression/ETags, and exercise request coalescing, edit invalidation and stale-response handling.

Chrome checks cover mouse/keyboard word selection, audio seeking and highlights, dictionary pop-ups, pinyin, traditional characters, passage search, desktop/mobile layout, and note autosave through reload. A temporary note was restored to its original contents. Returning through the library preserved the exact audio position (13.666133 seconds) and full buffer (208.323719 seconds). No browser console errors were observed.

Screenshots: `output/reader-performance-desktop.png`, `output/reader-performance-mobile.png`.

## Second optimization pass

This pass isolates the media clock with `useSyncExternalStore`: only the progress slider, time label and an open timing editor subscribe to clock changes. The reader and other dialogs no longer re-render on every audio time update. Highlighting uses a cancellable timer scheduled around the next word boundary, adjusted for playback speed, with native media events correcting seeks and stalls. Hidden tabs stop that scheduled work. Automatic passage scrolling stops while a dialog is open.

Grammar matches and sentence lookups are indexed once per lesson. Word hover/focus warms dictionary entries; a cached dictionary opens synchronously. Course notes warm during idle time. Expired client cache entries use ETags and reuse the parsed object on HTTP 304. Legacy grammar-page metadata is omitted from reader responses while original lesson files remain unchanged. The dialog overlay no longer blurs the moving passage behind it.

| Measurement | Earlier version | Current version |
| --- | ---: | ---: |
| Playback JavaScript per second, vocabulary dialog open | 36.35 ms | 12.99 ms (64.3% less) |
| Full-size cover collection, JPEG vs WebP | 2,683,861 bytes | 1,028,862 bytes (61.7% less) |
| Thumbnail collection, original JPEG vs WebP | 2,683,861 bytes | 484,872 bytes (81.9% less) |

Playback uses production Chrome, lesson 4, 425 word buttons, muted audio at 1x starting near the beginning, and its 40-entry vocabulary dialog open. Chrome `Performance.getMetrics` sampling windows were 12.72 seconds before and 12.06 seconds after, normalized by elapsed time. The final sample ran after local translation precomputation finished. This measures JavaScript work in this scenario, not end-to-end interaction latency or field INP. It does not establish a speedup for every feature. The previous tab closed before the final fixed-duration sample, so that sample used a fresh tab in the same Chrome profile.

Production asset delivery is verified against the decoded source bytes: current JavaScript transfers as 90,946 Brotli bytes instead of 309,979 identity bytes (70.7% less), and CSS as 7,136 instead of 33,521 bytes (78.7% less). These are encoding comparisons of the same build, not two different source bundles. Gzip and identity fallbacks are also tested. Responsive images select smaller variants and use hashed URLs with immutable caching; all 36 original JPEGs are preserved. Image comparisons sum the generated collection, not the size of every library page.

All 699 sentences across the 36 course lessons now have translations in the combined course/user cache. Live lesson responses were checked for complete translation coverage and conditional HTTP 304 responses. A warmed cached translation POST had a 3.26 ms median and 4.84 ms p95 over 20 requests after one excluded warm-up. Lesson responses bring cached translations into the browser, where selecting those sentences needs no translation request. The local model and decoding settings are retained; new personal sentences still require inference and new recordings still require alignment. Translation caching does not improve translation quality.

The second API timing run did **not** demonstrate lower server latency: before/after medians were 5.37/8.48 ms for a lesson, 1.26/1.84 ms for dictionary, 2.08/3.27 ms for vocabulary, 1.58/3.56 ms for vocabulary search and 6.69/8.93 ms for a 64 KB audio range. Background activity, OS caching and host load are uncontrolled. No server-latency speedup is claimed for this pass; the improvements above concern client rendering, fewer requests, precomputed translations and transfer size.

All 23 Node tests pass. Added checks cover clock subscriptions, exact grammar-match parity over all 36 lessons, timing boundaries, ETag revalidation, Brotli/gzip/identity content equality and generated image references. The production build passes. Chrome checks cover playback highlights, seeking, timing preview/playhead capture without saving, dictionary/grammar/vocabulary dialogs, both search interfaces, keyboard selection, save/unsave, pinyin, traditional characters, desktop/mobile overflow and note autosave across reload. Test notes and saved words were restored. No console errors were observed.

Reproduce delivery and API checks while the production reader is running:

```powershell
node scripts/benchmark-delivery.mjs output/delivery-speed2.json
node scripts/benchmark-api.mjs output/api-speed2-after.json
```

Raw browser samples: `output/speed2-browser-before.json`, `output/speed2-browser-after.json`. API samples: `output/api-speed2-before.json`, `output/api-speed2-after.json`. Delivery and coverage: `output/delivery-speed2.json`. Screenshots: `output/reader-speed2-desktop.png`, `output/reader-speed2-mobile.png`.

## Third optimization pass (2026-10-18)

Verified on 18 October 2026 with Node 24.11.1 on Windows. The changes preserve the current reader controls, course content, dark theme, and mobile layout.

## Measured CPU work

`node scripts/benchmark-speed.mjs` measures the same 36 lessons and 10,896 vocabulary entries before and after the changes. Each result is the median of seven warmed batches, in microseconds per operation. These are local computation measurements, not end-to-end page-load or internet speed claims.

| Operation | Before | After | Improvement |
| --- | ---: | ---: | ---: |
| Library filtering without a query | 19.348 | 0.634 | 30.5x |
| Library search | 22.232 | 1.645 | 13.5x |
| Vocabulary browsing | 109.988 | 4.819 | 22.8x |
| Vocabulary browsing by level | 62.846 | 4.827 | 13.0x |

Full vocabulary text search still scans matching candidates; its measured cost stayed around 0.8 milliseconds. Reader-model preparation stayed around 0.1 milliseconds. Neither is presented as a demonstrated speed improvement.

## Loading and interaction changes

- Hosted JavaScript fell from approximately 98.77 KB to 89.84 KB gzipped, a 9% reduction. Grammar preparation now happens once on the server or during the hosted build.
- The prepared catalog is preloaded with the HTML. All 36 lessons and course notes are generated as public static JSON and served by the CDN. API compatibility remains available, with shared caching restricted to the read-only hosted server.
- A fresh library view creates no audio element and does not load the last-opened lesson. Hover, focus, and touch intent still prefetch the selected lesson.
- Playback progress uses an independent store and idle persistence, so saving progress no longer rerenders the reader every four seconds. Leaving or hiding the page flushes pending changes.
- Passage search updates only changed highlight classes. It does not rebuild the word/ruby tree or reset audio tracking on every keystroke.
- Vocabulary reuses cached responses immediately, prefetches on opening intent, and skips rendering offscreen rows. Requests from superseded filters cannot replace current results.

## Verification

- 28 unit and regression tests, plus the hosted integration test, passed.
- Integration checks compare every static lesson and note document against its API response, validate app icons, and verify all 36 recordings support byte-range requests.
- Browser checks covered fresh library loading, searching, vocabulary filtering and bookmarking, passage matches, word audio and moving highlights, speed changes, grammar details, dark mode, pronunciation toggles, mobile underlines and play-button centring, and returning to a lesson without losing its audio duration or progress.
