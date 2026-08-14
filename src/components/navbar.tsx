"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ShieldCheck, Plus, LogOut, FileText, Lock } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Don't show full nav header on share access page if preferred, but keeping standard header is very clean
  const isSharePage = pathname.startsWith("/share/");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 max-w-5xl">
        <Link href={user ? "/" : "/login"} className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg text-slate-100 tracking-tight">
            Notes<span className="text-primary">Vault</span>
          </span>
        </Link>

        <nav className="flex items-center space-x-3">
          {loading ? (
            <div className="h-8 w-24 bg-muted/40 animate-pulse rounded-md" />
          ) : user ? (
            <>
              <Link href="/">
                <Button variant={pathname === "/" ? "secondary" : "ghost"} size="sm" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  My Notes
                </Button>
              </Link>

              <Link href="/notes/new">
                <Button size="sm" className="gap-1.5 font-medium shadow-sm">
                  <Plus className="h-4 w-4" />
                  New Note
                </Button>
              </Link>

              <div className="hidden sm:flex items-center pl-2 pr-1 text-xs text-muted-foreground border-l border-border/60">
                <span className="truncate max-w-[140px]">{user.email}</span>
              </div>

              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-rose-400">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Logout</span>
              </Button>
            </>
          ) : (
            !isSharePage && (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
