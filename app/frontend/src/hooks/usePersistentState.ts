import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

type Initializer<T> = T | (() => T);

function resolveInitialValue<T>(initialValue: Initializer<T>): T {
  return typeof initialValue === "function"
    ? (initialValue as () => T)()
    : initialValue;
}

/** Small localStorage-backed state helper for resumeable simulations. */
export function usePersistentState<T>(
  key: string,
  initialValue: Initializer<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return resolveInitialValue(initialValue);
    }

    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return resolveInitialValue(initialValue);
    }

    try {
      return JSON.parse(stored) as T;
    } catch {
      return resolveInitialValue(initialValue);
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  const setPersistentValue: Dispatch<SetStateAction<T>> = useCallback(
    (nextValue) => {
      setValue((current) => {
        const resolved =
          typeof nextValue === "function"
            ? (nextValue as (currentValue: T) => T)(current)
            : nextValue;

        window.localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key],
  );

  return [value, setPersistentValue];
}
