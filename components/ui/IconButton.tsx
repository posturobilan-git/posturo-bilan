"use client";

import type { ReactNode } from "react";

type Variant = "neutral" | "brand" | "danger";

const VARIANTS: Record<Variant, string> = {
  neutral: "text-content-subtle hover:bg-surface-muted hover:text-content",
  brand: "text-content-subtle hover:bg-brand-50 hover:text-brand-700",
  danger: "text-content-subtle hover:bg-danger-50 hover:text-danger-700",
};

interface Props {
  icon: ReactNode;
  /** Accessible name + tooltip shown on hover. */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  type?: "button" | "submit";
  /** Forces the active (hover) color, e.g. for a destructive confirm state. */
  active?: boolean;
}

/**
 * Compact square icon button with a tooltip + hover affordance — replaces the
 * plain-text row actions on library/config cards.
 */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "neutral",
  type = "button",
  active = false,
}: Props) {
  const activeColor =
    variant === "danger"
      ? "bg-danger-50 text-danger-700"
      : variant === "brand"
      ? "bg-brand-50 text-brand-700"
      : "bg-surface-muted text-content";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? activeColor : VARIANTS[variant]
      }`}
    >
      {icon}
    </button>
  );
}
