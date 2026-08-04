package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.RegleFiscale;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeImpactMouvement;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuittanceCalculServiceTest {

    private final QuittanceCalculService service = new QuittanceCalculService(null);

    @Test
    void fiscalRulesUseTheExplicitMovementEffectiveDate() {
        RegleFiscaleQuittanceEngine engine = mock(RegleFiscaleQuittanceEngine.class);
        QuittanceCalculService fiscalService = new QuittanceCalculService(engine);
        Contrat contrat = new Contrat();
        LocalDate movementDate = LocalDate.of(2027, 1, 15);
        RegleFiscaleQuittanceEngine.Ligne line = new RegleFiscaleQuittanceEngine.Ligne(
                CategorieQuittance.AUTOMOBILE, 10, new BigDecimal("100"), new BigDecimal("15.50"),
                new BigDecimal("1.50"), BigDecimal.ZERO, new BigDecimal("17"), new BigDecimal("134"));
        when(engine.calculer(eq(contrat), any(), eq(1), eq(movementDate)))
                .thenReturn(new RegleFiscaleQuittanceEngine.Calcul(List.of(line), List.of()));

        QuittanceCalculService.Resultat result = fiscalService.calculer(
                contrat, null, List.of(), 1, movementDate);

        assertThat(result.primeTotale()).isEqualByComparingTo("134.00");
        verify(engine).calculer(eq(contrat), any(), eq(1), eq(movementDate));
    }

    @Test
    void returnPremiumSnapshotsOnlyTheEvcatAmountActuallyReturned() {
        RegleFiscaleQuittanceEngine engine = mock(RegleFiscaleQuittanceEngine.class);
        QuittanceCalculService fiscalService = new QuittanceCalculService(engine);
        Contrat contrat = new Contrat();
        LocalDate movementDate = LocalDate.of(2027, 2, 1);
        RegleFiscale taxRule = rule("TAX", NatureRegleFiscale.TAXE_ASSURANCE, CategorieQuittance.AUTOMOBILE);
        RegleFiscale evcatRule = rule("EVCAT", NatureRegleFiscale.EVCAT, CategorieQuittance.EVCAT);
        List<RegleFiscaleQuittanceEngine.Ligne> lines = List.of(
                new RegleFiscaleQuittanceEngine.Ligne(CategorieQuittance.AUTOMOBILE, 10,
                        new BigDecimal("100"), new BigDecimal("15"), new BigDecimal("1.5"),
                        BigDecimal.ZERO, new BigDecimal("17"), new BigDecimal("133.5")),
                new RegleFiscaleQuittanceEngine.Ligne(CategorieQuittance.EVCAT, 30,
                        new BigDecimal("3.5"), new BigDecimal("0.49"), new BigDecimal("0.0525"),
                        BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("4.0425"))
        );
        List<RegleFiscaleQuittanceEngine.Application> applications = List.of(
                new RegleFiscaleQuittanceEngine.Application(taxRule, movementDate, 1L, 2L, null,
                        new BigDecimal("100"), new BigDecimal("15")),
                new RegleFiscaleQuittanceEngine.Application(evcatRule, movementDate, 1L, 2L, null,
                        new BigDecimal("100"), new BigDecimal("3.5"))
        );
        when(engine.calculer(eq(contrat), any(), eq(1), eq(movementDate)))
                .thenReturn(new RegleFiscaleQuittanceEngine.Calcul(lines, applications));
        TypeMouvementContrat returnType = TypeMouvementContrat.builder()
                .typeImpact(TypeImpactMouvement.RETOUR_PRIME)
                .build();

        QuittanceCalculService.Resultat result = fiscalService.calculer(
                contrat, returnType, List.of(), 1, movementDate);

        assertThat(result.taxe()).isZero();
        assertThat(result.taxeParafiscale()).isZero();
        assertThat(result.cnpac()).isZero();
        assertThat(result.applications()).singleElement().satisfies(application -> {
            assertThat(application.regle().getNature()).isEqualTo(NatureRegleFiscale.EVCAT);
            assertThat(application.montantCalcule()).isEqualByComparingTo("-3.5");
        });
    }

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

    private RegleFiscale rule(String code, NatureRegleFiscale nature, CategorieQuittance category) {
        return RegleFiscale.builder()
                .code(code)
                .libelle(code)
                .nature(nature)
                .modeCalcul(ModeCalculRegleFiscale.TAUX)
                .baseCalcul(BaseCalculRegleFiscale.PRIME_GARANTIE)
                .categorieResultat(category)
                .valeur(new BigDecimal("0.1"))
                .dateDebut(LocalDate.of(2000, 1, 1))
                .build();
    }

    private BigDecimal sum(
            List<QuittanceCalculService.Ligne> lines,
            Function<QuittanceCalculService.Ligne, BigDecimal> extractor
    ) {
        return lines.stream().map(extractor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
