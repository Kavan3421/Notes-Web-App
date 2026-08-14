"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Lock, Globe, Clock, Check, Copy, AlertCircle, ArrowLeft, KeyRound, ExternalLink, Sparkles } from "lucide-react";

export default function NewNotePage() {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shareType, setShareType] = useState<"ONE_TIME" | "TIME_BASED">("ONE_TIME");
  const [accessType, setAccessType] = useState<"PUBLIC" | "PASSWORD_PROTECTED">("PUBLIC");
  const [expiryHours, setExpiryHours] = useState<number>(24);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result State (after creation)
  const [createdResult, setCreatedResult] = useState<{
    noteId: string;
    shareUrl: string;
    accessKey: string | null;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter a note title.");
      return;
    }
    if (!content.trim()) {
      setError("Please enter note content.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          shareType,
          accessType,
          expiryHours: shareType === "TIME_BASED" ? expiryHours : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create note.");
        setLoading(false);
        return;
      }

      setCreatedResult({
        noteId: data.noteId,
        shareUrl: data.shareUrl,
        accessKey: data.accessKey,
      });
    } catch (err) {
      setError("An error occurred while creating your note.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: "link" | "key") => {
    await navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (createdResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center text-sm text-slate-300 hover:text-slate-100 font-medium">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to My Notes
        </Link>

        <Card className="border-emerald-500/40 bg-emerald-950/15 shadow-2xl overflow-hidden">
          <CardHeader className="space-y-1 bg-emerald-500/10 border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
              <CardTitle className="text-xl font-bold">Note & Share Link Created!</CardTitle>
            </div>
            <CardDescription className="text-slate-300 text-xs sm:text-sm">
              Your note is live and ready for secure sharing. Below is your generated share link.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {/* Share Link Box */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Shareable Link
              </Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Input
                  value={createdResult.shareUrl}
                  readOnly
                  className="font-mono text-xs sm:text-sm bg-background/90 text-emerald-300 select-all h-10 border-emerald-500/30"
                />
                <Button
                  onClick={() => copyToClipboard(createdResult.shareUrl, "link")}
                  className="shrink-0 gap-1.5 h-10 w-full sm:w-auto font-medium"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copiedLink ? "Copied Link" : "Copy Link"}
                </Button>
              </div>
            </div>

            {/* Access Key Box (if Password Protected) */}
            {createdResult.accessKey && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-400 font-semibold text-sm">
                    <KeyRound className="h-4 w-4" /> Generated Access Password
                  </span>
                  <span className="text-[11px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    Shown Once
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This password is cryptographically hashed in PostgreSQL and will NOT be shown again. Save or copy it now!
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <Input
                    value={createdResult.accessKey}
                    readOnly
                    className="font-mono text-base font-bold bg-background text-amber-300 tracking-wider select-all h-10 border-amber-500/30"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(createdResult.accessKey!, "key")}
                    className="shrink-0 gap-1.5 h-10 w-full sm:w-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-amber-400" /> : <Copy className="h-4 w-4" />}
                    {copiedKey ? "Copied Password" : "Copy Password"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2 bg-muted/10 border-t border-border/40">
            <Button variant="outline" onClick={() => router.push("/")} className="w-full sm:w-auto">
              Done
            </Button>
            <Link href={`/notes/${createdResult.noteId}`} className="w-full sm:w-auto">
              <Button className="w-full gap-1.5">
                View Note Details <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1 text-slate-300 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Create New Note</h1>
      </div>

      <Card className="shadow-2xl border-border/80">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Note Title</Label>
              <Input
                id="title"
                placeholder="e.g., API Keys & Staging Credentials"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-10"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-medium">Note Content</Label>
              <textarea
                id="content"
                rows={5}
                placeholder="Write your secret note content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>

            {/* Share Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Share Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShareType("ONE_TIME")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    shareType === "ONE_TIME"
                      ? "border-primary bg-primary/10 text-slate-100 ring-1 ring-primary/40 shadow-sm"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-sm text-slate-200">
                      <Clock className="h-4 w-4 text-amber-400" /> ONE_TIME
                    </span>
                    {shareType === "ONE_TIME" && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Self-destructs immediately after the first successful view.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShareType("TIME_BASED")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    shareType === "TIME_BASED"
                      ? "border-primary bg-primary/10 text-slate-100 ring-1 ring-primary/40 shadow-sm"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-sm text-slate-200">
                      <Clock className="h-4 w-4 text-blue-400" /> TIME_BASED
                    </span>
                    {shareType === "TIME_BASED" && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Accessible multiple times until the set expiration time.
                  </p>
                </button>
              </div>
            </div>

            {/* Expiry Hours (if TIME_BASED) */}
            {shareType === "TIME_BASED" && (
              <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/60">
                <Label htmlFor="expiry" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Expiration Duration
                </Label>
                <select
                  id="expiry"
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={1}>1 Hour</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (1 Day)</option>
                  <option value={72}>72 Hours (3 Days)</option>
                  <option value={168}>168 Hours (7 Days)</option>
                </select>
              </div>
            )}

            {/* Access Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Access Control</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccessType("PUBLIC")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    accessType === "PUBLIC"
                      ? "border-primary bg-primary/10 text-slate-100 ring-1 ring-primary/40 shadow-sm"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-sm text-slate-200">
                      <Globe className="h-4 w-4 text-emerald-400" /> PUBLIC
                    </span>
                    {accessType === "PUBLIC" && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Anyone with the share link can open it.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessType("PASSWORD_PROTECTED")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    accessType === "PASSWORD_PROTECTED"
                      ? "border-primary bg-primary/10 text-slate-100 ring-1 ring-primary/40 shadow-sm"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-sm text-slate-200">
                      <Lock className="h-4 w-4 text-emerald-400" /> PASSWORD_PROTECTED
                    </span>
                    {accessType === "PASSWORD_PROTECTED" && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Generates a secure random access password required to unlock.
                  </p>
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-end space-x-3 pt-2 bg-muted/10 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 font-medium shadow-md">
              <Sparkles className="h-4 w-4" />
              {loading ? "Creating..." : "Generate Secure Share Link"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
