import { useEffect, useState } from "react";

const TABLE_VIEW_QUERY = "(max-width: 1200px)";

export const useTableView = () => {
  const [isTableView, setIsTableView] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(TABLE_VIEW_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia(TABLE_VIEW_QUERY);
    const handleChange = () => {
      setIsTableView(mediaQuery.matches);
    };
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isTableView;
};
