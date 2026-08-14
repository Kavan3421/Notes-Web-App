"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Lock, KeyRound, AlertTriangle, FileText, CheckCircle2, Clock, Ban, Unlock } from "lucide-react";

interface ShareMeta {
  noteTitle: string;
  shareType: "ONE_TIME" | "TIME_BASED";
  accessType: "PUBLIC" | "PASSWORD_PROTECTED";
  isPasswordProtected: boolean;
  expiresAt: string | null;
}

interface UnlockedNote {
  title: string;
  content: string;
  createdAt: string;
  shareType: string;
  accessType: string;
}

export default function ShareTokenPage() {
  const params = useParams();
  const rawToken = params.token as string;

  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [unlockedNote, setUnlockedNote] = useState<UnlockedNote | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Inspect Share Token Metadata
  useEffect(() => {
    async function inspectShare() {
      try {
        const res = await fetch(`/api/share/${rawToken}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid or inaccessible share link.");
          setMeta(null);
          return;
        }

        setMeta(data);

        // If it's PUBLIC, auto-unlock immediately!
        if (!data.isPasswordProtected) {
          await unlockNote("");
        }
      } catch (err) {
        setError("Failed to process share link.");
      } finally {
        setLoading(false);
      }
    }

    if (rawToken) {
      inspectShare();
    }
  }, [rawToken]);

  // Step 2: Unlock Note Content
  const unlockNote = async (accessPassword: string) => {
    setUnlocking(true);
    setError(null);

    try {
      const res = await fetch(`/api/share/${rawToken}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: accessPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to unlock note.");
        setUnlocking(false);
        return;
      }

      setUnlockedNote(data);
    } catch (err) {
      setError("An error occurred while unlocking the note.");
    } finally {
      setUnlocking(false);
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the access key.");
      return;
    }
    unlockNote(password);
  };

  // Initial Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground font-medium">Verifying secure share link...</p>
      </div>
    );
  }

  // Error State (Revoked, Expired, Already Used, Invalid Token)
  if (error && !unlockedNote) {
    const isRevoked = error.toLowerCase().includes("revoked");
    const isExpired = error.toLowerCase().includes("expired");
    const isUsed = error.toLowerCase().includes("used");

    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <Card className="shadow-2xl border-rose-500/30 bg-rose-950/15 text-center overflow-hidden">
          <CardHeader className="space-y-3 pb-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              {isRevoked ? (
                <Ban className="h-8 w-8" />
              ) : isExpired ? (
                <Clock className="h-8 w-8" />
              ) : (
                <AlertTriangle className="h-8 w-8" />
              )}
            </div>
            <CardTitle className="text-xl font-bold text-rose-300">Access Denied</CardTitle>
            <CardDescription className="text-slate-200 font-medium text-base leading-snug">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-2 border-t border-rose-500/20 bg-rose-500/5">
            {isUsed && "This one-time note has already been read and permanently consumed."}
            {isExpired && "The owner set an expiration timer for this link that has now elapsed."}
            {isRevoked && "The owner manually invalidated this share link."}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password Prompt Form (Password Protected Share)
  if (meta?.isPasswordProtected && !unlockedNote) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <Card className="shadow-2xl border-border/80 overflow-hidden">
          <CardHeader className="text-center space-y-2 pb-4 bg-muted/20 border-b border-border/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-100">Password Protected Note</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              This note is protected by an access password. Enter the key to view content.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Access Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter access password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10 font-mono text-sm h-11"
                  />
                  <KeyRound className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 bg-muted/10 border-t border-border/40">
              <Button type="submit" className="w-full gap-2 font-medium h-11 shadow-md" disabled={unlocking}>
                <Unlock className="h-4 w-4" />
                {unlocking ? "Verifying Password..." : "Unlock Note"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // Unlocked Note View
  if (unlockedNote) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-6 px-4">
        <Card className="shadow-2xl border-border/80 overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-4 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <CardTitle className="text-2xl font-bold tracking-tight text-slate-100">{unlockedNote.title}</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                  Created on {new Date(unlockedNote.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex gap-1.5">
                <Badge variant={unlockedNote.shareType === "ONE_TIME" ? "warning" : "secondary"} className="px-2.5 py-0.5 text-xs font-bold uppercase">
                  {unlockedNote.shareType === "ONE_TIME" ? "One-Time Read" : "Time-Based"}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="p-5 rounded-xl bg-background/80 border border-border/80 font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-100 shadow-inner">
              {unlockedNote.content}
            </div>

            {unlockedNote.shareType === "ONE_TIME" && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
                <Clock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>One-Time Note Consumed:</strong> This note link has now been permanently consumed. If you refresh or navigate away, it will no longer be accessible.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
