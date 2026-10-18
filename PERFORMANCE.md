# Reader performance verification

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
