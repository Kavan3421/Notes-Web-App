import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { db } from "@/lib/db";
import {
  generateShareToken,
  hashToken,
  generateAccessKey,
  hashSecret,
  verifySecret,
} from "@/lib/crypto";
import {
  signJwtToken,
  verifyJwtToken,
  AUTH_COOKIE_NAME,
  JWTPayload,
} from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "@/lib/rate-limit";

// Define Hono environment types with custom context variables
type Env = {
  Variables: {
    user: JWTPayload;
  };
};

const app = new Hono<Env>().basePath("/api");

// Helper to dynamically get application base origin URL from request headers or environment
function getRequestOrigin(c: any): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const proto = c.req.header("x-forwarded-proto") || "http";
  const host = c.req.header("x-forwarded-host") || c.req.header("host") || "localhost:3000";
  return `${proto}://${host}`;
}

// Helper to get client IP for rate limiting
function getClientIp(c: any): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "127.0.0.1"
  );
}

// Helper to get authenticated user from HTTP-only cookie
function getAuthUser(c: any): JWTPayload | null {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return verifyJwtToken(token);
}

// Auth Middleware for protected routes
const requireAuth = async (c: any, next: () => Promise<void>) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized. Please log in." }, 401);
  }
  c.set("user", user);
  await next();
};

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// POST /api/auth/register
app.post("/auth/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return c.json({ error: "Please provide a valid email address." }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return c.json({ error: "Password must be at least 6 characters long." }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return c.json({ error: "An account with this email already exists." }, 400);
    }

    // Hash password & create user
    const passwordHash = await hashSecret(password);
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    // Generate JWT and set HTTP-only cookie
    const token = signJwtToken({ userId: user.id, email: user.email });
    setCookie(c, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return c.json({
      user: { id: user.id, email: user.email },
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    return c.json({ error: "Failed to register user. Please try again." }, 500);
  }
});

// POST /api/auth/login
app.post("/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: "Email and password are required." }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return c.json({ error: "Invalid email or password." }, 401);
    }

    const isValid = await verifySecret(password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: "Invalid email or password." }, 401);
    }

    const token = signJwtToken({ userId: user.id, email: user.email });
    setCookie(c, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return c.json({
      user: { id: user.id, email: user.email },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return c.json({ error: "Login failed. Please try again." }, 500);
  }
});

// POST /api/auth/logout
app.post("/auth/logout", (c) => {
  setCookie(c, AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
  return c.json({ success: true });
});

// GET /api/auth/me
app.get("/auth/me", (c) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ user: null }, 401);
  }
  return c.json({ user });
});

// ==========================================
// NOTE MANAGEMENT ROUTES (Authenticated)
// ==========================================

// POST /api/notes - Create a new note and generate share link
app.post("/notes", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const { title, content, shareType, accessType, expiryHours } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return c.json({ error: "Title is required." }, 400);
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return c.json({ error: "Content is required." }, 400);
    }
    if (!["ONE_TIME", "TIME_BASED"].includes(shareType)) {
      return c.json({ error: "Invalid share type." }, 400);
    }
    if (!["PUBLIC", "PASSWORD_PROTECTED"].includes(accessType)) {
      return c.json({ error: "Invalid access type." }, 400);
    }

    // Expiry calculation
    let expiresAt: Date | null = null;
    if (expiryHours && typeof expiryHours === "number" && expiryHours > 0) {
      expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    }

    // Cryptographic Token & Password Generation
    const { rawToken, tokenHash } = generateShareToken();

    let generatedKey: string | null = null;
    let passwordHash: string | null = null;

    if (accessType === "PASSWORD_PROTECTED") {
      generatedKey = generateAccessKey();
      passwordHash = await hashSecret(generatedKey);
    }

    // Transaction: Create Note & ShareLink
    const note = await db.note.create({
      data: {
        userId: user.userId,
        title: title.trim(),
        content: content.trim(),
        shares: {
          create: {
            tokenHash,
            rawToken,
            shareType,
            accessType,
            passwordHash,
            expiresAt,
          },
        },
      },
      include: {
        shares: true,
      },
    });

    const shareLink = note.shares[0];
    const appOrigin = getRequestOrigin(c);
    const fullShareUrl = `${appOrigin}/share/${rawToken}`;

    return c.json({
      noteId: note.id,
      shareId: shareLink.id,
      rawToken,
      shareUrl: fullShareUrl,
      accessKey: generatedKey, // Returned ONCE to owner after creation
    });
  } catch (err: any) {
    console.error("Create note error:", err);
    return c.json({ error: "Failed to create note." }, 500);
  }
});

