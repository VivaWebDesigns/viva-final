import content from "./content.json";

type ContentNode = { en: string; es: string } | boolean | ContentNode[] | { [key: string]: ContentNode };

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function t(path: string): string {
  try {
    const parts = path.split(".");
    const value = getNestedValue(content, parts);

    if (value === null || value === undefined) {
      return `[MISSING: ${path}]`;
    }

    if (typeof value === "object" && !Array.isArray(value) && "en" in (value as object)) {
      const node = value as { en: string; es: string };
      return node.en;
    }

    return `[MISSING: ${path}]`;
  } catch {
    return `[MISSING: ${path}]`;
  }
}

export function tArr(path: string): string[] {
  try {
    const parts = path.split(".");
    const value = getNestedValue(content, parts);

    if (Array.isArray(value)) {
      return value.map((item: unknown) => {
        if (typeof item === "object" && item !== null && "en" in (item as object)) {
          return (item as { en: string }).en;
        }
        return String(item);
      });
    }

    return [];
  } catch {
    return [];
  }
}

export function tObjArr<T extends Record<string, unknown>>(path: string): T[] {
  try {
    const parts = path.split(".");
    const value = getNestedValue(content, parts);

    if (Array.isArray(value)) {
      return value.map((item: unknown) => {
        if (typeof item !== "object" || item === null) return {} as T;
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
          if (typeof val === "object" && val !== null && "en" in (val as object)) {
            result[key] = (val as { en: string }).en;
          } else if (typeof val === "boolean") {
            result[key] = val;
          } else {
            result[key] = val;
          }
        }
        return result as T;
      });
    }

    return [];
  } catch {
    return [];
  }
}

export function tBool(path: string): boolean {
  try {
    const parts = path.split(".");
    const value = getNestedValue(content, parts);
    return typeof value === "boolean" ? value : false;
  } catch {
    return false;
  }
}

export default content;
