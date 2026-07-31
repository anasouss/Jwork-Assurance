import type { ReactNode } from "react";
import {
  ContractTargetsSection,
  type ContractTargetsSectionProps,
} from "../contrat-creation/ContractTargetsSection";

type FixedCapability =
  | "allowTargetChanges"
  | "guaranteeLayout"
  | "garantiesExtraAction"
  | "maxRemorques"
  | "remorqueSectionTitle"
  | "showVehicleSection"
  | "showRemorqueSection"
  | "singleRemorqueLayout"
  | "singleVehicleLayout"
  | "vehicleSectionTitle";

type SingleContractAvenantProps = Omit<ContractTargetsSectionProps, FixedCapability> & {
  targetMode: "vehicule" | "remorque" | "existing";
};

export function ParticulierAvenantTargetsSection({
  targetMode,
  ...props
}: SingleContractAvenantProps) {
  const showRemorque = targetMode === "remorque" || (targetMode === "existing" && props.remorques.length > 0);
  return (
    <ContractTargetsSection
      {...props}
      allowTargetChanges={false}
      guaranteeLayout="particulier"
      maxRemorques={1}
      pricingMode={props.pricingMode === "MANUELLE_AVEC_PRIME_NETTE" ? "MANUELLE_AVEC_PRIME_NETTE" : "MANUELLE"}
      remorqueSectionTitle="Remorque"
      showAssistance={false}
      showRemorqueSection={showRemorque}
      showVehicleSection={targetMode !== "remorque"}
      singleRemorqueLayout
      singleVehicleLayout
      vehicleSectionTitle="Véhicule"
    />
  );
}

export function ConventionAvenantTargetsSection({
  guaranteesAction,
  targetMode,
  ...props
}: SingleContractAvenantProps & { guaranteesAction?: ReactNode }) {
  const showRemorque = targetMode === "remorque" || (targetMode === "existing" && props.remorques.length > 0);
  return (
    <ContractTargetsSection
      {...props}
      allowTargetChanges={false}
      guaranteeLayout="tariff"
      garantiesExtraAction={guaranteesAction}
      maxRemorques={1}
      remorqueSectionTitle="Remorque"
      showRemorqueSection={showRemorque}
      showVehicleSection={targetMode !== "remorque"}
      singleRemorqueLayout
      singleVehicleLayout
      vehicleSectionTitle="Véhicule"
    />
  );
}

export type FlotteAvenantTargetsSectionProps = Omit<
  ContractTargetsSectionProps,
  | "guaranteeLayout"
  | "remorqueSectionTitle"
  | "showRemorqueSection"
  | "showVehicleSection"
  | "singleRemorqueLayout"
  | "singleVehicleLayout"
  | "vehicleSectionTitle"
>;

export function FlotteAvenantTargetsSection(props: FlotteAvenantTargetsSectionProps) {
  return (
    <ContractTargetsSection
      {...props}
      guaranteeLayout="tariff"
      showRemorqueSection
      showVehicleSection
      remorqueSectionTitle="Remorques"
      vehicleSectionTitle="Véhicules"
    />
  );
}

type AvenantTargetsSectionProps = Omit<
  ContractTargetsSectionProps,
  FixedCapability
> & Pick<
  ContractTargetsSectionProps,
  "allowTargetChanges" | "maxRemorques"
> & {
  contractType?: string | null;
  guaranteesAction?: ReactNode;
  targetMode: "vehicule" | "remorque" | "existing";
};

export function AvenantTargetsSection({
  contractType,
  guaranteesAction,
  targetMode,
  ...props
}: AvenantTargetsSectionProps) {
  if (contractType === "PARTICULIER") {
    const {
      allowTargetChanges: _allowTargetChanges,
      maxRemorques: _maxRemorques,
      ...singleVehicleProps
    } = props;
    void _allowTargetChanges;
    void _maxRemorques;
    return <ParticulierAvenantTargetsSection {...singleVehicleProps} targetMode={targetMode} />;
  }

  if (contractType === "CONVENTION") {
    const {
      allowTargetChanges: _allowTargetChanges,
      maxRemorques: _maxRemorques,
      ...singleVehicleProps
    } = props;
    void _allowTargetChanges;
    void _maxRemorques;
    return (
      <ConventionAvenantTargetsSection
        {...singleVehicleProps}
        guaranteesAction={guaranteesAction}
        targetMode={targetMode}
      />
    );
  }

  return (
    <FlotteAvenantTargetsSection
      {...props}
      garantiesExtraAction={guaranteesAction}
    />
  );
}
