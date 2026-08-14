"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Clock, Lock, Globe, ShieldAlert, Check, Copy, Ban, RefreshCw, AlertCircle, Link as LinkIcon, Sparkles, KeyRound, Plus } from "lucide-react";

interface NoteDetail {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  shares: Array<{
    id: string;
    tokenHash: string;
    rawToken: string | null;
    shareType: "ONE_TIME" | "TIME_BASED";
    accessType: "PUBLIC" | "PASSWORD_PROTECTED";
    viewCount: number;
    expiresAt: string | null;
    usedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
}

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Regenerate Modal / Form State
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [regenShareType, setRegenShareType] = useState<"ONE_TIME" | "TIME_BASED">("ONE_TIME");
  const [regenAccessType, setRegenAccessType] = useState<"PUBLIC" | "PASSWORD_PROTECTED">("PUBLIC");
  const [regenExpiryHours, setRegenExpiryHours] = useState<number>(24);
  const [regenerating, setRegenerating] = useState(false);

  // Regenerated Result State
  const [regenResult, setRegenResult] = useState<{
    shareUrl: string;
    accessKey: string | null;
  } | null>(null);

  const fetchNote = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("Note not found or access denied.");
        setNote(null);
        return;
      }
      const data = await res.json();
      setNote(data.note);
    } catch (err) {
      setError("Failed to load note details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNote();
  }, [noteId]);

  const handleRevoke = async (shareId: string) => {
    if (!confirm("Are you sure you want to revoke this share link? It will become immediately inaccessible.")) {
      return;
    }

    setRevoking(true);
    try {
      const res = await fetch(`/api/shares/${shareId}/revoke`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to revoke share link.");
        return;
      }

      setRegenResult(null);
      await fetchNote();
    } catch (err) {
      alert("Error revoking share link.");
    } finally {
      setRevoking(false);
    }
  };

  const handleRegenerateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegenerating(true);
    setRegenResult(null);

    try {
      const res = await fetch(`/api/notes/${noteId}/regenerate-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareType: regenShareType,
          accessType: regenAccessType,
          expiryHours: regenShareType === "TIME_BASED" ? regenExpiryHours : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to regenerate share link.");
        return;
      }

      setRegenResult({
        shareUrl: data.shareUrl,
        accessKey: data.accessKey,
      });

      setShowRegenerateForm(false);
      await fetchNote();
    } catch (err) {
      alert("Error regenerating share link.");
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: "link" | "key" = "link") => {
    await navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground font-medium">Loading note details...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="max-w-xl mx-auto space-y-4 text-center py-12">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-200">{error || "Note not found"}</h2>
        <Link href="/">
          <Button variant="outline">Return to Home</Button>
        </Link>
      </div>
    );
  }

  const share = note.shares[0];
  const isRevoked = share?.revokedAt != null;
  const isUsed = share?.shareType === "ONE_TIME" && share?.usedAt != null;
  const isExpired = share?.expiresAt != null && new Date(share.expiresAt) < new Date();
  const isLinkInactive = isRevoked || isUsed || isExpired;
  const isLinkActive = share && !isLinkInactive;

  // Support share URL for ALL notes
  const appUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  const shareToken = share?.rawToken || share?.tokenHash || "";
  const fullShareUrl = shareToken ? `${appUrl}/share/${shareToken}` : "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-300 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" /> Back to Notes
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={fetchNote} className="gap-1.5 text-xs shadow-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
        </Button>
      </div>

      {/* Main Note Card */}
      <Card className="shadow-2xl border-border/80 overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-100">{note.title}</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Created on {new Date(note.createdAt).toLocaleString()}
              </CardDescription>
            </div>
            <div>
              {isRevoked ? (
                <Badge variant="destructive" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  REVOKED
                </Badge>
              ) : isUsed ? (
                <Badge variant="warning" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  USED / CONSUMED
                </Badge>
              ) : isExpired ? (
                <Badge variant="destructive" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  EXPIRED
                </Badge>
              ) : (
                <Badge variant="success" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  ACTIVE
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Note Content */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Note Content
            </h4>
            <div className="p-4 rounded-xl bg-background/80 border border-border/80 font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-200 shadow-inner">
              {note.content}
            </div>
          </div>

          {/* Active Share Link Copy Box */}
          {isLinkActive && fullShareUrl && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" /> Shareable Link
                </Label>
                <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Ready to Share
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Input
                  value={fullShareUrl}
                  readOnly
                  className="font-mono text-xs sm:text-sm bg-background/90 text-emerald-300 select-all h-10 border-primary/20 focus-visible:ring-emerald-500"
                />
                <Button
                  onClick={() => copyToClipboard(fullShareUrl, "link")}
                  className="shrink-0 gap-2 h-10 w-full sm:w-auto font-medium shadow-md transition-all active:scale-95"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copiedLink ? "Copied" : "Copy Share Link"}
                </Button>
              </div>
            </div>
          )}

          {/* Recently Regenerated Password Box */}
          {regenResult?.accessKey && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold text-sm">
                  <KeyRound className="h-4 w-4" /> Newly Generated Access Password
                </span>
                <span className="text-[11px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  Shown Once
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Input
                  value={regenResult.accessKey}
                  readOnly
                  className="font-mono text-base font-bold bg-background text-amber-300 tracking-wider select-all h-10 border-amber-500/30"
                />
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(regenResult.accessKey!, "key")}
                  className="shrink-0 gap-1.5 h-10 w-full sm:w-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium"
                >
                  {copiedKey ? <Check className="h-4 w-4 text-amber-400" /> : <Copy className="h-4 w-4" />}
                  {copiedKey ? "Copied Password" : "Copy Password"}
                </Button>
              </div>
            </div>
          )}

          {/* Inactive / Revoked / Expired Banner with Regenerate Option */}
          {isLinkInactive && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-300 leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong>Link Inactive:</strong>{" "}
                  {isRevoked
                    ? "This share link was manually revoked."
                    : isUsed
                    ? "This one-time share link was opened and consumed."
                    : "This share link has expired."}{" "}
                  You can regenerate a new active share link for this note anytime!
                </div>
              </div>

              {!showRegenerateForm && (
                <Button
                  onClick={() => setShowRegenerateForm(true)}
                  className="gap-2 w-full sm:w-auto font-medium shadow-md bg-amber-500 hover:bg-amber-600 text-slate-950"
                >
                  <Sparkles className="h-4 w-4" /> Regenerate New Share Link
                </Button>
              )}
            </div>
          )}

          {/* Active Note Regenerate Button */}
          {!isLinkInactive && !showRegenerateForm && (
            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenerateForm(true)}
                className="gap-1.5 text-xs text-slate-300 hover:text-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate New Link
              </Button>
            </div>
          )}

          {/* Inline Regenerate Share Link Form */}
          {showRegenerateForm && (
            <Card className="border-primary/40 bg-primary/5 shadow-xl">
              <form onSubmit={handleRegenerateShare}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-100">
                    <Sparkles className="h-4 w-4 text-primary" /> Regenerate Share Link Settings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate a fresh, working share link with new security and access rules.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  {/* Share Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">Share Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegenShareType("ONE_TIME")}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          regenShareType === "ONE_TIME"
                            ? "border-primary bg-primary/20 text-slate-100 font-semibold"
                            : "border-border/60 bg-background/50 text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-400" /> ONE_TIME
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegenShareType("TIME_BASED")}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          regenShareType === "TIME_BASED"
                            ? "border-primary bg-primary/20 text-slate-100 font-semibold"
                            : "border-border/60 bg-background/50 text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-blue-400" /> TIME_BASED
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Expiry Hours (if TIME_BASED) */}
                  {regenShareType === "TIME_BASED" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="regen-expiry" className="text-xs font-semibold text-slate-200">
                        Expiration Duration
                      </Label>
                      <select
                        id="regen-expiry"
                        value={regenExpiryHours}
                        onChange={(e) => setRegenExpiryHours(Number(e.target.value))}
                        className="flex h-9 w-full rounded-md border border-input bg-background/90 px-3 py-1 text-xs focus-visible:ring-1"
                      >
                        <option value={1}>1 Hour</option>
                        <option value={12}>12 Hours</option>
                        <option value={24}>24 Hours (1 Day)</option>
                        <option value={72}>72 Hours (3 Days)</option>
                        <option value={168}>168 Hours (7 Days)</option>
                      </select>
                    </div>
                  )}

                  {/* Access Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-200">Access Control</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRegenAccessType("PUBLIC")}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          regenAccessType === "PUBLIC"
                            ? "border-primary bg-primary/20 text-slate-100 font-semibold"
                            : "border-border/60 bg-background/50 text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-emerald-400" /> PUBLIC
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegenAccessType("PASSWORD_PROTECTED")}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          regenAccessType === "PASSWORD_PROTECTED"
                            ? "border-primary bg-primary/20 text-slate-100 font-semibold"
                            : "border-border/60 bg-background/50 text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-emerald-400" /> PASSWORD_PROTECTED
                        </span>
                      </button>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRegenerateForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={regenerating} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {regenerating ? "Generating..." : "Generate New Link"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Share Statistics & Controls */}
          {share && (
            <div className="space-y-4 pt-4 border-t border-border/60">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Latest Share Security & Statistics
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* View Count */}
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-center">
                  <Eye className="h-5 w-5 text-primary mb-1" />
                  <div className="text-xl font-bold text-slate-100">{share.viewCount}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">Successful Views</div>
                </div>

                {/* Share Type */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex flex-col items-center justify-center text-center">
                  <Clock className="h-5 w-5 text-amber-400 mb-1" />
                  <div className="text-sm font-semibold text-slate-200">
                    {share.shareType === "ONE_TIME" ? "One-Time" : "Time-Based"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Share Type</div>
                </div>

                {/* Access Type */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex flex-col items-center justify-center text-center min-w-0">
                  {share.accessType === "PASSWORD_PROTECTED" ? (
                    <Lock className="h-5 w-5 text-emerald-400 mb-1" />
                  ) : (
                    <Globe className="h-5 w-5 text-blue-400 mb-1" />
                  )}
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-full">
                    {share.accessType === "PASSWORD_PROTECTED" ? "Protected" : "Public"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Access Control</div>
                </div>

                {/* Expiry */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex flex-col items-center justify-center text-center min-w-0">
                  <ShieldAlert className="h-5 w-5 text-purple-400 mb-1" />
                  <div className="text-xs font-semibold text-slate-200 truncate max-w-full">
                    {share.expiresAt
                      ? new Date(share.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : "No Expiry"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : "Lifetime"}
                  </div>
                </div>
              </div>

              {/* Revoke Action (ONLY SHOWN IF LINK IS CURRENTLY ACTIVE, NOT EXPIRED, NOT USED, NOT REVOKED) */}
              {isLinkActive && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 mt-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-rose-300">Revoke Share Link</div>
                    <div className="text-xs text-rose-300/80">
                      Immediately invalidates this share link. Anyone opening it will be denied access.
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(share.id)}
                    disabled={revoking}
                    className="gap-1.5 shrink-0 w-full sm:w-auto font-medium"
                  >
                    <Ban className="h-4 w-4" />
                    {revoking ? "Revoking..." : "Revoke Link"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
