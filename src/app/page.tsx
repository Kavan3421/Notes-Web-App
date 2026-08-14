"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Eye, Clock, Lock, ShieldAlert, ArrowRight, ExternalLink } from "lucide-react";

interface NoteSummary {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  shares: Array<{
    id: string;
    shareType: "ONE_TIME" | "TIME_BASED";
    accessType: "PUBLIC" | "PASSWORD_PROTECTED";
    viewCount: number;
    expiresAt: string | null;
    usedAt: string | null;
    revokedAt: string | null;
  }>;
}

export default function HomePage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotes() {
      try {
        const res = await fetch("/api/notes");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes);
        }
      } catch (err) {
        console.error("Error fetching notes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground font-medium">Loading your secure notes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">My Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your secure notes and active share link statistics.
          </p>
        </div>
        <Link href="/notes/new">
          <Button className="gap-2 shadow-md w-full sm:w-auto font-medium">
            <Plus className="h-4 w-4" /> Create New Note
          </Button>
        </Link>
      </div>

      {notes.length === 0 ? (
        <Card className="text-center py-12 px-4 border-dashed border-border/80 bg-muted/10">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-200">No notes created yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Create your first note with custom expiration rules, password protection, or one-time read destruction.
              </p>
            </div>
            <Link href="/notes/new">
              <Button size="sm" className="mt-2 gap-1.5 font-medium">
                <Plus className="h-4 w-4" /> Create Note Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {notes.map((note) => {
            const share = note.shares[0];
            const isRevoked = share?.revokedAt != null;
            const isUsed = share?.shareType === "ONE_TIME" && share?.usedAt != null;
            const isExpired = share?.expiresAt != null && new Date(share.expiresAt) < new Date();

            return (
              <Card key={note.id} className="flex flex-col justify-between hover:border-primary/40 transition-colors shadow-lg overflow-hidden">
                <CardHeader className="pb-3 bg-muted/10">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-lg font-bold text-slate-100">{note.title}</CardTitle>
                    <div className="flex gap-1.5 flex-wrap shrink-0">
                      {isRevoked ? (
                        <Badge variant="destructive" className="text-[10px] font-bold">REVOKED</Badge>
                      ) : isUsed ? (
                        <Badge variant="warning" className="text-[10px] font-bold">USED</Badge>
                      ) : isExpired ? (
                        <Badge variant="destructive" className="text-[10px] font-bold">EXPIRED</Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] font-bold">ACTIVE</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 mt-1.5 text-xs text-slate-400 font-mono">
                    {note.content}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 bg-background/60 p-2.5 rounded-xl border border-border/60">
                    <span className="flex items-center gap-1 font-mono font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
                      <Eye className="h-3.5 w-3.5" /> {share?.viewCount ?? 0} Views
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-medium px-2 py-0.5 rounded bg-amber-500/10">
                      <Clock className="h-3.5 w-3.5" />
                      {share?.shareType === "ONE_TIME" ? "One-Time" : "Time-Based"}
                    </span>
                    {share?.accessType === "PASSWORD_PROTECTED" && (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10">
                        <Lock className="h-3.5 w-3.5" /> Protected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                    <Link href={`/notes/${note.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium h-8">
                        Details & Share <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
