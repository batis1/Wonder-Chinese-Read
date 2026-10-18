import { performance } from "node:perf_hooks";
import fs from "node:fs";

const base = process.env.BENCHMARK_URL || "http://127.0.0.1:5175";
const cases = {
  lesson: "/api/lessons/course-04",
  dictionary: "/api/dictionary?word=从前",
  vocabulary: "/api/vocabulary?level=5&q=",
  vocabularySearch: "/api/vocabulary?q=change",
  audioRange: "/audio/course-04",
};
const results = {};
for (const [name, route] of Object.entries(cases)) {
  const times = [];
  let bytes = 0;
  for (let i = 0; i < 21; i++) {
    const start = performance.now();
    const response = await fetch(
      base + route,
      name === "audioRange" ? { headers: { Range: "bytes=0-65535" } } : {},
    );
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    bytes = (await response.arrayBuffer()).byteLength;
    if (i) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  results[name] = {
    medianMs: Number(times[10].toFixed(2)),
    p95Ms: Number(times[18].toFixed(2)),
    bytes,
  };
}
const output = process.argv[2];
if (output) fs.writeFileSync(output, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
