export function passageVocabulary(lesson, tokens) {
  if (Array.isArray(lesson?.courseVocabulary)) return lesson.courseVocabulary;
  const unique = new Map();
  for (const token of tokens)
    if (token.pinyin && !unique.has(token.text)) unique.set(token.text, token);
  return [...unique.values()];
}
