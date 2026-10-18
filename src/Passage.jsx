import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { prefetchDictionary } from "./resources";

const levelLabel = (level) =>
  level === 7 ? "HSK 7–9" : level ? `HSK ${level}` : "Outside syllabus";
const timeLabel = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const PassageText = memo(function PassageText({
  title,
  model,
  characters,
  pinyin,
  hsk,
  grammar,
  fontFamily,
  fontSize,
  search,
  onPick,
}) {
  const hoverTimer = useRef(null);
  useEffect(() => () => clearTimeout(hoverTimer.current), [model]);
  const warmWord = useCallback((event) => {
    const button = event.target.closest("button[data-word]");
    if (!button || button.contains(event.relatedTarget)) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(
      () => prefetchDictionary(button.dataset.word),
      60,
    );
  }, []);
  const pick = useCallback(
    (event) => {
      const button = event.target.closest("button[data-token]");
      if (!button || !event.currentTarget.contains(button)) return;
      const token = model.byKey.get(button.dataset.token);
      if (token) onPick(token, button);
    },
    [model, onPick],
  );
  return (
    <article
      className={`passage ${hsk ? "show-hsk" : ""} ${grammar ? "show-grammar" : ""} ${pinyin === "off" ? "hide-pinyin" : ""} font-${fontFamily}`}
      style={{ "--reading-size": `${fontSize}px` }}
      lang="zh-CN"
      onClick={pick}
      onPointerOver={warmWord}
      onPointerLeave={() => clearTimeout(hoverTimer.current)}
      onFocus={(event) => {
        const button = event.target.closest("button[data-word]");
        if (button) prefetchDictionary(button.dataset.word);
      }}
    >
      <div className="passage-title">{title}</div>
      {model.paragraphs.map((paragraph, pi) => (
        <p key={pi} className="chinese-paragraph">
          {paragraph.sentences.map((sentence) => (
            <span
              id={`sentence-${sentence.key}`}
              key={sentence.key}
              className="sentence"
            >
              {sentence.tokens.map((token) =>
                token.pinyin ? (
                  <button
                    id={`word-${token.key}`}
                    key={token.key}
                    className={`word level-${token.level || 0} ${search && token.text.includes(search) ? "search-hit" : ""} ${token.hasGrammar ? "grammar-word" : ""}`}
                    data-token={token.key}
                    data-start={token.start}
                    data-word={token.text}
                    aria-label={`${token.text}, ${token.pinyin}, ${levelLabel(token.level)}${token.start != null ? ", play from " + timeLabel(token.start) : ""}`}
                  >
                    <ruby>
                      {characters === "traditional"
                        ? token.traditional
                        : token.text}
                      <rt
                        className={
                          pinyin === "advanced" &&
                          token.level &&
                          token.level < 4
                            ? "invisible"
                            : ""
                        }
                      >
                        {token.pinyin}
                      </rt>
                    </ruby>
                  </button>
                ) : (
                  <span className="punctuation" key={token.key}>
                    {token.text}
                  </span>
                ),
              )}
            </span>
          ))}
        </p>
      ))}
    </article>
  );
});

// Keep transient highlights off the passage render path: only the old/new nodes change.
export function PassageHighlights({
  selectedKey,
  activeKey,
  sentenceKey,
  playing,
  model,
  search,
}) {
  const previous = useRef({});
  useLayoutEffect(() => {
    const next = {
      selected: selectedKey ? `word-${selectedKey}` : null,
      speaking: activeKey ? `word-${activeKey}` : null,
      "speaking-sentence":
        playing && sentenceKey ? `sentence-${sentenceKey}` : null,
    };
    for (const [className, id] of Object.entries(next)) {
      if (previous.current[className] !== id)
        document
          .getElementById(previous.current[className])
          ?.classList.remove(className);
      if (id) document.getElementById(id)?.classList.add(className);
    }
    previous.current = next;
  }, [selectedKey, activeKey, sentenceKey, playing, model, search]);
  return null;
}