// POST /api/notes/:id/regenerate-share - Generate a new share link for an existing note
app.post("/notes/:id/regenerate-share", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const noteId = c.req.param("id");
    const body = await c.req.json();

    const { shareType, accessType, expiryHours } = body;

    if (!["ONE_TIME", "TIME_BASED"].includes(shareType)) {
      return c.json({ error: "Invalid share type." }, 400);
    }
    if (!["PUBLIC", "PASSWORD_PROTECTED"].includes(accessType)) {
      return c.json({ error: "Invalid access type." }, 400);
    }

    // Verify note exists and belongs to user
    const note = await db.note.findFirst({
      where: { id: noteId, userId: user.userId },
    });

    if (!note) {
      return c.json({ error: "Note not found or access denied." }, 404);
    }

    // Mark any existing active shares as revoked so only the new link is active
    await db.shareLink.updateMany({
      where: { noteId: note.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Expiry calculation
    let expiresAt: Date | null = null;
    if (expiryHours && typeof expiryHours === "number" && expiryHours > 0) {
      expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    }

    // Cryptographic Token & Password Generation
    const { rawToken, tokenHash } = generateShareToken();

    let generatedKey: string | null = null;
    let passwordHash: string | null = null;

    if (accessType === "PASSWORD_PROTECTED") {
      generatedKey = generateAccessKey();
      passwordHash = await hashSecret(generatedKey);
    }

    // Create new ShareLink
    const newShare = await db.shareLink.create({
      data: {
        noteId: note.id,
        tokenHash,
        rawToken,
        shareType,
        accessType,
        passwordHash,
        expiresAt,
      },
    });

    const appOrigin = getRequestOrigin(c);
    const fullShareUrl = `${appOrigin}/share/${rawToken}`;

    return c.json({
      noteId: note.id,
      shareId: newShare.id,
      rawToken,
      shareUrl: fullShareUrl,
      accessKey: generatedKey,
    });
  } catch (err: any) {
    console.error("Regenerate share link error:", err);
    return c.json({ error: "Failed to regenerate share link." }, 500);
  }
});

// GET /api/notes - List user's notes
app.get("/notes", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const notes = await db.note.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        shares: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return c.json({ notes });
  } catch (err: any) {
    console.error("List notes error:", err);
    return c.json({ error: "Failed to fetch notes." }, 500);
  }
});

// GET /api/notes/:id - Get owner note detail & share status
app.get("/notes/:id", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const noteId = c.req.param("id");

    const note = await db.note.findFirst({
      where: { id: noteId, userId: user.userId },
      include: {
        shares: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!note) {
      return c.json({ error: "Note not found." }, 404);
    }

    return c.json({ note });
  } catch (err: any) {
    console.error("Get note detail error:", err);
    return c.json({ error: "Failed to fetch note detail." }, 500);
  }
});

// POST /api/shares/:id/revoke - Revoke a share link
app.post("/shares/:id/revoke", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    const shareId = c.req.param("id");

    // Find share and ensure note belongs to user
    const share = await db.shareLink.findUnique({
      where: { id: shareId },
      include: { note: true },
    });

    if (!share || share.note.userId !== user.userId) {
      return c.json({ error: "Share link not found or access denied." }, 404);
    }

    if (share.revokedAt) {
      return c.json({ message: "Share link is already revoked." });
    }

    const updatedShare = await db.shareLink.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });

    return c.json({ success: true, share: updatedShare });
  } catch (err: any) {
    console.error("Revoke share error:", err);
    return c.json({ error: "Failed to revoke share link." }, 500);
  }
});

// ==========================================
// PUBLIC SHARE LINK ACCESS ROUTES
// ==========================================

