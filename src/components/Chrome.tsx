"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* The page used to carry two bars: the site header, and a second strip under it
   holding whatever the run in progress needed. On a phone the pair ate a third
   of the screen before the game began. Now there is one bar, and the screen
   below it hands up the two or three things it wants shown there. */

export interface RunChrome {
  /** "Classic · Pro", or the room code. */
  label: string;
  /** Re-spins in hand, while there are still squads to draft. */
  respins?: number;
  /** Must keep the same identity between renders. */
  onRestart: () => void;
}

const Ctx = createContext<{ run: RunChrome | null; setRun: (r: RunChrome | null) => void }>({
  run: null,
  setRun: () => {},
});

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<RunChrome | null>(null);
  const value = useMemo(() => ({ run, setRun }), [run]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChrome() {
  return useContext(Ctx);
}

/** Publish this screen's run to the bar above it; withdraw it on the way out. */
export function usePublishRun(run: RunChrome | null) {
  const { setRun } = useChrome();
  const label = run?.label ?? "";
  const respins = run?.respins;
  const onRestart = run?.onRestart;
  useEffect(() => {
    // The header sits above this screen in the tree, so what it shows can only
    // travel upwards once this has rendered.
    setRun(onRestart ? { label, respins, onRestart } : null);
    return () => {
      setRun(null);
    };
  }, [label, respins, onRestart, setRun]);
}
