import { useLayoutMode } from "./layoutMode";

export const useTableView = () => {
  return useLayoutMode() === "table";
};
