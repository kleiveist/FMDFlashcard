/**
 * @file frontend/src/features/preview/database/database-panel-layer-style.ts
 *
 * Utility helpers for desktop database panel layer positioning.
 */

export type DatabasePanelLayerRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type ResolveDatabasePanelLayerStyleInput = {
  triggerRect: DatabasePanelLayerRect;
  viewportWidth: number;
  viewportHeight: number;
  panelWidth: number;
  panelHeight?: number;
  horizontalAlign?: "left" | "right";
  keepBelowTrigger?: boolean;
};

export type DatabasePanelLayerLayout = {
  left: number;
  top: number;
  maxHeight: number;
};

export const DATABASE_PANEL_LAYER_VIEWPORT_PADDING = 12;
export const DATABASE_PANEL_LAYER_VERTICAL_GAP = 8;
export const DATABASE_PANEL_LAYER_MIN_WIDTH = 280;
export const DATABASE_PANEL_LAYER_MAX_WIDTH = 620;
export const DATABASE_PANEL_LAYER_MIN_VISIBLE_HEIGHT = 220;
export const DATABASE_PANEL_LAYER_MAX_HEIGHT = 640;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

export const resolveDatabasePanelLayerStyle = ({
  triggerRect,
  viewportWidth,
  viewportHeight,
  panelWidth,
  panelHeight,
  horizontalAlign = "right",
  keepBelowTrigger = false,
}: ResolveDatabasePanelLayerStyleInput): DatabasePanelLayerLayout => {
  const nextViewportWidth = Math.max(1, asFinite(viewportWidth, 1));
  const nextViewportHeight = Math.max(1, asFinite(viewportHeight, 1));
  const maxUsablePanelWidth = Math.max(
    DATABASE_PANEL_LAYER_MIN_WIDTH,
    nextViewportWidth - (DATABASE_PANEL_LAYER_VIEWPORT_PADDING * 2),
  );
  const nextPanelWidth = clamp(
    asFinite(panelWidth, DATABASE_PANEL_LAYER_MAX_WIDTH),
    DATABASE_PANEL_LAYER_MIN_WIDTH,
    maxUsablePanelWidth,
  );

  const minLeft = DATABASE_PANEL_LAYER_VIEWPORT_PADDING;
  const maxLeft = Math.max(
    minLeft,
    nextViewportWidth - nextPanelWidth - DATABASE_PANEL_LAYER_VIEWPORT_PADDING,
  );
  const anchoredLeft = horizontalAlign === "left"
    ? triggerRect.left
    : triggerRect.right - nextPanelWidth;
  const left = clamp(anchoredLeft, minLeft, maxLeft);

  const topCandidate = triggerRect.bottom + DATABASE_PANEL_LAYER_VERTICAL_GAP;
  const desiredVisibleHeight = Number.isFinite(panelHeight) && (panelHeight ?? 0) > 0
    ? Math.min(asFinite(panelHeight ?? 0, DATABASE_PANEL_LAYER_MIN_VISIBLE_HEIGHT), DATABASE_PANEL_LAYER_MAX_HEIGHT)
    : DATABASE_PANEL_LAYER_MIN_VISIBLE_HEIGHT;
  const maxTopForVisibleHeight = Math.max(
    DATABASE_PANEL_LAYER_VIEWPORT_PADDING,
    nextViewportHeight - DATABASE_PANEL_LAYER_VIEWPORT_PADDING - desiredVisibleHeight,
  );
  const top = keepBelowTrigger
    ? Math.max(DATABASE_PANEL_LAYER_VIEWPORT_PADDING, topCandidate)
    : clamp(topCandidate, DATABASE_PANEL_LAYER_VIEWPORT_PADDING, maxTopForVisibleHeight);

  const availableHeight = Math.max(0, nextViewportHeight - top - DATABASE_PANEL_LAYER_VIEWPORT_PADDING);
  const maxHeight = Math.min(availableHeight, DATABASE_PANEL_LAYER_MAX_HEIGHT);

  return {
    left,
    top,
    maxHeight,
  };
};
