import { cn } from "@/lib/utils";

type DeveloperCreditProps = {
  className?: string;
};

export function DeveloperCredit({ className }: DeveloperCreditProps) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Développé par{" "}
      <a
        href="https://jway.ma"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
      >
        Jway Services · jway.ma
      </a>
    </p>
  );
}
