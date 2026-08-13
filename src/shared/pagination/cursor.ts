import { z } from "zod";

const cursorSchema = z.object({ value: z.string().min(1), id: z.uuid() });
export type Cursor = z.infer<typeof cursorSchema>;
export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
export function decodeCursor(value: string): Cursor {
  return cursorSchema.parse(
    JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
  );
}
