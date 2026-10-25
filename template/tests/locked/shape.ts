// LOCKED (see docs/CHARTER.md). Computes a structural "shape" of saved state
// (field names and value types, never values) so a save-format change cannot
// slip through without a SCHEMA bump, a migration and an old-save fixture.

type ArrayShape = { "[]": Shape[] };
type Shape = string | ArrayShape | { [key: string]: Shape };
const isArray = (s: Shape): s is ArrayShape => typeof s === "object" && "[]" in s;

export function shapeOf(value: unknown): Shape {
  if (value === null) return "null";
  if (Array.isArray(value)) return { "[]": unionArray(value.map(shapeOf)) };
  if (typeof value === "object") {
    const out: Record<string, Shape> = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = shapeOf(v);
    }
    return out;
  }
  return typeof value;
}

const key = (s: Shape) => JSON.stringify(s);

function unionArray(shapes: Shape[]): Shape[] {
  // Merge object shapes (field-wise) so arrays of records give one shape.
  const objects = shapes.filter((s): s is Record<string, Shape> => typeof s === "object" && !isArray(s));
  const others = shapes.filter((s) => typeof s !== "object" || isArray(s));
  const merged = objects.length ? [objects.reduce((a, b) => merge(a, b) as Record<string, Shape>)] : [];
  const uniq = new Map<string, Shape>();
  for (const s of [...merged, ...others]) uniq.set(key(s), s);
  return [...uniq.values()].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Merge two shapes. `null` is absorbed by any other type (nullable fields). */
export function merge(a: Shape, b: Shape): Shape {
  if (a === "null") return b;
  if (b === "null") return a;
  if (typeof a === "string" || typeof b === "string") {
    if (key(a) === key(b)) return a;
    return [a, b].map(key).sort().join("|");
  }
  if (isArray(a) && isArray(b)) return { "[]": unionArray([...a["[]"], ...b["[]"]]) };
  if (isArray(a) || isArray(b)) return [key(a), key(b)].sort().join("|");
  const out: Record<string, Shape> = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const av = (a as Record<string, Shape>)[k];
    const bv = (b as Record<string, Shape>)[k];
    out[k] = av === undefined ? bv : bv === undefined ? av : merge(av, bv);
  }
  return out;
}
