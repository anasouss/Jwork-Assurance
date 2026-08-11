import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Globe2, LoaderCircle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { authApi } from "@/lib/api/auth";
import { isPlatformAdmin } from "@/lib/platform-context";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export function AgencyContextSelector() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const enterAgencyContext = useAuthStore((state) => state.enterAgencyContext);
  const exitAgencyContext = useAuthStore((state) => state.exitAgencyContext);
  const switching = useAuthStore((state) => state.isSwitchingContext);
  const [open, setOpen] = useState(false);
  const options = useQuery({
    queryKey: ["agency-context-options"],
    queryFn: authApi.agencyContextOptions,
    enabled: isPlatformAdmin(user),
    staleTime: 5 * 60_000,
  });

  if (!isPlatformAdmin(user)) {
    return null;
  }

  const inAgency = Boolean(user?.agenceId);

  async function selectAgency(agencyId: string) {
    if (agencyId === user?.agenceId) {
      setOpen(false);
      return;
    }
    try {
      await enterAgencyContext(agencyId);
      setOpen(false);
      navigate("/app", { replace: true });
      toast.success("Contexte agence activé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Contexte agence impossible à activer");
    }
  }

  async function returnToPlatform() {
    try {
      await exitAgencyContext();
      setOpen(false);
      navigate("/app/platform", { replace: true });
      toast.success("Retour à la plateforme");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retour à la plateforme impossible");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={switching}
          className="h-auto min-h-10 w-full justify-start gap-2 px-2 py-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          title={inAgency ? user?.agenceName ?? "Agence" : "Plateforme"}
        >
          {switching ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
          ) : inAgency ? (
            <Building2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <Globe2 className="size-4 shrink-0 text-blue-600" />
          )}
          <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs text-muted-foreground">Contexte de travail</span>
            <span className="truncate text-sm font-medium">
              {inAgency ? user?.agenceName : "Plateforme"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher une agence" />
          <CommandList>
            <CommandEmpty>Aucune agence active trouvée.</CommandEmpty>
            <CommandGroup heading="Agences actives">
              {(options.data ?? []).map((agency) => (
                <CommandItem
                  key={agency.id}
                  value={`${agency.code} ${agency.nom} ${agency.ville ?? ""}`}
                  onSelect={() => void selectAgency(agency.id)}
                >
                  <Building2 className="size-4" />
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">{agency.nom}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {agency.code}{agency.ville ? ` · ${agency.ville}` : ""}
                    </span>
                  </span>
                  <Check className={cn("size-4", agency.id === user?.agenceId ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
            {inAgency ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => void returnToPlatform()}>
                    <LogOut className="size-4" />
                    Retour à la plateforme
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
