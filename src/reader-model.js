export function buildReaderModel(lesson, grammar) {
  const sentences = [];
  const tokens = [];
  const byKey = new Map();
  const bySentenceKey = new Map();
  const preparedGrammar = grammar.map((rule) => ({
    rule,
    sentenceTexts: /^(为所|来去|得起|得不行)$/.test(rule.point)
      ? new Set(rule.examples.map((example) => example.text))
      : null,
  }));
  const paragraphs = (lesson?.paragraphs || []).map((paragraph, pi) => ({
    sentences: paragraph.sentences.map((source, si) => {
      const sentence = {
        ...source,
        key: `${pi}-${si}`,
        index: sentences.length,
      };
      sentences.push(sentence);
      bySentenceKey.set(sentence.key, sentence);
      sentence.tokens = source.tokens.map((token, ti) => {
        const word = { ...token, key: `${sentence.key}-${ti}`, sentence };
        word.grammarMatches = preparedGrammar
          .filter(
            ({ rule, sentenceTexts }) =>
              rule.point.includes(token.text) ||
              token.text.includes(rule.point) ||
              sentenceTexts?.has(source.text),
          )
          .map(({ rule }) => rule);
        word.hasGrammar = word.grammarMatches.length > 0;
        tokens.push(word);
        byKey.set(word.key, word);
        return word;
      });
      return sentence;
    }),
  }));
  return { paragraphs, sentences, tokens, byKey, bySentenceKey };
}

export function buildTimingIndex(tokens) {
  const timed = tokens.filter(
    (token) => token.start != null && token.end > token.start,
  );
  const maxEnds = [];
  let maxEnd = -Infinity;
  for (const token of timed) {
    maxEnd = Math.max(maxEnd, token.end);
    maxEnds.push(maxEnd);
  }
  const boundaries = [
    ...new Set(timed.flatMap((token) => [token.start, token.end])),
  ].sort((a, b) => a - b);
  return { timed, maxEnds, boundaries };
}

export function nextTimingBoundary({ boundaries }, seconds) {
  let low = 0,
    high = boundaries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (boundaries[middle] <= seconds) low = middle + 1;
    else high = middle;
  }
  return boundaries[low];
}

export function findTimedToken({ timed, maxEnds }, clock) {
  let low = 0;
  let high = timed.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (maxEnds[middle] <= clock) low = middle + 1;
    else high = middle;
  }
  for (let i = low; i < timed.length && timed[i].start <= clock; i++)
    if (clock < timed[i].end) return timed[i];
}
