export function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M5.5 5.5l9 9m0-9-9 9" />
    </svg>
  );
}
