import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { clientApi } from "../api/clients";
import type { VehiculeResponse } from "../types";

type LookupStatus = "idle" | "loading" | "found" | "new" | "error";

type LookupState = {
  status: LookupStatus;
  message?: string;
};

export function VehicleRegistrationLookupInput({
  value,
  onValueChange,
  onVehicleFound,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onVehicleFound: (vehicle: VehiculeResponse) => void;
}) {
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const requestSequence = useRef(0);
  const lastCompletedValue = useRef<string | null>(null);

  useEffect(() => () => {
    requestSequence.current += 1;
  }, []);

  const handleChange = (nextValue: string) => {
    requestSequence.current += 1;
    lastCompletedValue.current = null;
    setLookup({ status: "idle" });
    onValueChange(nextValue);
  };

  const handleBlur = async () => {
    const registration = value.trim();
    if (registration.length < 3 || lastCompletedValue.current === registration) {
      return;
    }

    const requestId = ++requestSequence.current;
    setLookup({ status: "loading", message: "Recherche du véhicule..." });

    try {
      const found = await clientApi.searchVehicule({ immatriculation: registration });
      if (requestId !== requestSequence.current) {
        return;
      }

      lastCompletedValue.current = registration;
      if (found) {
        onVehicleFound(found);
        setLookup({ status: "found", message: "Véhicule existant chargé." });
      } else {
        setLookup({ status: "new", message: "Nouveau véhicule : aucune fiche trouvée." });
      }
    } catch {
      if (requestId === requestSequence.current) {
        setLookup({ status: "error", message: "Recherche véhicule indisponible." });
      }
    }
  };

  const tone = lookup.status === "found"
    ? "text-emerald-700 dark:text-emerald-400"
    : lookup.status === "new"
      ? "text-slate-500"
      : lookup.status === "error"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <>
      <Input
        value={value}
        autoComplete="off"
        onBlur={() => void handleBlur()}
        onChange={(event) => handleChange(event.target.value)}
      />
      {lookup.status !== "idle" ? (
        <span role="status" aria-live="polite" className={`flex items-center gap-1 text-xs ${tone}`}>
          {lookup.status === "loading" ? <Loader2 className="size-3 animate-spin" /> : null}
          {lookup.message}
        </span>
      ) : null}
    </>
  );
}
