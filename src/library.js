export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7];

export function lessonLevel(lesson) {
  const level = Number(lesson.hskLevel);
  if (Number.isInteger(level) && level >= 1 && level <= 9)
    return Math.min(level, 7);
  return lesson.id.startsWith("course-") ? 5 : null;
}

export function filterLessons(
  catalog,
  {
    query = "",
    levels = [],
    hideRead = false,
    completed = [],
    volume = "all",
  } = {},
) {
  const terms = query
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return catalog.filter((lesson) => {
    if (levels.length && !levels.includes(lessonLevel(lesson))) return false;
    if (hideRead && completed.includes(lesson.id)) return false;
    if (volume !== "all" && lesson.volume !== volume) return false;
    const searchable = [
      lesson.title,
      lesson.english,
      lesson.number,
      lesson.number ? String(lesson.number).padStart(2, "0") : "",
      lessonLevel(lesson)
        ? `HSK ${lessonLevel(lesson) === 7 ? "7–9" : lessonLevel(lesson)}`
        : "",
      lesson.volume,
    ]
      .join(" ")
      .normalize("NFKC")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function groupLessons(lessons) {
  const groups = new Map();
  for (const lesson of lessons) {
    const level = lessonLevel(lesson);
    const title =
      lesson.volume === "My passages" || !lesson.number
        ? "My passages"
        : `${level ? `HSK ${level === 7 ? "7–9" : level} · ` : ""}Standard Course ${lesson.volume || ""}`.trim();
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(lesson);
  }
  return [...groups]
    .map(([title, items]) => ({ title, items }))
    .sort((a, b) => {
      const rank = (group) =>
        group.title === "My passages"
          ? 100
          : (lessonLevel(group.items[0]) || 10) * 2 +
            (group.items[0].volume === "下" ? 1 : 0);
      return rank(a) - rank(b);
    });
}
