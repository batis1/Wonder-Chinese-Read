# Wonder Chinese Read

A Chinese reader built around the supplied HSK Standard Course 5 上 and 下 materials, with local processing tools and a hosted prepared-course edition.

## Hosted release

The Vercel edition contains all 36 prepared lessons, 699 cached sentence translations, textbook vocabulary, typed grammar notes, dictionary search and recorded audio. Notes, saved words, saved lessons, settings and progress stay in each visitor's browser. There are no shared editing endpoints or personal uploads in this release. Import, passage editing, recording replacement, new translation inference and automatic alignment remain available through the local server.

Vercel uses `npm run build:vercel` and serves `dist/`. The API entry is `api/index.mjs`, backed by the read-only `server-hosted.mjs`. `scripts/prepare-vercel.mjs` copies only the course recordings to hashed static URLs, prepares covers and validates translation coverage. No Python models or database credentials are needed for this edition. Python processing does not run inside Vercel Functions.

For a clean checkout, run `npm ci`, `npm run build:vercel`, `npm test` and `npm run test:hosted`. The hosted integration check covers every course lesson, recording range requests, dictionary/search, cached translations and rejected writes. Original PDF books, scan images, local translation caches, personal uploads, models and runtime logs are excluded from Git. The original-scan test runs when those optional source files are installed locally. The included typed notes have their own corpus checks.

Pushes to the connected GitHub `main` branch deploy to Vercel production. Use `npm run build` when returning to the local processing edition. Regeneration scripts require the original source books and extraction inputs described below; ordinary course reading does not.

## Open

Run `./start-reader.ps1` in PowerShell. The normal address is **http://127.0.0.1:5175**. The launcher reuses this app if already running and selects another port if a different app occupies 5175.

The current workspace is installed and prepared. To develop: `npm run dev`. To rebuild: `npm run build`. The server binds to loopback only.

Performance improvements and measured before/after results are documented in [PERFORMANCE.md](PERFORMANCE.md). The reader reuses lesson/dictionary data, buffers the current recording, prefetches adjacent content, and updates word highlights without rebuilding the passage. Newly translated sentences still require local model inference; cached translations appear immediately.

The playback clock updates only its subscribers, and word highlighting schedules around timing boundaries rather than checking every display frame. Dictionary hover/focus warms lookups, and course notes warm during idle time. Expired API entries revalidate with ETags. Production builds generate Brotli and gzip assets automatically; the production server negotiates the supported format.

Course covers use responsive WebP images with content hashes and immutable caching. Rebuild them with `python scripts/optimize_covers.py`; the source JPEGs are preserved. Run `python scripts/warm_course_translations.py` to fill the separate `data/course-translations.json` cache using the existing local model. It resumes missing sentences, saves after each batch and preserves `data/translations.json`, whose entries take precedence. Regenerating or editing a passage requires warming its new sentences again. This removes first-use inference for cached course sentences; new personal text and audio alignment still need local processing.

## Included

- All 36 course lessons, with recorded audio. Lesson 7 combines its two story recordings.
- A searchable lesson page at `/#lessons`, with image grids grouped by book, HSK level filters, expandable collections and a hide-read filter. Search accepts Chinese, English and lesson numbers. Future entries in `data/catalog.json` can set `hskLevel` (1–9); levels 7–9 share a filter. Existing course entries default to HSK 5, and personal passages remain unclassified.
- Clickable words, pinyin, dictionary and character entries, simplified/traditional text, HSK underlines and search.
- Passage vocabulary for the 36 course lessons follows each book's numbered new-word list, including listed expressions and optional word forms. The tab count uses this list instead of every segmented word in the passage. Personal passages retain the unique-word list. HSK badges still use the current examination syllabus.
- The November 2025 HSK 3.0 **examination syllabus**, marked effective July 2026. This is distinct from both HSK 2.0 and the 2021 proficiency framework. Unique normalized headwords are deduplicated; multi-level senses use the earliest listed level. Unlisted forms are labeled “Outside syllabus”, never guessed.
- Course-specific grammar and usage points, English summaries, passage examples, and typed book explanations/examples for all 36 lessons. Word comparisons have separate explanations for each term. Book-page references are plain text; grammar panels contain no page screenshots or PDF links. Notes load only when grammar is opened. The course grammar sequence stays separate from new exam vocabulary levels.
- Local Chinese-to-English machine translation with Helsinki-NLP/opus-mt-zh-en, cached by sentence.
- Playback speed, seeking, sentence repeat, following text, and manual word-start correction at the playhead.
- Passage import with optional audio. Text-only imports get pinyin, dictionary entries, levels, supported grammar matches and translations. Browser speech is available without a recording; its voice availability depends on the browser/OS.
- Edit passage text and attach/replace audio later. Edits are backed up under `data/revisions/` and regenerate annotations/alignment.
- Saved words and lessons, read status, notes, preferences and playback position. Export/restore study backups from preferences.

