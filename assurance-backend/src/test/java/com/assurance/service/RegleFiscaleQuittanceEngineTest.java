package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.RegleFiscale;
import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import com.assurance.repository.RegleFiscaleRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RegleFiscaleQuittanceEngineTest {

    private static final LocalDate DATE = LocalDate.of(2026, 8, 4);

    private final RegleFiscaleRepository repository = mock(RegleFiscaleRepository.class);
    private final RegleFiscaleQuittanceEngine engine = new RegleFiscaleQuittanceEngine(
            new RegleFiscaleResolver(repository));

    @Test
    void baselineRulesReproduceLegacyTaxEvcatTpfAndCnpacAmounts() {
        Garantie rc = guarantee(1L, "RC", TypeGarantie.VEHICULE);
        Garantie vol = guarantee(2L, "V", TypeGarantie.VEHICULE);
        Garantie personne = guarantee(14L, "PP", TypeGarantie.PERSONNE);
        when(repository.findActiveAt(DATE)).thenReturn(baselineRules(rc));
        Contrat contract = Contrat.builder().typeContrat(TypeContrat.FLOTTE).build();

        RegleFiscaleQuittanceEngine.Calcul result = engine.calculer(contract, List.of(
                contractGuarantee(rc, "100"), contractGuarantee(vol, "50"),
                contractGuarantee(personne, "20")), 1, DATE);

        RegleFiscaleQuittanceEngine.Ligne automobile = line(result, CategorieQuittance.AUTOMOBILE);
        RegleFiscaleQuittanceEngine.Ligne corporel = line(result, CategorieQuittance.CORPOREL);
        RegleFiscaleQuittanceEngine.Ligne evcat = line(result, CategorieQuittance.EVCAT);
        assertThat(automobile.primeNette()).isEqualByComparingTo("150");
        assertThat(automobile.taxe()).isEqualByComparingTo("22.5");
        assertThat(automobile.taxeParafiscale()).isEqualByComparingTo("2.25");
        assertThat(automobile.cnpac()).isEqualByComparingTo("17");
        assertThat(corporel.primeNette()).isEqualByComparingTo("20");
        assertThat(corporel.taxe()).isEqualByComparingTo("2.8");
        assertThat(corporel.taxeParafiscale()).isEqualByComparingTo("0.3");
        assertThat(evcat.primeNette()).isEqualByComparingTo("4.25");
        assertThat(evcat.taxe()).isEqualByComparingTo("0.595");
        assertThat(evcat.taxeParafiscale()).isEqualByComparingTo("0.06375");
        assertThat(result.applications()).hasSize(10);
    }

    @Test
    void personEvcatIsZeroUntilAConfiguredPersonRuleExists() {
        Garantie personne = guarantee(14L, "PP", TypeGarantie.PERSONNE);
        List<RegleFiscale> baseline = baselineRules(guarantee(1L, "RC", TypeGarantie.VEHICULE));
        RegleFiscale personEvcat = guaranteeRule("EVCAT_PERSONNE", NatureRegleFiscale.EVCAT,
                "0.02", CategorieQuittance.EVCAT, null, TypeGarantie.PERSONNE, 10);
        when(repository.findActiveAt(DATE)).thenReturn(concat(baseline, personEvcat));

        RegleFiscaleQuittanceEngine.Calcul result = engine.calculer(
                Contrat.builder().typeContrat(TypeContrat.CONVENTION).build(),
                List.of(contractGuarantee(personne, "100")), 1, DATE);

        assertThat(line(result, CategorieQuittance.EVCAT).primeNette()).isEqualByComparingTo("2");
        assertThat(result.applications()).anyMatch(application ->
                application.regle().getCode().equals("EVCAT_PERSONNE"));
    }

    private List<RegleFiscale> baselineRules(Garantie rc) {
        return List.of(
                guaranteeRule("TAXE_RC", NatureRegleFiscale.TAXE_ASSURANCE, "0.155", CategorieQuittance.AUTOMOBILE, rc, null, 100),
                guaranteeRule("TAXE_VEHICULE", NatureRegleFiscale.TAXE_ASSURANCE, "0.14", CategorieQuittance.AUTOMOBILE, null, TypeGarantie.VEHICULE, 0),
                guaranteeRule("TAXE_PERSONNE", NatureRegleFiscale.TAXE_ASSURANCE, "0.14", CategorieQuittance.CORPOREL, null, TypeGarantie.PERSONNE, 0),
                guaranteeRule("EVCAT_RC", NatureRegleFiscale.EVCAT, "0.035", CategorieQuittance.EVCAT, rc, null, 100),
                guaranteeRule("EVCAT_VEHICULE", NatureRegleFiscale.EVCAT, "0.015", CategorieQuittance.EVCAT, null, TypeGarantie.VEHICULE, 0),
                categoryRule("TAXE_EVCAT", NatureRegleFiscale.TAXE_ASSURANCE, CategorieQuittance.EVCAT, "0.14"),
                categoryRule("TPF_AUTO", NatureRegleFiscale.TPF, CategorieQuittance.AUTOMOBILE, "0.015"),
                categoryRule("TPF_CORPOREL", NatureRegleFiscale.TPF, CategorieQuittance.CORPOREL, "0.015"),
                categoryRule("TPF_EVCAT", NatureRegleFiscale.TPF, CategorieQuittance.EVCAT, "0.015"),
                fixedRule("CNPAC", "17")
        );
    }

    private RegleFiscale guaranteeRule(String code, NatureRegleFiscale nature, String value,
                                       CategorieQuittance result, Garantie guarantee,
                                       TypeGarantie type, int priority) {
        return RegleFiscale.builder().code(code).libelle(code).nature(nature)
                .modeCalcul(ModeCalculRegleFiscale.TAUX).valeur(new BigDecimal(value))
                .baseCalcul(BaseCalculRegleFiscale.PRIME_GARANTIE).categorieResultat(result)
                .garantie(guarantee).typeGarantie(type).dateDebut(LocalDate.of(2000, 1, 1))
                .applicable(true).priorite(priority).actif(true).build();
    }

    private RegleFiscale categoryRule(String code, NatureRegleFiscale nature,
                                      CategorieQuittance category, String value) {
        return RegleFiscale.builder().code(code).libelle(code).nature(nature)
                .modeCalcul(ModeCalculRegleFiscale.TAUX).valeur(new BigDecimal(value))
                .baseCalcul(BaseCalculRegleFiscale.PRIME_CATEGORIE).categorieBase(category)
                .categorieResultat(category).dateDebut(LocalDate.of(2000, 1, 1))
                .applicable(true).priorite(0).actif(true).build();
    }

    private RegleFiscale fixedRule(String code, String value) {
        return RegleFiscale.builder().code(code).libelle(code).nature(NatureRegleFiscale.CNPAC)
                .modeCalcul(ModeCalculRegleFiscale.MONTANT_FIXE).valeur(new BigDecimal(value))
                .baseCalcul(BaseCalculRegleFiscale.UNITE_ASSUREE)
                .categorieResultat(CategorieQuittance.AUTOMOBILE).dateDebut(LocalDate.of(2000, 1, 1))
                .applicable(true).priorite(0).actif(true).build();
    }

    private Garantie guarantee(Long id, String code, TypeGarantie type) {
        Garantie guarantee = Garantie.builder().code(code).libelle(code).typeGarantie(type).build();
        guarantee.setId(id);
        return guarantee;
    }

    private ContratGarantie contractGuarantee(Garantie guarantee, String prime) {
        return ContratGarantie.builder().garantie(guarantee).prime(new BigDecimal(prime)).build();
    }

    private RegleFiscaleQuittanceEngine.Ligne line(RegleFiscaleQuittanceEngine.Calcul result,
                                                    CategorieQuittance category) {
        return result.lignes().stream().filter(line -> line.categorie() == category).findFirst().orElseThrow();
    }

    private List<RegleFiscale> concat(List<RegleFiscale> rules, RegleFiscale extra) {
        java.util.ArrayList<RegleFiscale> result = new java.util.ArrayList<>(rules);
        result.add(extra);
        return result;
    }
}
