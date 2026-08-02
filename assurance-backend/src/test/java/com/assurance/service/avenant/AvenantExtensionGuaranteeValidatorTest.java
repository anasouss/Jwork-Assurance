package com.assurance.service.avenant;

import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.Vehicule;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AvenantExtensionGuaranteeValidatorTest {

    private final AvenantExtensionGuaranteeValidator validator = new AvenantExtensionGuaranteeValidator();

    @Test
    void acceptsExistingGuaranteesUnchangedAndNewGuarantees() {
        ContratGarantie rc = guarantee(1L, 10L, "100");
        ContratGarantie sameRc = guarantee(1L, 10L, "100.00");
        ContratGarantie newGuarantee = guarantee(2L, 10L, "25");

        assertThatCode(() -> validator.validatePreservesExisting(
                List.of(rc),
                List.of(sameRc, newGuarantee)
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsRemovedExistingGuarantee() {
        assertThatThrownBy(() -> validator.validatePreservesExisting(
                List.of(guarantee(1L, 10L, "100")),
                List.of(guarantee(2L, 10L, "25"))
        ))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("supprimer");
    }

    @Test
    void rejectsChangedExistingGuarantee() {
        assertThatThrownBy(() -> validator.validatePreservesExisting(
                List.of(guarantee(1L, 10L, "100")),
                List.of(guarantee(1L, 10L, "90"))
        ))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("modifier");
    }

    private ContratGarantie guarantee(Long guaranteeId, Long vehicleId, String prime) {
        Garantie guarantee = new Garantie();
        guarantee.setId(guaranteeId);
        Vehicule vehicle = new Vehicule();
        vehicle.setId(vehicleId);
        return ContratGarantie.builder()
                .garantie(guarantee)
                .vehicule(vehicle)
                .modeSelectionne(ModeTarificationGarantie.TAUX)
                .prime(new BigDecimal(prime))
                .build();
    }
}
