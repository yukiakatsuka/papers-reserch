import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  BrainCircuit,
  ChartNoAxesColumnIncreasing,
  FlaskConical,
  HeartPulse,
  Link,
  RefreshCcw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

const STORAGE_KEY = "paperswipe-real-v2";
const DISMISSED_KEY = "paperswipe-dismissed-real-v2";
const SAVED_KEY = "paperswipe-saved-real-v2";
const TRANSLATION_KEY = "paperswipe-title-ja-v1";
const PAPER_TYPES = new Set(["article", "preprint"]);
const CROSSREF_PAPER_TYPES = new Set(["journal-article", "posted-content"]);
const OPENALEX_SOURCE = "OpenAlex";
const CROSSREF_SOURCE = "Crossref";
const POLITE_EMAIL = "paperswipe@example.com";

const genres = [
  {
    id: "ai",
    label: "AI",
    count: 142,
    query: "artificial intelligence machine learning",
    icon: BrainCircuit,
  },
  {
    id: "economics",
    label: "Economics",
    count: 78,
    query: "economics macroeconomics behavioral economics",
    icon: TrendingUp,
  },
  {
    id: "investing",
    label: "Investing",
    count: 61,
    query: "investment portfolio asset pricing financial markets",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    id: "drug-discovery",
    label: "Drug Discovery",
    count: 56,
    query: "drug discovery molecular docking clinical candidates",
    icon: FlaskConical,
  },
  {
    id: "medicine",
    label: "Medicine",
    count: 53,
    query: "medicine clinical trial diagnosis treatment",
    icon: HeartPulse,
  },
  {
    id: "statistics",
    label: "Statistics",
    count: 30,
    query: "statistics causal inference bayesian model",
    icon: SlidersHorizontal,
  },
];

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeOpenAlexWork(work, genre) {
  const source =
    work.primary_location?.source?.display_name ||
    work.locations?.[0]?.source?.display_name ||
    "OpenAlex";
  const url =
    work.primary_location?.landing_page_url ||
    work.doi ||
    work.id ||
    "https://openalex.org";
  const concepts = (work.concepts || [])
    .slice(0, 4)
    .map((concept) => concept.display_name)
    .filter(Boolean);
  return {
    id: work.id || `${genre.id}-${work.title}`,
    genre: genre.id,
    source,
    sourceIndex: OPENALEX_SOURCE,
    paperType: work.type || work.type_crossref || "article",
    topic: genre.label,
    date: work.publication_date
      ? new Date(work.publication_date).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "Recent",
    title: work.title || "Untitled paper",
    tags: concepts.length ? concepts : [genre.label, "research", "open source"],
    authors: (work.authorships || [])
      .slice(0, 5)
      .map((item) => item.author?.display_name)
      .filter(Boolean)
      .join(", "),
    institution:
      work.authorships?.[0]?.institutions?.[0]?.display_name ||
      "Open scholarly index",
    abstract: invertAbstract(work.abstract_inverted_index) || fallbackAbstract(genre),
    url,
  };
}

function isPaperOrPreprint(work) {
  return (
    PAPER_TYPES.has(work.type) ||
    CROSSREF_PAPER_TYPES.has(work.type_crossref)
  );
}

function invertAbstract(index) {
  if (!index) return "";
  const words = [];
  Object.entries(index).forEach(([word, positions]) => {
    positions.forEach((position) => {
      words[position] = word;
    });
  });
  return words.join(" ").slice(0, 280);
}

