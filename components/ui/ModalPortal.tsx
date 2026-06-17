"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into `document.body` via a portal.
 *
 * Card components lift on hover with `hover:-translate-y-*`, which applies a CSS
 * `transform`. A `position: fixed` element nested inside a transformed ancestor
 * is contained by that ancestor instead of the viewport — so a modal rendered
 * inside such a card jumps/resizes when the card (or a sibling) is hovered.
 * Portalling the overlay to `document.body` escapes the transform entirely.
 *
 * Callers gate this behind their own `open` state (client-only), so the body is
 * always available; the guard just keeps it safe if ever rendered on the server.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
