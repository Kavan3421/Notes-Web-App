import { db } from "../src/lib/db";
import { generateShareToken, hashSecret } from "../src/lib/crypto";

async function runMultipleSharesTest() {
  console.log("\n🧪 --- STARTING INDEPENDENT MULTIPLE SHARE LINKS TEST ---\n");

  // 1. Setup Test User
  const testEmail = `multi-share-test-${Date.now()}@example.com`;
  const user = await db.user.create({
    data: {
      email: testEmail,
      passwordHash: await hashSecret("password123"),
    },
  });

  console.log(`Created test user: ${testEmail}`);

  // 2. Create Note with Share Link A (TIME_BASED)
  const tokenA = generateShareToken();
  const note = await db.note.create({
    data: {
      userId: user.id,
      title: "Multiple Share Links Test Note",
      content: "Testing that multiple share links remain completely independent.",
      shares: {
        create: {
          tokenHash: tokenA.tokenHash,
          rawToken: tokenA.rawToken,
          shareType: "TIME_BASED",
          accessType: "PUBLIC",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    },
    include: { shares: true },
  });

  const shareA = note.shares[0];
  console.log(`\nStep 1: Created Note and Share Link A (ID: ${shareA.id})`);
  console.log(`Share A initial viewCount: ${shareA.viewCount}`);

  // 3. Open Share Link A successfully 2 times
  await db.shareLink.update({
    where: { id: shareA.id },
    data: { viewCount: { increment: 1 } },
  });
  await db.shareLink.update({
    where: { id: shareA.id },
    data: { viewCount: { increment: 1 } },
  });

  const updatedA1 = await db.shareLink.findUnique({ where: { id: shareA.id } });
  console.log(`Step 2: Accessed Share Link A twice -> viewCount: ${updatedA1?.viewCount}`);
  if (updatedA1?.viewCount !== 2) throw new Error(`Expected A viewCount = 2, got ${updatedA1?.viewCount}`);

  // 4. Generate Share Link B (TIME_BASED) for the same note
  const tokenB = generateShareToken();
  const shareB = await db.shareLink.create({
    data: {
      noteId: note.id,
      tokenHash: tokenB.tokenHash,
      rawToken: tokenB.rawToken,
      shareType: "TIME_BASED",
      accessType: "PUBLIC",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log(`\nStep 3: Generated Share Link B (ID: ${shareB.id}) for Note`);

  // 5. Verify A is still 2 views, B is 0 views
  const checkA = await db.shareLink.findUnique({ where: { id: shareA.id } });
  const checkB = await db.shareLink.findUnique({ where: { id: shareB.id } });

  console.log(`Step 4 Verification: Share A viewCount = ${checkA?.viewCount}, Share B viewCount = ${checkB?.viewCount}`);
  if (checkA?.viewCount !== 2) throw new Error(`Share A viewCount changed! Expected 2, got ${checkA?.viewCount}`);
  if (checkB?.viewCount !== 0) throw new Error(`Share B viewCount expected 0, got ${checkB?.viewCount}`);
  if (checkA?.revokedAt !== null) throw new Error(`Share A was incorrectly revoked!`);

  // 6. Open B once
  await db.shareLink.update({
    where: { id: shareB.id },
    data: { viewCount: { increment: 1 } },
  });

  const checkA2 = await db.shareLink.findUnique({ where: { id: shareA.id } });
  const checkB2 = await db.shareLink.findUnique({ where: { id: shareB.id } });

  console.log(`Step 5: Accessed Share B once -> Share A viewCount = ${checkA2?.viewCount}, Share B viewCount = ${checkB2?.viewCount}`);
  if (checkA2?.viewCount !== 2) throw new Error(`Share A viewCount modified! Expected 2, got ${checkA2?.viewCount}`);
  if (checkB2?.viewCount !== 1) throw new Error(`Share B viewCount expected 1, got ${checkB2?.viewCount}`);

  // 7. Revoke B
  await db.shareLink.update({
    where: { id: shareB.id },
    data: { revokedAt: new Date() },
  });

  const checkA3 = await db.shareLink.findUnique({ where: { id: shareA.id } });
  const checkB3 = await db.shareLink.findUnique({ where: { id: shareB.id } });

  console.log(`Step 6: Revoked Share B -> Share A revokedAt = ${checkA3?.revokedAt}, Share B revokedAt = ${checkB3?.revokedAt}`);
  if (checkA3?.revokedAt !== null) throw new Error(`Share A was revoked when B was revoked!`);
  if (checkB3?.revokedAt === null) throw new Error(`Share B was not revoked!`);

  // 8. Test ONE_TIME links independence
  console.log("\n--- TESTING ONE_TIME SHARE LINKS INDEPENDENCE ---");
  const tokenOT_A = generateShareToken();
  const shareOT_A = await db.shareLink.create({
    data: {
      noteId: note.id,
      tokenHash: tokenOT_A.tokenHash,
      rawToken: tokenOT_A.rawToken,
      shareType: "ONE_TIME",
      accessType: "PUBLIC",
    },
  });

  // Consume ONE_TIME Link A
  const claimA1 = await db.shareLink.updateMany({
    where: { id: shareOT_A.id, usedAt: null, revokedAt: null },
    data: { usedAt: new Date(), viewCount: { increment: 1 } },
  });
  if (claimA1.count !== 1) throw new Error("First claim of OT_A should succeed");

  const claimA2 = await db.shareLink.updateMany({
    where: { id: shareOT_A.id, usedAt: null, revokedAt: null },
    data: { usedAt: new Date(), viewCount: { increment: 1 } },
  });
  if (claimA2.count !== 0) throw new Error("Second claim of OT_A should be rejected");

  console.log(`ONE_TIME Link A consumed successfully (viewCount = 1, usedAt != null)`);

  // Generate ONE_TIME Link B
  const tokenOT_B = generateShareToken();
  const shareOT_B = await db.shareLink.create({
    data: {
      noteId: note.id,
      tokenHash: tokenOT_B.tokenHash,
      rawToken: tokenOT_B.rawToken,
      shareType: "ONE_TIME",
      accessType: "PUBLIC",
    },
  });

  const checkOT_B = await db.shareLink.findUnique({ where: { id: shareOT_B.id } });
  console.log(`ONE_TIME Link B created -> usedAt = ${checkOT_B?.usedAt}, viewCount = ${checkOT_B?.viewCount}`);
  if (checkOT_B?.usedAt !== null || checkOT_B?.viewCount !== 0) {
    throw new Error("ONE_TIME Link B inherited state from Link A!");
  }

  // Consume ONE_TIME Link B
  const claimB1 = await db.shareLink.updateMany({
    where: { id: shareOT_B.id, usedAt: null, revokedAt: null },
    data: { usedAt: new Date(), viewCount: { increment: 1 } },
  });
  if (claimB1.count !== 1) throw new Error("Claim of fresh OT_B should succeed");

  console.log(`ONE_TIME Link B consumed successfully (viewCount = 1)`);

  // Clean up test data
  await db.user.delete({ where: { id: user.id } });

  console.log("\n✅ [SUCCESS] MULTIPLE INDEPENDENT SHARES TEST PASSED PERFECTLY!\n");
  process.exit(0);
}

runMultipleSharesTest().catch((err) => {
  console.error("\n❌ [FAIL] MULTIPLE SHARES TEST FAILED:", err);
  process.exit(1);
});
