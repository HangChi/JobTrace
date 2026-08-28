import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "small" | "medium";

export function Button({
  className = "",
  variant = "primary",
  size = "medium",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={`button ${variant} button-${size} ${className}`.trim()}
      {...props}
    />
  );
}
