/**
 * @file frontend/src/features/settings/settingsDeepLink.ts
 *
 * Zweck:
 * - Ermoeglicht Deep-Links/Fokus in Settings ohne Router.
 */

import type { SettingsPageId, SettingsSubPageId } from "./settingsNavigation";

export type SettingsFocusRequest = {
  pageId: SettingsPageId;
  subPageId?: SettingsSubPageId;
  focusSelector?: string;
  scrollSelector?: string;
  highlight?: boolean;
};

type SettingsFocusListener = (request: SettingsFocusRequest) => void;

const listeners = new Set<SettingsFocusListener>();
let pendingRequest: SettingsFocusRequest | null = null;

export const requestSettingsFocus = (request: SettingsFocusRequest) => {
  pendingRequest = request;
  listeners.forEach((listener) => listener(request));
};

export const subscribeSettingsFocus = (listener: SettingsFocusListener) => {
  listeners.add(listener);
  if (pendingRequest) {
    listener(pendingRequest);
  }
  return () => {
    listeners.delete(listener);
  };
};

export const consumeSettingsFocusRequest = () => {
  const request = pendingRequest;
  pendingRequest = null;
  return request;
};
