/** Room codes avoid look-alike characters (0/O, 1/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

export function generateRoomCode(random: () => number = Math.random): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ALPHABET[Math.floor(random() * ALPHABET.length)],
  ).join("");
}

/** What someone typed or pasted, cleaned up to valid code characters. */
export function normalizeRoomCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((c) => ALPHABET.includes(c))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);
}

export const isRoomCode = (code: string): boolean =>
  code.length === ROOM_CODE_LENGTH && normalizeRoomCode(code) === code;

export const inviteLink = (origin: string, code: string): string => `${origin}/?r=${code}`;

/** The room code in a page URL's query string (`?r=K7QM`), or null. */
export function roomCodeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get("r");
  const code = raw ? normalizeRoomCode(raw) : "";
  return isRoomCode(code) ? code : null;
}
