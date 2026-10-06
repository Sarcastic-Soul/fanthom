"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Toast = { id: number; body: ReactNode };
const ToastContext = createContext<(body: ReactNode) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReducedMotion();
  const show = useCallback((body: ReactNode) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), body });
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            className="toast"
            initial={reduce ? false : { opacity: 0, y: 8, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 4, x: "-50%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          >
            {toast.body}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
