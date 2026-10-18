import React, { memo } from "react";
import { BookOpen } from "lucide-react";

export function BookPageReferences({ pages }) {
  return (
    <ul className="book-page-references" aria-label="Book page references">
      {pages.map((page) => (
        <li key={page}>Book page {page}</li>
      ))}
    </ul>
  );
}

export const CourseBookNote = memo(function CourseBookNote({
  note,
  loading,
  error,
  onRetry,
}) {
  if (loading)
    return (
      <p className="muted" role="status">
        Loading course notes…
      </p>
    );
  if (error)
    return (
      <div role="alert">
        <p className="error">{error}</p>
        <button onClick={onRetry}>Retry course notes</button>
      </div>
    );
  if (!note) return null;
  const sections = [];
  for (const block of note.blocks || []) {
    if (block.type === "example") {
      if (sections.at(-1)?.type !== "examples")
        sections.push({ type: "examples", items: [] });
      sections.at(-1).items.push(block);
    } else sections.push(block);
  }
  return (
    <section className="book-note" aria-label="Course notes and examples">
      <h3>
        <BookOpen size={19} />
        Course notes &amp; examples
      </h3>
      <BookPageReferences pages={note.pages} />
      {sections.map((section, index) =>
        section.type === "examples" ? (
          <ol className="book-examples" key={index}>
            {section.items.map((item, itemIndex) => (
              <li value={item.number} key={itemIndex} lang="zh-CN">
                {item.text}
              </li>
            ))}
          </ol>
        ) : (
          <p className="book-explanation" lang="zh-CN" key={index}>
            {section.text}
          </p>
        ),
      )}
      {note.kind === "comparison" && (
        <>
          {note.common.length > 0 && (
            <section className="book-shared">
              <h4>Shared meaning</h4>
              {note.common.map((text, index) => (
                <p lang="zh-CN" key={index}>
                  {text}
                </p>
              ))}
            </section>
          )}
          <div className="book-comparison">
            {note.terms.map((term) => (
              <section key={term.word}>
                <h4 lang="zh-CN">{term.word}</h4>
                {term.paragraphs.map((text, index) => (
                  <p
                    className={
                      text.startsWith("如") ? "book-comparison-example" : ""
                    }
                    lang="zh-CN"
                    key={index}
                  >
                    {text}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
});
