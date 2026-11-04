import { useId } from "react";
import skayMark from "@/assets/skay-mark.png";
import styles from "./session-splash.module.css";

export function SessionSplash() {
  const revealId = useId();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-7 bg-background px-6 text-foreground"
      role="status" aria-live="polite" aria-label="Chargement de votre espace Skay Assurance">
      <svg viewBox="180 90 600 720" aria-hidden="true" focusable="false"
        className={`h-36 w-30 overflow-visible dark:brightness-0 dark:invert ${styles.mark}`}>
        <defs>
          <mask id={revealId} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="900">
            {/* Reveal the original artwork along each ribbon, without replacing the logo. */}
            <g fill="none" stroke="white" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round">
              <path className={styles.gold} pathLength="1"
                d="M 715 300 L 715 229 Q 485 84 253 229 L 253 381 Q 371 455 520 479" />
              <path className={styles.shield} pathLength="1"
                d="M 410 340 Q 600 370 709 459 Q 673 637 488 731 Q 309 637 268 518" />
            </g>
          </mask>
        </defs>
        <image href={skayMark} width="900" height="900" opacity="0.1" />
        <image href={skayMark} width="900" height="900" mask={`url(#${revealId})`} />
      </svg>
      <p className="text-sm text-muted-foreground">Chargement de votre espace…</p>
    </div>
  );
}
