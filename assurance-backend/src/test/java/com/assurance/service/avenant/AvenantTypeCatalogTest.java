package com.assurance.service.avenant;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AvenantTypeCatalogTest {

    private final AvenantTypeCatalog catalog = new AvenantTypeCatalog();

    @Test
    void exposesEverySeededAvenantType() {
        assertThat(List.of(
                "EXG_M", "MOG_M", "CHV_M", "EXR_M", "PRI_M", "DUP_M", "PRO_M", "RES_M", "RCH_M", "ANN_M",
                "INC_F", "MOG_F", "RET_F", "EXR_F", "RES_F", "RCH_F", "PRI_F", "DUP_F"
        )).allSatisfy(code -> assertThat(catalog.requireFamily(code)).isNotNull());
    }

    @Test
    void duplicataAllowsTargetsWhoseUsageDoesNotConsumeAttestations() {
        AvenantRequest request = request("DUP_M");
        request.setVehiculeIds(List.of(12L));

        assertThatCode(() -> catalog.validateCommand("DUP_M", request)).doesNotThrowAnyException();
    }

    @Test
    void changementVehiculeRequiresExactlyOneVehicleAndGuarantees() {
        AvenantRequest request = request("CHV_M");
        request.setVehicules(List.of(new CreateContratRequest.VehiculeInput()));
        request.setGaranties(List.of(new CreateContratRequest.GarantieInput()));

        assertThatCode(() -> catalog.validateCommand("CHV_M", request)).doesNotThrowAnyException();

        request.setVehicules(List.of());
        assertThatThrownBy(() -> catalog.validateCommand("CHV_M", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("exactement un vehicule");
    }

    @Test
    void rejectsUnknownMovementType() {
        assertThatThrownBy(() -> catalog.requireFamily("UNKNOWN"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("n'est pas pris en charge");
    }

    private AvenantRequest request(String code) {
        AvenantRequest request = new AvenantRequest();
        request.setCodeTypeMouvement(code);
        request.setDateEffet(LocalDate.of(2026, 8, 1));
        return request;
    }
}
