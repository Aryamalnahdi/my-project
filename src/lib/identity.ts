import { createHash } from "node:crypto";

export function canonicalUsername(username: string) {
  return username.normalize("NFKC").trim().toLowerCase();
}

// Opaque Auth identifier; no user-facing email or mail delivery is involved.
export function authEmail(username: string) {
  return `${createHash("sha256").update(canonicalUsername(username)).digest("hex")}@accounts.internal.invalid`;
}
