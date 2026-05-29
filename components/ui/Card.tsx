import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  /** Elevation level. "flat" = border only, "raised" = soft shadow. */
  elevation?: "flat" | "raised";
  /** Adds hover lift — use for clickable cards. */
  interactive?: boolean;
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  padding = "md",
  elevation = "raised",
  interactive = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const elevationClass = elevation === "raised" ? "shadow-sm" : "";
  const interactiveClass = interactive
    ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong"
    : "";

  return (
    <div
      className={`rounded-xl border border-border bg-surface ${elevationClass} ${interactiveClass} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
