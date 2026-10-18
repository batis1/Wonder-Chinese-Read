import React, { memo, useMemo, useState } from "react";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  HSK_LEVELS,
  filterLessons,
  groupLessons,
  lessonLevel,
} from "./library";
import { prefetchLesson } from "./resources";
import { coverImage } from "./cover-images";

const levelLabel = (level) => `HSK ${level === 7 ? "7–9" : level}`;

export default memo(function LessonLibrary({
  catalog,
  completed,
  savedLessons,
  onOpen,
  volume,
  onVolumeChange,
  filters,
  onFiltersChange,
  loading,
  error,
  onRetry,
  onAdd,
}) {
  const [expanded, setExpanded] = useState([]);
  const { query, levels, hideRead } = filters;
  const filtered = useMemo(
    () => filterLessons(catalog, { ...filters, completed, volume }),
    [catalog, filters, completed, volume],
  );
  const groups = useMemo(() => groupLessons(filtered), [filtered]);
  const searching = query.trim().length > 0;
  const update = (changes) => onFiltersChange({ ...filters, ...changes });
  const clear = () => {
    onFiltersChange({ query: "", levels: [], hideRead: false });
    onVolumeChange("all");
  };
  const card = (lesson) => {
    const level = lessonLevel(lesson);
    const read = completed.includes(lesson.id);
    return (
      <li key={lesson.id}>
        <a
          className={`catalog-card catalog-level-${level || 0}`}
          href={`#${lesson.id}`}
          onPointerEnter={() => prefetchLesson(lesson.id)}
          onPointerDown={() => prefetchLesson(lesson.id)}
          onFocus={() => prefetchLesson(lesson.id)}
          onClick={(e) => {
            e.preventDefault();
            onOpen(lesson.id);
          }}
        >
          <span className="catalog-card-meta">
            <span>
              {lesson.number
                ? `Lesson ${String(lesson.number).padStart(2, "0")} · ${lesson.volume}`
                : "My passage"}
            </span>
            <span
              className={`catalog-read-state ${read ? "is-read" : ""}`}
              title={read ? "Read" : "Unread"}
            >
              {read && <Check size={13} aria-hidden="true" />}
              <span className="sr-only">{read ? "Read" : "Unread"}</span>
            </span>
          </span>
          {lesson.cover ? (
            <img
              className="catalog-image"
              {...coverImage(lesson.cover, true)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span
              className="catalog-image catalog-text-cover"
              aria-hidden="true"
            >
              <BookOpen size={30} strokeWidth={1.2} />
              <span lang="zh-CN">{lesson.title}</span>
            </span>
          )}
          <span className="catalog-title" lang="zh-CN">
            {lesson.title}
          </span>
          <span className="catalog-english">
            {lesson.english || "Personal passage"}
          </span>
          <span className="catalog-card-bottom">
            {savedLessons.includes(lesson.id) && (
              <Bookmark size={14} aria-label="Saved lesson" />
            )}
            <span>{level ? levelLabel(level) : "Personal"}</span>
          </span>
        </a>
      </li>
    );
  };
  return (
    <main className="lesson-catalog" aria-label="Lessons">
      <h1 className="sr-only">Lessons</h1>
      <div className="catalog-search-row">
        <div className="search-field catalog-search">
          <input
            aria-label="Search lessons"
            placeholder="Search lessons…"
            value={query}
            onChange={(e) => update({ query: e.target.value })}
            type="search"
          />
          {query ? (
            <button
              title="Clear search"
              aria-label="Clear search"
              onClick={() => update({ query: "" })}
            >
              <X size={17} />
            </button>
          ) : (
            <Search size={19} aria-hidden="true" />
          )}
        </div>
        <label className="catalog-hide-read">
          <input
            type="checkbox"
            checked={hideRead}
            onChange={(e) => update({ hideRead: e.target.checked })}
          />
          Hide read content
        </label>
      </div>
      <div
        className="catalog-levels"
        role="group"
        aria-label="Filter by HSK level"
      >
        {HSK_LEVELS.map((level) => (
          <label
            className={`catalog-level-filter catalog-level-${level} ${levels.includes(level) ? "is-selected" : ""}`}
            key={level}
          >
            {levelLabel(level)}
            <input
              type="checkbox"
              checked={levels.includes(level)}
              onChange={(e) =>
                update({
                  levels: e.target.checked
                    ? [...levels, level]
                    : levels.filter((value) => value !== level),
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="catalog-browse-row">
        <div className="segmented" role="group" aria-label="Filter by book">
          {[
            ["all", "All lessons"],
            ["上", "上"],
            ["下", "下"],
            ["My passages", "My passages"],
          ].map(([value, text]) => (
            <button
              key={value}
              aria-pressed={volume === value}
              className={volume === value ? "active" : ""}
              onClick={() => onVolumeChange(value)}
            >
              {text}
            </button>
          ))}
        </div>
        <span className="catalog-result-count" role="status">
          {filtered.length} {filtered.length === 1 ? "lesson" : "lessons"}
        </span>
      </div>
      {loading ? (
        <p className="catalog-empty" role="status">
          Loading lessons…
        </p>
      ) : error ? (
        <div className="catalog-empty" role="alert">
          <p>{error}</p>
          <button className="primary" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : !filtered.length ? (
        <div className="catalog-empty">
          <BookOpen size={30} aria-hidden="true" />
          <h2>
            {levels.length === 1 &&
            !catalog.some((lesson) => lessonLevel(lesson) === levels[0])
              ? `No ${levelLabel(levels[0])} lessons yet`
              : "No lessons found"}
          </h2>
          <div className="catalog-empty-actions">
            <button onClick={clear}>Clear filters</button>
            {onAdd && <button onClick={onAdd}>Add passage</button>}
          </div>
        </div>
      ) : searching ? (
        <section
          className="catalog-section"
          aria-labelledby="search-results-title"
        >
          <h2 id="search-results-title">Search results</h2>
          <ul className="catalog-grid">{filtered.map(card)}</ul>
        </section>
      ) : (
        groups.map(({ title, items }, index) => {
          const open = expanded.includes(title);
          return (
            <section
              className="catalog-section"
              aria-labelledby={`catalog-section-${index}`}
              key={title}
            >
              <div className="catalog-section-heading">
                <h2 id={`catalog-section-${index}`}>{title}</h2>
                {items.length > 4 && (
                  <button
                    aria-expanded={open}
                    aria-controls={`catalog-grid-${index}`}
                    aria-label={`${open ? "Show fewer" : "See all"} ${title} lessons`}
                    onClick={() =>
                      setExpanded((previous) =>
                        open
                          ? previous.filter((value) => value !== title)
                          : [...previous, title],
                      )
                    }
                  >
                    {open ? "Show fewer" : `See all ${items.length}`}
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
              <ul className="catalog-grid" id={`catalog-grid-${index}`}>
                {(open ? items : items.slice(0, 4)).map(card)}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
});
