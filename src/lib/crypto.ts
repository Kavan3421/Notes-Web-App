import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Generates a cryptographically secure random 32-byte hex token for sharing.
 * Returns both the raw token (to be sent in the URL) and its SHA-256 hash (to be stored in PostgreSQL).
 */
export function generateShareToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes the SHA-256 hash of a raw share token.
 * Used for looking up share records without storing raw tokens in the database.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a cryptographically secure random access key for password-protected shares.
 * Returns a 12-character random string.
 */
export function generateAccessKey(): string {
  // Generates 9 random bytes -> 12 base64url characters
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Hashes a plaintext password or access key using bcrypt.
 */
export async function hashSecret(secret: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(secret, saltRounds);
}

/**
 * Compares a plaintext password or access key against its bcrypt hash.
 */
export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
