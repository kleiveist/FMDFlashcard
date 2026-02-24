/**
 * @file apps/fmd-desktop/src/components/ModalShell.tsx
 *
 * Zweck:
 * - Rendert eine wiederverwendbare Modal-Huelle mit Close-Handling.
 */

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import { CloseIcon } from "./icons";

let modalBodyScrollLockCount = 0;
let previousBodyOverflow = "";

type ModalShellProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  canClose?: boolean;
  initialFocusSelector?: string;
  headerActions?: ReactNode;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export const ModalShell = ({
  isOpen,
  title,
  onClose,
  children,
  className,
  bodyClassName,
  canClose = true,
  initialFocusSelector,
  headerActions,
}: ModalShellProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const handleClose = useCallback(() => {
    if (!canClose) {
      return;
    }
    onClose();
  }, [canClose, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return registerCloseLayer({
      id: `modal-shell-${titleId}`,
      priority: 240,
      isActive: () => true,
      onClose: handleClose,
    });
  }, [handleClose, isOpen, titleId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const panel = panelRef.current;
    const focusTarget =
      (initialFocusSelector && panel
        ? panel.querySelector<HTMLElement>(initialFocusSelector)
        : null) ?? closeButtonRef.current;
    if (focusTarget?.hasAttribute("disabled")) {
      panel?.querySelector<HTMLElement>(focusableSelector)?.focus();
      return;
    }
    focusTarget?.focus();
  }, [initialFocusSelector, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }
    const body = document.body;
    if (modalBodyScrollLockCount === 0) {
      previousBodyOverflow = body.style.overflow;
      body.style.overflow = "hidden";
    }
    modalBodyScrollLockCount += 1;
    return () => {
      modalBodyScrollLockCount = Math.max(0, modalBodyScrollLockCount - 1);
      if (modalBodyScrollLockCount === 0) {
        body.style.overflow = previousBodyOverflow;
      }
    };
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!active || !panel.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  const portalTarget = typeof document === "undefined" ? null : document.body;
  const panelClassName = ["modal-panel hub-modal-panel", className]
    .filter(Boolean)
    .join(" ");
  const bodyClassNames = ["hub-modal-body", bodyClassName]
    .filter(Boolean)
    .join(" ");
  const modal = (
    <div className="modal-backdrop" role="presentation" onClick={handleClose}>
      <div
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-panel-header">
          <h2 id={titleId} className="modal-panel-title">
            {title}
          </h2>
          <div className="modal-panel-header-actions">
            {headerActions}
            <button
              ref={closeButtonRef}
              type="button"
              className="modal-panel-close"
              onClick={handleClose}
              aria-label="Close"
              disabled={!canClose}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className={bodyClassNames}>{children}</div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
};
