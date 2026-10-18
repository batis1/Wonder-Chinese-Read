import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { grammarFor, tokenGrammar } from "../src/grammar.js";
import {
  buildReaderModel,
  buildTimingIndex,
  findTimedToken,
} from "../src/reader-model.js";
import {
  createFileSnapshots,
  createJsonResponses,
  buildVocabularyIndex,
  searchVocabulary,
} from "../server-cache.mjs";
import {
  api,
  peekResource,
  invalidateResource,
  fetchTranslation,
} from "../src/resources.js";

const read = (file) =>
  JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));

test("indexed audio lookup preserves the previous linear lookup across all course recordings", () => {
  for (const item of read("data/catalog.json")) {
    const lesson = read(`data/lessons/${item.id}.json`);
    const grammar = grammarFor(lesson);
    const model = buildReaderModel(lesson, grammar);
    const source = lesson.paragraphs.flatMap((paragraph) =>
      paragraph.sentences.flatMap((sentence) => sentence.tokens),
    );
    assert.equal(
      model.tokens.map((token) => token.text).join(""),
      source.map((token) => token.text).join(""),
    );
    for (const token of model.tokens) {
      assert.equal(model.byKey.get(token.key), token);
      assert.equal(
        token.hasGrammar,
        tokenGrammar(token, token.sentence, grammar).length > 0,
      );
    }
    const index = buildTimingIndex(model.tokens);
    const times = [
      0,
      ...model.tokens
        .filter((token) => token.start != null)
        .flatMap((token) => [
          token.start,
          token.start + 0.001,
          token.end,
          token.end + 0.01,
        ]),
    ];
    for (const clock of times) {
      const old = model.tokens.find(
        (token) =>
          token.start != null && clock >= token.start && clock < token.end,
      );
      assert.equal(
        findTimedToken(index, clock)?.key,
        old?.key,
        `${item.id} at ${clock}`,
      );
    }
  }
});

test("timing lookup handles gaps, punctuation, overlapping intervals, and text-only passages", () => {
  const tokens = [
    { start: 1, end: 4, key: "a" },
    { text: "，" },
    { start: 2, end: 3, key: "b" },
    { start: 5, end: 6, key: "c" },
  ];
  const index = buildTimingIndex(tokens);
  assert.equal(findTimedToken(index, 2.5).key, "a");
  assert.equal(findTimedToken(index, 4.5), undefined);
  assert.equal(findTimedToken(index, 5).key, "c");
  assert.equal(
    findTimedToken(buildTimingIndex([{ text: "你好" }]), 2),
    undefined,
  );
});

test("file snapshots refresh edited data and response caches support gzip and conditional requests", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wonder-cache-test-"));
  const file = path.join(dir, "lesson.json");
  try {
    fs.writeFileSync(file, JSON.stringify({ title: "First" }));
    const snapshot = createFileSnapshots();
    const first = snapshot(file);
    assert.equal(snapshot(file), first);
    fs.writeFileSync(file, JSON.stringify({ title: "Updated lesson" }));
    assert.equal(snapshot(file).value.title, "Updated lesson");
    assert.notEqual(snapshot(file).version, first.version);
    const send = createJsonResponses();
    const headers = {};
    let body;
    let status;
    const response = {
      set(key, value) {
        if (typeof key === "object") Object.assign(headers, key);
        else headers[key] = value;
        return this;
      },
      send(value) {
        body = value;
      },
      status(value) {
        status = value;
        return this;
      },
      end() {},
    };
    const request = { get() {}, acceptsEncodings: () => "gzip" };
    const value = { text: "你好".repeat(1000) };
    send(request, response, "first", () => value);
    assert.equal(headers["Content-Encoding"], "gzip");
    assert.deepEqual(JSON.parse(gunzipSync(body)), value);
    assert.ok(body.length < JSON.stringify(value).length / 3);
    send({ ...request, get: () => headers.ETag }, response, "first", () => {
      throw new Error("cached data was recomputed");
    });
    assert.equal(status, 304);
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

test("preindexed vocabulary preserves course search results and pagination", () => {
  const vocabulary = read("data/vocabulary.json");
  const dictionary = read("data/dictionary.json");
  const index = buildVocabularyIndex(vocabulary, dictionary);
  for (const query of ["", "change", "爱", "zhōng"]) {
    for (const level of [0, 3, 5, 7]) {
      const old = Object.entries(vocabulary).filter(
        ([word, value]) =>
          (!level || value.level === level) &&
          (!query ||
            word.includes(query) ||
            value.pinyin.includes(query) ||
            dictionary[word]?.definitions
              .join(" ")
              .toLowerCase()
              .includes(query)),
      );
      const result = searchVocabulary(index, query, level, 1);
      assert.equal(result.total, old.length);
      assert.deepEqual(
        result.rows.map((row) => row.word),
        old.slice(60, 120).map(([word]) => word),
      );
    }
  }
});

test("client requests coalesce, reuse data, invalidate on edits, and retry failed translations", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let revision = 1;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ revision, translation: "Hello" }));
  };
  const url = "/api/lessons/import-cache-test";
  try {
    const [first, duplicate] = await Promise.all([api(url), api(url)]);
    assert.equal(calls, 1);
    assert.equal(first, duplicate);
    assert.equal(await api(url), first);
    revision = 2;
    await api(`${url}/timing`, { method: "POST" });
    assert.equal(peekResource(url), undefined);
    assert.equal((await api(url)).revision, 2);
    revision = 3;
    assert.equal((await api(url, { fresh: true })).revision, 3);
    assert.equal((await api(url)).revision, 3);
    const before = calls;
    assert.deepEqual(
      await Promise.all([
        fetchTranslation("cache-test-sentence"),
        fetchTranslation("cache-test-sentence"),
      ]),
      ["Hello", "Hello"],
    );
    assert.equal(calls, before + 1);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "temporary" }), { status: 503 });
    await assert.rejects(fetchTranslation("retry-test-sentence"), /temporary/);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ translation: "Recovered" }));
    assert.equal(await fetchTranslation("retry-test-sentence"), "Recovered");
  } finally {
    globalThis.fetch = originalFetch;
    invalidateResource(url);
  }
});

test("an older in-flight read cannot repopulate a cache after mutation", async () => {
  const originalFetch = globalThis.fetch;
  let release;
  const url = "/api/lessons/import-race-test";
  try {
    globalThis.fetch = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const stale = api(url);
    invalidateResource(url);
    release(new Response(JSON.stringify({ revision: "old" })));
    await stale;
    assert.equal(peekResource(url), undefined);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateResource(url);
  }
});
