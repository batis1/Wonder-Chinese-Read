import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFileSnapshots, createJsonResponses, buildVocabularyIndex, searchVocabulary } from "./server-cache.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

export function createHostedApp(dataDirectory = path.join(root, "data")) {
  const app = express();
  const snapshot = createFileSnapshots();
  const sendJson = createJsonResponses();
  const read = (file) => snapshot(path.join(dataDirectory, file));
  const validCourse = (id) => /^course-(0[1-9]|[12]\d|3[0-6])$/.test(id);
  let dictionary, vocabulary, vocabularyIndex;
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.get("/api/catalog", (req, res) => {
    const catalog = read("catalog.json");
    sendJson(req, res, `catalog:${catalog.version}`, () => catalog.value);
  });
  app.get("/api/provenance", (req, res) => res.json(read("provenance.json").value));
  app.get("/api/lessons/:id", (req, res) => {
    if (!validCourse(req.params.id)) return res.sendStatus(404);
    const source = read(`lessons/${req.params.id}.json`);
    const translations = read("course-translations.json");
    const words = read(`course-vocabulary/${req.params.id}.json`);
    const recordings = read("course-audio.json");
    sendJson(req, res, `lesson:${req.params.id}:${source.version}:${translations.version}:${words.version}:${recordings.version}`, () => {
      const { audio, grammarSource, ...lesson } = source.value;
      const cached = {};
      for (const paragraph of lesson.paragraphs) for (const sentence of paragraph.sentences) {
        if (translations.value[sentence.text]) cached[sentence.text] = translations.value[sentence.text];
      }
      return { ...lesson, courseVocabulary: words.value.words, translations: cached, audioUrl: recordings.value[lesson.id].url };
    });
  });
  app.get("/api/course-notes/:id", (req, res) => {
    if (!validCourse(req.params.id)) return res.sendStatus(404);
    const notes = read(`course-notes/${req.params.id}.json`);
    sendJson(req, res, `notes:${req.params.id}:${notes.version}`, () => notes.value);
  });
  app.get("/api/dictionary", (req, res) => {
    dictionary ||= read("dictionary.json").value;
    vocabulary ||= read("vocabulary.json").value;
    const word = String(req.query.word || "").slice(0, 60);
    sendJson(req, res, `dictionary:${word}`, () => ({ word, entry: dictionary[word] || null, hsk: vocabulary[word] || null, characters: [...word].map((character) => ({ word: character, entry: dictionary[character] || null, hsk: vocabulary[character] || null })) }));
  });
  app.get("/api/vocabulary", (req, res) => {
    dictionary ||= read("dictionary.json").value;
    vocabulary ||= read("vocabulary.json").value;
    vocabularyIndex ||= buildVocabularyIndex(vocabulary, dictionary);
    const query = String(req.query.q || "").slice(0, 200).toLowerCase();
    const level = Number(req.query.level) || 0;
    const requestedPage = Number(req.query.page);
    const page = Number.isFinite(requestedPage) ? Math.max(0, Math.floor(requestedPage)) : 0;
    sendJson(req, res, `vocabulary:${JSON.stringify([query, level, page])}`, () => searchVocabulary(vocabularyIndex, query, level, page));
  });
  app.post("/api/translate", (req, res) => {
    const text = String(req.body?.text || "").trim();
    if (!text || text.length > 5000) return res.status(400).json({ error: "Invalid sentence." });
    const translation = read("course-translations.json").value[text];
    if (typeof translation !== "string") return res.status(422).json({ error: "Translation is available for the prepared course sentences." });
    res.json({ translation, machine: true });
  });
  app.use("/api", (req, res) => res.status(req.method === "GET" ? 404 : 403).json({ error: "The hosted course library is read-only." }));
  app.use((error, req, res, next) => res.status(error.type === "entity.too.large" ? 413 : 400).json({ error: "Unable to process this request." }));
  return app;
}
