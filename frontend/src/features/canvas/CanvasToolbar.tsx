import {
  type CSSProperties,
  type RefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ModalShell } from "../../components/ModalShell";
import {
  type CanvasCustomColorSlot,
  normalizeCanvasHex,
} from "./canvasSettings";
import { type CanvasNodeShape } from "./document";

type IconProps = {
  className?: string;
};

type CanvasPopoverPosition = {
  top: number;
  left: number;
};

const POPOVER_OFFSET = 6;

const resolvePopoverPosition = (
  anchor: HTMLElement | null,
): CanvasPopoverPosition => {
  const rect = anchor?.getBoundingClientRect();
  if (!rect) {
    return { top: 0, left: 0 };
  }
  return {
    top: rect.bottom + POPOVER_OFFSET,
    left: rect.left,
  };
};

const SvgIcon = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const CanvasEditIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 20h4.2L19.1 9.1a2.1 2.1 0 0 0 0-3L17.9 5a2.1 2.1 0 0 0-3 0L4 15.8V20Z" />
    <path d="m13.8 6.1 4.1 4.1" />
  </SvgIcon>
);

export const CanvasConnectIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="12" r="2.5" />
    <path d="M8.5 12h7" />
  </SvgIcon>
);

export const CanvasCopyIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect x="8" y="8" width="10" height="10" rx="2" />
    <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </SvgIcon>
);

export const CanvasDuplicateIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect x="7" y="7" width="9" height="9" rx="2" />
    <path d="M11.5 9.8v3.4" />
    <path d="M9.8 11.5h3.4" />
    <path d="M5 14H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </SvgIcon>
);

export const CanvasTrashIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M6 7l1 14h10l1-14" />
    <path d="M9 7V4h6v3" />
  </SvgIcon>
);

export const CanvasPaletteIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M12 3a8.5 8.5 0 0 0 0 17h1.2a1.8 1.8 0 0 0 1.2-3.1 1.6 1.6 0 0 1 1.1-2.8H17a4 4 0 0 0 4-4C21 6.2 17 3 12 3Z" />
    <circle cx="8" cy="10" r=".9" />
    <circle cx="11" cy="7.5" r=".9" />
    <circle cx="15" cy="8" r=".9" />
  </SvgIcon>
);

export const CanvasGroupIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect x="4" y="5" width="16" height="14" rx="2" strokeDasharray="3 2" />
    <rect x="8" y="9" width="4" height="4" rx="1" />
    <rect x="13" y="11" width="4" height="4" rx="1" />
  </SvgIcon>
);

export const CanvasAlignLeftIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 4v16" />
    <rect x="8" y="6" width="10" height="4" rx="1" />
    <rect x="8" y="14" width="7" height="4" rx="1" />
  </SvgIcon>
);

export const CanvasAlignTopIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 5h16" />
    <rect x="6" y="8" width="4" height="10" rx="1" />
    <rect x="14" y="8" width="4" height="7" rx="1" />
  </SvgIcon>
);

export const CanvasPlusIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </SvgIcon>
);

export const CanvasViewIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  </SvgIcon>
);

export const CanvasCodeIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m8 8-4 4 4 4" />
    <path d="m16 8 4 4-4 4" />
    <path d="m14 5-4 14" />
  </SvgIcon>
);

export const CanvasZoomInIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="M10.5 8v5" />
    <path d="M8 10.5h5" />
    <path d="m15 15 5 5" />
  </SvgIcon>
);

export const CanvasZoomOutIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="M8 10.5h5" />
    <path d="m15 15 5 5" />
  </SvgIcon>
);

export const CanvasFitIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 9V4h5" />
    <path d="M20 9V4h-5" />
    <path d="M4 15v5h5" />
    <path d="M20 15v5h-5" />
  </SvgIcon>
);

export const CanvasFullscreenIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M8 4H4v4" />
    <path d="M16 4h4v4" />
    <path d="M8 20H4v-4" />
    <path d="M16 20h4v-4" />
  </SvgIcon>
);

export const CanvasExitFullscreenIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M9 4v5H4" />
    <path d="M15 4v5h5" />
    <path d="M9 20v-5H4" />
    <path d="M15 20v-5h5" />
  </SvgIcon>
);

export const CanvasSnapIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 5h14" />
    <path d="M5 12h14" />
    <path d="M5 19h14" />
    <path d="M5 5v14" />
    <path d="M12 5v14" />
    <path d="M19 5v14" />
  </SvgIcon>
);

