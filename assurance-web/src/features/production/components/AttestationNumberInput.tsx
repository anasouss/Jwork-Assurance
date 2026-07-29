import { useEffect, useId, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import type { AttestationNumeroValidation, ReferenceOption } from "../types";

type Props = {
  value?: string | null;
  onChange: (value: string) => void;
  compagnieAssuranceId?: string | null;
  usageId?: string | null;
  compagnies?: ReferenceOption[];
  usages?: ReferenceOption[];
  numeroCourant?: string | null;
  required?: boolean;
  controleStock?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function AttestationNumberInput({
  value,
  onChange,
  compagnieAssuranceId,
  usageId,
  compagnies = [],
  usages = [],
  numeroCourant,
  required = false,
  controleStock = true,
  disabled = false,
  placeholder = "Série attestation",
  className,
}: Props) {
  const datalistId = useId();
  const [validation, setValidation] = useState<AttestationNumeroValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const canonicalPrefix = useMemo(
    () => buildCanonicalPrefix(compagnies, usages, compagnieAssuranceId, usageId, validation),
    [compagnieAssuranceId, compagnies, usageId, usages, validation]
  );
  const rawValue = value ?? "";
  const displayValue = stripPrefix(rawValue, canonicalPrefix);
  const canValidate = Boolean(controleStock && compagnieAssuranceId && usageId);

  useEffect(() => {
    if (!canValidate || disabled) {
      setValidation(null);
      setLoading(false);
      return;
    }
    const numero = rawValue.trim();
    if (!numero) {
      setValidation(null);
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      productionApi.validateAttestationNumero({
        compagnieAssuranceId: compagnieAssuranceId ?? undefined,
        usageId: usageId ?? undefined,
        numero,
        numeroCourant: numeroCourant ?? undefined,
      })
        .then((result) => {
          if (cancelled) return;
          setValidation(result);
          setSuggestions(result.suggestions ?? []);
          if (result.disponible && result.numeroNormalise && result.numeroNormalise !== rawValue) {
            onChange(result.numeroNormalise);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setValidation({
            controleStockActif: true,
            validationRequise: true,
            disponible: false,
            message: error instanceof Error ? error.message : "Validation impossible",
            suggestions: [],
          });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canValidate, compagnieAssuranceId, disabled, numeroCourant, onChange, rawValue, usageId]);

  const valid = validation?.validationRequise ? validation.disponible : true;
  const message = validation?.message;
  const prefix = canonicalPrefix || [validation?.prefixe, validation?.codeUsageStock].filter(Boolean).join("");

  const commitDisplayValue = (nextValue: string) => {
    const compact = nextValue.replace(/\s+/g, "").toUpperCase();
    if (!compact) {
      onChange("");
      return;
    }
    if (prefix && compact.startsWith(prefix)) {
      onChange(compact);
      return;
    }
    onChange(prefix ? `${prefix}${compact}` : compact);
  };

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex min-w-0 gap-2">
        {prefix ? (
          <div className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-slate-100 px-3 text-sm font-semibold text-slate-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            {prefix}
          </div>
        ) : null}
        <div className="relative min-w-0 flex-1">
          <Input
            value={displayValue}
            onChange={(event) => commitDisplayValue(event.target.value)}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            aria-invalid={validation?.validationRequise && !validation.disponible}
            list={suggestions.length ? datalistId : undefined}
            className="pr-9"
          />
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            {!loading && validation?.validationRequise && validation.disponible ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
            {!loading && validation?.validationRequise && !validation.disponible ? <AlertCircle className="size-4 text-red-600" /> : null}
          </div>
          {suggestions.length ? (
            <datalist id={datalistId}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={stripPrefix(suggestion, prefix)} />
              ))}
            </datalist>
          ) : null}
        </div>
      </div>
      {message ? (
        <span className={cn("text-xs", valid ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>{message}</span>
      ) : null}
      {controleStock && !canValidate ? (
        <span className="text-xs text-muted-foreground">Sélectionnez la compagnie et l'usage pour contrôler le stock.</span>
      ) : null}
      {!controleStock ? (
        <span className="text-xs text-muted-foreground">Terme compagnie : contrôle du stock désactivé.</span>
      ) : null}
    </div>
  );
}

function buildCanonicalPrefix(
  compagnies: ReferenceOption[],
  usages: ReferenceOption[],
  compagnieAssuranceId?: string | null,
  usageId?: string | null,
  validation?: AttestationNumeroValidation | null
) {
  const prefixe = stringValue(compagnies.find((item) => item.id === compagnieAssuranceId)?.prefixeAttestation)
    || stringValue(validation?.prefixe);
  const codeUsageStock = stringValue(usages.find((item) => item.id === usageId)?.groupeUsageAttestationCode)
    || stringValue(validation?.codeUsageStock);
  return normalizeToken(prefixe) + normalizeToken(codeUsageStock);
}

function stripPrefix(value: string, prefix: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  const normalizedPrefix = normalizeToken(prefix);
  if (normalizedPrefix && compact.startsWith(normalizedPrefix)) {
    return compact.slice(normalizedPrefix.length);
  }
  return compact;
}

function normalizeToken(value?: string | null) {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
