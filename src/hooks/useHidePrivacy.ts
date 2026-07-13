import { useCallback, useEffect, useState } from "react";

const KEY = "dashboard_hide_values";
const EVT = "dashboard_hide_values:change";

function readInitial(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    // Default: HIDDEN (only shown if explicitly set to "0")
    return v !== "0";
  } catch {
    return true;
  }
}

/**
 * Shared hide-values state for admin panels.
 * Persisted in localStorage under `dashboard_hide_values`, defaulting to hidden.
 * Syncs across components via storage events and a custom in-tab event.
 */
export function useHidePrivacy(): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
  const [hide, setHide] = useState<boolean>(readInitial);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setHide(e.newValue !== "0");
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setHide(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVT, onCustom as EventListener);
    };
  }, []);

  const update = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setHide((prev) => {
      const next = typeof v === "function" ? (v as (p: boolean) => boolean)(prev) : v;
      try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* noop */ }
      try { window.dispatchEvent(new CustomEvent(EVT, { detail: next })); } catch { /* noop */ }
      return next;
    });
  }, []);

  return [hide, update];
}