export const CanvasPasteIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M9 4h6l1 2h2v14H6V6h2l1-2Z" />
    <path d="M9 10h6" />
    <path d="M9 14h4" />
  </SvgIcon>
);

const ShapeIcon = ({
  shape,
  className,
}: {
  shape: CanvasNodeShape;
  className?: string;
}) => (
  <SvgIcon className={className}>
    {shape === "ellipse" ? (
      <ellipse cx="12" cy="12" rx="7" ry="5" />
    ) : shape === "diamond" ? (
      <path d="M12 4 20 12 12 20 4 12 12 4Z" />
    ) : shape === "rectangle" ? (
      <rect x="5" y="7" width="14" height="10" rx=".5" />
    ) : (
      <rect x="5" y="7" width="14" height="10" rx="3" />
    )}
  </SvgIcon>
);

const EdgeDirectionIcon = ({
  direction,
  className,
}: {
  direction: "none" | "forward" | "backward" | "both";
  className?: string;
}) => (
  <SvgIcon className={className}>
    <path d="M5 12h14" strokeDasharray={direction === "none" ? "3 3" : undefined} />
    {(direction === "forward" || direction === "both") ? (
      <path d="m16 8 4 4-4 4" />
    ) : null}
    {(direction === "backward" || direction === "both") ? (
      <path d="m8 8-4 4 4 4" />
    ) : null}
  </SvgIcon>
);

