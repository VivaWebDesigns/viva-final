/**
 * Compatibility shim for using Zod v4 schemas with react-hook-form.
 *
 * Context: shared/schema.ts imports `z` from "zod/v4" (required for drizzle-zod
 * v0.8.x compatibility). @hookform/resolvers/zod is compiled against the Zod v3
 * type surface and does not yet export a /zod-v4 entrypoint. At runtime both
 * versions share the same .safeParse() contract so this cast is safe — it is
 * purely a TypeScript-level bridge and carries no runtime cost.
 *
 * Keep this file as the single cast site. Never add `as any` to individual
 * form resolver calls elsewhere in the codebase.
 */
import { zodResolver as _zodResolver } from "@hookform/resolvers/zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver(schema: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _zodResolver(schema as any);
}
