import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SelectionState {
  selected: number[];
  toggle: (n: number) => void;
  clear: () => void;
  set: (nums: number[]) => void;
}

export const useSelection = create<SelectionState>()(
  persist(
    (set, get) => ({
      selected: [],
      toggle: (n) => {
        const cur = get().selected;
        set({
          selected: cur.includes(n)
            ? cur.filter((x) => x !== n)
            : [...cur, n].sort((a, b) => a - b),
        });
      },
      clear: () => set({ selected: [] }),
      set: (nums) => set({ selected: [...nums].sort((a, b) => a - b) }),
    }),
    { name: "raffle_selection" },
  ),
);