export const CanvasIconButton = ({
  label,
  children,
  className,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    className={[
      "canvas-toolbar-icon-button",
      active ? "active" : "",
      className,
    ].filter(Boolean).join(" ")}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    aria-pressed={active || undefined}
  >
    {children}
  </button>
);

export const CanvasFloatingToolbar = ({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) => (
  <div
    className={[
      "canvas-floating-toolbar",
      "business-canvas-floating-toolbar",
      className,
    ].filter(Boolean).join(" ")}
    style={style}
  >
    {children}
  </div>
);

const CanvasToolbarPortalPopover = ({
  anchorRef,
  className,
  role,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  className: string;
  role?: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<CanvasPopoverPosition>(() =>
    resolvePopoverPosition(anchorRef.current),
  );

  const updatePosition = useCallback(() => {
    setPosition(resolvePopoverPosition(anchorRef.current));
  }, [anchorRef]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (anchorRef.current?.contains(target) || popoverRef.current?.contains(target))
      ) {
        return;
      }
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, onClose, updatePosition]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={popoverRef}
      className={`canvas-toolbar-popover canvas-toolbar-popover-portal ${className}`}
      style={{ top: position.top, left: position.left }}
      role={role}
      data-md-block-control="true"
    >
      {children}
    </div>,
    document.body,
  );
};

export const CanvasShapePicker = ({
  value,
  shapes,
  onChange,
}: {
  value: CanvasNodeShape;
  shapes: CanvasNodeShape[];
  onChange: (shape: CanvasNodeShape) => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="canvas-toolbar-picker" ref={rootRef}>
      <CanvasIconButton
        label="Card shape"
        active={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ShapeIcon shape={value} />
      </CanvasIconButton>
      {open ? (
        <CanvasToolbarPortalPopover
          anchorRef={rootRef}
          className="canvas-shape-popover"
          role="menu"
          onClose={() => setOpen(false)}
        >
          {shapes.map((shape) => (
            <CanvasIconButton
              key={shape}
              label={shape}
              active={shape === value}
              onClick={() => {
                onChange(shape);
                setOpen(false);
              }}
            >
              <ShapeIcon shape={shape} />
            </CanvasIconButton>
          ))}
        </CanvasToolbarPortalPopover>
      ) : null}
    </div>
  );
};

export const CanvasEdgeDirectionPicker = ({
  value,
  onChange,
}: {
  value: "none" | "forward" | "backward" | "both";
  onChange: (direction: "none" | "forward" | "backward" | "both") => void;
}) => {
  const directions = useMemo(
    () => ["none", "forward", "backward", "both"] as const,
    [],
  );
  return (
    <div className="canvas-edge-direction-icons" role="group" aria-label="Edge direction">
      {directions.map((direction) => (
        <CanvasIconButton
          key={direction}
          label={`Edge direction ${direction}`}
          active={direction === value}
          onClick={() => onChange(direction)}
        >
          <EdgeDirectionIcon direction={direction} />
        </CanvasIconButton>
      ))}
    </div>
  );
};

export const CanvasColorPalette = ({
  label = "Canvas color",
  standardColors,
  customColors,
  selectedColor,
  onSelectColor,
  onSaveCustomColor,
}: {
  label?: string;
  standardColors: readonly string[];
  customColors: CanvasCustomColorSlot[];
  selectedColor?: string | null;
  onSelectColor: (color: string) => void;
  onSaveCustomColor?: (slot: CanvasCustomColorSlot) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<CanvasCustomColorSlot | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState("#64748b");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const closePopover = useCallback(() => {
    setOpen(false);
    setEditingSlot(null);
  }, []);

  const startSlotEditing = useCallback((slot: CanvasCustomColorSlot) => {
    setEditingSlot(slot);
    setDraftName(slot.name);
    setDraftColor(slot.value ?? "#64748b");
  }, []);

  const saveSlot = useCallback(() => {
    if (!editingSlot || !onSaveCustomColor) {
      return;
    }
    const value = normalizeCanvasHex(draftColor) ?? "#64748b";
    const nextSlot = {
      slot: editingSlot.slot,
      name: draftName.trim() || `Custom ${editingSlot.slot}`,
      value,
    };
    onSaveCustomColor(nextSlot);
    onSelectColor(value);
    setEditingSlot(null);
  }, [draftColor, draftName, editingSlot, onSaveCustomColor, onSelectColor]);

  return (
    <div className="canvas-toolbar-picker" ref={rootRef}>
      <CanvasIconButton
        label={label}
        active={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CanvasPaletteIcon />
      </CanvasIconButton>
      {open ? (
        <CanvasToolbarPortalPopover
          anchorRef={rootRef}
          className="canvas-color-popover"
          onClose={closePopover}
        >
          <div className="canvas-color-palette-row" aria-label="Standard colors">
            {standardColors.map((color) => (
              <button
                key={color}
                type="button"
                className={`business-canvas-color-swatch business-canvas-color-${color}${
                  selectedColor === color ? " active" : ""
                }`}
                onClick={() => onSelectColor(color)}
                aria-label={`Apply standard color ${color}`}
                title={`Standard ${color}`}
              />
            ))}
          </div>
          <div className="canvas-color-palette-row" aria-label="Custom colors">
            {customColors.map((slot) => (
              <button
                key={slot.slot}
                type="button"
                className={`business-canvas-color-swatch canvas-custom-color-swatch${
                  slot.value ? "" : " is-empty"
                }${selectedColor === slot.value ? " active" : ""}`}
                style={
                  slot.value
                    ? ({ "--business-canvas-custom-color": slot.value } as CSSProperties)
                    : undefined
                }
                onClick={() => {
                  if (slot.value) {
                    onSelectColor(slot.value);
                    return;
                  }
                  startSlotEditing(slot);
                }}
                onDoubleClick={() => startSlotEditing(slot)}
                aria-label={slot.value ? `Apply ${slot.name}` : `Set ${slot.name}`}
                title={slot.value ? slot.name : `Set ${slot.name}`}
              />
            ))}
            <CanvasIconButton
              label="Add custom color"
              disabled={!onSaveCustomColor}
              onClick={() => {
                const emptySlot = customColors.find((slot) => !slot.value) ?? customColors[0];
                if (emptySlot) {
                  startSlotEditing(emptySlot);
                }
              }}
            >
              <CanvasPlusIcon />
            </CanvasIconButton>
          </div>
          {editingSlot ? (
            <div className="canvas-color-editor">
              <input
                type="color"
                value={draftColor}
                onChange={(event) => setDraftColor(event.target.value)}
                aria-label="Custom color value"
              />
              <input
                className="text-input"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                aria-label="Custom color name"
              />
              <CanvasIconButton label="Save custom color" onClick={saveSlot}>
                <CanvasCheckIcon />
              </CanvasIconButton>
            </div>
          ) : null}
        </CanvasToolbarPortalPopover>
      ) : null}
    </div>
  );
};

export const CanvasCheckIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m5 12 4 4 10-10" />
  </SvgIcon>
);

export const CanvasDeleteConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <ModalShell
    isOpen={isOpen}
    title={title}
    onClose={onCancel}
    className="canvas-delete-confirm-modal"
    bodyClassName="modal-body"
    initialFocusSelector="[data-canvas-delete-cancel]"
  >
    <p>{description}</p>
    <div className="modal-actions">
      <button
        type="button"
        className="ghost small"
        data-canvas-delete-cancel
        onClick={onCancel}
      >
        Abbrechen
      </button>
      <button type="button" className="ghost small danger" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  </ModalShell>
);
