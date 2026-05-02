import { useEffect, useRef } from "react";

export function useAutoScroll<T>(deps: T[]) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [deps]);

  return ref;
}
