"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Shield, Zap, CheckCircle, UsersRound } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setLoading(false);
  };

  const BrandingPanel = (
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
  );

  if (success) {
    return (
      <div className="flex min-h-screen">
        {BrandingPanel}
        <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>. Click the link to verify your account.
            </p>
            <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}>
              <Button variant="outline" className="w-full mt-2">
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {BrandingPanel}
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
              {inviteToken ? "Create account & join" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {inviteToken
                ? "Verify your email, then accept the invitation to join your team."
                : "Get started with AMG Operations"}
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}
              className="text-primary hover:text-primary/80 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
