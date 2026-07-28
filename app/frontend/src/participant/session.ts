const COOKIE_NAME = "simworks:participant-name";

export function getParticipantName(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export function setParticipantName(name: string) {
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(name)}; max-age=${maxAge}; path=/; SameSite=Strict`;
}

export function clearParticipantName() {
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Strict`;
}
