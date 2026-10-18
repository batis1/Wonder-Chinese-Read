import express from "express";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { compressedAssets } from "./server-static.mjs";
import {
  createFileSnapshots,
  createJsonResponses,
  buildVocabularyIndex,
  searchVocabulary,
} from "./server-cache.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const data = path.join(root, "data");
fs.mkdirSync(path.join(data, "uploads"), { recursive: true });
fs.mkdirSync(path.join(data, "jobs"), { recursive: true });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
    return res.status(403).json({ error: "Local requests only." });
  next();
});
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const snapshot = createFileSnapshots();
const sendJson = createJsonResponses();
const translationCacheFile = path.join(data, "translations.json");
const courseTranslationFile = path.join(data, "course-translations.json");
let mergedTranslations;
const translationSnapshot = () => {
  const course = fs.existsSync(courseTranslationFile)
    ? snapshot(courseTranslationFile)
    : { version: "empty", value: {} };
  const saved = fs.existsSync(translationCacheFile)
    ? snapshot(translationCacheFile)
    : { version: "empty", value: {} };
  const version = `${course.version}:${saved.version}`;
  if (mergedTranslations?.version !== version)
    mergedTranslations = {
      version,
      value: { ...course.value, ...saved.value },
    };
  return mergedTranslations;
};
const save = (file, value) => {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
};
const validId = (id) => /^(course-\d{2}|import-[a-f0-9-]{36})$/.test(id);
const lessonFile = (id) =>
  path.join(
    data,
    id.startsWith("course-") ? "lessons" : "uploads",
    `${id}.json`,
  );
