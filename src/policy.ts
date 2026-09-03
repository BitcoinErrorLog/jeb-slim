export type PolicyReason = "self" | "blocklist" | "thread_cap" | "user_hour" | "kill" | "db";

export function authorBlocked(author: string, botPk: string, blocklist: Set<string>): PolicyReason | null {
  if (author === botPk) return "self";
  if (blocklist.has(author)) return "blocklist";
  return null;
}

export function threadCapped(publishedInThread: number, cap: number): boolean {
  return publishedInThread >= cap;
}

export function userHourCapped(count: number, limit: number): boolean {
  return count >= limit;
}
