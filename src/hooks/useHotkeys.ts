import { useEffect, useRef } from "react";

export interface HotkeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  handler: () => void;
  when?: () => boolean;
}

export function useHotkeys(bindings: HotkeyBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      for (const binding of bindingsRef.current) {
        if (binding.when && !binding.when()) continue;

        const ctrl = binding.ctrl ?? false;
        const shift = binding.shift ?? false;
        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatch = ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shift ? e.shiftKey : !e.shiftKey;

        if (keyMatch && ctrlMatch && shiftMatch) {
          e.preventDefault();
          binding.handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
