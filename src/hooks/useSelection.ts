import { useCallback, useEffect, useState } from "react";

const KEY = "raffle_selection";

const read = (): number[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

const write = (nums: number[]) => {
  localStorage.setItem(KEY, JSON.stringify(nums));
  window.dispatchEvent(new CustomEvent("raffle-selection-change"));
};

export const useSelection = () => {
  const [selected, setSelected] = useState<number[]>(() => read());

  useEffect(() => {
    const sync = () => setSelected(read());
    window.addEventListener("raffle-selection-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("raffle-selection-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((n: number) => {
    const cur = read();
    const next = cur.includes(n)
      ? cur.filter((x) => x !== n)
      : [...cur, n].sort((a, b) => a - b);
    write(next);
  }, []);

  const clear = useCallback(() => write([]), []);
  const set = useCallback((nums: number[]) => {
    write([...nums].sort((a, b) => a - b));
  }, []);

  return { selected, toggle, clear, set };
};
