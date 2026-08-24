"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Shield, Zap, UsersRound } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (inviteToken) {
      router.push(`/join/${encodeURIComponent(inviteToken)}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between bg-card border-r border-border p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
            AMG
          </div>
          <span className="text-lg font-semibold text-foreground">AMG Operations</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              Precision through detail.
            </h1>
            <p className="mt-3 text-muted-foreground text-base leading-relaxed">
              Manage every customer, job, and follow-up from one place — built for the automotive upgrade shop.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Car, label: "Vehicle-first customer profiles" },
              { icon: Zap, label: "7-stage service job pipeline" },
              { icon: Shield, label: "10-day quality check automation" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} AMG Operations. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xs">
            AMG
          </div>
          <span className="text-base font-semibold text-foreground">AMG Operations</span>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div>
            {inviteToken ? (
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <UsersRound className="h-6 w-6 text-primary" />
              </div>
            ) : null}
            <h2 className="text-2xl font-bold text-foreground">
              {inviteToken ? "Sign in to accept" : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {inviteToken
                ? "Sign in and we'll take you to the invitation."
                : "Sign in to your AMG Operations account"}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href={inviteToken ? `/signup?invite=${encodeURIComponent(inviteToken)}` : "/signup"}
              className="text-primary hover:text-primary/80 font-medium"
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
