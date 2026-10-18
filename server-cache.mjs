import fs from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

export function createFileSnapshots(limit = 100) {
  const cache = new Map();
  return (file) => {
    const stat = fs.statSync(file);
    const version = `${stat.mtimeMs}-${stat.size}`;
    const existing = cache.get(file);
    if (existing?.version === version) return existing;
    const snapshot = {
      version,
      value: JSON.parse(fs.readFileSync(file, "utf8")),
    };
    cache.delete(file);
    cache.set(file, snapshot);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return snapshot;
  };
}

export function createJsonResponses(limit = 240) {
  const cache = new Map();
  return (req, res, key, makeValue) => {
    let entry = cache.get(key);
    if (!entry) {
      const raw = Buffer.from(JSON.stringify(makeValue()));
      entry = {
        raw,
        gzip: raw.length > 1024 ? gzipSync(raw, { level: 4 }) : null,
        etag: `"${createHash("sha1").update(raw).digest("hex")}"`,
      };
      cache.set(key, entry);
      if (cache.size > limit) cache.delete(cache.keys().next().value);
    } else {
      cache.delete(key);
      cache.set(key, entry);
    }
    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-cache",
      ETag: entry.etag,
      Vary: "Accept-Encoding",
    });
    if (req.get("if-none-match") === entry.etag) return res.status(304).end();
    const gzip = entry.gzip && req.acceptsEncodings("gzip");
    if (gzip) res.set("Content-Encoding", "gzip");
    return res.send(gzip ? entry.gzip : entry.raw);
  };
}

export function buildVocabularyIndex(vocabulary, dictionary) {
  return Object.entries(vocabulary).map(([word, value]) => {
    const definitions = dictionary[word]?.definitions || [];
    return {
      word,
      ...value,
      meaning: definitions.slice(0, 3).join("; "),
      search: definitions.join(" ").toLowerCase(),
    };
  });
}

export function searchVocabulary(index, query, level, page) {
  const rows = index.filter(
    (row) =>
      (!level || row.level === level) && (!query || row.word.includes(query) || row.pinyin.includes(query) || row.search.includes(query)),
  );
  return {
    total: rows.length,
    rows: rows
      .slice(page * 60, page * 60 + 60)
      .map(({ search, ...row }) => row),
  };
}
