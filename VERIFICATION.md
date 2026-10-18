# Verification — 2026-10-16

- Production build completed successfully with `npm run build`.
- Thirteen tests pass with `npm test` (corpus, lesson-library and performance regressions); four annotation regression tests previously passed with `python -m unittest discover -s tests -p 'test_*.py'`.
- All 36 course passages have audio, monotone word timestamps, source links and original course-note images. Lesson 7 joins its two story recordings.
- The official vocabulary PDF yielded all **11,000 numbered rows**, IDs 1 through 11,000, without missing IDs or malformed pinyin fields. Deduplicating normalized headwords produces 10,896 entries; levels come directly from the November 2025 syllabus.
- Chrome checks: word clicks seek and start audio; dictionary and grammar open; original note images render; text-only import and text editing generate annotations; an audio import completes local alignment and seeks from a clicked word; lesson 36 audio plays; notes and preferences survive reload; vocabulary search returns the correct entry.
- Responsive checks at 390 × 844 and the browser's 1920 × 945 desktop viewport found no horizontal overflow. Light/dark appearance, pinyin visibility and mobile icon names were checked.
- Word-timing editor opens, retains the selected word's start, and previews the recording. Audio range requests return HTTP 206. Invalid text-only input is rejected.
- A clean production Chrome tab reported no console errors. The reader is left running on loopback at http://127.0.0.1:5175, with no public deployment.
- Temporary verification passages were removed; the library contains the 36 supplied course lessons.
- Lesson-library Chrome checks: Chinese/English/lesson-number search, empty HSK-level state, book filtering, all 18 lessons in an expanded book, opening a card, hiding a completed lesson and restoring its original read status. Search filters survive opening a lesson and returning; reloading `/#lessons` keeps the library open. The Add passage dialog opens from the library.
- Library layout checked at desktop and 390 × 844: four columns on desktop and two on mobile, no horizontal overflow, all visible course images loaded. Future HSK levels are covered by catalog metadata tests; no additional level content is supplied yet.
- Performance changes and local before/after measurements are recorded in [PERFORMANCE.md](PERFORMANCE.md), including playback, repeated selection, vocabulary requests, lesson/dictionary loading, audio ranges, cache invalidation and retained buffering.

Screenshots: [desktop](output/reader-desktop.png), [grammar panel](output/reader-grammar.png), [mobile](output/reader-mobile.png).

Lesson library: [desktop](output/lesson-library-desktop.png), [mobile](output/lesson-library-mobile.png).

These checks establish software behavior and data coverage, not human proofreading. Text comes from PDF OCR, word segmentation and pronunciation are automatic, translations use a local machine-translation model, and audio boundaries are machine estimates. All 36 alignments passed the tool's usable-interval threshold; that diagnostic is **not a measured alignment-accuracy score**. Review against the original books and recordings when precision matters. Arbitrary imported text receives matching supported grammar patterns, not exhaustive grammar analysis.