const python = process.env.WONDER_PYTHON || "python";
let translator;
const translationRequests = new Map();
function ensureTranslator() {
  if (!translator) {
    const log = fs.openSync(path.join(data, "jobs", "translator.log"), "a");
    translator = spawn(python, ["scripts/translate_local.py"], {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      stdio: ["pipe", "pipe", log],
    });
    createInterface({ input: translator.stdout }).on("line", (line) => {
      try {
        const result = JSON.parse(line);
        const request = translationRequests.get(result.id);
        if (request) {
          clearTimeout(request.timeout);
          translationRequests.delete(result.id);
          result.error
            ? request.reject(new Error(result.error))
            : request.resolve(result.translation);
        }
      } catch {}
    });
    let closed = false;
    const failed = () => {
      if (closed) return;
      closed = true;
      for (const req of translationRequests.values()) {
        clearTimeout(req.timeout);
        req.reject(new Error("Local translator unavailable"));
      }
      translationRequests.clear();
      translator = null;
      fs.closeSync(log);
    };
    translator.on("exit", failed);
    translator.on("error", failed);
  }
}
function localTranslate(text) {
  ensureTranslator();
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const timeout = setTimeout(() => {
      translationRequests.delete(id);
      reject(new Error("Translation timed out"));
    }, 90000);
    translationRequests.set(id, { resolve, reject, timeout });
    translator.stdin.write(JSON.stringify({ id, text }) + "\n");
  });
}
const queue = [];
let running = false;
function enqueue(id, operation) {
  queue.push({ id, operation });
  nextJob();
}
function nextJob() {
  if (running || !queue.length) return;
  running = true;
  const job = queue.shift();
  const log = fs.openSync(path.join(data, "jobs", `${job.id}.log`), "a");
  const child = spawn(
    python,
    ["scripts/process_lesson.py", "--id", job.id, "--operation", job.operation],
    {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      stdio: ["ignore", log, log],
    },
  );
  let finished = false;
  const done = (error) => {
    if (finished) return;
    finished = true;
    fs.closeSync(log);
    if (error) {
      try {
        const file = lessonFile(job.id);
        const l = read(file);
        l.alignmentStatus = "failed";
        l.processingError =
          "Processing failed. See the local job log or retry.";
        save(file, l);
      } catch {}
    }
    running = false;
    nextJob();
  };
  child.on("error", () => done(true));
  child.on("exit", (code) => done(code !== 0));
}
const upload = multer({
  dest: path.join(data, "uploads"),
  limits: { fileSize: 250 * 1024 * 1024, fields: 8 },
  fileFilter: (req, file, cb) =>
    cb(null, /\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(file.originalname)),
});
let dictionary;
let vocabulary;
let vocabularyIndex;
app.get("/api/catalog", (req, res) => {
  const catalog = fs.existsSync(path.join(data, "catalog.json"))
    ? [...snapshot(path.join(data, "catalog.json")).value]
    : [];
  for (const f of fs
    .readdirSync(path.join(data, "uploads"))
    .filter((f) => /^import-.*\.json$/.test(f))) {
    const l = snapshot(path.join(data, "uploads", f)).value;
    catalog.push({
      id: l.id,
      title: l.title,
      english: l.english,
      volume: "My passages",
      alignmentStatus: l.alignmentStatus,
    });
  }
  res.json(catalog);
});
app.get("/api/provenance", (req, res) =>
  res.json(read(path.join(data, "provenance.json"))),
);
app.get("/api/lessons/:id", (req, res) => {
  if (!validId(req.params.id)) return res.sendStatus(404);
  const file = lessonFile(req.params.id);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  const lessonSnapshot = snapshot(file);
  const translations = translationSnapshot();
  const vocabularyFile = path.join(
    data,
    "course-vocabulary",
    `${req.params.id}.json`,
  );
  const courseVocabulary =
    /^course-\d{2}$/.test(req.params.id) && fs.existsSync(vocabularyFile)
      ? snapshot(vocabularyFile)
      : null;
  sendJson(
    req,
    res,
    `lesson:${req.params.id}:${lessonSnapshot.version}:${translations.version}:${courseVocabulary?.version || ""}`,
    () => {
      const lesson = lessonSnapshot.value;
      const { grammarSource, ...readerLesson } = lesson;
      const audioVersion = lesson.audio
        ? fs.statSync(path.resolve(root, lesson.audio))
        : null;
      const cached = {};
      for (const paragraph of lesson.paragraphs || [])
        for (const sentence of paragraph.sentences)
          if (translations.value[sentence.text])
            cached[sentence.text] = translations.value[sentence.text];
      return {
        ...readerLesson,
        ...(courseVocabulary
          ? { courseVocabulary: courseVocabulary.value.words }
          : {}),
        translations: cached,
        audioUrl: lesson.audio
          ? `/audio/${lesson.id}?v=${audioVersion.mtimeMs}-${audioVersion.size}`
          : null,
      };
    },
  );
});
app.get("/api/course-notes/:id", (req, res) => {
  if (!/^course-\d{2}$/.test(req.params.id)) return res.sendStatus(404);
  const file = path.join(data, "course-notes", `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  const notes = snapshot(file);
  sendJson(
    req,
    res,
    `course-notes:${req.params.id}:${notes.version}`,
    () => notes.value,
  );
});
app.get("/audio/:id", (req, res) => {
  if (!validId(req.params.id)) return res.sendStatus(404);
  const file = lessonFile(req.params.id);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  const l = snapshot(file).value;
  if (!l.audio) return res.sendStatus(404);
  const resolved = path.resolve(root, l.audio);
  if (!resolved.startsWith(`${root}${path.sep}`)) return res.sendStatus(403);
  const stat = fs.statSync(resolved);
  const version = `${stat.mtimeMs}-${stat.size}`;
  res.sendFile(
    resolved,
    req.query.v === version ? { maxAge: "1y", immutable: true } : {},
  );
});
app.get("/api/dictionary", (req, res) => {
  dictionary ||= read(path.join(data, "dictionary.json"));
  vocabulary ||= read(path.join(data, "vocabulary.json"));
  const word = String(req.query.word || "").slice(0, 60);
  sendJson(req, res, `dictionary:${word}`, () => ({
    word,
    entry: dictionary[word] || null,
    hsk: vocabulary[word] || null,
    characters: [...word].map((c) => ({
      word: c,
      entry: dictionary[c] || null,
      hsk: vocabulary[c] || null,
    })),
  }));
});
app.get("/api/vocabulary", (req, res) => {
  dictionary ||= read(path.join(data, "dictionary.json"));
  vocabulary ||= read(path.join(data, "vocabulary.json"));
  const q = String(req.query.q || "").toLowerCase();
  const level = Number(req.query.level);
  vocabularyIndex ||= buildVocabularyIndex(vocabulary, dictionary);
  const page = Math.max(0, Number(req.query.page) || 0);
  sendJson(
    req,
    res,
    `vocabulary:${JSON.stringify([q, level || 0, page])}`,
    () => searchVocabulary(vocabularyIndex, q, level, page),
  );
});
app.post("/api/import", upload.single("audio"), (req, res) => {
  const text = String(req.body.text || "").trim();
  const title = String(req.body.title || "").trim();
  if (!title || !text || text.length > 50000 || !/[\u3400-\u9fff]/.test(text)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: "Add a title and Chinese text (up to 50,000 characters).",
    });
  }
  const id = `import-${randomUUID()}`;
  const lesson = {
    id,
    title: title.slice(0, 160),
    english: String(req.body.english || "").slice(0, 200),
    text,
    volume: "My passages",
    source: "Personal import",
    sourcePages: [],
    grammarPages: [],
    grammar: [],
    paragraphs: [],
    audio: req.file ? path.relative(root, req.file.path) : null,
    alignmentStatus: req.file ? "queued" : "text-only",
    processing: true,
    created: new Date().toISOString(),
  };
  save(lessonFile(id), lesson);
  enqueue(id, req.file ? "all" : "annotate");
  res.status(201).json({ id });
});
app.post("/api/lessons/:id/edit", upload.single("audio"), (req, res) => {
  if (!validId(req.params.id) || !fs.existsSync(lessonFile(req.params.id)))
    return res.sendStatus(404);
  const l = read(lessonFile(req.params.id));
  if (["queued", "aligning"].includes(l.alignmentStatus)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(409).json({
      error: "Wait for the current alignment to finish before editing.",
    });
  }
  const text = String(req.body.text || "").trim(),
    title = String(req.body.title || "").trim();
  if (!title || !text || text.length > 50000 || !/[\u3400-\u9fff]/.test(text)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: "Add a title and Chinese text (up to 50,000 characters).",
    });
  }
  const revisions = path.join(data, "revisions");
  fs.mkdirSync(revisions, { recursive: true });
  save(path.join(revisions, `${l.id}-${Date.now()}.json`), l);
  l.title = title.slice(0, 160);
  l.english = String(req.body.english || "").slice(0, 200);
  l.text = text;
  l.paragraphs = [];
  if (req.file) l.audio = path.relative(root, req.file.path);
  l.alignmentStatus = l.audio ? "queued" : "text-only";
  l.processing = true;
  delete l.alignmentQuality;
  delete l.processingError;
  save(lessonFile(l.id), l);
  enqueue(l.id, l.audio ? "all" : "annotate");
  res.json({ id: l.id });
});
app.post("/api/lessons/:id/align", (req, res) => {
  if (!validId(req.params.id) || !fs.existsSync(lessonFile(req.params.id)))
    return res.sendStatus(404);
  const l = read(lessonFile(req.params.id));
  if (!l.audio) return res.status(400).json({ error: "Attach audio first." });
  if (["queued", "aligning"].includes(l.alignmentStatus))
    return res.json({ status: l.alignmentStatus });
  l.alignmentStatus = "queued";
  delete l.processingError;
  save(lessonFile(l.id), l);
  enqueue(l.id, "align");
  res.json({ status: "queued" });
});
app.post("/api/lessons/:id/audio", upload.single("audio"), (req, res) => {
  if (!validId(req.params.id) || !fs.existsSync(lessonFile(req.params.id))) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.sendStatus(404);
  }
  if (!req.file)
    return res
      .status(400)
      .json({ error: "Choose an MP3, WAV, M4A, OGG, WebM or FLAC file." });
  const l = read(lessonFile(req.params.id));
  if (["queued", "aligning"].includes(l.alignmentStatus)) {
    fs.unlinkSync(req.file.path);
    return res
      .status(409)
      .json({ error: "Wait for current alignment to finish." });
  }
  l.audio = path.relative(root, req.file.path);
  l.alignmentStatus = "queued";
  delete l.processingError;
  for (const p of l.paragraphs)
    for (const s of p.sentences)
      for (const t of s.tokens) {
        delete t.start;
        delete t.end;
      }
  save(lessonFile(l.id), l);
  enqueue(l.id, "align");
  res.json({ status: "queued" });
});
app.post("/api/lessons/:id/timing", (req, res) => {
  if (!validId(req.params.id) || !fs.existsSync(lessonFile(req.params.id)))
    return res.sendStatus(404);
  const l = read(lessonFile(req.params.id));
  if (["queued", "aligning"].includes(l.alignmentStatus))
    return res.status(409).json({
      error: "Wait until alignment finishes before correcting timings.",
    });
  const parts = String(req.body.key || "")
    .split("-")
    .map(Number);
  const start = Number(req.body.start);
  if (
    parts.length !== 3 ||
    parts.some((n) => !Number.isInteger(n) || n < 0) ||
    !Number.isFinite(start) ||
    start < 0
  )
    return res.status(400).json({ error: "Invalid word timing." });
  const [pi, si, ti] = parts;
  const token = l.paragraphs[pi]?.sentences[si]?.tokens[ti];
  if (!token) return res.sendStatus(404);
  const tokens = l.paragraphs.flatMap((p) =>
    p.sentences.flatMap((s) => s.tokens),
  );
  const index = tokens.indexOf(token);
  const before = tokens.slice(0, index).findLast((t) => t.start != null);
  const after = tokens.slice(index + 1).find((t) => t.start != null);
  if ((before && start < before.start) || (after && start >= after.start))
    return res.status(400).json({
      error:
        "Place the playhead between the neighboring words, then set the start again.",
    });
  token.start = Number(start.toFixed(3));
  token.end = Math.max(token.end || 0, start + 0.05);
  token.timingConfidence = "manual";
  const sentence = l.paragraphs[pi].sentences[si];
  sentence.start = sentence.tokens.find((t) => t.start != null)?.start;
  sentence.end = sentence.tokens.findLast((t) => t.end != null)?.end;
  save(lessonFile(l.id), l);
  res.json({ status: "saved" });
});
const translationWork = new Map();
function translateOnce(text) {
  if (translationWork.has(text)) return translationWork.get(text);
  const work = localTranslate(text)
    .then((translation) => {
      const latest = fs.existsSync(translationCacheFile)
        ? read(translationCacheFile)
        : {};
      latest[text] = translation;
      save(translationCacheFile, latest);
      return translation;
    })
    .finally(() => translationWork.delete(text));
  translationWork.set(text, work);
  return work;
}
app.post("/api/translate", async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text || text.length > 5000)
    return res.status(400).json({ error: "Sentence too long." });
  const cache = translationSnapshot().value;
  if (cache[text]) return res.json({ translation: cache[text], machine: true });
  try {
    const translation = await translateOnce(text);
    res.json({ translation, machine: true });
  } catch {
    res.status(503).json({
      error: "The local translator is unavailable. Retry in a moment.",
    });
  }
});
app.get("/book/:volume", (req, res) => {
  if (!["upper", "lower"].includes(req.params.volume))
    return res.sendStatus(404);
  res.sendFile(
    path.join(root, `HSK5${req.params.volume === "upper" ? "上" : "下"}.pdf`),
  );
});
app.get("/api/source-page/:volume/:page", (req, res) => {
  const volume = req.params.volume;
  const page = Number(req.params.page);
  if (
    !["upper", "lower"].includes(volume) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 200
  )
    return res.sendStatus(400);
  const file = path.join(data, "pages", `${volume}-${page}.jpg`);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.sendStatus(404);
});
app.use(
  "/media/covers",
  express.static(path.join(data, "covers"), {
    dotfiles: "deny",
    index: false,
    setHeaders(res, file) {
      if (/-[a-f0-9]{10}\.webp$/.test(file))
        res.set("Cache-Control", "public, max-age=31536000, immutable");
    },
  }),
);
app.use((error, req, res, next) =>
  res.status(400).json({
    error:
      error.code === "LIMIT_FILE_SIZE"
        ? "Audio must be smaller than 250 MB."
        : "Unable to process this request.",
  }),
);

if (process.argv.includes("--production")) {
  app.use("/assets", compressedAssets(path.join(root, "dist", "assets")));
  app.use(
    "/assets",
    express.static(path.join(root, "dist", "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use(express.static(path.join(root, "dist")));
} else {
  const vite = await createViteServer({
    configFile: path.join(root, "vite.config.js"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5175);
if (process.argv.includes("--production")) {
  dictionary = read(path.join(data, "dictionary.json"));
  vocabulary = read(path.join(data, "vocabulary.json"));
  vocabularyIndex = buildVocabularyIndex(vocabulary, dictionary);
  if (fs.existsSync(path.join(root, ".cache", "translator", "config.json")))
    ensureTranslator();
}
app.listen(port, "127.0.0.1", () =>
  console.log(`Wonder Chinese Read: http://127.0.0.1:${port}`),
);
