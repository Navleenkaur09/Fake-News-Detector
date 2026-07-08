import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Brain, Activity, Database, ArrowRight,
  Zap, Search, BarChart3, CheckCircle2, AlertCircle,
  Loader2, TrendingUp, Lock, Globe, Newspaper,
} from "lucide-react";
import {
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
  usePredictNews,
} from "@workspace/api-client-react";

/* ─── Animated counter ──────────────────────────────────────────── */
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1600, bounce: 0 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { if (inView) mv.set(value); }, [inView, value, mv]);
  useEffect(() => spring.on("change", v => setDisplay(Math.round(v))), [spring]);
  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>;
}

/* ─── Newspaper clipping card ───────────────────────────────────── */
interface ClipProps {
  headline: string;
  body: string;
  source: string;
  date: string;
  rotate: number;
  top: string;
  left?: string;
  right?: string;
  delay: number;
}

function NewsClip({ headline, body, source, date, rotate, top, left, right, delay }: ClipProps) {
  const [stamped, setStamped] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const mutation = usePredictNews();

  const handleClick = () => {
    if (stamped || analyzing) return;
    setAnalyzing(true);
    mutation.mutate(
      { data: { text: headline + " " + body } },
      {
        onSuccess: () => { setAnalyzing(false); setStamped(true); },
        onError:   () => { setAnalyzing(false); setStamped(true); },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotate: rotate - 4 }}
      animate={{ opacity: 1, scale: 1, rotate }}
      transition={{ duration: 0.7, delay, type: "spring", stiffness: 120 }}
      whileHover={{ scale: 1.07, rotate: 0, zIndex: 20, boxShadow: "0 20px 40px rgba(0,0,0,0.18)" }}
      onClick={handleClick}
      className="absolute w-52 cursor-pointer select-none"
      style={{ top, left, right }}
    >
      {/* Paper texture */}
      <div className="relative rounded-sm bg-amber-50 border border-amber-200/80 shadow-md overflow-hidden"
           style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 23px,rgba(180,140,60,0.08) 23px,rgba(180,140,60,0.08) 24px)" }}>

        {/* Newspaper masthead */}
        <div className="border-b-2 border-stone-800 px-3 pt-2 pb-1 text-center">
          <p className="font-serif text-[9px] uppercase tracking-widest text-stone-500 font-bold">The Daily Chronicle</p>
          <div className="border-t border-stone-400 my-0.5" />
          <p className="font-serif text-[8px] text-stone-400">{date}</p>
        </div>

        {/* Headline */}
        <div className="px-3 pt-2 pb-1">
          <h3 className="font-serif text-[11px] font-black leading-tight text-stone-900 uppercase tracking-tight">
            {headline}
          </h3>
          <div className="border-t border-stone-400 my-1.5" />
          <p className="font-serif text-[9px] leading-snug text-stone-700">{body}</p>
          <p className="text-[8px] text-stone-400 italic mt-1.5 text-right">— {source}</p>
        </div>

        {/* Click hint */}
        {!stamped && !analyzing && (
          <div className="px-3 pb-2">
            <p className="text-[7px] text-stone-400 text-center border border-dashed border-stone-300 rounded px-1 py-0.5">
              Click to scan ↑
            </p>
          </div>
        )}

        {/* FAKE stamp overlay */}
        <AnimatePresence>
          {(stamped || analyzing) && (
            <motion.div
              initial={{ opacity: 0, scale: 2, rotate: -15 }}
              animate={{ opacity: 1, scale: 1, rotate: -12 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {analyzing ? (
                <div className="rounded border-2 border-stone-400 px-3 py-1.5 bg-white/70 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-stone-500 mx-auto" />
                </div>
              ) : (
                <div className="rounded border-4 border-red-600 px-3 py-1.5 bg-white/60 backdrop-blur-sm -rotate-12">
                  <span className="font-black text-2xl tracking-widest text-red-600 font-mono opacity-90">
                    FAKE
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Newspaper data ────────────────────────────────────────────── */
const CLIPPINGS: ClipProps[] = [
  {
    headline: "Moon Confirmed to Be Made of Aged Gouda",
    body: "NASA scientists finally admitted what flat-earthers have known for years. The lunar surface is 94% dairy product.",
    source: "Anonymous Insider",
    date: "Est. 1842  •  Vol. CLXXXIV",
    rotate: -6,
    top: "6%",
    left: "1%",
    delay: 0.2,
  },
  {
    headline: "5G Towers Secretly Transmit Mind-Control Signals",
    body: "Whistleblower reveals telecom giants have been broadcasting subliminal advertising directly into customers' dreams.",
    source: "T. Ruther, Esq.",
    date: "Est. 1842  •  Vol. CCXI",
    rotate: 5,
    top: "4%",
    right: "1%",
    delay: 0.4,
  },
  {
    headline: "Drinking Hot Water Cures All Known Disease",
    body: "Big Pharma furiously suppresses groundbreaking study showing 100% efficacy of boiled tap water against every ailment.",
    source: "Dr. S. Quacksworth",
    date: "Est. 1842  •  Vol. CXLII",
    rotate: -4,
    top: "52%",
    left: "0%",
    delay: 0.6,
  },
  {
    headline: "Aliens Running Major World Governments",
    body: "Leaked documents show extraterrestrial beings have infiltrated 43 nations. They prefer paperwork to abductions.",
    source: "Deep Orbit Source",
    date: "Est. 1842  •  Vol. CLVII",
    rotate: 7,
    top: "50%",
    right: "0%",
    delay: 0.8,
  },
];

/* ─── Feature card ───────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, color, delay }:
  { icon: React.ElementType; title: string; desc: string; color: string; delay: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group relative rounded-2xl border border-green-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-default overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at 55% 35%, ${color}14 0%, transparent 70%)` }}
      />
      <motion.div
        animate={{ scale: hovered ? 1.15 : 1, rotate: hovered ? 8 : 0 }}
        transition={{ type: "spring", stiffness: 300 }}
        className="inline-flex items-center justify-center rounded-xl p-3 mb-4"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </motion.div>
      <h3 className="font-semibold text-[15px] mb-1.5 text-stone-900">{title}</h3>
      <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* ─── Mini analyzer ─────────────────────────────────────────────── */
function MiniAnalyzer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ label: "REAL" | "FAKE" } | null>(null);
  const mutation = usePredictNews();

  const run = () => {
    if (text.trim().length < 10) return;
    mutation.mutate({ data: { text } }, {
      onSuccess: d => setResult({ label: d.label }),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55 }}
      className="rounded-2xl border border-green-200 bg-white shadow-lg overflow-hidden"
    >
      {/* Terminal bar */}
      <div className="border-b border-green-100 bg-green-50 px-5 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <span className="text-xs text-stone-400 font-mono ml-2 flex items-center gap-1.5">
          <Newspaper className="h-3 w-3" /> veritas — quick scan
        </span>
      </div>
      <div className="p-5 space-y-3">
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); mutation.reset(); }}
          placeholder="Paste a headline or excerpt here…"
          rows={3}
          className="w-full resize-none rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all font-mono"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-400 font-mono">{text.length} chars</span>
          <div className="flex gap-2">
            {result && (
              <Button variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => { setText(""); setResult(null); mutation.reset(); }}>
                Clear
              </Button>
            )}
            <Button size="sm" className="h-8 px-4 text-xs font-semibold gap-1.5 bg-rose-600 hover:bg-rose-700"
              disabled={text.trim().length < 10 || mutation.isPending}
              onClick={run}>
              {mutation.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
                : <><Search className="h-3.5 w-3.5" /> Quick Scan</>}
            </Button>
          </div>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-lg px-4 py-3 border flex items-center justify-between
                ${result.label === "FAKE"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-green-50 border-green-200 text-green-700"}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {result.label === "FAKE"
                  ? <AlertCircle className="h-4 w-4" />
                  : <CheckCircle2 className="h-4 w-4" />}
                {result.label === "FAKE" ? "Likely Fake News" : "Appears Credible"}
              </span>
              <Link href="/predict">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                  Full report <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function Home() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const accuracy = stats ? Math.round((stats.accuracy ?? 0) * 100) : 0;

  const features = [
    { icon: Zap,        title: "Instant Results",       color: "#f59e0b", desc: "Get a credibility verdict in under a second — no sign-up, no waiting." },
    { icon: Brain,      title: "NLP Signal Detection",  color: "#6366f1", desc: "15+ linguistic indicators: sensationalism, unverified sources, conspiracy framing, viral bait." },
    { icon: BarChart3,  title: "Confidence Scoring",    color: "#3b82f6", desc: "Every verdict comes with a probability score, key influencing words, and a full explanation." },
    { icon: Search,     title: "Explainable AI",        color: "#10b981", desc: "Not just a label — see exactly why content was flagged and what to do about it." },
    { icon: TrendingUp, title: "Model Performance",     color: "#ec4899", desc: "Trained on 44,898 articles from the ISOT dataset. Accuracy, precision, recall all tracked live." },
    { icon: Lock,       title: "Private by Design",     color: "#8b5cf6", desc: "Text is processed server-side only. Nothing stored, nothing shared, no account needed." },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-green-50 text-stone-900">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center overflow-hidden min-h-[92vh] bg-gradient-to-br from-green-50 via-emerald-50 to-lime-50 px-4 py-20">

        {/* Subtle dot grid */}
        <div className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "radial-gradient(circle, #86efac 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        {/* Newspaper clippings */}
        {CLIPPINGS.map((c, i) => (
          <NewsClip key={i} {...c} />
        ))}

        {/* Glow blobs */}
        <div className="pointer-events-none absolute top-0 left-1/4 h-80 w-80 rounded-full bg-green-200/50 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-1/4 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl" />

        {/* Hero content */}
        <div className="relative z-10 max-w-2xl text-center">

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 shadow-sm mb-8"
          >
            <ShieldCheck className="h-4 w-4" />
            NLP-powered · GPT-ready · 100% free
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-stone-900 leading-[1.05]"
          >
            Don't believe{" "}
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-600">
                everything
              </span>
              {/* Underline */}
              <motion.span
                className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
                style={{ originX: 0 }}
              />
            </span>{" "}
            you read.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg text-stone-600 leading-relaxed max-w-xl mx-auto"
          >
            Veritas detects misinformation in seconds — analyzing linguistic patterns,
            source credibility, and manipulation signals so you know what's real.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-sm text-stone-400 italic"
          >
            👆 Click any newspaper above to scan it instantly
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link href="/predict" className="inline-flex">
              <Button size="lg"
                className="h-12 px-8 font-semibold gap-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 border-0 shadow-md hover:shadow-lg transition-shadow text-white">
                <Brain className="h-5 w-5" />
                Analyze an Article
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard" className="inline-flex">
              <Button size="lg" variant="outline"
                className="h-12 px-8 font-semibold gap-2 border-green-300 bg-green-100 hover:bg-green-200 text-stone-800">
                <BarChart3 className="h-5 w-5" />
                View Model Stats
              </Button>
            </Link>
          </motion.div>

          {/* Trust pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex flex-wrap justify-center gap-3 text-xs text-stone-500"
          >
            {[
              { icon: Database,    label: "44,898 training articles" },
              { icon: TrendingUp,  label: `${accuracy}% model accuracy` },
              { icon: Globe,       label: "Free to use" },
              { icon: Lock,        label: "No data stored" },
            ].map(({ icon: Icon, label }) => (
              <span key={label}
                className="flex items-center gap-1.5 rounded-full bg-green-100 border border-green-300 px-3 py-1 shadow-sm">
                <Icon className="h-3 w-3 text-rose-500" />
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────── */}
      <section className="border-y border-green-200 bg-green-50">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Database,  value: stats?.datasetSize ?? 0,      suffix: "",  label: "Articles Indexed",  color: "#e11d48" },
              { icon: Brain,     value: accuracy,                      suffix: "%", label: "Model Accuracy",    color: "#f43f5e" },
              { icon: Activity,  value: stats?.totalPredictions ?? 0, suffix: "",  label: "Scans Completed",   color: "#fb7185" },
            ].map(({ icon: Icon, value, suffix, label, color }) => (
              <motion.div
                key={label}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-green-200 bg-white hover:bg-green-100 hover:border-green-300 hover:shadow-md transition-all cursor-default"
              >
                <div className="rounded-xl p-3 mb-1" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <p className="text-3xl font-extrabold font-mono" style={{ color }}>
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <AnimatedNumber value={value} suffix={suffix} />}
                </p>
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRY IT NOW ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-green-50 to-emerald-100/50 px-4 py-20">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <Badge className="mb-4 bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100">
              Try it live
            </Badge>
            <h2 className="text-3xl font-bold text-stone-900">Quick Scan — Right Here</h2>
            <p className="mt-3 text-stone-500">No sign-up. Paste any text and get a verdict instantly.</p>
          </motion.div>
          <MiniAnalyzer />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section className="bg-green-50 border-t border-green-100 px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-stone-900">Everything you need to spot disinformation</h2>
            <p className="mt-3 text-stone-500 max-w-lg mx-auto">
              A multi-signal NLP pipeline built on the ISOT fake news dataset.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-rose-500 to-red-600 px-4 py-20 text-center text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-xl mx-auto"
        >
          <h2 className="text-3xl font-bold mb-4">Stop misinformation before it spreads</h2>
          <p className="text-rose-100 mb-8 leading-relaxed">
            Every share of a fake article spreads deception further. Verify before you share.
          </p>
          <Link href="/predict" className="inline-flex">
            <Button size="lg" variant="secondary"
              className="h-12 px-8 font-semibold gap-2 text-rose-700 shadow-lg hover:shadow-xl transition-shadow">
              <Brain className="h-5 w-5" />
              Analyze Now — It's Free
            </Button>
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
