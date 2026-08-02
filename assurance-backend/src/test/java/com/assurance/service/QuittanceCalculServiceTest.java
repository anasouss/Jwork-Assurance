package com.assurance.service;

import com.assurance.enums.CategorieQuittance;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

class QuittanceCalculServiceTest {

    private final QuittanceCalculService service = new QuittanceCalculService(null);

    @Test
    void changementVehiculeKeepsNegativeTaxClearsTpfAndChargesNewCnpac() {
        QuittanceCalculService.Resultat apres = result(
                line(CategorieQuittance.AUTOMOBILE, "100", "10", "2", "17", "129"),
                line(CategorieQuittance.EVCAT, "10", "1", "0.2", "0", "11.2")
        );
        QuittanceCalculService.Resultat avant = result(
                line(CategorieQuittance.AUTOMOBILE, "150", "15", "3", "17", "185"),
                line(CategorieQuittance.EVCAT, "15", "1.5", "0.3", "0", "16.8")
        );

        QuittanceCalculService.Resultat difference = service.differenceChangementVehicule(apres, avant);

        assertThat(difference.primeNette()).isEqualByComparingTo("-55.00");
        assertThat(difference.taxe()).isEqualByComparingTo("-5.50");
        assertThat(difference.taxeParafiscale()).isEqualByComparingTo("0.00");
        assertThat(difference.cnpac()).isEqualByComparingTo("17.00");
        assertThat(difference.primeTotale()).isEqualByComparingTo("-43.50");
    }

    @Test
    void regularNegativeDifferenceDoesNotRefundTaxesOrCnpac() {
        QuittanceCalculService.Resultat apres = result(
                line(CategorieQuittance.AUTOMOBILE, "100", "10", "2", "17", "129")
        );
        QuittanceCalculService.Resultat avant = result(
                line(CategorieQuittance.AUTOMOBILE, "150", "15", "3", "17", "185")
        );

        QuittanceCalculService.Resultat difference = service.difference(apres, avant);

        assertThat(difference.primeNette()).isEqualByComparingTo("-50.00");
        assertThat(difference.taxe()).isEqualByComparingTo("0.00");
        assertThat(difference.taxeParafiscale()).isEqualByComparingTo("0.00");
        assertThat(difference.cnpac()).isEqualByComparingTo("0.00");
        assertThat(difference.primeTotale()).isEqualByComparingTo("-50.00");
    }

    @Test
    void guaranteeDifferenceNeverChargesCnpac() {
        QuittanceCalculService.Resultat apres = result(
                line(CategorieQuittance.AUTOMOBILE, "120", "12", "2.4", "34", "168.4")
        );
        QuittanceCalculService.Resultat avant = result(
                line(CategorieQuittance.AUTOMOBILE, "100", "10", "2", "17", "129")
        );

        QuittanceCalculService.Resultat difference = service.differenceGaranties(apres, avant);

        assertThat(difference.primeNette()).isEqualByComparingTo("20.00");
        assertThat(difference.taxe()).isEqualByComparingTo("2.00");
        assertThat(difference.taxeParafiscale()).isEqualByComparingTo("0.40");
        assertThat(difference.cnpac()).isEqualByComparingTo("0.00");
        assertThat(difference.primeTotale()).isEqualByComparingTo("22.40");
    }

    private QuittanceCalculService.Resultat result(QuittanceCalculService.Ligne... lines) {
        List<QuittanceCalculService.Ligne> values = List.of(lines);
        return new QuittanceCalculService.Resultat(
                values,
                sum(values, QuittanceCalculService.Ligne::primeNette),
                sum(values, QuittanceCalculService.Ligne::taxe),
                sum(values, QuittanceCalculService.Ligne::taxeParafiscale),
                sum(values, QuittanceCalculService.Ligne::accessoire),
                sum(values, QuittanceCalculService.Ligne::cnpac),
                sum(values, QuittanceCalculService.Ligne::primeTotale)
        );
    }

    private QuittanceCalculService.Ligne line(
            CategorieQuittance category,
            String net,
            String tax,
            String tpf,
            String cnpac,
            String total
    ) {
        return new QuittanceCalculService.Ligne(
                category,
                category == CategorieQuittance.AUTOMOBILE ? 10 : 30,
                false,
                new BigDecimal(net),
                new BigDecimal(tax),
                new BigDecimal(tpf),
                BigDecimal.ZERO,
                new BigDecimal(cnpac),
                new BigDecimal(total)
        );
    }

    private BigDecimal sum(
            List<QuittanceCalculService.Ligne> lines,
            Function<QuittanceCalculService.Ligne, BigDecimal> extractor
    ) {
        return lines.stream().map(extractor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
