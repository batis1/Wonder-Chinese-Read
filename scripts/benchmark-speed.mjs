import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { filterLessons } from "../src/library.js";
import { buildVocabularyIndex, searchVocabulary } from "../server-cache.mjs";
import { buildReaderModel } from "../src/reader-model.js";
import { grammarFor } from "../src/grammar.js";

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../data/${file}`, import.meta.url)));
const catalog = read("catalog.json");
const lessons = catalog.map(({ id }) => read(`lessons/${id}.json`));
const index = buildVocabularyIndex(read("vocabulary.json"), read("dictionary.json"));
const results = {};
function measure(name, iterations, operation) {
  for (let i = 0; i < 10; i++) operation(i);
  const samples = [];
  for (let run = 0; run < 7; run++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) operation(i);
    samples.push((performance.now() - start) * 1000 / iterations);
  }
  samples.sort((a, b) => a - b);
  results[name] = { iterations, medianMicroseconds: Number(samples[3].toFixed(3)) };
}
measure("libraryEmptyFilter", 3000, () => filterLessons(catalog));
measure("librarySearch", 3000, (i) => filterLessons(catalog, { query: ["love", "parents", "hsk 5", "汉字"][i % 4] }));
measure("vocabularyBrowse", 1500, (i) => searchVocabulary(index, "", 0, i % 10));
measure("vocabularyLevelBrowse", 1500, (i) => searchVocabulary(index, "", 5, i % 10));
measure("vocabularySearch", 300, (i) => searchVocabulary(index, ["change", "爱", "zhōng"][i % 3], 0, 0));
measure("readerPreparation", 300, (i) => { const lesson = lessons[i % lessons.length]; buildReaderModel(lesson, grammarFor(lesson)); });
const report = { node: process.version, catalog: catalog.length, vocabulary: index.length, results };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
