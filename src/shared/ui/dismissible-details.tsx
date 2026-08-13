"use client";

import {
  useEffect,
  useRef,
  type DetailsHTMLAttributes,
  type MouseEvent,
} from "react";

export function DismissibleDetails({
  children,
  onClick,
  ...props
}: DetailsHTMLAttributes<HTMLDetailsElement>) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePress(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) {
        details.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector<HTMLElement>("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function handleClick(event: MouseEvent<HTMLDetailsElement>) {
    onClick?.(event);
    if (
      !event.defaultPrevented &&
      (event.target as HTMLElement).closest("a, button")
    ) {
      detailsRef.current?.removeAttribute("open");
    }
  }

  return (
    <details ref={detailsRef} onClick={handleClick} {...props}>
      {children}
    </details>
  );
}
