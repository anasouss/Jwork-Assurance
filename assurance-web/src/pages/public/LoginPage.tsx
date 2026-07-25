import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, PasswordInput } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

const featureCards: [string, string, LucideIcon][] = [
  ["Contrats", "Saisie structurée par sections", FileText],
  ["Garanties", "Calculs et grilles tarifaires", BadgeCheck],
  ["Accès", "Permissions backend conservées", ShieldCheck],
];

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
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1fr_440px] lg:items-center">
        <section className="hidden max-w-3xl lg:block">
          <Badge variant="outline" className="mb-5">
            Production assurance automobile
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Gestion des contrats, avenants, garanties et attestations.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Interface métier connectée au backend assurance: création particulier,
            convention, flotte, prévisualisation quittance et paramétrage production.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {featureCards.map(([title, text, Icon]) => (
              <div key={title} className="rounded-lg border bg-card p-4">
                <Icon className="mb-3 size-5 text-primary" />
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{text}</div>
              </div>
            ))}
          </div>
        </section>

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
