import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { coursePoints } from "../src/grammar.js";
import { distinctions } from "../src/distinctions.js";

const read = (name) =>
  JSON.parse(
    fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"),
  );
const notes = Array.from({ length: 36 }, (_, index) =>
  read(`course-notes/course-${String(index + 1).padStart(2, "0")}.json`),
);

test("typed book notes cover every usage and comparison point in both volumes", () => {
  for (const [index, lesson] of notes.entries()) {
    const source = read(`lessons/${lesson.id}.json`);
    assert.deepEqual(lesson.sourcePages, source.grammarPages);
    assert.deepEqual(
      lesson.points.map((note) => note.point),
      [...coursePoints[index], distinctions[index].slice(0, 2).join(" / ")],
    );
    for (const point of lesson.points) {
      assert.ok(
        point.pages.length &&
          point.pages.every((page) => lesson.sourcePages.includes(page)),
        `${lesson.id}: ${point.point} references`,
      );
      if (point.kind === "usage") {
        assert.ok(
          point.blocks.some((block) => block.type === "explanation"),
          `${lesson.id}: ${point.point} explanation`,
        );
        assert.ok(
          point.blocks.some((block) => block.type === "example"),
          `${lesson.id}: ${point.point} examples`,
        );
      } else {
        assert.equal(point.terms.length, 2);
        for (const term of point.terms)
          assert.ok(term.paragraphs.length >= 2, `${lesson.id}: ${term.word}`);
      }
    }
    assert.ok(
      Buffer.byteLength(JSON.stringify(lesson)) < 25000,
      `${lesson.id}: unexpectedly large notes`,
    );
  }
});

test("source examples and usage distinctions survive table extraction", () => {
  const point = (index, name) =>
    notes[index - 1].points.find((note) => note.point === name);
  assert.equal(
    point(1, "如何").blocks.filter((block) => block.type === "example").length,
    4,
  );
  assert.equal(
    point(1, "靠").blocks.filter((block) => block.type === "example").length,
    6,
  );
  assert.match(
    point(26, "来")
      .blocks.map((block) => block.text)
      .join(""),
    /一来……，二来……/,
  );
  assert.match(point(13, "激烈 / 强烈").terms[1].paragraphs.join(""), /35(?:℃|°C)/);
  assert.match(point(20, "记录 / 纪录").terms[0].paragraphs[0], /动词/);
  assert.match(point(20, "记录 / 纪录").terms[1].paragraphs[0], /最好成绩/);
  assert.match(
    point(36, "应付 / 处理").terms[1].paragraphs.join(""),
    /减价出售/,
  );
});
