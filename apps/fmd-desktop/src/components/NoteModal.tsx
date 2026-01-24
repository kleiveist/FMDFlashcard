/**
 * @file apps/fmd-desktop/src/components/NoteModal.tsx
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
};

export const NoteModal = ({
  isOpen,
  onClose,
  children,
  title = "Note",
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
      className="note-modal-panel"
      bodyClassName="note-modal-body"
    >
      {children}
    </ModalShell>
  );
};
