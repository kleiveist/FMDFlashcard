import { useEffect, useState } from "react";

export const useMediaQuery = (query: string, defaultState: boolean) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return defaultState;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => {
      setMatches(mediaQuery.matches);
    };
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
};
