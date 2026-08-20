type IconProps = { className?: string };

export function EditIcon({ className = "action-icon" }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M11.8 4.2 15.8 8.2M5 15l2.1-.4 8.2-8.2a1.4 1.4 0 0 0 0-2l-.7-.7a1.4 1.4 0 0 0-2 0l-8.2 8.2L4 14a.9.9 0 0 0 1 1Z" />
      <path d="M10.8 5.5 14.5 9.2" />
    </svg>
  );
}

export function DeleteIcon({ className = "action-icon" }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M4.5 6.2h11M8 3.8h4l.8 2.4H7.2L8 3.8Z" />
      <path d="m6.3 6.2.6 9.1a1.2 1.2 0 0 0 1.2 1.1h3.8a1.2 1.2 0 0 0 1.2-1.1l.6-9.1M8.4 9v4.6M11.6 9v4.6" />
    </svg>
  );
}
