/**
 * @file frontend/src/components/NoteModal.tsx
 *
 * Zweck:
 * - Rendert ein kompaktes Note-Modal mit Close-Handling.
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ModalShell } from "./ModalShell";

type NoteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  panelClassName?: string;
  bodyClassName?: string;
  headerActions?: ReactNode;
};

export const NoteModal = ({
  isOpen,
  onClose,
  children,
  title = "Note",
  panelClassName,
  bodyClassName,
  headerActions,
}: NoteModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <ModalShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      className={["note-modal-panel", panelClassName].filter(Boolean).join(" ")}
      bodyClassName={["note-modal-body", bodyClassName].filter(Boolean).join(" ")}
      headerActions={headerActions}
    >
      {children}
    </ModalShell>
  );
};
