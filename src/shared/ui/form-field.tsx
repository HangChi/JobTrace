import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
export function FormField({
  label,
  error,
  fieldClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  fieldClassName?: string;
}) {
  return (
    <label className={fieldClassName}>
      {label}
      <input aria-invalid={Boolean(error)} {...props} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
export function TextAreaField({
  label,
  error,
  fieldClassName,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  fieldClassName?: string;
}) {
  return (
    <label className={fieldClassName}>
      {label}
      <textarea aria-invalid={Boolean(error)} {...props} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
