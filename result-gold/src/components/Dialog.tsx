import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEventHandler, ReactNode } from "react";

interface DialogProps {
  id: string;
  titleId: string;
  descriptionId?: string;
  className?: string;
  style?: CSSProperties;
  onClose: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
  children: ReactNode;
}

/** Native modal supplies focus containment, background inertness, and Escape handling. */
export function Dialog({
  id,
  titleId,
  descriptionId,
  className = "",
  style,
  onClose,
  onKeyDown,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected && trigger.getClientRects().length) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      className={`modal ${className}`}
      style={style}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onClose();
      }}
    >
      {children}
    </dialog>
  );
}