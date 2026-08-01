package com.assurance.seeder;

import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeImpactMouvement;
import com.assurance.repository.TypeMouvementContratRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;

@Component
@Order(1)
@RequiredArgsConstructor
public class TypeMouvementContratSeeder implements CommandLineRunner {

    private static final List<Definition> DEFINITIONS = List.of(
            definition("AN", "Affaire nouvelle", CategorieMouvementContrat.AFFAIRE_NOUVELLE,
                    TypeImpactMouvement.NORMAL, allContracts(), false, false, true, true,
                    false, true, true, true, true, false, false, 10),
            definition("REN", "Renouvellement", CategorieMouvementContrat.RENOUVELLEMENT,
                    TypeImpactMouvement.NORMAL, allContracts(), true, true, true, true,
                    false, true, true, true, true, false, true, 20),

            definition("EXG_M", "Extension garanties", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, monoContracts(), true, true, false, false,
                    false, true, true, false, false, false, false, 110),
            definition("MOG_M", "Modification garanties", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, monoContracts(), true, true, false, false,
                    false, true, true, false, false, false, false, 120),
            definition("CHV_M", "Changement vehicule", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, monoContracts(), true, true, true, false,
                    false, true, true, true, true, false, false, 130),
            definition("EXR_M", "Extension remorque", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, monoContracts(), true, false, false, true,
                    false, true, true, true, true, false, false, 140),
            definition("PRI_M", "Precision immatriculation", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.CNPAC_SEUL, monoContracts(), false, false, true, false,
                    true, true, false, false, true, false, false, 150),
            definition("DUP_M", "Duplicata", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.CNPAC_SEUL, monoContracts(), false, false, false, false,
                    true, true, false, false, true, false, false, 160),
            definition("PRO_M", "Provisoire", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.NORMAL, monoContracts(), true, true, true, false,
                    false, true, true, true, true, false, false, 170),
            definition("RES_M", "Resiliation", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.RETOUR_PRIME, monoContracts(), false, false, false, false,
                    false, true, false, false, false, true, false, 180),
            definition("RCH_M", "Resiliation a l'echeance", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.ZERO, monoContracts(), false, false, false, false,
                    false, true, false, false, false, true, false, 190),
            definition("ANN_M", "Annulation", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.RETOUR_PRIME, monoContracts(), false, false, false, false,
                    false, true, false, false, false, true, false, 200),

            definition("INC_F", "Incorporation flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, fleetOnly(), true, true, true, true,
                    false, true, true, true, true, false, false, 310),
            definition("MOG_F", "Modification garanties flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, fleetOnly(), true, true, true, true,
                    false, true, true, false, false, false, false, 315),
            definition("RET_F", "Retrait flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.RETOUR_PRIME, fleetOnly(), true, false, true, true,
                    false, true, false, false, false, false, false, 320),
            definition("EXR_F", "Extension remorque flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.DIFFERENTIEL, fleetOnly(), false, false, false, true,
                    false, true, false, false, false, false, false, 325),
            definition("RES_F", "Resiliation flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.RETOUR_PRIME, fleetOnly(), false, false, false, false,
                    false, true, false, false, false, true, false, 330),
            definition("RCH_F", "Resiliation a l'echeance flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.ZERO, fleetOnly(), false, false, false, false,
                    false, true, false, false, false, false, false, 335),
            definition("PRI_F", "Precision immatriculation flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.CNPAC_SEUL, fleetOnly(), false, false, true, false,
                    true, true, false, false, true, false, false, 340),
            definition("DUP_F", "Duplicata flotte", CategorieMouvementContrat.AVENANT,
                    TypeImpactMouvement.CNPAC_SEUL, fleetOnly(), false, false, false, false,
                    true, true, false, false, true, false, false, 350)
    );

    private final TypeMouvementContratRepository repository;

    @Override
    @Transactional
    public void run(String... args) {
        DEFINITIONS.forEach(this::upsert);
    }

    private void upsert(Definition definition) {
        TypeMouvementContrat movement = repository.findByCodeIgnoreCase(definition.code())
                .orElseGet(() -> TypeMouvementContrat.builder().code(definition.code()).build());
        movement.setLibelle(definition.label());
        movement.setCategorie(definition.category());
        movement.setTypeImpact(definition.impact());
        if (movement.getTypesContratAutorises() == null) {
            movement.setTypesContratAutorises(new LinkedHashSet<>());
        } else {
            movement.getTypesContratAutorises().clear();
        }
        movement.getTypesContratAutorises().addAll(definition.contractTypes());
        movement.setModifieGaranties(definition.changesGuarantees());
        movement.setGarantiesEditables(definition.guaranteesEditable());
        movement.setModifieVehicule(definition.changesVehicle());
        movement.setModifieRemorque(definition.changesTrailer());
        movement.setCnpacSeul(definition.cnpacOnly());
        movement.setGenereQuittance(definition.generatesReceipt());
        movement.setAutoriseAssistance(definition.allowsAssistance());
        movement.setAutoriseCarteVerte(definition.allowsGreenCard());
        movement.setConsommeAttestation(definition.consumesCertificate());
        movement.setClotureContrat(definition.closesContract());
        movement.setRenouvelleContrat(definition.renewsContract());
        movement.setOrdreAffichage(definition.displayOrder());
        movement.setActif(true);
        repository.save(movement);
    }

    private static List<TypeContrat> allContracts() {
        return List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION, TypeContrat.FLOTTE);
    }

    private static List<TypeContrat> monoContracts() {
        return List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION);
    }

    private static List<TypeContrat> fleetOnly() {
        return List.of(TypeContrat.FLOTTE);
    }

    private static Definition definition(
            String code,
            String label,
            CategorieMouvementContrat category,
            TypeImpactMouvement impact,
            List<TypeContrat> contractTypes,
            boolean changesGuarantees,
            boolean guaranteesEditable,
            boolean changesVehicle,
            boolean changesTrailer,
            boolean cnpacOnly,
            boolean generatesReceipt,
            boolean allowsAssistance,
            boolean allowsGreenCard,
            boolean consumesCertificate,
            boolean closesContract,
            boolean renewsContract,
            int displayOrder
    ) {
        return new Definition(code, label, category, impact, contractTypes, changesGuarantees,
                guaranteesEditable, changesVehicle, changesTrailer, cnpacOnly, generatesReceipt,
                allowsAssistance, allowsGreenCard, consumesCertificate, closesContract, renewsContract,
                displayOrder);
    }

    private record Definition(
            String code,
            String label,
            CategorieMouvementContrat category,
            TypeImpactMouvement impact,
            List<TypeContrat> contractTypes,
            boolean changesGuarantees,
            boolean guaranteesEditable,
            boolean changesVehicle,
            boolean changesTrailer,
            boolean cnpacOnly,
            boolean generatesReceipt,
            boolean allowsAssistance,
            boolean allowsGreenCard,
            boolean consumesCertificate,
            boolean closesContract,
            boolean renewsContract,
            int displayOrder
    ) {
    }
}