## Data and processing

`data/raw/` contains extracted course text. `data/lessons/` contains annotated passages and timings. Your imports and recordings are in `data/uploads/`. Dictionary and syllabus data live in `data/`; models are cached in `.cache/`.

Audio is aligned **on this computer**, using stable-ts and faster-whisper-base in CPU int8 mode. Jobs run one at a time. The reader exposes queued, aligning, machine-aligned, needs-review and failed states; retries are available. New jobs load the cached model, so the first operation can take a moment.

Timings are machine estimates, not manually verified boundaries. Low-confidence intervals and OCR-derived text can require correction. The original book remains available for checking. Use Edit passage to correct text; click a word and choose “Adjust audio timing” to enter or preview a start time, then save it. Replacing audio starts fresh alignment.

Grammar detection for custom text matches supported patterns. It is not a complete grammatical analysis of arbitrary Chinese. Machine translations and automatic pronunciation can also contain errors, especially with context-dependent readings.

The local processing edition makes no cloud API calls for dictionary lookup, translation, annotation or audio alignment after the models are downloaded. The hosted edition serves its prepared course data and recordings through Vercel; it does not upload visitors' study notes or saved words.

Typed course notes live in `data/course-notes/`. Regenerate them with `python scripts/extract_course_notes.py --ocr-comparisons`. This reads the supplied PDFs, caches local OCR of table columns, normalizes scanning artifacts and applies the source-based transcription corrections in `scripts/course_note_corrections.json`. Practice blanks are not displayed as worked answers. The extraction does not modify passages, recordings or study records. OCR text has been cleaned, but the entire corpus has not received a separate human proofreading pass.

Textbook vocabulary lives in `data/course-vocabulary/`. Regenerate it with `python scripts/extract_course_vocabulary.py`; local OCR is cached and source-based corrections are retained in `scripts/course_vocabulary_corrections.json`. The extractor excludes the separately numbered proper-name sections. The supplied lesson 5 scan skips vocabulary number 29; its 46 printed entries retain their original numbers. Lesson 9's final vocabulary page has a damaged JPEG, so its existing PDF text layer supplies entries 27-38. Definitions use the dictionary with contextual course corrections, and HSK levels are exact syllabus lookups.

## Reproduce the corpus

The supplied PDFs/audio are inputs, not generated files. Install Node and local Python dependencies (`npm ci`, `python -m pip install -r scripts/requirements.txt`) and FFmpeg. Initial model/source downloads need internet access. Python requirements are kept under `scripts/` so the Vercel course build does not install processing models.

1. Place the official syllabus at `data/sources/hsk-2025.pdf` and the CC-CEDICT archive at `data/sources/cedict.txt.gz`.
2. Run `python scripts/prepare.py --ocr`, then `python scripts/clean_corpus.py` and `python scripts/prepare.py --annotate-only`.
3. Run `python scripts/prepare_covers.py`, `python scripts/optimize_covers.py`, `python scripts/complete_notes.py` and `python scripts/process_lesson.py --all --operation align`.
4. Run `python scripts/warm_course_translations.py` to prepare course sentence translations.
5. Run `npm test` and `npm run build`.

Regenerating course files is a maintenance operation. Back up edited course lessons before running the pipeline; it reads `data/raw/` as the source of course text. User imports are separate.

## Attribution

- User-supplied HSK Standard Course 5 上 / 下 books and recordings; original files are preserved.
- [Official HSK syllabus](https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲（词汇、汉字、语法）.pdf), November 2025.
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict), CC BY-SA 4.0.
- [Helsinki-NLP/opus-mt-zh-en](https://huggingface.co/Helsinki-NLP/opus-mt-zh-en), Apache-2.0.
- jieba, pypinyin, stable-ts, faster-whisper, React, Vite and Lucide.
