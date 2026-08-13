export function Feedback({
  children,
  kind = "info",
}: {
  children: React.ReactNode;
  kind?: "info" | "error" | "success";
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={kind === "error" ? "field-error" : "muted"}
    >
      {children}
    </p>
  );
}
