import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createMediaClock } from "../src/media-clock.js";
import { api, invalidateResource } from "../src/resources.js";
import {
  buildReaderModel,
  buildTimingIndex,
  nextTimingBoundary,
} from "../src/reader-model.js";
import { grammarFor, tokenGrammar } from "../src/grammar.js";
import { compressBuild } from "../scripts/compress-build.mjs";
import { compressedAssets } from "../server-static.mjs";

test("media clock notifies only subscribers and supports precise and second-level snapshots", () => {
  const clock = createMediaClock();
  let notifications = 0;
  const unsubscribe = clock.subscribe(() => notifications++);
  clock.set(1.25);
  clock.set(1.25);
  assert.equal(notifications, 1);
  assert.equal(clock.getSnapshot(), 1.25);
  assert.equal(clock.getWholeSeconds(), 1);
  unsubscribe();
  clock.set(2);
  assert.equal(notifications, 1);
  clock.set(NaN);
  assert.equal(clock.getSnapshot(), 0);
});

test("grammar indexes retain every course match, including split structures", () => {
  for (let number = 1; number <= 36; number++) {
    const lesson = JSON.parse(
      fs.readFileSync(
        new URL(
          `../data/lessons/course-${String(number).padStart(2, "0")}.json`,
          import.meta.url,
        ),
      ),
    );
    const grammar = grammarFor(lesson);
    const model = buildReaderModel(lesson, grammar);
    for (const token of model.tokens)
      assert.deepEqual(
        token.grammarMatches,
        tokenGrammar(token, token.sentence, grammar),
      );
    for (const sentence of model.sentences)
      assert.equal(model.bySentenceKey.get(sentence.key), sentence);
    const index = buildTimingIndex(model.tokens);
    for (const boundary of index.boundaries)
      assert.equal(nextTimingBoundary(index, boundary - 0.000001), boundary);
    assert.equal(nextTimingBoundary(index, Infinity), undefined);
  }
  const index = buildTimingIndex([
    { start: 1, end: 4 },
    { start: 2, end: 3 },
    { start: 5, end: 6 },
  ]);
  assert.equal(nextTimingBoundary(index, 1), 2);
  assert.equal(nextTimingBoundary(index, 4), 5);
});

test("expired API entries revalidate with ETags and reuse the parsed object on 304", async () => {
  const previousFetch = globalThis.fetch,
    previousNow = Date.now;
  const url = "/api/lessons/import-revalidation-test";
  let now = previousNow(),
    calls = 0;
  try {
    Date.now = () => now;
    globalThis.fetch = async (_url, options) => {
      calls++;
      if (calls === 1)
        return new Response(JSON.stringify({ revision: 1 }), {
          headers: { ETag: '"revision-1"' },
        });
      assert.equal(options.headers.get("if-none-match"), '"revision-1"');
      return new Response(null, { status: 304 });
    };
    const first = await api(url);
    now += 31_000;
    const [second, concurrent] = await Promise.all([api(url), api(url)]);
    assert.equal(first, second);
    assert.equal(second, concurrent);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
    Date.now = previousNow;
    invalidateResource(url);
  }
});

test("build compression serves Brotli, gzip and identity with the same content", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reader-assets-"));
  const source = "const message = 'reader';\n".repeat(300);
  fs.writeFileSync(path.join(directory, "app-hash.js"), source);
  compressBuild(directory);
  const app = express();
  app.use("/assets", compressedAssets(directory), express.static(directory));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}/assets/app-hash.js`;
    for (const encoding of ["br", "gzip", "identity"]) {
      const response = await fetch(base, {
        headers: { "Accept-Encoding": encoding },
      });
      assert.equal(await response.text(), source);
      assert.equal(
        response.headers.get("content-encoding"),
        encoding === "identity" ? null : encoding,
      );
      assert.match(response.headers.get("vary"), /Accept-Encoding/i);
      if (encoding !== "identity")
        assert.match(response.headers.get("cache-control"), /immutable/);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("responsive covers preserve every original and reference generated files", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      new URL("../src/assets/course-covers.json", import.meta.url),
    ),
  );
  assert.equal(Object.keys(manifest).length, 36);
  for (const [original, image] of Object.entries(manifest)) {
    assert.ok(
      fs.existsSync(
        new URL(`../data/covers/${path.basename(original)}`, import.meta.url),
      ),
    );
    assert.ok(
      fs.existsSync(
        new URL(`../data/covers/${path.basename(image.src)}`, import.meta.url),
      ),
    );
    assert.match(image.src, /-[a-f0-9]{10}\.webp$/);
    assert.ok(image.width > 0 && image.height > 0);
  }
});
