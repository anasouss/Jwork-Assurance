import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import TopoBackground from "@/components/kokonutui/topo-background";
import { DeveloperCredit } from "@/components/shared/developer-credit";
import skayLogo from "@/assets/logo.webp";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, hydrate, clearError, error, isAuthenticated, isHydrated, isLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const busy = isLoading || !isHydrated;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      navigate("/app", { replace: true });
    }
  }, [isAuthenticated, isHydrated, navigate]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    clearError();
    const ok = await login(email.trim(), password);
    if (ok) {
      navigate("/app", { replace: true });
    }
  };

  return (
    <div className="relative isolate flex min-h-svh flex-col bg-zinc-100 text-foreground selection:bg-primary selection:text-primary-foreground dark:bg-background">
      <div aria-hidden="true" className="absolute inset-y-3 left-3 -z-10 hidden w-[calc(50%-0.75rem)] overflow-hidden rounded-2xl bg-[#dce5eb] lg:block dark:bg-[#1c252d]">
        <TopoBackground className="h-full min-h-0 bg-transparent text-[#b38a43] dark:bg-transparent dark:text-[#c3a367]/80"
          speed={0.7} interactive labels={false} seed={26} interval={0.09}>
          {null}
        </TopoBackground>
      </div>

      <header className="pointer-events-none relative mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 pt-6 sm:px-10 lg:px-14 lg:pt-8">
        <img src={skayLogo} alt="Skay Assurance" width={1200} height={666}
          className="h-16 w-48 max-w-[70%] object-cover lg:h-20 lg:w-64 dark:brightness-0 dark:invert" />
        <ThemeToggle className="pointer-events-auto size-11 border border-border bg-background text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
      </header>

      <main className="pointer-events-none relative mx-auto grid w-full max-w-[1440px] flex-1 items-center px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-24 lg:px-14 lg:py-16 xl:gap-40">
        <div className="hidden min-w-0 max-w-md self-end space-y-6 pb-6 text-[#132a3b] lg:block dark:text-[#edf2f5]">
          <p className="max-w-[420px] text-4xl font-semibold leading-[1.2]">
            <span className="block">Votre espace de</span>
            <span className="block text-[#805a19] dark:text-[#e1b86b]">gestion d’assurance.</span>
          </p>
          <p className="max-w-[360px] text-pretty text-base leading-7 text-[#354f61] dark:text-[#becdd7]">
            Contrats, clients, sinistres et comptabilité réunis au même endroit.
          </p>
        </div>
        <section aria-labelledby="login-title" className="pointer-events-auto mx-auto w-full max-w-[400px]">
          <div className="mb-9 space-y-3">
            <h1 id="login-title" className="text-3xl font-semibold leading-tight">Connexion</h1>
            <p className="text-sm leading-6 text-muted-foreground">Accédez à votre espace Skay Assurance.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} aria-busy={busy}>
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium">Adresse e-mail</label>
              <Input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@agence.ma"
                disabled={busy} aria-describedby={error ? "login-error" : undefined}
                className="h-12 rounded-md border-input bg-card px-3.5 text-foreground caret-primary md:text-base focus-visible:border-ring focus-visible:ring-ring/30 dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                required />
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium">Mot de passe</label>
              <div className="relative">
                <Input id="login-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={event => setPassword(event.target.value)} disabled={busy}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-12 rounded-md border-input bg-card pl-3.5 pr-12 text-foreground caret-primary md:text-base focus-visible:border-ring focus-visible:ring-ring/30 dark:border-input dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
                  required />
                <Button type="button" variant="ghost" size="icon" disabled={busy}
                  aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  title={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={passwordVisible} aria-controls="login-password"
                  className="absolute right-0.5 top-0.5 size-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setPasswordVisible(current => !current)}>
                  {passwordVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </Button>
              </div>
            </div>
            {error && <div ref={errorRef} id="login-error" role="alert" tabIndex={-1}
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{error}</span>
            </div>}
            <Button type="submit" disabled={busy}
              className="h-12 w-full justify-between rounded-md px-4 text-sm font-semibold focus-visible:ring-ring/30">
              <span>{!isHydrated ? "Vérification de la session..." : isLoading ? "Connexion..." : "Se connecter"}</span>
              {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowRight aria-hidden="true" className="size-4" />}
            </Button>
          </form>

          <p className="mt-8 border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
            Un problème d’accès ? Contactez votre administrateur.
          </p>
        </section>
      </main>

      <footer className="relative mx-auto w-full max-w-[1440px] px-6 pb-6 sm:px-10 lg:px-14 lg:pb-8">
        <DeveloperCredit className="text-center lg:text-right" />
      </footer>
    </div>
  );
}
