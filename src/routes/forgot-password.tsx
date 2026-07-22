import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import logoAsset from "@/assets/Zen_logo_Without background.png";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: user.role === "client" ? "/client" : "/" });
    }
  }, [isAuthenticated, navigate, user.role]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const normalizedEmail = email.trim();

    try {
      const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
      const endpoint = base ? `${base}/auth/forgot-password` : "/auth/forgot-password";

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      }).catch(() => null);

      setSubmitted(true);
    } catch {
      setError("Unable to send reset instructions right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-tr from-[#006c3c] via-[#003a4a] to-[#0b0b0b] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logoAsset} alt="Zen Carbon" className="h-20 w-20 object-contain" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">My Zen Carbon</h1>
          <p className="text-xs text-muted-foreground">DMRV Platform</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>
              Enter your email and we will send password reset instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              {submitted && (
                <p className="text-xs text-emerald-600">
                  If an account exists for that email, reset instructions have been sent.
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>

              <Link
                to="/login"
                className="text-[11px] text-center text-muted-foreground block transition-colors hover:text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
