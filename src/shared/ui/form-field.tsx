import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
export function FormField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label>
      {label}
      <input aria-invalid={Boolean(error)} {...props} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
export function TextAreaField({
  label,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
}) {
  return (
    <label>
      {label}
      <textarea aria-invalid={Boolean(error)} {...props} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
