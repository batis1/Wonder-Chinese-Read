import { grammarFor } from "./src/grammar.js";

export function readerGrammar(lesson) {
  return grammarFor(lesson).map((rule) => ({
    ...rule,
    examples: rule.examples.map(({ text, translation }) => ({
      text,
      ...(translation ? { translation } : {}),
    })),
  }));
}

export function preparedCourseLesson(source, words, translations, audioUrl) {
  const { audio, grammarSource, ...lesson } = source;
  const cached = {};
  for (const paragraph of lesson.paragraphs)
    for (const sentence of paragraph.sentences)
      if (translations[sentence.text]) cached[sentence.text] = translations[sentence.text];
  return { ...lesson, courseVocabulary: words, translations: cached, audioUrl, readerGrammar: readerGrammar(lesson) };
}
