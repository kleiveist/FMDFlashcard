import { describe, expect, it } from "vitest";
import {
  DATABASE_PANEL_LAYER_MAX_HEIGHT,
  resolveDatabasePanelLayerStyle,
} from "./database-panel-layer-style";

describe("resolveDatabasePanelLayerStyle", () => {
  it("anchors the panel to the trigger right edge and expands left", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 740,
        right: 900,
        top: 60,
        bottom: 96,
      },
      viewportWidth: 1280,
      viewportHeight: 900,
      panelWidth: 480,
      panelHeight: 400,
    });

    expect(layout.left).toBe(420);
  });

  it("can align panel left edge with trigger left edge", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 180,
        right: 260,
        top: 60,
        bottom: 96,
      },
      viewportWidth: 1280,
      viewportHeight: 900,
      panelWidth: 480,
      panelHeight: 400,
      horizontalAlign: "left",
    });

    expect(layout.left).toBe(180);
  });

  it("clamps the panel when there is not enough room on the left", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 120,
        right: 200,
        top: 80,
        bottom: 112,
      },
      viewportWidth: 1280,
      viewportHeight: 900,
      panelWidth: 480,
      panelHeight: 420,
    });

    expect(layout.left).toBe(12);
  });

  it("clamps the panel when there is not enough room on the right", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 1198,
        right: 1278,
        top: 80,
        bottom: 112,
      },
      viewportWidth: 1280,
      viewportHeight: 900,
      panelWidth: 460,
      panelHeight: 420,
    });

    expect(layout.left).toBe(808);
  });

  it("derives a dynamic max height larger than the previous fixed 360px cap", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 640,
        right: 760,
        top: 44,
        bottom: 80,
      },
      viewportWidth: 1400,
      viewportHeight: 1100,
      panelWidth: 520,
      panelHeight: 900,
    });

    expect(layout.maxHeight).toBe(DATABASE_PANEL_LAYER_MAX_HEIGHT);
    expect(layout.maxHeight).toBeGreaterThan(360);
  });

  it("moves the panel upward and caps max height safely in short viewports", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 600,
        right: 760,
        top: 320,
        bottom: 352,
      },
      viewportWidth: 1100,
      viewportHeight: 430,
      panelWidth: 520,
      panelHeight: 520,
    });

    expect(layout.top).toBe(12);
    expect(layout.maxHeight).toBe(406);
  });

  it("keeps top edge below trigger when configured", () => {
    const layout = resolveDatabasePanelLayerStyle({
      triggerRect: {
        left: 600,
        right: 760,
        top: 320,
        bottom: 352,
      },
      viewportWidth: 1100,
      viewportHeight: 430,
      panelWidth: 520,
      panelHeight: 520,
      keepBelowTrigger: true,
    });

    expect(layout.top).toBe(360);
    expect(layout.maxHeight).toBe(58);
  });
});
