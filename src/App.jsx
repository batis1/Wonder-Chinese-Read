import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Search,
  SlidersHorizontal,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Languages,
  Library,
  GraduationCap,
  Download,
  RotateCcw,
  Moon,
  Sun,
  FileText,
  Headphones,
  Link,
  Pencil,
  StickyNote,
  LoaderCircle,
  List,
  Settings,
  Trash2,
} from "lucide-react";
import LessonLibrary from "./LessonLibrary";
import { BookPageReferences, CourseBookNote } from "./CourseBookNote";
import { passageVocabulary } from "./lesson-vocabulary";
import readMark from "./assets/read-mark.svg";
import { PassageText, PassageHighlights } from "./Passage";
import { buildReaderModel, buildTimingIndex } from "./reader-model";
import { useAudioTracking } from "./useAudioTracking";
import { createMediaClock, initialAudioPosition } from "./media-clock";
import { createProgressStore } from "./progress-store";
import { AudioProgress, AudioTime } from "./AudioProgress";
import { coverImage } from "./cover-images";
import {
  api,
  peekResource,
  prefetchLesson,
  whenIdle,
  rememberTranslations,
  peekTranslation,
  fetchTranslation,
} from "./resources";

const localProcessing = !import.meta.env.VITE_HOSTED;
const emptyGrammar = [];

const defaults = {
  pinyin: "all",
  characters: "simplified",
  hsk: true,
  grammar: true,
  translation: true,
  fontSize: 25,
  fontFamily: "system",
  theme: "light",
  follow: true,
};
function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`wonder:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}
function useStored(key, initial) {
  const [v, set] = useState(() => stored(key, initial));
  useEffect(() => {
    const persist = () =>
      localStorage.setItem(`wonder:${key}`, JSON.stringify(v));
    const cancel = whenIdle(persist);
    window.addEventListener("pagehide", persist);
    return () => {
      cancel();
      window.removeEventListener("pagehide", persist);
    };
  }, [key, v]);
  return [v, set];
}
const post = (url, body) =>
  api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const time = (s) =>
  `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;
const label = (level) =>
  level === 7 ? "HSK 7–9" : level ? `HSK ${level}` : "Outside syllabus";
