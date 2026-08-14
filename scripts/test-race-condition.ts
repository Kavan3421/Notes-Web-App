import { db } from "../src/lib/db";
import { generateShareToken, hashSecret } from "../src/lib/crypto";

async function runRaceConditionTest() {
  console.log("\n🧪 --- STARTING ATOMIC RACE CONDITION TEST ---\n");

  // 1. Setup Test User
  const testEmail = `race-test-${Date.now()}@example.com`;
  const user = await db.user.create({
    data: {
      email: testEmail,
      passwordHash: await hashSecret("password123"),
    },
  });

  // 2. Setup Test Note & ONE_TIME Share Link
  const { rawToken, tokenHash } = generateShareToken();
  const note = await db.note.create({
    data: {
      userId: user.id,
      title: "Concurrent Race Condition Test Note",
      content: "This note should only be read exactly ONCE despite 2 simultaneous requests.",
      shares: {
        create: {
          tokenHash,
          shareType: "ONE_TIME",
          accessType: "PUBLIC",
        },
      },
    },
    include: { shares: true },
  });

  const shareLink = note.shares[0];
  console.log(`Created ONE_TIME ShareLink ID: ${shareLink.id}`);
  console.log(`Raw Token: ${rawToken}`);

  // 3. Define Atomic Claim Function (Simulating concurrent server handling)
  async function claimShare(requestId: string) {
    // Exact atomic logic from Hono route handler:
    const claimResult = await db.shareLink.updateMany({
      where: {
        id: shareLink.id,
        usedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: {
        usedAt: new Date(),
        viewCount: { increment: 1 },
      },
    });

    if (claimResult.count === 0) {
      return { requestId, success: false, error: "This share link has already been used." };
    }

    return { requestId, success: true, title: note.title, content: note.content };
  }

  // 4. Launch 2 Concurrent Requests simultaneously via Promise.all
  console.log("⚡ Launching 2 SIMULTANEOUS concurrent requests against the ONE_TIME share link...");
  
  const [resultA, resultB] = await Promise.all([
    claimShare("Request A"),
    claimShare("Request B"),
  ]);

  console.log("\n--- REQUEST RESULTS ---");
  console.log("Request A:", resultA);
  console.log("Request B:", resultB);

  // 5. Verify Results
  const successCount = (resultA.success ? 1 : 0) + (resultB.success ? 1 : 0);
  const failureCount = (resultA.success ? 0 : 1) + (resultB.success ? 0 : 1);

  // Fetch final DB state
  const updatedShare = await db.shareLink.findUnique({
    where: { id: shareLink.id },
  });

  console.log("\n--- FINAL DATABASE STATE ---");
  console.log(`viewCount: ${updatedShare?.viewCount}`);
  console.log(`usedAt: ${updatedShare?.usedAt}`);

  // Clean up test data
  await db.user.delete({ where: { id: user.id } });

  // Assertions
  if (successCount === 1 && failureCount === 1 && updatedShare?.viewCount === 1) {
    console.log("\n✅ [SUCCESS] RACE CONDITION TEST PASSED!");
    console.log("Guaranteed by PostgreSQL atomic conditional update (usedAt IS NULL).");
    process.exit(0);
  } else {
    console.error("\n❌ [FAIL] RACE CONDITION TEST FAILED!");
    console.error(`Expected 1 success, 1 failure, viewCount=1. Got: success=${successCount}, fail=${failureCount}, viewCount=${updatedShare?.viewCount}`);
    process.exit(1);
  }
}

runRaceConditionTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
