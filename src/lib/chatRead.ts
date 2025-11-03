// frontend/src/lib/chatRead.ts
export function isDmRead(participants: Record<string, { id: string; lastReadAt?: string | null }>|undefined, myId: string|undefined, msgAtISO: string|undefined) {
  if (!participants || !myId || !msgAtISO) return false;
  const others = Object.values(participants).filter((u) => u.id !== myId);
  const other = others[0];
  if (!other || !other.lastReadAt) return false;
  return new Date(other.lastReadAt).getTime() >= new Date(msgAtISO).getTime();
}

export function isGroupAllRead(participants: Record<string, { id: string; lastReadAt?: string | null }>|undefined, myId: string|undefined, msgAtISO: string|undefined) {
  if (!participants || !myId || !msgAtISO) return false;
  const others = Object.values(participants).filter((u) => u.id !== myId);
  if (!others.length) return false;
  const t = new Date(msgAtISO).getTime();
  return others.every((u) => u.lastReadAt && new Date(u.lastReadAt).getTime() >= t);
}