function fallbackAbstract(genre) {
  return `A recent open-access scholarly work related to ${genre.label}. Open the source URL to review the full paper, metadata, and linked publication record.`;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeCrossrefWork(item, genre) {
  const title = item.title?.[0] || "Untitled paper";
  const published =
    item.published?.["date-parts"]?.[0] ||
    item["published-print"]?.["date-parts"]?.[0] ||
    item["published-online"]?.["date-parts"]?.[0];
  const date = published
    ? new Date(published[0], (published[1] || 1) - 1, published[2] || 1)
    : null;
  const authors = (item.author || [])
    .slice(0, 5)
    .map((author) => [author.given, author.family].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");
  const url = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : "");

  return {
    id: item.DOI || item.URL || `${genre.id}-${title}`,
    genre: genre.id,
    source: item["container-title"]?.[0] || CROSSREF_SOURCE,
    sourceIndex: CROSSREF_SOURCE,
    paperType: item.type === "posted-content" ? "preprint" : "article",
    topic: genre.label,
    date: date
      ? date.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "Recent",
    title,
    tags: [genre.label, item.type || "journal-article", "real record"],
    authors,
    institution: item.publisher || CROSSREF_SOURCE,
    abstract:
      item.abstract?.replace(/<[^>]+>/g, "").slice(0, 280) ||
      `A ${item.type || "journal article"} record indexed by Crossref for ${genre.label}.`,
    url,
  };
}

async function fetchFreeDailyPapers() {
  const papers = [];
  for (const genre of genres) {
    try {
      const url = new URL("https://api.openalex.org/works");
      url.searchParams.set("search", genre.query);
      url.searchParams.set("per-page", "35");
      url.searchParams.set("sort", "publication_date:desc");
      url.searchParams.set("mailto", POLITE_EMAIL);
      url.searchParams.set(
        "filter",
        `from_publication_date:2023-01-01,to_publication_date:${todayKey()}`,
      );
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
      const data = await response.json();
      papers.push(
        ...(data.results || [])
          .filter(isPaperOrPreprint)
          .map((work) => normalizeOpenAlexWork(work, genre)),
      );
    } catch {
      papers.push(...(await fetchCrossrefPapers(genre)));
    }
    await sleep(350);
  }

  if (!papers.length) {
    throw new Error("No article or preprint records were returned from OpenAlex or Crossref.");
  }
  return papers;
}

async function fetchCrossrefPapers(genre) {
  const rowsPerType = 22;
  const types = ["journal-article", "posted-content"];
  const results = [];

  for (const type of types) {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.bibliographic", genre.query);
    url.searchParams.set("rows", String(rowsPerType));
    url.searchParams.set("sort", "published");
    url.searchParams.set("order", "desc");
    url.searchParams.set("mailto", POLITE_EMAIL);
    url.searchParams.set(
      "filter",
      `from-pub-date:2023-01-01,until-pub-date:${todayKey()},type:${type}`,
    );

    const response = await fetch(url);
    if (!response.ok) continue;
    const data = await response.json();
    results.push(
      ...(data.message?.items || [])
        .filter((item) => item.URL || item.DOI)
        .map((item) => normalizeCrossrefWork(item, genre)),
    );
    await sleep(180);
  }

  return results;
}

function compactUrl(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function compactSource(source) {
  if (!source) return "OpenAlex";
  const clean = source
    .replace(/Academic Bibliography/gi, "Bibliography")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  if (clean.length <= 16) return clean;
  if (/arxiv/i.test(clean)) return "arXiv";
  if (/pubmed/i.test(clean)) return "PubMed";
  if (/biorxiv/i.test(clean)) return "bioRxiv";
  return clean.slice(0, 15);
}

function hasJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function readTranslationCache() {
  return readJson(TRANSLATION_KEY, {});
}

function writeTranslationCache(cache) {
  try {
    localStorage.setItem(TRANSLATION_KEY, JSON.stringify(cache));
  } catch {
    // Translation cache is nice-to-have; the English title remains available.
  }
}

async function translateTitleToJapanese(title) {
  if (!title || hasJapanese(title)) return title;
  const cache = readTranslationCache();
  if (cache[title]) return cache[title];

  const translated =
    (await translateWithGoogleAuto(title).catch(() => "")) ||
    (await translateWithMyMemory(title).catch(() => ""));
  if (!translated || translated.toLowerCase() === title.toLowerCase()) {
    throw new Error("No Japanese translation returned.");
  }

  const nextCache = { ...cache, [title]: translated };
  writeTranslationCache(nextCache);
  return translated;
}

async function translateWithGoogleAuto(title) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", "ja");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", title);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google translation ${response.status}`);
  const data = await response.json();
  return (data?.[0] || [])
    .map((segment) => segment?.[0] || "")
    .join("")
    .trim();
}

async function translateWithMyMemory(title) {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", title);
  url.searchParams.set("langpair", "en|ja");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MyMemory translation ${response.status}`);
  const data = await response.json();
  return data.responseData?.translatedText?.trim() || "";
}

