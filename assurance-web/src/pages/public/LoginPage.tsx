import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleAlert, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { resolvedTheme, setTheme } = useTheme();
  const busy = isLoading || !isHydrated;
  const themeLabel = resolvedTheme === "dark" ? "Activer le thème clair" : "Activer le thème sombre";

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
    <div className="relative isolate flex min-h-svh flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 hidden w-[48%] border-r border-zinc-200/70 bg-[#eef2ef] lg:block xl:w-[54%] dark:border-zinc-800 dark:bg-[#131a17]">
        <TopoBackground className="h-full min-h-0 bg-transparent text-emerald-900 dark:bg-transparent dark:text-emerald-200"
          speed={0} interactive={false} labels={false} seed={26} interval={0.09}>
          {null}
        </TopoBackground>
      </div>

      <header className="relative mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 pt-6 sm:px-10 lg:px-14 lg:pt-8">
        <img src={skayLogo} alt="Skay Assurance" width={1200} height={666}
          className="h-16 w-48 max-w-[70%] object-cover lg:h-20 lg:w-64 dark:brightness-0 dark:invert" />
        <Button type="button" variant="ghost" size="icon" aria-label={themeLabel} title={themeLabel}
          className="size-11 rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
        </Button>
      </header>

      <main className="relative mx-auto grid w-full max-w-[1440px] flex-1 items-center px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-24 lg:px-14 lg:py-16 xl:gap-40">
        <div aria-hidden="true" className="hidden lg:block" />
        <section aria-labelledby="login-title" className="mx-auto w-full max-w-[400px]">
          <div className="mb-9 space-y-3">
            <h1 id="login-title" className="text-3xl font-semibold leading-tight">Connexion</h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Accédez à votre espace Skay Assurance.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} aria-busy={busy}>
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium">Adresse e-mail</label>
              <Input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@agence.ma"
                disabled={busy} aria-describedby={error ? "login-error" : undefined}
                className="h-12 rounded-md border-zinc-300 bg-white px-3.5 md:text-base focus-visible:border-orange-700 focus-visible:ring-orange-700/20 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus-visible:border-orange-400 dark:focus-visible:ring-orange-400/25"
                required />
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium">Mot de passe</label>
              <div className="relative">
                <Input id="login-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={event => setPassword(event.target.value)} disabled={busy}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-12 rounded-md border-zinc-300 bg-white pl-3.5 pr-12 md:text-base focus-visible:border-orange-700 focus-visible:ring-orange-700/20 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus-visible:border-orange-400 dark:focus-visible:ring-orange-400/25"
                  required />
                <Button type="button" variant="ghost" size="icon" disabled={busy}
                  aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  title={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={passwordVisible} aria-controls="login-password"
                  className="absolute right-0.5 top-0.5 size-11 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
              className="h-12 w-full justify-between rounded-md bg-orange-700 px-4 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:ring-orange-700/30 dark:bg-orange-400 dark:text-zinc-950 dark:hover:bg-orange-300">
              <span>{!isHydrated ? "Vérification de la session..." : isLoading ? "Connexion..." : "Se connecter"}</span>
              {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowRight aria-hidden="true" className="size-4" />}
            </Button>
          </form>

          <p className="mt-8 border-t border-zinc-200 pt-6 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
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
