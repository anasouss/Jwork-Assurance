package com.assurance.service;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.assurance.entity.Contrat;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AvenantManualQuittanceServiceTest {

    private final AvenantManualQuittanceService service = new AvenantManualQuittanceService();
    private final Contrat contrat = Contrat.builder().typeContrat(TypeContrat.PARTICULIER).build();

    @Test
    void calculatesEnteredDifferenceWithoutFurtherProration() {
        var input = line("100.125", "14.02");
        var result = service.calculate(contrat, request("EXG_M", input));
        assertThat(result.primeNette()).isEqualByComparingTo("100.13");
        assertThat(result.primeTotale()).isEqualByComparingTo("114.15");
        assertThat(result.lignes()).hasSize(2);
        assertThat(result.lignes().get(1).categorie()).isEqualTo(CategorieQuittance.TOTAL);
    }

    @Test
    void requiresManualLinesForParticulierGuaranteeAmendments() {
        var request = new AvenantRequest();
        request.setCodeTypeMouvement("EXG_M");
        assertThatThrownBy(() -> service.calculate(contrat, request))
                .isInstanceOf(BadRequestException.class);
        contrat.setTypeContrat(TypeContrat.FLOTTE);
        request.setCodeTypeMouvement("MOG_F");
        assertThat(service.calculate(contrat, request)).isNull();
    }

    @Test
    void rejectsDuplicateCategoriesAndInconsistentTotal() {
        var input = line("100", "14");
        assertThatThrownBy(() -> service.calculate(contrat, request("EXG_M", input, input)))
                .isInstanceOf(BadRequestException.class);
        input.setPrimeTotale(new BigDecimal("999"));
        assertThatThrownBy(() -> service.calculate(contrat, request("EXG_M", input)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAssistanceAndUnsupportedContracts() {
        var input = line("100", "14");
        input.setCategorie(CategorieQuittance.ASSISTANCE);
        assertThatThrownBy(() -> service.calculate(contrat, request("EXG_M", input)))
                .isInstanceOf(BadRequestException.class);
        contrat.setTypeContrat(TypeContrat.FLOTTE);
        assertThatThrownBy(() -> service.calculate(contrat, request("MOG_M", line("100", "14"))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void allowsRefundForModificationButNotExtension() {
        var input = line("-100", "-14");
        assertThat(service.calculate(contrat, request("MOG_M", input)).primeTotale())
                .isEqualByComparingTo("-114");
        assertThatThrownBy(() -> service.calculate(contrat, request("EXG_M", input)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsBlankQuittanceButAcceptsExplicitZero() {
        var blank = new CreateContratRequest.QuittanceInput();
        blank.setCategorie(CategorieQuittance.AUTOMOBILE);
        assertThatThrownBy(() -> service.calculate(contrat, request("EXG_M", blank)))
                .isInstanceOf(BadRequestException.class);
        var input = line("0", "0");
        assertThat(service.calculate(contrat, request("EXG_M", input)).primeTotale()).isZero();
    }

    private AvenantRequest request(String code, CreateContratRequest.QuittanceInput... lines) {
        var request = new AvenantRequest();
        request.setCodeTypeMouvement(code);
        request.setQuittances(List.of(lines));
        return request;
    }

    private CreateContratRequest.QuittanceInput line(String net, String tax) {
        var input = new CreateContratRequest.QuittanceInput();
        input.setCategorie(CategorieQuittance.AUTOMOBILE);
        input.setPrimeNette(new BigDecimal(net));
        input.setTaxe(new BigDecimal(tax));
        return input;
    }
}
