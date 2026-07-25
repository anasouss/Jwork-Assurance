import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConventionContratForm } from "../contrat-creation/ConventionContratForm";
import { FlotteContratForm } from "../contrat-creation/FlotteContratForm";
import { ParticulierContratForm } from "../contrat-creation/ParticulierContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";
import type { TypeContrat } from "../types";

export default function ContratCreationPage() {
  const [typeContrat, setTypeContrat] = useState<TypeContrat>("PARTICULIER");
  const form = useContratCreationForm(typeContrat);

  return (
    <div className="grid gap-4">
      <Tabs value={typeContrat} onValueChange={(value) => setTypeContrat(value as TypeContrat)}>
        <TabsList>
          <TabsTrigger value="PARTICULIER">Particulier</TabsTrigger>
          <TabsTrigger value="CONVENTION">Convention</TabsTrigger>
          <TabsTrigger value="FLOTTE">Flotte</TabsTrigger>
        </TabsList>
        <TabsContent value="PARTICULIER" className="mt-4">
          <ParticulierContratForm form={form} />
        </TabsContent>
        <TabsContent value="CONVENTION" className="mt-4">
          <ConventionContratForm form={form} />
        </TabsContent>
        <TabsContent value="FLOTTE" className="mt-4">
          <FlotteContratForm form={form} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
