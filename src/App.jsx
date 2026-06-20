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

const STORAGE_KEY = "paperswipe-v1";
const DISMISSED_KEY = "paperswipe-dismissed-v1";
const SAVED_KEY = "paperswipe-saved-v1";

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

const samplePapers = [
  {
    id: "sample-1",
    genre: "ai",
    source: "arXiv",
    topic: "cs.LG",
    date: "May 24, 2024",
    title: "Scaling Laws for Diffusion Models at Large Batch Sizes",
    tags: ["diffusion models", "scaling laws", "generative models"],
    authors: "J. Liu, A. Kumar, M. Chen, S. Rajeswaran, C. Finn, S. Ermon",
    institution: "Stanford University, Google DeepMind, UC Berkeley",
    abstract:
      "We identify distinct scaling regimes that govern sample quality and training efficiency for diffusion models as model size, dataset size, and batch size increase.",
    url: "https://arxiv.org/abs/2405.12345",
  },
  {
    id: "sample-2",
    genre: "economics",
    source: "OpenAlex",
    topic: "Econ",
    date: "Jun 02, 2024",
    title: "Monetary Policy Shocks and Household Portfolio Rebalancing",
    tags: ["monetary policy", "households", "risk assets"],
    authors: "M. Sato, L. Anders, R. Nakamura",
    institution: "Hitotsubashi University, London School of Economics",
    abstract:
      "Using high-frequency identification, we estimate how rate shocks reshape savings, equity exposure, and bond duration across income groups.",
    url: "https://openalex.org/W4389210092",
  },
  {
    id: "sample-3",
    genre: "investing",
    source: "SSRN",
    topic: "Finance",
    date: "Apr 18, 2024",
    title: "Factor Crowding, Liquidity Premia, and ETF Flow Reversals",
    tags: ["factor investing", "liquidity", "ETF flows"],
    authors: "N. Park, E. Watanabe, S. Brooks",
    institution: "University of Chicago Booth, Tokyo University",
    abstract:
      "We document that crowded style exposures amplify liquidity premia during ETF flow reversals and compress expected returns afterward.",
    url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4567890",
  },
  {
    id: "sample-4",
    genre: "drug-discovery",
    source: "bioRxiv",
    topic: "Cheminformatics",
    date: "May 09, 2024",
    title: "Active Learning for Kinase Inhibitor Discovery with Sparse Assays",
    tags: ["active learning", "kinase", "sparse assays"],
    authors: "A. Reyes, H. Mori, P. Gupta, L. Tran",
    institution: "Broad Institute, Kyoto University",
    abstract:
      "A batch active-learning loop prioritizes compounds under assay budget limits while preserving chemical diversity in hit expansion.",
    url: "https://www.biorxiv.org/content/10.1101/2024.05.09.000001v1",
  },
  {
    id: "sample-5",
    genre: "medicine",
    source: "PubMed",
    topic: "Clinical AI",
    date: "Mar 31, 2024",
    title: "External Validation of Multimodal Models for Sepsis Prediction",
    tags: ["sepsis", "validation", "multimodal model"],
    authors: "K. Johnson, Y. Tanaka, R. Singh, M. Flores",
    institution: "Mayo Clinic, University of Tokyo Hospital",
    abstract:
      "Across five hospitals, multimodal predictors improved early warning performance but showed calibration drift under changes in care pathways.",
    url: "https://pubmed.ncbi.nlm.nih.gov/38600001/",
  },
  {
    id: "sample-6",
    genre: "statistics",
    source: "arXiv",
    topic: "stat.ME",
    date: "Feb 14, 2024",
    title: "Robust Bayesian Inference under Misspecified Treatment Assignment",
    tags: ["bayesian inference", "causal effects", "robustness"],
    authors: "S. Kline, T. Yamamoto, A. Gelman",
    institution: "Columbia University, University of Washington",
    abstract:
      "The method couples prior predictive checks with sensitivity curves to stabilize treatment-effect estimates under misspecified assignment models.",
    url: "https://arxiv.org/abs/2402.09876",
  },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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

async function fetchFreeDailyPapers() {
  const batches = await Promise.allSettled(
    genres.map(async (genre) => {
      const url = new URL("https://api.openalex.org/works");
      url.searchParams.set("search", genre.query);
      url.searchParams.set("per-page", "80");
      url.searchParams.set("sort", "publication_date:desc");
      url.searchParams.set(
        "filter",
        "from_publication_date:2023-01-01,type:article|preprint",
      );
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
      const data = await response.json();
      return (data.results || []).map((work) => normalizeOpenAlexWork(work, genre));
    }),
  );

  const papers = batches.flatMap((batch) =>
    batch.status === "fulfilled" ? batch.value : [],
  );
  return papers.length ? papers : expandSamples();
}

function expandSamples() {
  return Array.from({ length: 420 }, (_, index) => {
    const paper = samplePapers[index % samplePapers.length];
    const day = String((index % 27) + 1).padStart(2, "0");
    return {
      ...paper,
      id: `${paper.id}-${index}`,
      date: `Jun ${day}, 2026`,
      title: index < samplePapers.length ? paper.title : `${paper.title}: Update ${index}`,
    };
  });
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

export function App() {
  const [activeGenre, setActiveGenre] = useState("ai");
  const [papers, setPapers] = useState([]);
  const [saved, setSaved] = useState(() => readJson(SAVED_KEY, []));
  const [dismissed, setDismissed] = useState(() => readJson(DISMISSED_KEY, []));
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [status, setStatus] = useState("Preparing today's deck");
  const [lastFetch, setLastFetch] = useState("");
  const startPoint = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const cached = readJson(STORAGE_KEY, null);
      if (cached?.date === todayKey() && cached?.papers?.length) {
        if (!mounted) return;
        setPapers(cached.papers);
        setLastFetch(cached.time || "06:30");
        setStatus("Loaded today's free harvest");
        return;
      }

      setStatus("Fetching free papers from OpenAlex");
      const nextPapers = await fetchFreeDailyPapers();
      if (!mounted) return;
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: todayKey(), time, papers: nextPapers }),
      );
      setPapers(nextPapers);
      setLastFetch(time);
      setStatus("Today fetched with free sources");
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

  const queue = useMemo(() => {
    const hidden = new Set([...saved, ...dismissed].map((paper) => paper.id));
    const available = papers.filter((paper) => !hidden.has(paper.id));
    const selected = available.filter((paper) => paper.genre === activeGenre);
    return selected.length ? selected : available;
  }, [activeGenre, dismissed, papers, saved]);

  const current = queue[index % Math.max(queue.length, 1)] || expandSamples()[0];
  const next = queue[(index + 1) % Math.max(queue.length, 1)];
  const totalToday = papers.length || 420;
  const genreCounts = useMemo(() => {
    const counts = Object.fromEntries(genres.map((genre) => [genre.id, 0]));
    papers.forEach((paper) => {
      counts[paper.genre] = (counts[paper.genre] || 0) + 1;
    });
    return counts;
  }, [papers]);

  function moveCard(direction) {
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
  const progress = Math.min(saved.length + dismissed.length + 1, totalToday);

  return (
    <main className="app-shell">
      <section className="phone-stage" aria-label="PaperSwipe iPhone app">
        <header className="topbar">
          <div>
            <h1>
              Paper<span>Swipe</span>
            </h1>
            <p>{status}</p>
          </div>
          <div className="daily-pill" aria-label="Daily fetch count">
            <RefreshCcw size={18} />
            <strong>Today {totalToday} papers</strong>
          </div>
          <button className="icon-button" aria-label="Saved papers">
            <Bookmark size={23} />
            <small>{saved.length}</small>
          </button>
        </header>

        <div className="refreshed">Refreshed at {lastFetch || "06:30"}</div>

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
                <strong>{genreCounts[genre.id] || genre.count}</strong>
              </button>
            );
          })}
        </nav>

        <section className="deck-area" aria-live="polite">
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
              <h2>{current.title}</h2>
              <div className="tag-row">
                {current.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                {current.tags.length > 3 ? <span>+{current.tags.length - 3}</span> : null}
              </div>
              <p className="authors">{current.authors || "OpenAlex indexed authors"}</p>
              <p className="institution">{current.institution}</p>
              <p className="abstract">{current.abstract}</p>
              <div className="paper-link">
                <Link size={21} />
                <a href={current.url} target="_blank" rel="noreferrer">
                  {compactUrl(current.url)}
                </a>
                <ArrowUpRight size={22} />
              </div>
            </div>
          </article>
        </section>

        <section className="actions" aria-label="Paper actions">
          <button className="action-button skip" onClick={() => moveCard("skip")}>
            <X size={42} />
            <span>Not interested</span>
          </button>
          <button className="action-button open" onClick={openCurrent}>
            <ArrowUpRight size={39} />
            <span>Open</span>
          </button>
          <button className="action-button save" onClick={() => moveCard("save")}>
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
            Free plan: automatic daily harvest, OpenAlex live fetch, arXiv/PubMed
            URLs retained when available.
          </p>
        </aside>
      </section>
    </main>
  );
}
