import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateShareToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateAccessKey(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function hashSecret(secret: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(secret, saltRounds);
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

