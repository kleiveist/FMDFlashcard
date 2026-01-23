import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type LayoutMode = "desktop" | "table";

const DESKTOP_QUERY = "(min-width: 1200px)";

const resolveLayoutMode = (): LayoutMode => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "desktop";
  }
  return window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "table";
};

const LayoutModeContext = createContext<LayoutMode>("desktop");

export const LayoutModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<LayoutMode>(() => resolveLayoutMode());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const handleChange = () => {
      setMode(mediaQuery.matches ? "desktop" : "table");
    };
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return (
    <LayoutModeContext.Provider value={mode}>
      {children}
    </LayoutModeContext.Provider>
  );
};

export const useLayoutMode = () => useContext(LayoutModeContext);
