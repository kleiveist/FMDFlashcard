/**
 * Set form-control state through the browser's native property setter.
 *
 * React tracks controlled values by wrapping the instance setter. Assigning
 * `element.value` directly in a test updates that tracker before the synthetic
 * input event runs, so React correctly concludes that nothing changed. Using
 * the native setter models what the browser does for real user input.
 */
export const setNativeValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) {
    throw new Error("Native form-control value setter is unavailable.");
  }
  setter.call(element, value);
};

export const setNativeChecked = (element: HTMLInputElement, checked: boolean) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  if (!setter) {
    throw new Error("Native input checked setter is unavailable.");
  }
  setter.call(element, checked);
};
