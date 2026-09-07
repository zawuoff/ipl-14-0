"use client";
import { Component, type ReactNode } from "react";

/* The home page reads a few numbers out of Convex that the rest of the game
   does not need. A front end can ship before its backend catches up, and a
   missing query throws during render — so anything optional goes inside this
   and the page simply carries on without it. */
export class QuietBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Worth seeing in the console, not worth showing a reader.
    console.warn("[14-0] optional section unavailable:", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
