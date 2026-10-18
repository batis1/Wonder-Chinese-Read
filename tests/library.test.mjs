import test from "node:test";
import assert from "node:assert/strict";
import { filterLessons, groupLessons, lessonLevel } from "../src/library.js";

const lessons = [
  {
    id: "course-01",
    number: 1,
    volume: "上",
    title: "爱的细节",
    english: "Details of Love",
  },
  {
    id: "course-19",
    number: 19,
    volume: "下",
    title: "家乡的萝卜饼",
    english: "Radish Pancakes from My Hometown",
  },
  {
    id: "future-01",
    number: 1,
    volume: "上",
    hskLevel: 2,
    title: "你好",
    english: "Hello",
  },
  {
    id: "future-02",
    number: 2,
    volume: "上",
    hskLevel: 9,
    title: "文化",
    english: "Culture",
  },
  {
    id: "import-test",
    volume: "My passages",
    title: "我的文章",
    english: "My passage",
  },
];

test("lesson search matches Chinese, English, and lesson numbers with normalized multi-word input", () => {
  assert.deepEqual(
    filterLessons(lessons, { query: "爱的" }).map((lesson) => lesson.id),
    ["course-01"],
  );
  assert.deepEqual(
    filterLessons(lessons, { query: "  LOVE   details  " }).map(
      (lesson) => lesson.id,
    ),
    ["course-01"],
  );
  assert.deepEqual(
    filterLessons(lessons, { query: "１９" }).map((lesson) => lesson.id),
    ["course-19"],
  );
  assert.equal(filterLessons(lessons, { query: "does not exist" }).length, 0);
});

test("book, level, read, and search filters combine without classifying personal passages as HSK 5", () => {
  assert.equal(lessonLevel(lessons[0]), 5);
  assert.equal(lessonLevel(lessons[4]), null);
  assert.deepEqual(
    filterLessons(lessons, {
      levels: [5],
      volume: "下",
      query: "pancakes",
    }).map((lesson) => lesson.id),
    ["course-19"],
  );
  assert.deepEqual(
    filterLessons(lessons, {
      levels: [5],
      hideRead: true,
      completed: ["course-01"],
    }).map((lesson) => lesson.id),
    ["course-19"],
  );
  assert.equal(filterLessons(lessons, { levels: [1] }).length, 0);
  assert.equal(filterLessons(lessons).length, lessons.length);
});

test("future HSK metadata supports multiple levels and the combined 7–9 band", () => {
  assert.deepEqual(
    filterLessons(lessons, { levels: [2, 7] }).map((lesson) => lesson.id),
    ["future-01", "future-02"],
  );
  const groups = groupLessons(lessons);
  assert.deepEqual(
    groups.map((group) => group.title),
    [
      "HSK 2 · Standard Course 上",
      "HSK 5 · Standard Course 上",
      "HSK 5 · Standard Course 下",
      "HSK 7–9 · Standard Course 上",
      "My passages",
    ],
  );
  assert.equal(groups.flatMap((group) => group.items).length, lessons.length);
});
