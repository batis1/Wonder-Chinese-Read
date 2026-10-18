import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { passageVocabulary } from "../src/lesson-vocabulary.js";

const read = (file) =>
  JSON.parse(
    fs.readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8"),
  );
const expectedCounts = [
  38, 39, 41, 40, 46, 41, 45, 43, 38, 37, 41, 43, 37, 41, 39, 41, 33, 40, 44,
  36, 41, 34, 40, 37, 40, 35, 34, 40, 36, 36, 29, 39, 38, 34, 35, 37,
];
const vocabulary = read("vocabulary.json");
const lessons = expectedCounts.map((_, index) =>
  read(`course-vocabulary/course-${String(index + 1).padStart(2, "0")}.json`),
);

test("every lesson contains its numbered textbook list with current syllabus labels", () => {
  for (const [index, lesson] of lessons.entries()) {
    const source = read(`lessons/${lesson.id}.json`);
    assert.equal(lesson.words.length, expectedCounts[index], lesson.id);
    assert.equal(
      new Set(lesson.words.map((word) => word.text)).size,
      lesson.words.length,
      `${lesson.id}: duplicate headwords`,
    );
    const expectedNumbers = Array.from(
      { length: index === 4 ? 47 : expectedCounts[index] },
      (_, i) => i + 1,
    ).filter((number) => index !== 4 || number !== 29);
    assert.deepEqual(
      lesson.words.map((word) => word.number),
      expectedNumbers,
      `${lesson.id}: numbering`,
    );
    for (const word of lesson.words) {
      assert.ok(
        source.sourcePages.includes(word.page),
        `${lesson.id}: ${word.text} source page`,
      );
      assert.ok(
        word.pinyin && word.meaning,
        `${lesson.id}: ${word.text} missing pronunciation or meaning`,
      );
      assert.equal(
        word.level,
        vocabulary[word.text]?.level ?? null,
        `${lesson.id}: ${word.text} HSK level`,
      );
    }
  }
});

test("book selection includes listed expressions and excludes incidental passage words", () => {
  const selected = passageVocabulary({ courseVocabulary: lessons[0].words }, [
    { text: "的", pinyin: "de" },
  ]);
  assert.equal(selected.length, 38);
  assert.equal(selected[0].text, "细节");
  assert.equal(selected.at(-1).text, "患难与共");
  assert.ok(!selected.some((word) => word.text === "的"));
  assert.ok(
    lessons[6].words.some((word) => word.text === "精诚所至，金石为开"),
  );
  assert.ok(lessons[17].words.some((word) => word.text === "洒"));
  assert.ok(!lessons[2].words.some((word) => word.text === "翟峰"));
});

test("personal passages retain their unique token vocabulary without a textbook list", () => {
  const tokens = [
    { text: "学习", pinyin: "xué xí" },
    { text: "。" },
    { text: "学习", pinyin: "xué xí" },
    { text: "汉语", pinyin: "hàn yǔ" },
  ];
  assert.deepEqual(
    passageVocabulary({ id: "import-example" }, tokens).map(
      (word) => word.text,
    ),
    ["学习", "汉语"],
  );
});
