package com.assurance.service;

import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.RegleFiscale;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
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

class RegleFiscaleResolverTest {

    private final RegleFiscaleRepository repository = mock(RegleFiscaleRepository.class);
    private final RegleFiscaleResolver resolver = new RegleFiscaleResolver(repository);

    @Test
    void mostSpecificRuleWinsOverGeneralRule() {
        LocalDate effectDate = LocalDate.of(2026, 8, 4);
        Garantie guarantee = guarantee(2L, "V", TypeGarantie.VEHICULE);
        Usage usage = usage(5L, "A");
        CompagnieAssurance company = company(3L);
        Contrat contract = Contrat.builder().brancheAssurance(branch(1L, "AUTOMOBILE")).compagnieAssurance(company).typeContrat(TypeContrat.FLOTTE).build();
        ContratGarantie contractGuarantee = ContratGarantie.builder()
                .garantie(guarantee).vehicule(Vehicule.builder().usage(usage).build()).build();

        RegleFiscale general = guaranteeRule(1L, "GENERAL", null, null, null, "0.14", true, 0);
        RegleFiscale companyRule = guaranteeRule(2L, "COMPANY", company, null, null, "0.12", true, 0);
        RegleFiscale usageRule = guaranteeRule(3L, "USAGE", null, null, usage, "0.11", true, 0);
        RegleFiscale guaranteeRule = guaranteeRule(4L, "GUARANTEE", null, guarantee, null, "0.10", true, 0);
        when(repository.findActiveAt(effectDate)).thenReturn(List.of(general, companyRule, usageRule, guaranteeRule));

        RegleFiscale resolved = resolver.catalogue(effectDate)
                .forGuarantee(NatureRegleFiscale.TAXE_ASSURANCE, contract, contractGuarantee)
                .orElseThrow();

        assertThat(resolved.getCode()).isEqualTo("GUARANTEE");
    }

    @Test
    void explicitExemptionOverridesApplicableGeneralRule() {
        LocalDate effectDate = LocalDate.of(2026, 8, 4);
        Garantie guarantee = guarantee(2L, "PP", TypeGarantie.PERSONNE);
        Contrat contract = Contrat.builder().brancheAssurance(branch(1L, "AUTOMOBILE")).typeContrat(TypeContrat.CONVENTION).build();
        ContratGarantie contractGuarantee = ContratGarantie.builder().garantie(guarantee).build();
        RegleFiscale general = guaranteeRule(1L, "GENERAL", null, null, null, "0.14", true, 0);
        RegleFiscale exemption = guaranteeRule(2L, "EXEMPT_PERSON", null, null, null, "0", false, 50);
        exemption.setTypeGarantie(TypeGarantie.PERSONNE);
        when(repository.findActiveAt(effectDate)).thenReturn(List.of(general, exemption));

        RegleFiscale resolved = resolver.catalogue(effectDate)
                .forGuarantee(NatureRegleFiscale.TAXE_ASSURANCE, contract, contractGuarantee)
                .orElseThrow();

        assertThat(resolved.getCode()).isEqualTo("EXEMPT_PERSON");
        assertThat(resolved.getApplicable()).isFalse();
    }

    @Test
    void clientCategoryRuleAppliesOnlyToContractSnapshot() {
        LocalDate effectDate = LocalDate.of(2026, 8, 4);
        Garantie guarantee = guarantee(1L, "RC", TypeGarantie.VEHICULE);
        CategorieClient tpv = CategorieClient.builder().code("TPV").libelle("TPV").build();
        tpv.setId(3L);
        Contrat contract = Contrat.builder().brancheAssurance(branch(1L, "AUTOMOBILE")).typeContrat(TypeContrat.FLOTTE).categorieClient(tpv).build();
        ContratGarantie contractGuarantee = ContratGarantie.builder().garantie(guarantee).build();
        RegleFiscale general = guaranteeRule(1L, "EVCAT_RC", null, guarantee, null, "0.035", true, 0);
        RegleFiscale categoryRule = guaranteeRule(2L, "EVCAT_RC_TPV", null, guarantee, null, "0.02", true, 0);
        categoryRule.setCategorieClient(tpv);
        when(repository.findActiveAt(effectDate)).thenReturn(List.of(general, categoryRule));

        RegleFiscale resolved = resolver.catalogue(effectDate)
                .forGuarantee(NatureRegleFiscale.TAXE_ASSURANCE, contract, contractGuarantee)
                .orElseThrow();

        assertThat(resolved.getCode()).isEqualTo("EVCAT_RC_TPV");
    }

