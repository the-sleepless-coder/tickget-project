export type SortKeyCommon = "start" | "latest";

export function sortRooms<
  T extends { createdAtMs?: number; startAtMs?: number },
>(rooms: T[], activeSort: SortKeyCommon): T[] {
  if (activeSort === "latest") {
    return [...rooms].sort(
      (a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)
    );
  }
  const now = Date.now();
  const score = (r: T) => {
    if (r.startAtMs == null) return Number.MAX_SAFE_INTEGER;
    const delta = r.startAtMs - now;
    return delta >= 0 ? delta : Math.abs(delta) + 1e12;
  };
  return [...rooms].sort((a, b) => score(a) - score(b));
}