function IconButton({ icon: Icon, label: tip, active, children, ...props }) {
  return (
    <button
      type="button"
      title={tip}
      aria-label={tip}
      className={`icon-button ${active ? "active" : ""}`}
      {...props}
    >
      <Icon size={19} />
      {children}
    </button>
  );
}
function Modal({ title, children, onClose, wide = false, drawer = false }) {
  const box = useRef(null);
  const previous = useRef(document.activeElement);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous.current?.focus();
    };
  }, []);
  return (
    <div
      className={`overlay ${drawer ? "drawer-overlay" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={box}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = box.current.querySelectorAll(
              "button:not([disabled]),input,select,textarea,a[href]",
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
function Toggle({ label: txt, checked, onChange }) {
  return (
    <label className="preference">
      <span>{txt}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function App() {
  const [catalog, setCatalog] = useState([]),
    [catalogLoading, setCatalogLoading] = useState(true),
    [catalogError, setCatalogError] = useState(""),
    [lesson, setLesson] = useState(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [id, setId] = useState(() =>
    /^#(course-|import-)/.test(location.hash)
      ? location.hash.slice(1)
      : stored("lastLesson", "course-01"),
  );
  const [prefs, setPrefs] = useStored("preferences", defaults),
    [saved, setSaved] = useStored("words", {}),
    [savedLessons, setSavedLessons] = useStored("lessons", []),
    [completed, setCompleted] = useStored("completed", []),
    [notes, setNotes] = useStored("notes", {});
  const [progress] = useState(() => createProgressStore(
    stored("progress", {}),
    (value) => localStorage.setItem("wonder:progress", JSON.stringify(value)),
  ));
  useEffect(() => {
    const onHidden = () => { if (document.hidden) progress.flush(); };
    window.addEventListener("pagehide", progress.flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", progress.flush);
      document.removeEventListener("visibilitychange", onHidden);
      progress.flush();
    };
  }, [progress]);
  const [panel, setPanel] = useState(null),
    [libraryOpen, setLibraryOpen] = useState(
      () => !/^#(course-|import-)/.test(location.hash),
    ),
    [libraryVolume, setLibraryVolume] = useState("all"),
    [libraryFilters, setLibraryFilters] = useState({
      query: "",
      levels: [],
      hideRead: false,
    }),
    [tab, setTab] = useState("all"),
    [selected, setSelected] = useState(null),
    [dictionary, setDictionary] = useState(null),
    [grammarPoint, setGrammarPoint] = useState(null),
    [toast, setToast] = useState("");
  const [playing, setPlaying] = useState(false),
    [duration, setDuration] = useState(0),
    [speed, setSpeed] = useState(1),
    [loop, setLoop] = useState(false),
    [muted, setMuted] = useState(false),
    [search, setSearch] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    [meaningHidden, setMeaningHidden] = useState(false);
  const [mediaClock] = useState(createMediaClock);
  const [translations, setTranslations] = useState({}),
    [translating, setTranslating] = useState(false),
    [translationError, setTranslationError] = useState(""),
    [sentenceKey, setSentenceKey] = useState(""),
    [pop, setPop] = useState(null);
  const [vocab, setVocab] = useState({ rows: [], total: 0 }),
    [vocabLevel, setVocabLevel] = useState(""),
    [vocabPage, setVocabPage] = useState(0),
    [vocabQuery, setVocabQuery] = useState("");
  const vocabularyUrl = `/api/vocabulary?level=${vocabLevel}&q=${encodeURIComponent(vocabQuery)}&page=${vocabPage}`;
  const warmVocabulary = () => api(vocabularyUrl).catch(() => {});
  const savedWords = useMemo(() => Object.values(saved), [saved]);
  const [courseNotes, setCourseNotes] = useState(null);
  const [courseNotesError, setCourseNotesError] = useState("");
  const [courseNotesRetry, setCourseNotesRetry] = useState(0);
  const retryCourseNotes = useCallback(
    () => setCourseNotesRetry((value) => value + 1),
    [],
  );
  const needsCourseNotes = Boolean(
    lesson?.number && (panel === "grammar" || grammarPoint),
  );
  const audio = useRef(null),
    pendingSeek = useRef(null),
    reader = useRef(null),
    lastProgress = useRef(0),
    requestRef = useRef(0),
    fileInput = useRef(null),
    backupInput = useRef(null);
  const grammar = lesson?.readerGrammar || emptyGrammar;
  const readerModel = useMemo(
    () => buildReaderModel(lesson, grammar),
    [lesson, grammar],
  );
  const sentences = readerModel.sentences;
  const flat = readerModel.tokens;
  const timingIndex = useMemo(() => buildTimingIndex(flat), [flat]);
  useAudioTracking({
    audio,
    index: timingIndex,
    playing,
    enabled: !libraryOpen && !loading,
    follow: prefs.follow,
    blocked: Boolean(pop || panel || dictionary || grammarPoint),
    onSentence: setSentenceKey,
  });
  const currentSentence =
    readerModel.bySentenceKey.get(sentenceKey) || sentences[0];
  const stats = useMemo(() => passageVocabulary(lesson, flat), [lesson, flat]);
  const searchMatches = useMemo(
    () => search ? flat.filter((token) => token.text.includes(search)) : [],
    [flat, search],
  );
  const flash = (text) => {
    setToast(text);
  };
  const refreshCatalog = useCallback(() => {
    setCatalogLoading(true);
    setCatalogError("");
    return api("/api/catalog", { fresh: true })
      .then(setCatalog)
      .catch((e) => setCatalogError(e.message))
      .finally(() => setCatalogLoading(false));
  }, []);
  useEffect(() => {
    refreshCatalog();
  }, []);
  useEffect(() => {
    if (!needsCourseNotes) return;
    let active = true;
    setCourseNotesError("");
    api(`/api/course-notes/${id}`, { fresh: courseNotesRetry > 0 })
      .then((notes) => {
        if (active) setCourseNotes(notes);
      })
      .catch(() => {
        if (active) setCourseNotesError("Course notes could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [id, needsCourseNotes, courseNotesRetry]);
  useEffect(() => {
    if (libraryOpen || lesson?.id === id) return;
    let alive = true;
    audio.current?.pause();
    speechSynthesis.cancel();
    setPlaying(false);
    mediaClock.set(0);
    setDuration(0);
    pendingSeek.current = null;
    const cached = peekResource(`/api/lessons/${id}`);
    setLoading(!cached);
    setLoadError("");
    setSelected(null);
    setPop(null);
    setSentenceKey("");
    setSearch("");
    requestRef.current++;
    setTranslating(false);
    setTranslationError("");
    setLesson(cached || null);
    rememberTranslations(cached?.translations);
    setTranslations(cached?.translations || {});
    localStorage.setItem("wonder:lastLesson", JSON.stringify(id));
    api(`/api/lessons/${id}`)
      .then((l) => {
        if (alive) {
          setLesson(l);
          rememberTranslations(l.translations);
          setTranslations(l.translations || {});
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    window.scrollTo(0, 0);
    return () => {
      alive = false;
    };
  }, [id, libraryOpen]);
  useEffect(() => {
    if (libraryOpen || !lesson) return;
    return whenIdle(() => {
      const index = catalog.findIndex((item) => item.id === id);
      prefetchLesson(catalog[index + 1]?.id);
      if (lesson.number) api(`/api/course-notes/${id}`).catch(() => {});
    });
  }, [id, lesson, catalog, libraryOpen]);
  useEffect(() => {
    const change = () => {
      const next = location.hash.slice(1);
      if (!next || next === "lessons") {
        setLibraryOpen(true);
        setPanel(null);
      } else if (/^(course-|import-)/.test(next)) {
        setLibraryOpen(false);
        setPanel(null);
        if (next !== id) setId(next);
      }
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [id]);
  useEffect(() => {
    if (libraryOpen) {
      pause();
      setPop(null);
      setDictionary(null);
      setGrammarPoint(null);
    }
    window.scrollTo(0, 0);
  }, [libraryOpen]);
  useEffect(() => {
    const pending =
      lesson &&
      (lesson.processing ||
        ["queued", "aligning"].includes(lesson.alignmentStatus));
    if (!pending) return;
    let live = true;
    const timer = setInterval(
      () =>
        api(`/api/lessons/${id}`, { fresh: true })
          .then((l) => {
            if (live) setLesson(l);
          })
          .catch(() => {}),
      3000,
    );
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id, lesson?.alignmentStatus, lesson?.processing]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const updateChrome = () => {
      const dark = prefs.theme === "dark" || (prefs.theme === "system" && scheme.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#ffffff");
    };
    updateChrome();
    scheme.addEventListener("change", updateChrome);
    return () => scheme.removeEventListener("change", updateChrome);
  }, [prefs.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!panel) return;
    setPop(null);
  }, [panel]);
  useEffect(() => {
    if (panel !== "vocabulary") return;
    const url = `/api/vocabulary?level=${vocabLevel}&q=${encodeURIComponent(vocabQuery)}&page=${vocabPage}`;
    const cached = peekResource(url);
    if (cached) { setVocab(cached); return; }
    let alive = true;
    const timer = setTimeout(
      () =>
        api(url)
          .then((r) => {
            if (alive) setVocab(r);
          })
          .catch((e) => { if (alive) flash(e.message); }),
      vocabQuery ? 40 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [panel, vocabLevel, vocabQuery, vocabPage]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        if (grammarPoint) setGrammarPoint(null);
        else if (dictionary) setDictionary(null);
        else if (panel) setPanel(null);
        else setPop(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panel, dictionary, grammarPoint]);
  useEffect(() => {
    const close = (e) => {
      if (
        pop &&
        !e.target.closest(".word-popover") &&
        !e.target.closest(".word")
      )
        setPop(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pop]);
  const updatePref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }));
  const go = useCallback((next) => {
    setId(next);
    setLibraryOpen(false);
    location.hash = next;
    setPanel(null);
    setGrammarPoint(null);
    window.scrollTo(0, 0);
  }, []);
  const openImport = useCallback(() => setPanel("import"), []);
  const openLibrary = (volume = "all") => {
    setLibraryVolume(volume);
    setLibraryOpen(true);
    setPanel(null);
    setGrammarPoint(null);
    location.hash = "lessons";
    window.scrollTo(0, 0);
  };
  async function translate(s) {
    if (!s) return;
    const req = ++requestRef.current;
    const cached =
      translations[s.text] || peekTranslation(s.text) || s.translation;
    setTranslationError("");
    if (cached) {
      setTranslations((previous) =>
        previous[s.text] ? previous : { ...previous, [s.text]: cached },
      );
      setTranslating(false);
      return;
    }
    setTranslating(true);
    try {
      const translation = await fetchTranslation(s.text);
      if (req === requestRef.current)
        setTranslations((t) => ({ ...t, [s.text]: translation }));
    } catch (e) {
      if (req === requestRef.current) setTranslationError(e.message);
    } finally {
      if (req === requestRef.current) setTranslating(false);
    }
  }
  useEffect(() => {
    if (!libraryOpen && prefs.translation && currentSentence) {
      translate(currentSentence);
    }
  }, [currentSentence?.text, prefs.translation, id, libraryOpen]);
  useEffect(() => {
    if (
      libraryOpen ||
      !prefs.translation ||
      translating ||
      !translations[currentSentence?.text]
    )
      return;
    const next = sentences[(currentSentence?.index ?? -1) + 1];
    if (!next || peekTranslation(next.text)) return;
    const timer = setTimeout(
      () => fetchTranslation(next.text).catch(() => {}),
      500,
    );
    return () => clearTimeout(timer);
  }, [
    currentSentence,
    translations,
    translating,
    libraryOpen,
    prefs.translation,
  ]);
  function pause() {
    audio.current?.pause();
    speechSynthesis.cancel();
    setPlaying(false);
  }
  function speak(text) {
    audio.current?.pause();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = speed;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => {
      setPlaying(false);
      flash("Speech is unavailable in this browser.");
    };
    speechSynthesis.speak(utterance);
    setPlaying(true);
  }
  async function play() {
    if (playing) {
      pause();
      return;
    }
    if (lesson?.audioUrl) {
      try {
        await audio.current.play();
      } catch {
        flash("Audio could not play. Try again.");
      }
    } else if (currentSentence) {
      speak(currentSentence.text);
    }
  }
  const seek = useCallback(
    (seconds, autoplay = false) => {
      if (!audio.current || !lesson?.audioUrl) return;
      const target = Math.max(
        0,
        Math.min(
          Number.isFinite(duration) && duration > 0 ? duration : Infinity,
          seconds,
        ),
      );
      pendingSeek.current = audio.current.readyState === 0 ? target : null;
      audio.current.currentTime = target;
      mediaClock.set(target);
      if (autoplay)
        audio.current
          .play()
          .catch(() => flash("Press Play to start the recording."));
    },
    [duration, lesson?.audioUrl, mediaClock],
  );
  const pick = useCallback(
    (t, button) => {
      const rect = button.getBoundingClientRect();
      if (t.start != null) seek(t.start, true);
      setSelected(t);
      setSentenceKey(t.sentence.key);
      setMeaningHidden(false);
      setPop({
        x: Math.max(12, Math.min(innerWidth - 192, rect.left)),
        y: Math.min(innerHeight - 230, rect.bottom + 8),
      });
      api(`/api/dictionary?word=${encodeURIComponent(t.text)}`).catch(() => {});
    },
    [seek],
  );
  function saveWord(t) {
    setSaved((s) => {
      const next = { ...s };
      if (next[t.text]) delete next[t.text];
      else
        next[t.text] = {
          ...t,
          key: undefined,
          sentence: undefined,
          grammarMatches: undefined,
          lessonId: id,
          lessonTitle: lesson?.title || catalog.find((item) => item.id === id)?.title || "",
          savedAt: Date.now(),
        };
      return next;
    });
  }
  async function openDictionary(word) {
    setPop(null);
    const cached = peekResource(
      `/api/dictionary?word=${encodeURIComponent(word)}`,
    );
    if (cached) {
      setDictionary(cached);
      return;
    }
    try {
      const r = await api(`/api/dictionary?word=${encodeURIComponent(word)}`);
      setDictionary(r);
    } catch (e) {
      flash(e.message);
    }
  }
  function selectGrammar(g) {
    setGrammarPoint(g);
    setPanel(null);
    setPop(null);
  }
  const toggleLesson = () =>
    setSavedLessons((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const changeSentence = (delta) => {
    const index = currentSentence?.index || 0;
    const s =
      sentences[Math.max(0, Math.min(sentences.length - 1, index + delta))];
    if (!s) return;
    setSentenceKey(s.key);
    setSelected(null);
    if (s.start != null) seek(s.start, playing);
    else if (playing && !lesson.audioUrl) speak(s.text);
    document
      .getElementById(`sentence-${s.key}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  function exportBackup() {
    const file = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            saved,
            savedLessons,
            completed,
            notes,
            progress: progress.get(),
            prefs,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wonder-chinese-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function restoreBackup(event) {
    try {
      const v = JSON.parse(await event.target.files[0].text());
      if (v.version !== 1 || !v.saved || !v.prefs)
        throw new Error("Invalid Wonder Chinese backup.");
      setSaved((s) => ({ ...s, ...v.saved }));
      setSavedLessons((s) => [...new Set([...s, ...(v.savedLessons || [])])]);
      setCompleted((s) => [...new Set([...s, ...(v.completed || [])])]);
      setNotes((s) => ({ ...s, ...(v.notes || {}) }));
      progress.set((s) => ({ ...s, ...(v.progress || {}) }));
      setPrefs({ ...defaults, ...v.prefs });
      flash("Study data restored.");
    } catch (e) {
      flash(e.message);
    }
    event.target.value = "";
  }
  async function attachAudio(e) {
    if (!e.target.files[0]) return;
    const form = new FormData();
    form.append("audio", e.target.files[0]);
    try {
      await api(`/api/lessons/${id}/audio`, { method: "POST", body: form });
      setLesson(await api(`/api/lessons/${id}`));
      flash("Audio attached. Local alignment is queued.");
    } catch (e) {
      flash(e.message);
    }
    e.target.value = "";
  }
  const playbackStatus = lesson?.alignmentStatus;
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a
            href="#lessons"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              openLibrary();
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              <img src={readMark} alt="" width="30" height="30" />
            </span>
            <span>
              Wonder Chinese <b>Read</b>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <button
              aria-label="Lessons"
              title="Lessons"
              className={libraryOpen ? "nav-current" : ""}
              aria-current={libraryOpen ? "page" : undefined}
              onClick={() => openLibrary()}
            >
              <Library size={16} />
              <span>Lessons</span>
            </button>
            <button
              aria-label="HSK 3.0 vocabulary"
              title="HSK 3.0 vocabulary"
              onPointerEnter={warmVocabulary}
              onPointerDown={warmVocabulary}
              onFocus={warmVocabulary}
              onClick={() => {
                const cached = peekResource(vocabularyUrl);
                if (cached) setVocab(cached);
                setPanel("vocabulary");
              }}
            >
              <GraduationCap size={17} />
              <span>HSK 3.0</span>
            </button>
            <button
              aria-label="Saved words and lessons"
              title="Saved words and lessons"
              onClick={() => setPanel("saved")}
            >
              <Bookmark size={16} />
              <span>
                Saved <small>{savedWords.length}</small>
              </span>
            </button>
            {localProcessing && <button
              className="import-button"
              aria-label="Add passage"
              title="Add passage"
              onClick={() => setPanel("import")}
            >
              <Plus size={17} />
              <span>Add passage</span>
            </button>}
          </nav>
        </div>
      </header>
      {libraryOpen ? (
        <LessonLibrary
          catalog={catalog}
          completed={completed}
          savedLessons={savedLessons}
          onOpen={go}
          volume={libraryVolume}
          onVolumeChange={setLibraryVolume}
          filters={libraryFilters}
          onFiltersChange={setLibraryFilters}
          loading={catalogLoading}
          error={catalogError}
          onRetry={refreshCatalog}
          onAdd={localProcessing ? openImport : undefined}
        />
      ) : loading ? (
        <main className="loading">
          <LoaderCircle className="spin" /> Opening passage…
        </main>
      ) : loadError ? (
        <main className="loading">
          <p>{loadError}</p>
          <button onClick={() => location.reload()}>Retry</button>
          <button onClick={() => openLibrary()}>Open lessons</button>
        </main>
      ) : (
        lesson && (
          <>
            <main className="page">
              <div className="breadcrumbs">
                <button onClick={() => openLibrary()}>Lessons</button>
                <ChevronRight size={13} />
                <button
                  onClick={() => {
                    openLibrary(lesson.volume);
                  }}
                >
                  {lesson.number
                    ? `HSK Standard Course 5 · ${lesson.volume}`
                    : "My passages"}
                </button>
                <ChevronRight size={13} />
                <span>{lesson.title}</span>
              </div>
              <section className="lesson-intro">
                <div className="lesson-description">
                  <h1>{lesson.title}</h1>
                  <p className="english-title">{lesson.english}</p>
                  <div className="intro-actions">
                    <button
                      className={`save-lesson ${savedLessons.includes(id) ? "saved" : ""}`}
                      onClick={toggleLesson}
                    >
                      {savedLessons.includes(id) ? (
                        <BookmarkCheck size={16} />
                      ) : (
                        <Bookmark size={16} />
                      )}{" "}
                      {savedLessons.includes(id)
                        ? "Lesson saved"
                        : "Save lesson"}
                    </button>
                    <span>
                      <FileText size={14} />
                      {lesson.text.replace(/\s/g, "").length} characters
                    </span>
                  </div>
                  <p className="lesson-excerpt">{sentences[0]?.text}</p>
                </div>
                {lesson.cover && (
                  <img
                    className="lesson-cover"
                    {...coverImage(lesson.cover)}
                    decoding="async"
                    fetchPriority="high"
                    alt={`${lesson.title} — illustration from the course book`}
                  />
                )}
              </section>
              <section
                className="reading-shell"
                ref={reader}
                aria-label="Passage reader"
              >
                {!meaningHidden && (
                  <div className="meaning-tray">
                    <div className="sentence-meaning">
                      <div className="tray-label">
                        <span>Translation in context</span>
                        <button onClick={() => setMeaningHidden(true)}>
                          Hide
                        </button>
                      </div>
                      <div className="translation-text">
                        {!prefs.translation ? (
                          <button
                            onClick={() => updatePref("translation", true)}
                          >
                            Show sentence translation
                          </button>
                        ) : translating ? (
                          <span className="muted">Translating…</span>
                        ) : translationError ? (
                          <button
                            className="error"
                            onClick={() => translate(currentSentence)}
                          >
                            {translationError} Retry
                          </button>
                        ) : (
                          translations[currentSentence?.text] ||
                          currentSentence?.translation || (
                            <span className="muted">
                              Select a word to read its sentence meaning.
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    <div className="word-meaning">
                      <span className="tray-label">Word meaning</span>
                      <div className="word-meaning-content">
                        {selected ? (
                          <>
                            <button
                              className="selected-word"
                              onClick={() => openDictionary(selected.text)}
                            >
                              {selected.text}
                            </button>
                            <span className="selected-pinyin">
                              {selected.pinyin}
                            </span>
                            <span>
                              {selected.meaning ||
                                "Open dictionary for character meanings"}
                            </span>
                            <span
                              className={`hsk-tag level-${selected.level || 0}`}
                            >
                              {label(selected.level)}
                            </span>
                          </>
                        ) : (
                          <span className="muted">
                            {stats.length}{" "}
                            {lesson?.courseVocabulary
                              ? "textbook words"
                              : "words in this passage"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="reader-toolbar">
                  <div className="reading-tabs">
                    <button className="current">
                      <BookOpen size={16} />
                      Passage
                    </button>
                    <button onClick={() => setPanel("lesson-vocabulary")}>
                      <GraduationCap size={16} />
                      Vocabulary <small>{stats.length}</small>
                    </button>
                    <button onClick={() => setPanel("grammar")}>
                      <Languages size={16} />
                      Grammar <small>{grammar.length}</small>
                    </button>
                  </div>
                  <div className="toolbar-actions">
                    {meaningHidden && (
                      <IconButton
                        icon={Languages}
                        label="Show meanings"
                        onClick={() => setMeaningHidden(false)}
                      />
                    )}
                    <IconButton
                      icon={Search}
                      label="Search passage"
                      active={showSearch}
                      onClick={() => setShowSearch((s) => !s)}
                    />
                    <IconButton
                      icon={StickyNote}
                      label="Lesson notes"
                      onClick={() => setPanel("notes")}
                    />
                    {localProcessing && <IconButton
                      icon={Pencil}
                      label="Edit passage"
                      onClick={() => setPanel("edit")}
                    />}
                    <button
                      aria-label="Settings"
                      title="Reading preferences"
                      onClick={() => setPanel("settings")}
                    >
                      <SlidersHorizontal size={16} />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>
                {showSearch && (
                  <div className="passage-search">
                    <Search size={17} />
                    <input
                      autoFocus
                      placeholder="Find a word in this passage…"
                      aria-label="Search passage"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <span>
                      {searchMatches.length}{" "}
                      matches
                    </span>
                    <IconButton
                      icon={X}
                      label="Close passage search"
                      onClick={() => {
                        setShowSearch(false);
                        setSearch("");
                      }}
                    />
                  </div>
                )}
                {lesson.processing && (
                  <div className="processing">
                    <LoaderCircle className="spin" size={16} />
                    Preparing words and pinyin…
                  </div>
                )}
                <PassageText
                  title={lesson.title}
                  model={readerModel}
                  characters={prefs.characters}
                  pinyin={prefs.pinyin}
                  hsk={prefs.hsk}
                  grammar={prefs.grammar}
                  fontFamily={prefs.fontFamily}
                  fontSize={prefs.fontSize}
                  onPick={pick}
                />
                <PassageHighlights
                  selectedKey={selected?.key}
                  sentenceKey={sentenceKey}
                  playing={playing}
                  model={readerModel}
                  search={search}
                  searchMatches={searchMatches}
                />
                <div className="reader-end">
                  <button
                    className={`complete-button ${completed.includes(id) ? "done" : ""}`}
                    onClick={() =>
                      setCompleted((s) =>
                        s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                      )
                    }
                  >
                    <Check size={17} />
                    {completed.includes(id) ? "Marked as read" : "Mark as read"}
                  </button>
                  <span>
                    {lesson.number
                      ? `${lesson.number} of 36 lessons`
                      : "My passage"}
                  </span>
                  <button
                    onClick={() => {
                      const next = catalog.find(
                        (l) => l.number === lesson.number + 1,
                      );
                      if (next) go(next.id);
                      else openLibrary();
                    }}
                  >
                    Next lesson
                    <ChevronRight size={16} />
                  </button>
                </div>
              </section>
              <div className="level-legend">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    className={`level-${n}`}
                    key={n}
                    onClick={() => {
                      setVocabLevel(String(n));
                      setPanel("vocabulary");
                    }}
                  >
                    {n === 7 ? "7–9" : n}
                  </button>
                ))}
                <button
                  className="level-0"
                  onClick={() => setPanel("lesson-vocabulary")}
                >
                  Outside syllabus
                </button>
              </div>
            </main>
            <div className="audio-dock">
              <AudioProgress
                clock={mediaClock}
                duration={duration}
                disabled={!lesson.audioUrl}
                onSeek={seek}
              />
              <div className="audio-inner">
                <div className="audio-lesson">
                  <strong>{lesson.english || lesson.title}</strong>
                  <div className="alignment-caption">
                    {localProcessing && (!lesson.audioUrl ? (
                      <button onClick={() => fileInput.current.click()}>
                        Attach audio
                      </button>
                    ) : ["aligning", "queued"].includes(playbackStatus) ? (
                      <>
                        <LoaderCircle size={11} className="spin" />{" "}
                        {playbackStatus === "queued"
                          ? "Alignment queued"
                          : "Aligning audio locally"}
                      </>
                    ) : playbackStatus === "machine-aligned" ? null : (
                      <button
                        onClick={async () => {
                          try {
                            await post(`/api/lessons/${id}/align`, {});
                            setLesson(await api(`/api/lessons/${id}`));
                          } catch (e) {
                            flash(e.message);
                          }
                        }}
                      >
                        {playbackStatus === "needs-review"
                          ? "Review alignment"
                          : playbackStatus === "failed"
                            ? "Retry alignment"
                            : "Align word audio"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="playback">
                  <select
                    className="speed-select"
                    aria-label="Playback speed"
                    value={speed}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setSpeed(v);
                      if (audio.current) audio.current.playbackRate = v;
                    }}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => (
                      <option value={n} key={n}>
                        {n}×
                      </option>
                    ))}
                  </select>
                  <IconButton
                    icon={SkipBack}
                    label="Previous sentence"
                    onClick={() => changeSentence(-1)}
                  />
                  <button
                    className="play-button"
                    aria-label={
                      playing
                        ? "Pause"
                        : lesson.audioUrl
                          ? "Play audio"
                          : "Read sentence aloud"
                    }
                    onClick={play}
                  >
                    {playing ? (
                      <Pause size={27} fill="currentColor" />
                    ) : (
                      <Play size={27} fill="currentColor" />
                    )}
                  </button>
                  <IconButton
                    icon={SkipForward}
                    label="Next sentence"
                    onClick={() => changeSentence(1)}
                  />
                  <IconButton
                    icon={Repeat}
                    label="Repeat sentence"
                    active={loop}
                    onClick={() => setLoop((v) => !v)}
                  />
                  <AudioTime clock={mediaClock} duration={duration} />
                </div>
                <div className="display-controls">
                  <button
                    className={prefs.hsk ? "on" : ""}
                    onClick={() => updatePref("hsk", !prefs.hsk)}
                  >
                    <span>HSK</span>
                    <span className="circle-setting">
                      {prefs.hsk ? "On" : "Off"}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      updatePref(
                        "characters",
                        prefs.characters === "simplified"
                          ? "traditional"
                          : "simplified",
                      )
                    }
                  >
                    <span>Characters</span>
                    <span className="circle-setting">
                      {prefs.characters === "simplified" ? "汉" : "漢"}
                    </span>
                  </button>
                  <button
                    className={prefs.pinyin !== "off" ? "on" : ""}
                    onClick={() =>
                      updatePref(
                        "pinyin",
                        prefs.pinyin === "off" ? "all" : "off",
                      )
                    }
                  >
                    <span>Pinyin</span>
                    <span className="circle-setting">
                      {prefs.pinyin === "off" ? "Off" : "On"}
                    </span>
                  </button>
                  <IconButton
                    icon={Volume2}
                    label={muted ? "Unmute audio" : "Mute audio"}
                    active={muted}
                    onClick={() => {
                      setMuted((v) => !v);
                      if (audio.current) audio.current.muted = !muted;
                    }}
                  />
                  <IconButton
                    icon={SlidersHorizontal}
                    label="Reading preferences"
                    onClick={() => setPanel("settings")}
                  />
                </div>
              </div>
            </div>
          </>
        )
      )}
      {lesson && (
        <audio
          ref={audio}
          src={lesson.audioUrl || undefined}
          preload={libraryOpen ? "metadata" : "auto"}
          onLoadedMetadata={() => {
            const element = audio.current;
            element.playbackRate = speed;
            element.muted = muted;
            setDuration(element.duration);
            const start = initialAudioPosition(element.duration, progress.get()[id]?.seconds, pendingSeek.current);
            pendingSeek.current = null;
            if (start !== null) element.currentTime = start;
            mediaClock.set(element.currentTime);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            if (loop && currentSentence?.start != null)
              seek(currentSentence.start, true);
          }}
          onError={() => {
            if (lesson.audioUrl) flash("This audio could not be loaded.");
          }}
          onTimeUpdate={() => {
            const element = audio.current;
            if (!element) return;
            mediaClock.set(element.currentTime);
            if (
              loop &&
              !libraryOpen &&
              currentSentence?.end != null &&
              element.currentTime >= currentSentence.end
            )
              seek(currentSentence.start, true);
            if (Date.now() - lastProgress.current > 4000) {
              lastProgress.current = Date.now();
              progress.set((previous) => ({
                ...previous,
                [id]: { seconds: element.currentTime, updated: Date.now() },
              }));
            }
          }}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        hidden
        onChange={attachAudio}
      />
      <input
        ref={backupInput}
        type="file"
        accept="application/json"
        hidden
        onChange={restoreBackup}
      />
      {pop && selected && (
        <div
          className="word-popover"
          style={{ left: pop.x, top: pop.y }}
          role="menu"
          aria-label="Word actions"
        >
          {selected.grammarMatches.map((g) => (
            <button
              role="menuitem"
              key={g.point}
              onClick={() => selectGrammar(g)}
            >
              <Languages size={17} />
              Grammar · {g.point}
            </button>
          ))}
          <button role="menuitem" onClick={() => openDictionary(selected.text)}>
            <BookOpen size={17} />
            Dictionary
          </button>
          <button role="menuitem" onClick={() => saveWord(selected)}>
            {saved[selected.text] ? (
              <BookmarkCheck size={17} />
            ) : (
              <Bookmark size={17} />
            )}{" "}
            {saved[selected.text] ? "Unsave word" : "Save word"}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              speak(selected.text);
              setPop(null);
            }}
          >
            <Volume2 size={17} />
            Pronounce
          </button>
          {localProcessing && lesson?.audioUrl && (
            <button
              role="menuitem"
              onClick={() => {
                pause();
                setPanel("timing");
                setPop(null);
              }}
            >
              <Pencil size={16} />
              Adjust audio timing
            </button>
          )}
        </div>
      )}
      {panel === "timing" && selected && (
        <TimingEditor
          token={selected}
          duration={duration}
          clock={mediaClock}
          playing={playing}
          onPreview={(value) => seek(value, true)}
          onPause={pause}
          onClose={() => {
            pause();
            setPanel(null);
          }}
          onSave={async (start) => {
            await post(`/api/lessons/${id}/timing`, {
              key: selected.key,
              start,
            });
            setLesson(await api(`/api/lessons/${id}`));
            setPanel(null);
            flash("Word start saved.");
          }}
        />
      )}
      {panel === "settings" && (
        <Modal title="Reading preferences" onClose={() => setPanel(null)}>
          <div className="settings-section">
            <h3>Display</h3>
            <label className="preference">
              <span>
                Font size <small>{prefs.fontSize}px</small>
              </span>
              <input
                aria-label="Font size"
                type="range"
                min="18"
                max="38"
                value={prefs.fontSize}
                onChange={(e) => updatePref("fontSize", Number(e.target.value))}
              />
            </label>
            <label className="preference">
              <span>Font family</span>
              <select
                value={prefs.fontFamily}
                onChange={(e) => updatePref("fontFamily", e.target.value)}
              >
                <option value="system">System sans</option>
                <option value="serif">Chinese serif</option>
              </select>
            </label>
            <label className="preference">
              <span>Appearance</span>
              <select
                value={prefs.theme}
                onChange={(e) => updatePref("theme", e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
            <Toggle
              label="Show sentence translation"
              checked={prefs.translation}
              onChange={(v) => updatePref("translation", v)}
            />
            <Toggle
              label="Underline HSK words"
              checked={prefs.hsk}
              onChange={(v) => updatePref("hsk", v)}
            />
            <Toggle
              label="Highlight grammar"
              checked={prefs.grammar}
              onChange={(v) => updatePref("grammar", v)}
            />
            <Toggle
              label="Follow audio"
              checked={prefs.follow}
              onChange={(v) => updatePref("follow", v)}
            />
          </div>
          <div className="settings-section">
            <h3>Language</h3>
            <label className="preference">
              <span>Character set</span>
              <select
                value={prefs.characters}
                onChange={(e) => updatePref("characters", e.target.value)}
              >
                <option value="simplified">Simplified</option>
                <option value="traditional">Traditional</option>
              </select>
            </label>
            <label className="preference">
              <span>Pronunciation</span>
              <select
                value={prefs.pinyin}
                onChange={(e) => updatePref("pinyin", e.target.value)}
              >
                <option value="all">All pinyin</option>
                <option value="advanced">HSK 4 and above</option>
                <option value="off">Hidden</option>
              </select>
            </label>
          </div>
          <div className="settings-section">
            <h3>Study data</h3>
            <div className="button-row">
              <button onClick={exportBackup}>
                <Download size={16} />
                Export backup
              </button>
              <button onClick={() => backupInput.current.click()}>
                <Upload size={16} />
                Restore backup
              </button>
              <button onClick={() => setPrefs(defaults)}>
                <RotateCcw size={16} />
                Reset preferences
              </button>
            </div>
          </div>
        </Modal>
      )}
      {(panel === "import" || panel === "edit") && (
        <ImportModal
          lesson={panel === "edit" ? lesson : null}
          onClose={() => setPanel(null)}
          onImported={async (newId) => {
            await refreshCatalog();
            if (newId === id) {
              setLesson(await api(`/api/lessons/${id}`));
              setPanel(null);
            } else go(newId);
            flash("Passage saved to your library.");
          }}
        />
      )}
      {(panel === "grammar" || panel === "lesson-vocabulary") && (
        <Modal
          title={panel === "grammar" ? "Grammar & usage" : "Passage vocabulary"}
          onClose={() => setPanel(null)}
          wide
        >
          {panel === "grammar" ? (
            <>
              <p className="panel-subtitle">
                {lesson?.title} · Standard Course 5 {lesson?.volume}
              </p>
              <div className="grammar-list">
                {grammar.map((g) => (
                  <button key={g.point} onClick={() => selectGrammar(g)}>
                    <span className="grammar-point">{g.point}</span>
                    <span>
                      <strong>{g.title}</strong>
                      <small>{g.pattern}</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
              {!grammar.length && (
                <p>
                  No matching course grammar notes were found in this passage.
                </p>
              )}
              {lesson?.grammarPages?.length > 0 && (
                <div className="source-notes">
                  <h3>Course notes & examples</h3>
                  <BookPageReferences pages={lesson.grammarPages} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="panel-subtitle">
                {stats.length}{" "}
                {lesson?.courseVocabulary ? "textbook words" : "unique words"}
              </div>
              <div className="vocab-list">
                {stats.map((t) => (
                  <div key={t.text} className="vocab-row">
                    <button
                      className="vocab-word"
                      onClick={() => openDictionary(t.text)}
                    >
                      <strong lang="zh">{t.display || t.text}</strong>
                      <span>{t.pinyin}</span>
                    </button>
                    <span className="vocab-meaning">
                      {t.meaning || "See dictionary"}
                    </span>
                    <span className={`hsk-tag level-${t.level || 0}`}>
                      {label(t.level)}
                    </span>
                    <IconButton
                      icon={saved[t.text] ? BookmarkCheck : Bookmark}
                      label={saved[t.text] ? "Unsave word" : "Save word"}
                      onClick={() => saveWord(t)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
      {panel === "vocabulary" && (
        <Modal title="HSK 3.0 vocabulary" wide onClose={() => setPanel(null)}>
          <div className="vocab-filters">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search vocabulary"
                placeholder="Chinese, pinyin or English"
                value={vocabQuery}
                onChange={(e) => {
                  setVocabQuery(e.target.value);
                  setVocabPage(0);
                }}
              />
            </div>
            <select
              aria-label="HSK level"
              value={vocabLevel}
              onChange={(e) => {
                setVocabLevel(e.target.value);
                setVocabPage(0);
              }}
            >
              <option value="">All levels</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option value={n} key={n}>
                  {label(n)}
                </option>
              ))}
            </select>
          </div>
          <div className="library-count">
            {vocab.total.toLocaleString()} entries
          </div>
          <div className="vocab-list">
            {vocab.rows.map((t) => (
              <div key={t.word} className="vocab-row">
                <button
                  className="vocab-word"
                  onClick={() => openDictionary(t.word)}
                >
                  <strong lang="zh">{t.word}</strong>
                  <span>{t.pinyin}</span>
                </button>
                <span className="vocab-meaning">{t.meaning}</span>
                <span className={`hsk-tag level-${t.level}`}>
                  {label(t.level)}
                </span>
                <IconButton
                  icon={saved[t.word] ? BookmarkCheck : Bookmark}
                  label={saved[t.word] ? "Unsave word" : "Save word"}
                  onClick={() => saveWord({ ...t, text: t.word })}
                />
              </div>
            ))}
          </div>
          <div className="pagination">
            <IconButton
              icon={ChevronLeft}
              label="Previous vocabulary page"
              disabled={vocabPage === 0}
              onClick={() => setVocabPage((p) => p - 1)}
            />
            <span>
              {vocabPage + 1} / {Math.max(1, Math.ceil(vocab.total / 60))}
            </span>
            <IconButton
              icon={ChevronRight}
              label="Next vocabulary page"
              disabled={(vocabPage + 1) * 60 >= vocab.total}
              onClick={() => setVocabPage((p) => p + 1)}
            />
          </div>
        </Modal>
      )}
      {panel === "saved" && (
        <Modal
          title="Saved words & lessons"
          wide
          onClose={() => setPanel(null)}
        >
          <div className="segmented">
            <button
              className={tab !== "saved-lessons" ? "active" : ""}
              onClick={() => setTab("saved-words")}
            >
              Words · {savedWords.length}
            </button>
            <button
              className={tab === "saved-lessons" ? "active" : ""}
              onClick={() => setTab("saved-lessons")}
            >
              Lessons · {savedLessons.length}
            </button>
          </div>
          {tab === "saved-lessons" ? (
            <div className="lesson-list">
              {catalog
                .filter((l) => savedLessons.includes(l.id))
                .map((l) => (
                  <button
                    className="lesson-row"
                    key={l.id}
                    onClick={() => go(l.id)}
                  >
                    <BookOpen size={18} />
                    <span className="lesson-row-title">
                      <strong>{l.title}</strong>
                      <span>{l.english}</span>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              {!savedLessons.length && (
                <p className="empty">No saved lessons yet.</p>
              )}
            </div>
          ) : (
            <div className="vocab-list">
              {savedWords.map((t) => (
                <div className="vocab-row" key={t.text}>
                  <button
                    className="vocab-word"
                    onClick={() => openDictionary(t.text)}
                  >
                    <strong>{t.text}</strong>
                    <span>{t.pinyin}</span>
                  </button>
                  <span className="vocab-meaning">{t.meaning}</span>
                  <button
                    className="saved-source"
                    onClick={() => go(t.lessonId)}
                  >
                    {t.lessonTitle}
                  </button>
                  <IconButton
                    icon={BookmarkCheck}
                    label="Unsave word"
                    onClick={() => saveWord(t)}
                  />
                </div>
              ))}
              {!savedWords.length && (
                <p className="empty">No saved words yet.</p>
              )}
            </div>
          )}
          <div className="button-row">
            <button onClick={exportBackup}>
              <Download size={16} />
              Export study data
            </button>
          </div>
        </Modal>
      )}
      {panel === "notes" && (
        <Modal title="Lesson notes" onClose={() => setPanel(null)}>
          <p className="panel-subtitle">{lesson?.title}</p>
          <textarea
            className="notes-input"
            aria-label="Lesson notes"
            placeholder="Your notes…"
            value={notes[id] || ""}
            onChange={(e) => setNotes((n) => ({ ...n, [id]: e.target.value }))}
          />
          <p className="save-status">
            <Check size={14} />
            Saved on this browser
          </p>
        </Modal>
      )}
      {panel === "sources" && (
        <Modal title="Sources & data" onClose={() => setPanel(null)}>
          <div className="source-detail">
            <h3>Course material</h3>
            <p>
              HSK Standard Course 5 上 and 下, from your supplied PDFs and
              recordings. This copy runs on your computer.
            </p>
            <h3>Vocabulary standard</h3>
            <p>
              HSK 3.0 examination syllabus, published November 2025, marked
              effective July 2026. Multi-level senses use the earliest listed
              level. Unlisted words remain “Outside syllabus”.
            </p>
            <a
              href="https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲（词汇、汉字、语法）.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Official syllabus <Link size={14} />
            </a>
            <h3>Dictionary</h3>
            <p>
              <a
                href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict"
                target="_blank"
                rel="noreferrer"
              >
                CC-CEDICT
              </a>{" "}
              · CC BY-SA 4.0. Pinyin from pypinyin; segmentation from jieba.
            </p>
            <h3>Audio & translation</h3>
            <p>
              Word boundaries are generated locally with stable-ts and Whisper.
              Machine alignment may need correction. Sentence translation runs
              locally with Helsinki-NLP’s OPUS Chinese-to-English model and is
              cached. These are machine translations, not reviewed textbook
              translations.
            </p>
            <h3>Your data</h3>
            <p>
              Imported text and audio are stored in this app’s local data
              folder. Saved words, notes and preferences are kept in this
              browser. Export a backup to move your study data.
            </p>
          </div>
        </Modal>
      )}
      {dictionary && (
        <Modal title="Dictionary" onClose={() => setDictionary(null)}>
          <div className="dictionary-head">
            <div>
              <strong>{dictionary.word}</strong>
              {dictionary.entry?.traditional !== dictionary.word && (
                <span>{dictionary.entry?.traditional}</span>
              )}
            </div>
            <p className="dictionary-pinyin">
              {dictionary.hsk?.pinyin || selected?.pinyin}
            </p>
            <span className={`hsk-tag level-${dictionary.hsk?.level || 0}`}>
              {label(dictionary.hsk?.level)}
            </span>
            <ol>
              {dictionary.entry?.definitions.map((d, i) => (
                <li key={i}>{d}</li>
              )) || (
                <li>
                  No exact word entry. See the character definitions below.
                </li>
              )}
            </ol>
          </div>
          <h3>Characters</h3>
          {dictionary.characters.map((c, i) => (
            <div className="character-entry" key={i}>
              <div>
                <strong>{c.word}</strong>
                <span>{c.hsk?.pinyin}</span>
              </div>
              <ol>
                {c.entry?.definitions
                  .slice(0, 8)
                  .map((d, j) => <li key={j}>{d}</li>) || (
                  <li>No dictionary entry.</li>
                )}
              </ol>
            </div>
          ))}
        </Modal>
      )}
      {grammarPoint && (
        <Modal
          title="Grammar & usage"
          drawer
          onClose={() => setGrammarPoint(null)}
        >
          <div className="grammar-detail">
            <span className="course-label">
              Standard Course 5 {lesson?.volume} · Lesson{" "}
              {lesson?.number || "import"}
            </span>
            <h2>
              <span lang="zh">{grammarPoint.point}</span> · {grammarPoint.title}
            </h2>
            <p>{grammarPoint.explanation}</p>
            <h3>
              <Languages size={19} />
              Structure
            </h3>
            <div className="grammar-structure">{grammarPoint.pattern}</div>
            <h3>
              <Pencil size={18} />
              In this passage
            </h3>
            {grammarPoint.examples.length ? (
              grammarPoint.examples.map((s, i) => (
                <div className="grammar-example" key={i}>
                  <span>{i + 1}</span>
                  <div>
                    <p lang="zh">{s.text}</p>
                    <button onClick={() => translate(s)}>
                      {translations[s.text] || "Show sentence meaning"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No matching examples in this passage.</p>
            )}
            {lesson?.number && (
              <CourseBookNote
                note={
                  courseNotes?.id === id
                    ? courseNotes.points.find(
                        (note) => note.point === grammarPoint.point,
                      )
                    : null
                }
                loading={courseNotes?.id !== id && !courseNotesError}
                error={courseNotesError}
                onRetry={retryCourseNotes}
              />
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function TimingEditor({
  token,
  duration,
  clock,
  playing,
  onPreview,
  onPause,
  onClose,
  onSave,
}) {
  const currentTime = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const [start, setStart] = useState(token.start ?? currentTime);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Word audio timing" onClose={onClose}>
      <form
        className="import-form"
        onSubmit={async (e) => {
          e.preventDefault();
          onPause();
          setSaving(true);
          setError("");
          try {
            await onSave(Number(start));
          } catch (e) {
            setError(e.message);
            setSaving(false);
          }
        }}
      >
        <h2 lang="zh">{token.text}</h2>
        <label>
          Start time (seconds)
          <input
            aria-label="Word start time"
            required
            type="number"
            min="0"
            max={duration || undefined}
            step="0.001"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            type="button"
            onClick={() => {
              playing ? onPause() : onPreview(Number(start));
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
            {playing ? "Pause preview" : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => setStart(Number(currentTime.toFixed(3)))}
          >
            Use playhead · {time(currentTime)}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={saving} type="submit">
            <Check size={16} />
            {saving ? "Saving…" : "Save timing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ImportModal({ onClose, onImported, lesson: existing }) {
  const [title, setTitle] = useState(existing?.title || ""),
    [english, setEnglish] = useState(existing?.english || ""),
    [text, setText] = useState(existing?.text || ""),
    [file, setFile] = useState(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const input = useRef(null);
  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData();
    form.append("title", title);
    form.append("english", english);
    form.append("text", text);
    if (file) form.append("audio", file);
    try {
      const r = await api(
        existing ? `/api/lessons/${existing.id}/edit` : "/api/import",
        { method: "POST", body: form },
      );
      onImported(r.id);
    } catch (e) {
      setError(e.message);
      setPending(false);
    }
  }
  return (
    <Modal
      title={existing ? "Edit passage" : "Add your own passage"}
      onClose={pending ? () => {} : onClose}
      wide
    >
      <form onSubmit={submit} className="import-form">
        <div className="form-grid">
          <label>
            <span className="form-label-line">Title</span>
            <input
              required
              maxLength={160}
              placeholder="文章标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            <span className="form-label-line">
              English title <small>Optional</small>
            </span>
            <input
              maxLength={200}
              placeholder="English title"
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
            />
          </label>
        </div>
        <label>
          Chinese passage
          <textarea
            required
            maxLength={50000}
            placeholder="在这里粘贴你的中文文章……"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="character-count">
          {text.length.toLocaleString()} / 50,000
        </div>
        <input
          ref={input}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        <div className="upload-area">
          <Headphones size={24} />
          <div>
            <strong>{file ? file.name : "Audio recording"}</strong>
            <span>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                : "Optional · MP3, WAV, M4A, OGG, FLAC or WebM"}
            </span>
          </div>
          {file ? (
            <IconButton
              icon={X}
              label="Remove audio"
              onClick={() => setFile(null)}
            />
          ) : (
            <button type="button" onClick={() => input.current.click()}>
              <Upload size={16} />
              Choose audio
            </button>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={pending || !title.trim() || !text.trim()}
            type="submit"
          >
            {pending ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}{" "}
            {pending
              ? "Saving passage…"
              : existing
                ? "Save changes"
                : "Add to library"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default App;
