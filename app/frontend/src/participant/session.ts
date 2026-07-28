const NAME_COOKIE = "simworks:participant-name";
const EMAIL_COOKIE = "simworks:participant-email";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string) {
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Strict`;
}

export function getParticipantName(): string | null {
  return readCookie(NAME_COOKIE);
}

export function setParticipantName(name: string) {
  writeCookie(NAME_COOKIE, name);
}

export function getParticipantEmail(): string | null {
  return readCookie(EMAIL_COOKIE);
}

export function setParticipantEmail(email: string) {
  writeCookie(EMAIL_COOKIE, email);
}

export function clearParticipantSession() {
  deleteCookie(NAME_COOKIE);
  deleteCookie(EMAIL_COOKIE);
}

/** @deprecated Use clearParticipantSession() to clear both name and email. */
export function clearParticipantName() {
  deleteCookie(NAME_COOKIE);
}
