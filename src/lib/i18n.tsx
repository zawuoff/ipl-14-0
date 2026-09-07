"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STRINGS } from "./strings";

export type Lang = "en" | "hi";

const STORE_KEY = "14-0-lang";

type Vars = Record<string, string | number>;

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Look a phrase up. Missing Hindi falls back to English rather than a blank. */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const entry = STRINGS[key];
  if (!entry) return fill(key, vars);
  const s = lang === "hi" ? entry.hi || entry.en : entry.en;
  return fill(s, vars);
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === "hi" || saved === "en") {
        setLangState(saved);
        return;
      }
      // First visit: follow the browser, since most of the audience is in India.
      if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("hi")) {
        setLangState("hi");
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORE_KEY, l);
    } catch {}
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

/** The phrase getter every screen uses. */
export function useT() {
  const { lang } = useLang();
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}

/** Switches the language and always shows the language you would switch to. */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  const next: Lang = lang === "en" ? "hi" : "en";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={lang === "en" ? "हिंदी में पढ़ें" : "Read in English"}
      title={lang === "en" ? "हिंदी में पढ़ें" : "Read in English"}
      className={`flex items-center justify-center shrink-0 rounded-full bg-white/12 text-white font-semibold hover:bg-white/20 transition-colors ${className}`}
    >
      {lang === "en" ? "हिं" : "EN"}
    </button>
  );
}

export type T = (k: string, v?: Record<string, string | number>) => string;

/** The sim writes margins in English units; swap the units, keep the numbers. */
export function localiseMargin(margin: string, t: T): string {
  return margin
    .replace(/(\d+)\s*(?:wkts?|wickets?)\b/g, (_, n) =>
      `${n} ${t(Number(n) === 1 ? "unit.wicket" : "unit.wickets")}`
    )
    .replace(/(\d+)\s*balls? left/g, (_, n) => `${n} ${t("unit.ballsLeft")}`)
    .replace(/(\d+)\s*runs?\b/g, (_, n) => `${n} ${t(Number(n) === 1 ? "unit.run" : "unit.runs")}`);
}

export function ordinal(n: number, t: T): string {
  return n >= 1 && n <= 10 ? t(`ord.${n}`) : `${n}th`;
}