// GET /api/share/:token - Inspect share link metadata
app.get("/share/:token", async (c) => {
  try {
    const rawToken = c.req.param("token");
    const computedHash = hashToken(rawToken);

    // Support lookup by hashed token OR rawToken OR legacy tokenHash
    const share = await db.shareLink.findFirst({
      where: {
        OR: [
          { tokenHash: computedHash },
          { rawToken: rawToken },
          { tokenHash: rawToken },
        ],
      },
      include: { note: { select: { title: true } } },
    });

    if (!share) {
      return c.json({ error: "Invalid share link." }, 404);
    }

    if (share.revokedAt) {
      return c.json({ error: "This share link has been revoked." }, 410);
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return c.json({ error: "This share link has expired." }, 410);
    }

    if (share.shareType === "ONE_TIME" && share.usedAt) {
      return c.json({ error: "This share link has already been used." }, 410);
    }

    return c.json({
      noteTitle: share.note.title,
      shareType: share.shareType,
      accessType: share.accessType,
      isPasswordProtected: share.accessType === "PASSWORD_PROTECTED",
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    });
  } catch (err: any) {
    console.error("Inspect share error:", err);
    return c.json({ error: "Failed to process share link." }, 500);
  }
});

// POST /api/share/:token/unlock - Unlock and view note content
app.post("/share/:token/unlock", async (c) => {
  try {
    const rawToken = c.req.param("token");
    const computedHash = hashToken(rawToken);
    const body = await c.req.json().catch(() => ({}));
    const accessKey = body?.password || "";
    const ip = getClientIp(c);

    // 1. Fetch Share Link
    const share = await db.shareLink.findFirst({
      where: {
        OR: [
          { tokenHash: computedHash },
          { rawToken: rawToken },
          { tokenHash: rawToken },
        ],
      },
      include: { note: true },
    });

    if (!share) {
      return c.json({ error: "Invalid share link." }, 404);
    }

    const tokenHash = share.tokenHash;

    // 2. Security Status Checks
    if (share.revokedAt) {
      return c.json({ error: "This share link has been revoked." }, 410);
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return c.json({ error: "This share link has expired." }, 410);
    }

    if (share.shareType === "ONE_TIME" && share.usedAt) {
      return c.json({ error: "This share link has already been used." }, 410);
    }

    // 3. Password Verification (If Password Protected)
    if (share.accessType === "PASSWORD_PROTECTED") {
      const rateLimitKey = `pw_attempt:${ip}:${tokenHash}`;
      const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

      if (!rateCheck.allowed) {
        return c.json(
          {
            error: `Too many failed password attempts. Please wait ${rateCheck.resetInSeconds} seconds.`,
          },
          429
        );
      }

      if (!accessKey || typeof accessKey !== "string") {
        return c.json({ error: "Invalid access key." }, 401);
      }

      if (!share.passwordHash) {
        return c.json({ error: "Share security configuration error." }, 500);
      }

      const isValidPassword = await verifySecret(accessKey, share.passwordHash);
      if (!isValidPassword) {
        recordFailedAttempt(rateLimitKey, 5, 15 * 60 * 1000);
        // Note: viewCount MUST NOT be incremented on failed password!
        return c.json({ error: "Invalid access key." }, 401);
      }

      // Password succeeded -> clear rate limit
      clearRateLimit(rateLimitKey);
    }

    // 4. ATOMIC CLAIM & VIEW COUNT UPDATE
    if (share.shareType === "ONE_TIME") {
      /**
       * ATOMIC RACE-CONDITION SAFE CLAIM:
       * Uses conditional database UPDATE `where: { id, usedAt: null, revokedAt: null }`.
       * PostgreSQL row-level locks ensure that if two concurrent requests attempt to claim this link,
       * only ONE query matches `usedAt: null` and updates count to 1.
       * The losing concurrent query receives `count === 0` and is safely rejected.
       */
      const claimResult = await db.shareLink.updateMany({
        where: {
          id: share.id,
          usedAt: null,
          revokedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        data: {
          usedAt: new Date(),
          viewCount: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        return c.json({ error: "This share link has already been used." }, 410);
      }
    } else {
      /**
       * TIME-BASED / PUBLIC LINK:
       * Atomic database-side increment (`viewCount: { increment: 1 }`).
       */
      await db.shareLink.update({
        where: { id: share.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Return the decrypted/unlocked note content
    return c.json({
      title: share.note.title,
      content: share.note.content,
      createdAt: share.note.createdAt,
      shareType: share.shareType,
      accessType: share.accessType,
    });
  } catch (err: any) {
    console.error("Unlock share error:", err);
    return c.json({ error: "Failed to access note." }, 500);
  }
});

export default app;
