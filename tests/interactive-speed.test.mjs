import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createProgressStore } from "../src/progress-store.js";
import { hostedResourceUrl } from "../src/resources.js";
import { readerGrammar } from "../reader-data.mjs";
import { grammarFor } from "../src/grammar.js";
import { buildReaderModel } from "../src/reader-model.js";
import { createFileSnapshots } from "../server-cache.mjs";
import { initialAudioPosition } from "../src/media-clock.js";

test("a word seek made during audio loading takes priority over saved playback progress", () => {
  assert.equal(initialAudioPosition(200, 90, 12.5), 12.5);
  assert.equal(initialAudioPosition(200, 90, 0), 0);
  assert.equal(initialAudioPosition(200, 90, null), 90);
  assert.equal(initialAudioPosition(200, 199, null), null);
  assert.equal(initialAudioPosition(200, 90, 199), 199);
  assert.equal(initialAudioPosition(200, 90, 300), 200);
  assert.equal(initialAudioPosition(200, 90, -1), 0);
  assert.equal(initialAudioPosition(NaN, 90, 10), null);
});

test("playback updates coalesce persistence and expose the latest progress without a render subscription", () => {
  const writes = [];
  let pending;
  const store = createProgressStore({}, (value) => writes.push(value), (callback) => {
    pending = callback;
    return () => { if (pending === callback) pending = null; };
  });
  for (let seconds = 1; seconds <= 100; seconds++)
    store.set((value) => ({ ...value, "course-01": { seconds } }));
  assert.equal(writes.length, 0);
  assert.equal(store.get()["course-01"].seconds, 100);
  pending();
  assert.equal(writes.length, 1);
  assert.equal(writes[0]["course-01"].seconds, 100);
  store.set((value) => ({ ...value, "course-02": { seconds: 12 } }));
  store.flush();
  store.flush();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1], { "course-01": { seconds: 100 }, "course-02": { seconds: 12 } });
  assert.equal(pending, null);
});

test("only prepared read routes map to static course documents", () => {
  assert.equal(hostedResourceUrl("/api/catalog"), "/courses/catalog.json");
  for (let n = 1; n <= 36; n++) {
    const id = `course-${String(n).padStart(2, "0")}`;
    for (const type of ["lessons", "course-notes"])
      assert.equal(hostedResourceUrl(`/api/${type}/${id}`), `/courses/${type}/${id}.json`);
  }
  for (const route of ["/api/lessons/course-37", "/api/lessons/import-personal", "/api/lessons/course-01/edit", "/api/dictionary?word=爱", "/api/vocabulary?level=5"])
    assert.equal(hostedResourceUrl(route), route);
});

test("prepared grammar preserves every rule and token match without duplicating annotated passages", () => {
  for (let n = 1; n <= 36; n++) {
    const lesson = JSON.parse(fs.readFileSync(new URL(`../data/lessons/course-${String(n).padStart(2, "0")}.json`, import.meta.url)));
    const expected = grammarFor(lesson);
    const prepared = readerGrammar(lesson);
    assert.deepEqual(prepared.map((rule) => [rule.point, rule.pattern, rule.explanation, rule.examples.map((example) => example.text)]), expected.map((rule) => [rule.point, rule.pattern, rule.explanation, rule.examples.map((example) => example.text)]));
    assert.ok(prepared.every((rule) => rule.examples.every((example) => !example.tokens)));
    const oldModel = buildReaderModel(lesson, expected);
    const nextModel = buildReaderModel(lesson, prepared);
    assert.deepEqual(nextModel.tokens.map((token) => token.grammarMatches.map((rule) => rule.point)), oldModel.tokens.map((token) => token.grammarMatches.map((rule) => rule.point)));
  }
});

test("immutable deployment snapshots reuse data while local snapshots still check revisions", () => {
  const source = new URL("../data/catalog.json", import.meta.url);
  const snapshot = createFileSnapshots(100, { immutable: true });
  const first = snapshot(source);
  const originalStat = fs.statSync;
  try {
    fs.statSync = () => { throw new Error("unexpected repeated filesystem stat"); };
    assert.equal(snapshot(source), first);
  } finally {
    fs.statSync = originalStat;
  }
});