    @Test
    void repositoryIsQueriedWithMovementEffectiveDate() {
        LocalDate effectDate = LocalDate.of(2027, 1, 1);
        when(repository.findActiveAt(effectDate)).thenReturn(List.of());

        assertThat(resolver.catalogue(effectDate)
                .forCategory(NatureRegleFiscale.TPF, CategorieQuittance.AUTOMOBILE,
                        Contrat.builder().typeContrat(TypeContrat.PARTICULIER).build()))
                .isEmpty();
    }

    @Test
    void ruleFromAnotherInsuranceBranchIsIgnored() {
        LocalDate effectDate = LocalDate.of(2026, 8, 4);
        BrancheAssurance automobile = branch(1L, "AUTOMOBILE");
        BrancheAssurance risquesDivers = branch(2L, "RISQUES_DIVERS");
        Garantie guarantee = guarantee(1L, "RC", TypeGarantie.VEHICULE);
        Contrat contract = Contrat.builder().brancheAssurance(automobile).typeContrat(TypeContrat.FLOTTE).build();
        ContratGarantie contractGuarantee = ContratGarantie.builder().garantie(guarantee).build();
        RegleFiscale automobileRule = guaranteeRule(1L, "AUTO", null, guarantee, null, "0.14", true, 0);
        automobileRule.setBrancheAssurance(automobile);
        RegleFiscale otherBranchRule = guaranteeRule(2L, "RD", null, guarantee, null, "0.20", true, 100);
        otherBranchRule.setBrancheAssurance(risquesDivers);
        when(repository.findActiveAt(effectDate)).thenReturn(List.of(automobileRule, otherBranchRule));

        RegleFiscale resolved = resolver.catalogue(effectDate)
                .forGuarantee(NatureRegleFiscale.TAXE_ASSURANCE, contract, contractGuarantee)
                .orElseThrow();

        assertThat(resolved.getCode()).isEqualTo("AUTO");
    }

    private RegleFiscale guaranteeRule(Long id, String code, CompagnieAssurance company,
                                       Garantie guarantee, Usage usage, String value,
                                       boolean applicable, int priority) {
        RegleFiscale rule = RegleFiscale.builder()
                .code(code).libelle(code).nature(NatureRegleFiscale.TAXE_ASSURANCE)
                .modeCalcul(ModeCalculRegleFiscale.TAUX).valeur(new BigDecimal(value))
                .baseCalcul(BaseCalculRegleFiscale.PRIME_GARANTIE)
                .categorieResultat(CategorieQuittance.AUTOMOBILE)
                .brancheAssurance(branch(1L, "AUTOMOBILE"))
                .compagnieAssurance(company).garantie(guarantee).usage(usage)
                .dateDebut(LocalDate.of(2000, 1, 1)).applicable(applicable)
                .priorite(priority).actif(true).build();
        rule.setId(id);
        return rule;
    }

    private Garantie guarantee(Long id, String code, TypeGarantie type) {
        Garantie guarantee = Garantie.builder().code(code).libelle(code).typeGarantie(type).build();
        guarantee.setId(id);
        return guarantee;
    }

    private Usage usage(Long id, String code) {
        Usage usage = Usage.builder().code(code).libelle(code).build();
        usage.setId(id);
        return usage;
    }

    private CompagnieAssurance company(Long id) {
        CompagnieAssurance company = CompagnieAssurance.builder().code("COMPANY").nom("Company").build();
        company.setId(id);
        return company;
    }

    private BrancheAssurance branch(Long id, String code) {
        BrancheAssurance branch = BrancheAssurance.builder().code(code).libelle(code).actif(true).build();
        branch.setId(id);
        return branch;
    }
}
