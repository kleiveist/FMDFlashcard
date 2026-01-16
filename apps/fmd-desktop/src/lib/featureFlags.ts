/**
 * @file apps/fmd-desktop/src/lib/featureFlags.ts
 *
 * Purpose:
 * - Central place for feature toggles.
 * - Keeps dev logging for flag states.
 */

const WORDPRESS_ENABLED =
  typeof import.meta.env.VITE_WORDPRESS_ENABLED === "string" &&
  import.meta.env.VITE_WORDPRESS_ENABLED.toLowerCase() === "true";

export const isWordPressEnabled = () => WORDPRESS_ENABLED;

export const logWordPressFeatureStatus = () => {
  if (!import.meta.env.DEV) {
    return;
  }
  // Keep a single log so we know whether the feature path is reachable.
  console.info("[feature] WordPress integration flag", {
    enabled: WORDPRESS_ENABLED,
    source: "VITE_WORDPRESS_ENABLED",
  });
};
