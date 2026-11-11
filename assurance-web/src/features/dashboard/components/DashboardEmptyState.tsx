export function DashboardEmptyState({ message = "Aucune production sur cette période." }: { message?: string }) {
  return (
    <div className="grid min-h-[200px] place-items-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
