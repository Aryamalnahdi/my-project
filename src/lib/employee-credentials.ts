import { createHmac, randomBytes, randomInt } from "node:crypto";
import { canonicalUsername } from "./identity";

// Only imported by server-only modules. Supabase Auth hashes this derived secret.
// A database leak alone cannot enumerate the 10,000 possible PINs without the pepper.
export function employeePassword(username: string, pin: string, pepper: string) {
  if (pepper.length < 32) throw new Error("EMPLOYEE_PIN_PEPPER must contain at least 32 characters.");
  if (!/^[0-9]{4}$/.test(pin)) throw new Error("Enter exactly 4 numeric digits.");
  return `Ep1!${createHmac("sha256", pepper).update(JSON.stringify([canonicalUsername(username), pin])).digest("base64url")}`;
}

export function generateEmployeeCredentials() {
  return { username: `employee-${randomBytes(6).toString("hex")}`, pin: String(randomInt(10000)).padStart(4, "0") };
}
