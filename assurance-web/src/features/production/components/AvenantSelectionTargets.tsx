import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  isDuplicataCode,
  isPrecisionCode,
  targetKey,
  type AmendmentTarget,
  type DuplicataAttestationDraft,
  type PrecisionDraft,
} from "../avenants/amendment-form";
import type { ReferenceOption } from "../types";
import { AttestationNumberInput } from "./AttestationNumberInput";

type Props = {
  movementCode: string;
  targets: AmendmentTarget[];
  selectedTargetIds: string[];
  setSelectedTargetIds: (value: string[] | ((current: string[]) => string[])) => void;
  precisionDrafts: Record<string, PrecisionDraft>;
  setPrecisionDrafts: (value: Record<string, PrecisionDraft> | ((current: Record<string, PrecisionDraft>) => Record<string, PrecisionDraft>)) => void;
  duplicataAttestationDrafts: Record<string, DuplicataAttestationDraft>;
  setDuplicataAttestationDrafts: (value: Record<string, DuplicataAttestationDraft> | ((current: Record<string, DuplicataAttestationDraft>) => Record<string, DuplicataAttestationDraft>)) => void;
  compagnieAssuranceId?: string | null;
  compagnies: ReferenceOption[];
  usages: ReferenceOption[];
};

export function AvenantSelectionTargets({
  movementCode,
  targets,
  selectedTargetIds,
  setSelectedTargetIds,
  precisionDrafts,
  setPrecisionDrafts,
  duplicataAttestationDrafts,
  setDuplicataAttestationDrafts,
  compagnieAssuranceId,
  compagnies,
  usages,
}: Props) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle>Cibles concernées</CardTitle>
        <CardDescription>{movementCode === "DUP_F" || movementCode === "DUP_M" ? "Sélectionnez les cibles du duplicata et renseignez leur nouvelle attestation." : "Sélectionnez les véhicules ou remorques concernés."}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", isPrecisionCode(movementCode) || isDuplicataCode(movementCode) ? "min-w-[980px]" : "min-w-[820px]")}>
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3" />
              <th className="px-3 py-3 text-left">Cible</th>
              <th className="px-3 py-3 text-left">Usage</th>
              {isPrecisionCode(movementCode) ? <th className="px-3 py-3 text-left">Nouvelle immatriculation / attestation</th> : null}
              {isDuplicataCode(movementCode) ? <th className="px-3 py-3 text-left">Nouvelle attestation</th> : null}
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const key = targetKey(target);
              const checked = selectedTargetIds.includes(key);
              return (
                <tr key={key} className={cn("border-t", checked && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                  <td className="px-3 py-2"><Checkbox checked={checked} onCheckedChange={(value) => toggleId(key, Boolean(value), setSelectedTargetIds)} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{target.label}</div>
                    <div className="text-xs text-muted-foreground">{target.sublabel || target.kind}</div>
                  </td>
                  <td className="px-3 py-2">{target.usage ?? "-"}</td>
                  {isPrecisionCode(movementCode) ? (
                    <td className="px-3 py-2">
                      <div className="grid gap-2 md:grid-cols-3">
                        <Input disabled={!checked} placeholder="Immatriculation" value={precisionDrafts[key]?.immatriculation ?? ""} onChange={(event) => updatePrecision(key, { immatriculation: event.target.value }, setPrecisionDrafts)} />
                        {target.kind === "vehicule" ? <Input disabled={!checked} placeholder="WW" value={precisionDrafts[key]?.immatriculationProvisoire ?? ""} onChange={(event) => updatePrecision(key, { immatriculationProvisoire: event.target.value }, setPrecisionDrafts)} /> : null}
                        <AttestationNumberInput
                          disabled={!checked}
                          required={checked && Boolean(target.consommeAttestation)}
                          value={precisionDrafts[key]?.numeroAttestation ?? ""}
                          onChange={(value) => updatePrecision(key, { numeroAttestation: value }, setPrecisionDrafts)}
                          compagnieAssuranceId={compagnieAssuranceId}
                          usageId={target.usageId}
                          compagnies={compagnies}
                          usages={usages}
                          numeroCourant={target.numeroAttestation}
                          placeholder="Attestation"
                        />
                      </div>
                    </td>
                  ) : null}
                  {isDuplicataCode(movementCode) ? (
                    <td className="px-3 py-2">
                      <AttestationNumberInput
                        disabled={!checked}
                        required={checked && Boolean(target.consommeAttestation)}
                        value={duplicataAttestationDrafts[key]?.numeroAttestation ?? ""}
                        onChange={(value) => updateDuplicataAttestation(key, { numeroAttestation: value }, setDuplicataAttestationDrafts)}
                        compagnieAssuranceId={compagnieAssuranceId}
                        usageId={target.usageId}
                        compagnies={compagnies}
                        usages={usages}
                        numeroCourant={target.numeroAttestation}
                        placeholder="Attestation duplicata"
                      />
                      {checked && !target.consommeAttestation ? (
                        <p className="mt-1 text-xs text-muted-foreground">Stock non contrôlé pour cet usage.</p>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function toggleId(id: string, checked: boolean, setter: Props["setSelectedTargetIds"]) {
  setter((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
}

function updatePrecision(key: string, patch: PrecisionDraft, setter: Props["setPrecisionDrafts"]) {
  setter((current) => ({ ...current, [key]: { ...(current[key] ?? {}), ...patch } }));
}

function updateDuplicataAttestation(
  key: string,
  patch: DuplicataAttestationDraft,
  setter: Props["setDuplicataAttestationDrafts"]
) {
  setter((current) => ({ ...current, [key]: { ...(current[key] ?? {}), ...patch } }));
}
