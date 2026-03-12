export function coalesce<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}
