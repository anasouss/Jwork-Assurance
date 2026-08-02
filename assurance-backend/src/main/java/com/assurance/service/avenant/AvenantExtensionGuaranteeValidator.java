package com.assurance.service.avenant;

import com.assurance.entity.BaseEntity;
import com.assurance.entity.ContratGarantie;
import com.assurance.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Component
public class AvenantExtensionGuaranteeValidator {

    public void validatePreservesExisting(
            List<ContratGarantie> existingGuarantees,
            List<ContratGarantie> requestedGuarantees
    ) {
        List<ContratGarantie> requested = safe(requestedGuarantees);
        for (ContratGarantie existing : safe(existingGuarantees)) {
            ContratGarantie matching = requested.stream()
                    .filter(candidate -> sameTargetGuarantee(existing, candidate))
                    .findFirst()
                    .orElseThrow(() -> new BadRequestException(
                            "Une extension de garanties ne peut pas supprimer une garantie existante"
                    ));
            if (!sameConfiguration(existing, matching)) {
                throw new BadRequestException(
                        "Une extension de garanties ne peut pas modifier une garantie existante"
                );
            }
        }
    }

    private boolean sameTargetGuarantee(ContratGarantie left, ContratGarantie right) {
        return Objects.equals(id(left.getGarantie()), id(right.getGarantie()))
                && Objects.equals(id(left.getVehicule()), id(right.getVehicule()))
                && Objects.equals(id(left.getRemorque()), id(right.getRemorque()))
                && Objects.equals(id(left.getClient()), id(right.getClient()));
    }

    private boolean sameConfiguration(ContratGarantie left, ContratGarantie right) {
        return Objects.equals(id(left.getLigneGrilleTarifaire()), id(right.getLigneGrilleTarifaire()))
                && Objects.equals(left.getModeSelectionne(), right.getModeSelectionne())
                && Objects.equals(left.getSourceValeurSelectionnee(), right.getSourceValeurSelectionnee())
                && Objects.equals(id(left.getFormuleGarantiePersonne()), id(right.getFormuleGarantiePersonne()))
                && decimalEquals(left.getValeurVenale(), right.getValeurVenale())
                && decimalEquals(left.getValeurNeuf(), right.getValeurNeuf())
                && decimalEquals(left.getValeurGlace(), right.getValeurGlace())
                && Objects.equals(left.getFormule(), right.getFormule())
                && decimalEquals(left.getMontantDeces(), right.getMontantDeces())
                && decimalEquals(left.getMontantInvalidite(), right.getMontantInvalidite())
                && decimalEquals(left.getMontantFraisMedicaux(), right.getMontantFraisMedicaux())
                && decimalEquals(left.getMontantFraisHospitalisation(), right.getMontantFraisHospitalisation())
                && decimalEquals(left.getMontantFraisFuneraires(), right.getMontantFraisFuneraires())
                && decimalEquals(left.getMontantFraisChirurgie(), right.getMontantFraisChirurgie())
                && decimalEquals(left.getAccessoire(), right.getAccessoire())
                && decimalEquals(left.getCapital(), right.getCapital())
                && decimalEquals(left.getTaux(), right.getTaux())
                && decimalEquals(left.getPrime(), right.getPrime())
                && decimalEquals(left.getTauxFranchise(), right.getTauxFranchise())
                && decimalEquals(left.getFranchiseMinimale(), right.getFranchiseMinimale());
    }

    private boolean decimalEquals(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) {
            return left == right;
        }
        return left.compareTo(right) == 0;
    }

    private Long id(BaseEntity entity) {
        return entity == null ? null : entity.getId();
    }

    private List<ContratGarantie> safe(List<ContratGarantie> guarantees) {
        return guarantees == null ? List.of() : guarantees;
    }
}
