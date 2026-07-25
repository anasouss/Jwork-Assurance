import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, PasswordInput } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, hydrate, clearError, error, isAuthenticated, isHydrated, isLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      navigate("/app", { replace: true });
    }
  }, [isAuthenticated, isHydrated, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    const ok = await login(email, password);
    if (ok) {
      navigate("/app", { replace: true });
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="w-full border-border/70 shadow-none">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BadgeCheck className="size-5" />
            </div>
            <CardTitle>Connexion</CardTitle>
            <p className="text-sm text-muted-foreground">Accès à l’espace production.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@domaine.ma"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mot de passe</label>
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mot de passe"
                  className="h-11"
                  required
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <Button type="submit" className="h-11 w-full" disabled={isLoading}>
                {isLoading ? "Connexion..." : "Se connecter"}
                {!isLoading ? <ArrowRight className="size-4" /> : null}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
