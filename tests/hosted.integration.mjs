import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createHostedApp } from "../server-hosted.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("hosted course reader serves every lesson, cached translation, and static recording without writes", async () => {
  const app = createHostedApp();
  app.use(express.static(path.join(root, "dist")));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const catalog = await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(catalog.length, 36);
    assert.ok(catalog.every((lesson) => lesson.id.startsWith("course-")));
    let total = 0;
    for (const { id } of catalog) {
      const response = await fetch(`${base}/api/lessons/${id}`);
      assert.equal(response.status, 200);
      const lesson = await response.json();
      assert.equal(lesson.audio, undefined);
      assert.equal(lesson.grammarSource, undefined);
      assert.ok(lesson.courseVocabulary.length > 0);
      const repeat = await fetch(response.url, { headers: { "If-None-Match": response.headers.get("etag") } });
      assert.equal(repeat.status, 304);
      for (const paragraph of lesson.paragraphs) for (const sentence of paragraph.sentences) {
        assert.ok(lesson.translations[sentence.text]);
        total++;
      }
      const audio = await fetch(base + lesson.audioUrl, { headers: { Range: "bytes=0-1023" } });
      assert.equal(audio.status, 206);
      assert.equal((await audio.arrayBuffer()).byteLength, 1024);
      assert.equal((await fetch(`${base}/api/course-notes/${id}`)).status, 200);
    }
    assert.equal(total, 699);
    const word = await (await fetch(`${base}/api/dictionary?word=${encodeURIComponent("从前")}`)).json();
    assert.ok(word.entry.definitions.length);
    const words = await (await fetch(`${base}/api/vocabulary?level=5&q=change`)).json();
    assert.equal(words.total, 8);
    const first = await (await fetch(`${base}/api/lessons/course-01`)).json();
    const text = first.paragraphs[0].sentences[0].text;
    const translated = await fetch(`${base}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    assert.equal((await translated.json()).translation, first.translations[text]);
    const privateLesson = await fetch(`${base}/api/lessons/import-ec4a9699-f9c4-4582-b397-5519c8536a82`);
    assert.equal(privateLesson.status, 404);
    for (const endpoint of ["import", "lessons/course-01/edit", "lessons/course-01/audio", "lessons/course-01/timing", "lessons/course-01/align"]) {
      assert.equal((await fetch(`${base}/api/${endpoint}`, { method: "POST" })).status, 403);
    }
    assert.equal((await fetch(`${base}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "not a prepared course sentence" }) })).status, 422);
    assert.ok(fs.existsSync(path.join(root, "dist/index.html")));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
