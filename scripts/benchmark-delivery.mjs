import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const base = process.env.BENCHMARK_URL || "http://127.0.0.1:5175";
const assets = {};
for (const name of fs.readdirSync(path.join(root, "dist/assets"))) {
  if (!/\.(js|css)$/.test(name)) continue;
  const response = await fetch(`${base}/assets/${name}`, { headers: { "Accept-Encoding": "br" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), "br");
  assert.match(response.headers.get("cache-control"), /immutable/);
  const decoded = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(decoded, fs.readFileSync(path.join(root, "dist/assets", name)));
  assets[name] = { rawBytes: decoded.length, transferBytes: Number(response.headers.get("content-length")) };
}
const covers = JSON.parse(fs.readFileSync(path.join(root, "src/assets/course-covers.json")));
const bytes = (source) => fs.statSync(path.join(root, "data/covers", path.basename(source))).size;
const images = { count: Object.keys(covers).length, originalBytes: 0, fullBytes: 0, thumbnailBytes: 0 };
for (const [original, image] of Object.entries(covers)) {
  images.originalBytes += bytes(original);
  images.fullBytes += bytes(image.src);
  images.thumbnailBytes += bytes(image.srcSet.split(",")[0].trim().split(" ")[0]);
}
const course = { lessons: 0, sentences: 0, cachedTranslations: 0 };
let example;
for (let number = 1; number <= 36; number++) {
  const response = await fetch(`${base}/api/lessons/course-${String(number).padStart(2, "0")}`);
  assert.equal(response.status, 200);
  const lesson = await response.json();
  const unchanged = await fetch(response.url, { headers: { "If-None-Match": response.headers.get("etag") } });
  assert.equal(unchanged.status, 304);
  assert.equal(lesson.grammarSource, undefined);
  assert.ok(lesson.audioUrl);
  course.lessons++;
  for (const paragraph of lesson.paragraphs) for (const sentence of paragraph.sentences) {
    course.sentences++;
    if (lesson.translations[sentence.text]) {
      course.cachedTranslations++;
      example ||= { text: sentence.text, translation: lesson.translations[sentence.text] };
    }
  }
}
const timings = [];
for (let request = 0; request < 21; request++) {
  const started = performance.now();
  const response = await fetch(`${base}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: example.text }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).translation, example.translation);
  if (request) timings.push(performance.now() - started);
}
timings.sort((a, b) => a - b);
const cachedTranslation = { medianMs: Number(timings[10].toFixed(2)), p95Ms: Number(timings[18].toFixed(2)) };
const results = { assets, images, course, cachedTranslation };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