export function App() {
  const [activeGenre, setActiveGenre] = useState("ai");
  const [papers, setPapers] = useState([]);
  const [saved, setSaved] = useState(() => readJson(SAVED_KEY, []));
  const [dismissed, setDismissed] = useState(() => readJson(DISMISSED_KEY, []));
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [status, setStatus] = useState("Preparing today's deck");
  const [fetchState, setFetchState] = useState("loading");
  const [fetchError, setFetchError] = useState("");
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translationStatus, setTranslationStatus] = useState("idle");
  const [fetchMeta, setFetchMeta] = useState({
    date: "",
    time: "",
    source: OPENALEX_SOURCE,
    count: 0,
    fromCache: false,
  });
  const [lastFetch, setLastFetch] = useState("");
  const startPoint = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const cached = readJson(STORAGE_KEY, null);
      if (cached?.date === todayKey() && cached?.papers?.length) {
        if (!mounted) return;
        setPapers(cached.papers);
        setFetchMeta({
          date: cached.date,
          time: cached.time || "06:30",
          source: cached.source || OPENALEX_SOURCE,
          count: cached.papers.length,
          fromCache: true,
        });
        setLastFetch(cached.time || "06:30");
        setFetchState("ready");
        setFetchError("");
        setStatus("Loaded today's real-paper harvest");
        return;
      }

      await refreshPapers({ isMounted: () => mounted, staleCache: cached });
    }

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }, [dismissed]);

  async function refreshPapers(options = {}) {
    const isMounted = options.isMounted || (() => true);
    setFetchState("loading");
    setFetchError("");
    setStatus("Fetching real articles and preprints");

    try {
      const nextPapers = await fetchFreeDailyPapers();
      if (!isMounted()) return;
      const date = todayKey();
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const meta = {
        date,
        time,
        source: sourceSummary(nextPapers),
        count: nextPapers.length,
        fromCache: false,
      };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...meta, papers: nextPapers }),
      );
      setPapers(nextPapers);
      setIndex(0);
      setFetchMeta(meta);
      setLastFetch(time);
      setFetchState("ready");
      setStatus("Fetched real articles and preprints");
    } catch (error) {
      if (!isMounted()) return;
      if (options.staleCache?.papers?.length) {
        setPapers(options.staleCache.papers);
        setIndex(0);
        setFetchMeta({
          date: options.staleCache.date || "previous",
          time: options.staleCache.time || "",
          source: options.staleCache.source || "Previous real data",
          count: options.staleCache.papers.length,
          fromCache: true,
        });
        setLastFetch(options.staleCache.time || "");
        setFetchState("ready");
        setFetchError(error.message || "Live fetch failed.");
        setStatus("Using previous real-paper harvest");
        return;
      }
      setPapers([]);
      setIndex(0);
      setFetchMeta({
        date: todayKey(),
        time: "",
        source: OPENALEX_SOURCE,
        count: 0,
        fromCache: false,
      });
      setLastFetch("");
      setFetchState("error");
      setFetchError(error.message || "OpenAlex fetch failed.");
      setStatus("Fetch failed");
    }
  }

  function sourceSummary(items) {
    const sources = [...new Set(items.map((paper) => paper.sourceIndex).filter(Boolean))];
    return sources.length ? sources.join(" + ") : OPENALEX_SOURCE;
  }

  const queue = useMemo(() => {
    const hidden = new Set([...saved, ...dismissed].map((paper) => paper.id));
    const available = papers.filter((paper) => !hidden.has(paper.id));
    const selected = available.filter((paper) => paper.genre === activeGenre);
    return selected.length ? selected : available;
  }, [activeGenre, dismissed, papers, saved]);

  const current = queue.length ? queue[index % queue.length] : null;
  const next = queue.length ? queue[(index + 1) % queue.length] : null;
  const totalToday = papers.length;
  const genreCounts = useMemo(() => {
    const counts = Object.fromEntries(genres.map((genre) => [genre.id, 0]));
    papers.forEach((paper) => {
      counts[paper.genre] = (counts[paper.genre] || 0) + 1;
    });
    return counts;
  }, [papers]);

  function moveCard(direction) {
    if (!current) return;
    const paper = current;
    if (direction === "save") {
      setSaved((items) =>
        items.some((item) => item.id === paper.id) ? items : [paper, ...items],
      );
      setStatus("Saved to your reading list");
    } else {
      setDismissed((items) =>
        items.some((item) => item.id === paper.id) ? items : [paper, ...items],
      );
      setStatus("Marked as not interested");
    }
    setDrag({ x: direction === "save" ? 430 : -430, y: 12, active: false });
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDrag({ x: 0, y: 0, active: false });
    }, 190);
  }

  function undo() {
    if (dismissed.length) {
      setDismissed((items) => items.slice(1));
      setStatus("Restored the last skipped paper");
      return;
    }
    if (saved.length) {
      setSaved((items) => items.slice(1));
      setStatus("Removed the last saved paper");
    }
  }

  function openCurrent() {
    if (!current) return;
    window.open(current.url, "_blank", "noopener,noreferrer");
  }

  function beginDrag(event) {
    startPoint.current = { x: event.clientX, y: event.clientY };
    setDrag((value) => ({ ...value, active: true }));
  }

  function updateDrag(event) {
    if (!startPoint.current) return;
    const x = event.clientX - startPoint.current.x;
    const y = event.clientY - startPoint.current.y;
    setDrag({ x, y, active: true });
  }

  function endDrag() {
    if (!startPoint.current) return;
    const x = drag.x;
    startPoint.current = null;
    if (x > 92) {
      moveCard("save");
    } else if (x < -92) {
      moveCard("skip");
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
  }

  const rotation = Math.max(Math.min(drag.x / 18, 9), -9);
  const progress = totalToday
    ? Math.min(saved.length + dismissed.length + 1, totalToday)
    : 0;

  useEffect(() => {
    let cancelled = false;
    async function translateCurrentTitle() {
      if (!current?.title) {
        setTranslatedTitle("");
        setTranslationStatus("idle");
        return;
      }

      setTranslationStatus("loading");
      setTranslatedTitle("");
      try {
        const translated = await translateTitleToJapanese(current.title);
        if (cancelled) return;
        setTranslatedTitle(translated);
        setTranslationStatus("ready");
      } catch {
        if (cancelled) return;
        setTranslatedTitle("");
        setTranslationStatus("error");
      }
    }

    translateCurrentTitle();
    return () => {
      cancelled = true;
    };
  }, [current?.id, current?.title]);

  return (
    <main className="app-shell">
      <section
        className="phone-stage"
        aria-label="PaperSwipe iPhone app"
        style={{
          "--card-art-image": `url("${import.meta.env.BASE_URL}research-card-texture.jpg")`,
        }}
      >
        <header className="topbar">
          <div>
            <h1>
              Paper<span>Swipe</span>
            </h1>
            <p>{status}</p>
          </div>
          <button
            className="daily-pill"
            aria-label="Refresh papers manually"
            onClick={() => refreshPapers()}
            disabled={fetchState === "loading"}
          >
            <RefreshCcw size={18} />
            <strong>
              {fetchState === "loading" ? "Fetching" : `Today ${totalToday} papers`}
            </strong>
          </button>
          <button className="icon-button" aria-label="Saved papers">
            <Bookmark size={23} />
            <small>{saved.length}</small>
          </button>
        </header>

        <div className="refreshed">
          Last updated {fetchMeta.date || "not yet"}
          {lastFetch ? ` ${lastFetch}` : ""} · Source {fetchMeta.source} ·{" "}
          {fetchMeta.count} records
          {fetchMeta.fromCache ? " · cached" : ""}
        </div>

        <nav className="genre-row" aria-label="Research genres">
          {genres.map((genre) => {
            const Icon = genre.icon;
            const isActive = genre.id === activeGenre;
            return (
              <button
                key={genre.id}
                className={`genre-chip ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveGenre(genre.id);
                  setIndex(0);
                }}
              >
                <Icon size={24} strokeWidth={1.9} />
                <span>{genre.label}</span>
                <strong>{genreCounts[genre.id] || 0}</strong>
              </button>
            );
          })}
        </nav>

        <section className="deck-area" aria-live="polite">
          {current ? (
            <>
              {next ? <div className="paper-card shadow-card shadow-one" /> : null}
              <div className="paper-card shadow-card shadow-two" />
              <article
                className="paper-card active-card"
                style={{
                  transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
                  transition: drag.active ? "none" : "transform 190ms ease",
                }}
                onPointerDown={beginDrag}
                onPointerMove={updateDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <div
                  className="swipe-label save-label"
                  style={{ opacity: Math.min(Math.max(drag.x / 90, 0), 1) }}
                >
                  <BookmarkCheck size={22} />
                  Save
                </div>
                <div
                  className="swipe-label skip-label"
                  style={{ opacity: Math.min(Math.max(-drag.x / 90, 0), 1) }}
                >
                  <X size={24} />
                  Skip
                </div>
                <div className="card-art" />
                <div className="paper-body">
                  <div className="meta-line">
                    <span className="source">{compactSource(current.source)}</span>
                    <span>{current.topic}</span>
                    <time>{current.date}</time>
                  </div>
                  <div className="title-stack">
                    {translatedTitle && translatedTitle !== current.title ? (
                      <h2 className="title-ja">{translatedTitle}</h2>
                    ) : translationStatus === "loading" ? (
                      <span className="translation-note">タイトル翻訳中</span>
                    ) : null}
                    <p className="title-original">{current.title}</p>
                  </div>
                  <div className="paper-link">
                    <Link size={21} />
                    <a href={current.url} target="_blank" rel="noreferrer">
                      {compactUrl(current.url)}
                    </a>
                    <ArrowUpRight size={22} />
                  </div>
                </div>
              </article>
            </>
          ) : (
            <section className={`empty-card ${fetchState}`}>
              <div className="card-art" />
              <div className="empty-body">
                <strong>{fetchState === "loading" ? "取得中" : "取得失敗"}</strong>
                <h2>
                  {fetchState === "loading"
                    ? "実在論文をOpenAlexから取得しています"
                    : "実在するarticle / preprintを取得できませんでした"}
                </h2>
                <p>
                  {fetchState === "loading"
                    ? "デモfallbackは使わず、OpenAlexで確認できる実データだけを表示します。"
                    : fetchError || "ネットワークまたはOpenAlexの応答を確認してください。"}
                </p>
                <button onClick={() => refreshPapers()} disabled={fetchState === "loading"}>
                  <RefreshCcw size={18} />
                  手動更新
                </button>
              </div>
            </section>
          )}
        </section>

        <section className="actions" aria-label="Paper actions">
          <button
            className="action-button skip"
            onClick={() => moveCard("skip")}
            disabled={!current}
          >
            <X size={42} />
            <span>Not interested</span>
          </button>
          <button className="action-button open" onClick={openCurrent} disabled={!current}>
            <ArrowUpRight size={39} />
            <span>Open</span>
          </button>
          <button
            className="action-button save"
            onClick={() => moveCard("save")}
            disabled={!current}
          >
            <Bookmark size={40} />
            <span>Save</span>
          </button>
        </section>

        <footer className="bottom-zone">
          <button className="square-button" aria-label="Filters">
            <SlidersHorizontal size={25} />
          </button>
          <div className="progress">
            <strong>
              {progress} / {totalToday}
            </strong>
            <span>Swipe to discover</span>
          </div>
          <button className="square-button" aria-label="Undo" onClick={undo}>
            <RotateCcw size={25} />
          </button>
        </footer>

        <aside className="saved-drawer">
          <div>
            <Sparkles size={16} />
            <strong>{saved.length} saved</strong>
            <span>{dismissed.length} skipped</span>
          </div>
          <p>
            Free plan: OpenAlex live fetch only. No demo fallback. Showing article
            and preprint records that include real source URLs.
          </p>
        </aside>
      </section>
    </main>
  );
}
