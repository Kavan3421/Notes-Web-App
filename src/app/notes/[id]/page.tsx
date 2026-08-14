"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Eye,
  Clock,
  Lock,
  Globe,
  ShieldAlert,
  Check,
  Copy,
  Ban,
  RefreshCw,
  AlertCircle,
  Link as LinkIcon,
  Sparkles,
  KeyRound,
  Plus,
  ChevronDown,
  ChevronUp,
  History,
  BarChart2
} from "lucide-react";

interface ShareItem {
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
}

interface NoteDetail {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  shares: ShareItem[];
}

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Accordion state for Share History
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  // Generate New Share Form State
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [regenShareType, setRegenShareType] = useState<"ONE_TIME" | "TIME_BASED">("ONE_TIME");
  const [regenAccessType, setRegenAccessType] = useState<"PUBLIC" | "PASSWORD_PROTECTED">("PUBLIC");
  const [regenExpiryHours, setRegenExpiryHours] = useState<number>(24);
  const [regenerating, setRegenerating] = useState(false);

  // Newly Generated Result State
  const [regenResult, setRegenResult] = useState<{
    shareId: string;
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

    setRevokingId(shareId);
    try {
      const res = await fetch(`/api/shares/${shareId}/revoke`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to revoke share link.");
        return;
      }

      await fetchNote();
    } catch (err) {
      alert("Error revoking share link.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleGenerateShare = async (e: React.FormEvent) => {
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
        alert(data.error || "Failed to generate share link.");
        return;
      }

      setRegenResult({
        shareId: data.shareId,
        shareUrl: data.shareUrl,
        accessKey: data.accessKey,
      });

      setShowRegenerateForm(false);
      setIsHistoryOpen(true);
      await fetchNote();
    } catch (err) {
      alert("Error generating share link.");
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, shareId?: string) => {
    await navigator.clipboard.writeText(text);
    if (shareId) {
      setCopiedShareId(shareId);
      setTimeout(() => setCopiedShareId(null), 2000);
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

  const appUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  // Calculate Overall Note Statistics
  const totalOverallViews = note.shares.reduce((acc, s) => acc + s.viewCount, 0);
  const activeSharesCount = note.shares.filter(
    (s) =>
      !s.revokedAt &&
      !(s.shareType === "ONE_TIME" && s.usedAt) &&
      !(s.expiresAt && new Date(s.expiresAt) < new Date())
  ).length;

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

            {/* Overall Total Views Badge */}
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-3.5 py-1.5 rounded-xl">
              <BarChart2 className="h-4 w-4 text-primary shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Overall Note Views</div>
                <div className="text-lg font-extrabold text-primary leading-tight">{totalOverallViews} Views</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Note Summary Stats */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-background/60 border border-border/60 text-center">
            <div>
              <div className="text-base font-bold text-slate-100">{totalOverallViews}</div>
              <div className="text-[11px] text-muted-foreground font-medium">Overall Total Views</div>
            </div>
            <div className="border-x border-border/60">
              <div className="text-base font-bold text-emerald-400">{activeSharesCount}</div>
              <div className="text-[11px] text-muted-foreground font-medium">Active Links</div>
            </div>
            <div>
              <div className="text-base font-bold text-slate-200">{note.shares.length}</div>
              <div className="text-[11px] text-muted-foreground font-medium">Total Share Links</div>
            </div>
          </div>

          {/* Note Content */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Note Content
            </h4>
            <div className="p-4 rounded-xl bg-background/80 border border-border/80 font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-200 shadow-inner">
              {note.content}
            </div>
          </div>

          {/* Newly Generated Password Notification */}
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
                  onClick={() => copyToClipboard(regenResult.accessKey!)}
                  className="shrink-0 gap-1.5 h-10 w-full sm:w-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium"
                >
                  {copiedKey ? <Check className="h-4 w-4 text-amber-400" /> : <Copy className="h-4 w-4" />}
                  {copiedKey ? "Copied Password" : "Copy Password"}
                </Button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* LATEST / CURRENT SHARE LINK (OUTSIDE ACCORDION)           */}
          {/* ======================================================== */}
          {note.shares.length > 0 && (() => {
            const latestShare = note.shares[0];
            const isRevoked = latestShare.revokedAt != null;
            const isUsed = latestShare.shareType === "ONE_TIME" && latestShare.usedAt != null;
            const isExpired = latestShare.expiresAt != null && new Date(latestShare.expiresAt) < new Date();
            const isInactive = isRevoked || isUsed || isExpired;
            const isActive = !isInactive;

            const token = latestShare.rawToken || latestShare.tokenHash;
            const shareUrl = `${appUrl}/share/${token}`;

            return (
              <div className="space-y-3 p-5 rounded-2xl bg-primary/5 border border-primary/30 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-primary" /> Active / Latest Share Link
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      (Share Link #{note.shares.length})
                    </span>
                  </div>

                  <div>
                    {isRevoked ? (
                      <Badge variant="destructive" className="text-[10px] font-bold">REVOKED</Badge>
                    ) : isUsed ? (
                      <Badge variant="warning" className="text-[10px] font-bold">USED / CONSUMED</Badge>
                    ) : isExpired ? (
                      <Badge variant="destructive" className="text-[10px] font-bold">EXPIRED</Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px] font-bold">ACTIVE</Badge>
                    )}
                  </div>
                </div>

                {/* Share Link Copy Field */}
                {isActive && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="font-mono text-xs sm:text-sm bg-background/90 text-emerald-300 select-all h-10 border-primary/30 focus-visible:ring-emerald-500"
                    />
                    <Button
                      onClick={() => copyToClipboard(shareUrl, latestShare.id)}
                      className="shrink-0 gap-2 h-10 font-medium shadow-md transition-all active:scale-95"
                    >
                      {copiedShareId === latestShare.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedShareId === latestShare.id ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                )}

                {/* Share Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2.5">
                    <Eye className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="font-bold text-slate-100 text-sm">{latestShare.viewCount}</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Link Views</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">
                        {latestShare.shareType === "ONE_TIME" ? "One-Time" : "Time-Based"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">Type</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center gap-2.5 min-w-0">
                    {latestShare.accessType === "PASSWORD_PROTECTED" ? (
                      <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Globe className="h-4 w-4 text-blue-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        {latestShare.accessType === "PASSWORD_PROTECTED" ? "Password" : "Public"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">Access</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center gap-2.5 min-w-0">
                    <ShieldAlert className="h-4 w-4 text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        {latestShare.expiresAt
                          ? new Date(latestShare.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : "No Expiry"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium">
                        {latestShare.expiresAt ? new Date(latestShare.expiresAt).toLocaleDateString() : "Lifetime"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revoke Action */}
                {isActive && (
                  <div className="flex justify-end pt-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(latestShare.id)}
                      disabled={revokingId === latestShare.id}
                      className="gap-1.5 text-xs h-8 font-medium"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {revokingId === latestShare.id ? "Revoking..." : "Revoke Link"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Generate New Share Link Action */}
          {!showRegenerateForm && (
            <div className="flex justify-between items-center pt-2">
              <div className="space-y-0.5">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Share Management
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Create additional independent share links with custom rules.
                </p>
              </div>
              <Button
                onClick={() => setShowRegenerateForm(true)}
                className="gap-2 font-medium shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                size="sm"
              >
                <Plus className="h-4 w-4" /> Generate New Share Link
              </Button>
            </div>
          )}

          {/* Inline Generate Share Link Form */}
          {showRegenerateForm && (
            <Card className="border-primary/40 bg-primary/5 shadow-xl">
              <form onSubmit={handleGenerateShare}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-100">
                    <Sparkles className="h-4 w-4 text-primary" /> Generate New Share Link Settings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate an independent share link with its own access rules and view count tracking.
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
                        <option value={1 / 60}>1 Minute</option>
                        <option value={5 / 60}>5 Minutes</option>
                        <option value={15 / 60}>15 Minutes</option>
                        <option value={30 / 60}>30 Minutes</option>
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

          {/* ======================================================== */}
          {/* ACCORDION: OLD SHARE LINKS HISTORY ONLY (note.shares.slice(1)) */}
          {/* ======================================================== */}
          {note.shares.length > 1 && (
            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-lg bg-background/40">
              {/* Accordion Toggle Header */}
              <button
                type="button"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="w-full p-4 flex items-center justify-between bg-muted/20 hover:bg-muted/30 transition-colors text-left border-b border-border/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Old Share Links History
                      <Badge variant="outline" className="text-[10px] font-semibold bg-background">
                        {note.shares.length - 1} Old {note.shares.length - 1 === 1 ? "Link" : "Links"}
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Click to {isHistoryOpen ? "collapse" : "expand"} previous share links history
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-xs font-medium hidden sm:inline">
                    {isHistoryOpen ? "Hide Old Links" : "Show Old Links"}
                  </span>
                  {isHistoryOpen ? (
                    <ChevronUp className="h-5 w-5 text-primary transition-transform" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform" />
                  )}
                </div>
              </button>

              {/* Accordion Content Body: ONLY Old Share Links (note.shares.slice(1)) */}
              {isHistoryOpen && (
                <div className="p-4 space-y-4 bg-muted/5">
                  {note.shares.slice(1).map((share, index) => {
                    const isRevoked = share.revokedAt != null;
                    const isUsed = share.shareType === "ONE_TIME" && share.usedAt != null;
                    const isExpired = share.expiresAt != null && new Date(share.expiresAt) < new Date();
                    const isInactive = isRevoked || isUsed || isExpired;
                    const isActive = !isInactive;

                    const token = share.rawToken || share.tokenHash;
                    const shareUrl = `${appUrl}/share/${token}`;
                    const shareNumber = note.shares.length - 1 - index;

                    return (
                      <div
                        key={share.id}
                        className={`p-4 rounded-xl border transition-all space-y-4 ${
                          isActive
                            ? "bg-background/80 border-primary/40 shadow-md"
                            : "bg-muted/20 border-border/60 opacity-80"
                        }`}
                      >
                        {/* Share Item Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200">
                              Share Link #{shareNumber}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              (Created {new Date(share.createdAt).toLocaleString()})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Status Badge */}
                            {isRevoked ? (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                REVOKED
                              </Badge>
                            ) : isUsed ? (
                              <Badge variant="warning" className="text-[10px] font-bold">
                                USED / CONSUMED
                              </Badge>
                            ) : isExpired ? (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                EXPIRED
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px] font-bold">
                                ACTIVE
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Share Link Copy Field (If Active) */}
                        {isActive && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Input
                              value={shareUrl}
                              readOnly
                              className="font-mono text-xs bg-background/90 text-emerald-300 select-all h-9 border-primary/20"
                            />
                            <Button
                              size="sm"
                              onClick={() => copyToClipboard(shareUrl, share.id)}
                              className="shrink-0 gap-1.5 h-9 font-medium"
                            >
                              {copiedShareId === share.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copiedShareId === share.id ? "Copied" : "Copy Link"}
                            </Button>
                          </div>
                        )}

                        {/* Share Attributes Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* View Count */}
                          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <div className="font-bold text-slate-100 text-sm">{share.viewCount}</div>
                              <div className="text-[10px] text-muted-foreground">Views</div>
                            </div>
                          </div>

                          {/* Share Type */}
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-200 text-xs">
                                {share.shareType === "ONE_TIME" ? "One-Time" : "Time-Based"}
                              </div>
                              <div className="text-[10px] text-muted-foreground">Type</div>
                            </div>
                          </div>

                          {/* Access Type */}
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex items-center gap-2 min-w-0">
                            {share.accessType === "PASSWORD_PROTECTED" ? (
                              <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Globe className="h-4 w-4 text-blue-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-200 text-xs truncate">
                                {share.accessType === "PASSWORD_PROTECTED" ? "Password" : "Public"}
                              </div>
                              <div className="text-[10px] text-muted-foreground">Access</div>
                            </div>
                          </div>

                          {/* Expiry */}
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex items-center gap-2 min-w-0">
                            <ShieldAlert className="h-4 w-4 text-purple-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-200 text-xs truncate">
                                {share.expiresAt
                                  ? new Date(share.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : "No Expiry"}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : "Lifetime"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Revoke Action */}
                        {isActive && (
                          <div className="flex justify-end pt-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevoke(share.id)}
                              disabled={revokingId === share.id}
                              className="gap-1.5 text-xs h-8 font-medium"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              {revokingId === share.id ? "Revoking..." : "Revoke Link"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

