import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { preparedCourseLesson } from "../reader-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(root, "data");
const output = path.join(root, "dist");
const catalog = JSON.parse(fs.readFileSync(path.join(data, "catalog.json")));
const manifest = {};
let totalBytes = 0;
fs.mkdirSync(path.join(output, "audio"), { recursive: true });
for (const { id } of catalog) {
  const lesson = JSON.parse(fs.readFileSync(path.join(data, "lessons", `${id}.json`)));
  const source = path.resolve(root, lesson.audio.replaceAll("\\", "/"));
  if (!source.startsWith(`${root}${path.sep}`)) throw new Error(`Invalid audio path for ${id}`);
  const bytes = fs.readFileSync(source);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const filename = `${id}-${hash}.mp3`;
  fs.copyFileSync(source, path.join(output, "audio", filename));
  manifest[id] = { url: `/audio/${filename}`, bytes: bytes.length };
  totalBytes += bytes.length;
}
const covers = path.join(output, "media", "covers");
fs.mkdirSync(covers, { recursive: true });
for (const filename of fs.readdirSync(path.join(data, "covers"))) {
  if (/\.(webp|jpg)$/.test(filename)) fs.copyFileSync(path.join(data, "covers", filename), path.join(covers, filename));
}
// Only course sentences are published; the personal translation cache stays local.
const courseCachePath = path.join(data, "course-translations.json");
const courseCache = JSON.parse(fs.readFileSync(courseCachePath));
const localCache = fs.existsSync(path.join(data, "translations.json")) ? JSON.parse(fs.readFileSync(path.join(data, "translations.json"))) : {};
const translations = {};
for (const { id } of catalog) {
  const lesson = JSON.parse(fs.readFileSync(path.join(data, "lessons", `${id}.json`)));
  for (const paragraph of lesson.paragraphs) for (const sentence of paragraph.sentences) {
    const translation = localCache[sentence.text] || courseCache[sentence.text];
    if (!translation) throw new Error(`Missing prepared translation in ${id}`);
    translations[sentence.text] = translation;
  }
}
fs.writeFileSync(courseCachePath, JSON.stringify(translations));
fs.writeFileSync(path.join(data, "course-audio.json"), JSON.stringify(manifest, null, 2) + "\n");
// Read-only course documents can be delivered by the CDN without a function call.
const courses = path.join(output, "courses");
fs.mkdirSync(path.join(courses, "lessons"), { recursive: true });
fs.mkdirSync(path.join(courses, "course-notes"), { recursive: true });
fs.writeFileSync(path.join(courses, "catalog.json"), JSON.stringify(catalog));
for (const { id } of catalog) {
  if (!/^course-(0[1-9]|[12]\d|3[0-6])$/.test(id)) throw new Error(`Unexpected hosted lesson: ${id}`);
  const lesson = JSON.parse(fs.readFileSync(path.join(data, "lessons", `${id}.json`)));
  const words = JSON.parse(fs.readFileSync(path.join(data, "course-vocabulary", `${id}.json`))).words;
  fs.writeFileSync(path.join(courses, "lessons", `${id}.json`), JSON.stringify(preparedCourseLesson(lesson, words, translations, manifest[id].url)));
  fs.copyFileSync(path.join(data, "course-notes", `${id}.json`), path.join(courses, "course-notes", `${id}.json`));
}
console.log(JSON.stringify({ lessons: catalog.length, courseSentences: Object.keys(translations).length, audioBytes: totalBytes }));
