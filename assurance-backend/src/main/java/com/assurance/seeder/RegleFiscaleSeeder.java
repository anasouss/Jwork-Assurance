package com.assurance.seeder;

import com.assurance.entity.Garantie;
import com.assurance.entity.RegleFiscale;
import com.assurance.entity.Usage;
import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeGarantie;
import com.assurance.repository.GarantieRepository;
import com.assurance.repository.RegleFiscaleRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.service.ParametreApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

@Component
@Order(10)
@RequiredArgsConstructor
public class RegleFiscaleSeeder implements CommandLineRunner {

    private static final LocalDate INITIAL_DATE = LocalDate.of(2000, 1, 1);

    private final RegleFiscaleRepository repository;
    private final GarantieRepository garantieRepository;
    private final UsageRepository usageRepository;
    private final ParametreApplicationService parametreApplicationService;

    @Override
    @Transactional
    public void run(String... args) {
        Garantie rc = garantieRepository.findByCode("RC").orElse(null);
        if (rc == null) return;

        String taxeRc = globalParam("TAUX_TAXE_1", "0.155");
        String taxeGarantie = globalParam("TAUX_TAXE_2", "0.14");
        String tpf = globalParam("TAUX_TAXE_PF", "0.015");
        String evcatRc = globalParam("TAUX_EVCAT_1", "0.035");
        String evcatAutres = globalParam("TAUX_EVCAT_2", "0.015");
        String evcatTpvRc = globalParam("TAUX_EVCAT_TPV_RC", "0.02");
        String cnpac = globalParam("CNPAC", "17");

        seed("TAXE_RC", "Taxe assurance - responsabilité civile", NatureRegleFiscale.TAXE_ASSURANCE,
                BaseCalculRegleFiscale.PRIME_GARANTIE, taxeRc, CategorieQuittance.AUTOMOBILE,
                rc, null, null, 100);
        seed("TAXE_VEHICULE", "Taxe assurance - garanties véhicule", NatureRegleFiscale.TAXE_ASSURANCE,
                BaseCalculRegleFiscale.PRIME_GARANTIE, taxeGarantie, CategorieQuittance.AUTOMOBILE,
                null, TypeGarantie.VEHICULE, null, 0);
        seed("TAXE_PERSONNE", "Taxe assurance - garanties personne", NatureRegleFiscale.TAXE_ASSURANCE,
                BaseCalculRegleFiscale.PRIME_GARANTIE, taxeGarantie, CategorieQuittance.CORPOREL,
                null, TypeGarantie.PERSONNE, null, 0);
        seedCategory("TAXE_EVCAT", "Taxe assurance sur EVCAT", NatureRegleFiscale.TAXE_ASSURANCE,
                CategorieQuittance.EVCAT, taxeGarantie);

        seedCategory("TPF_AUTOMOBILE", "Taxe parafiscale automobile", NatureRegleFiscale.TPF,
                CategorieQuittance.AUTOMOBILE, tpf);
        seedCategory("TPF_CORPOREL", "Taxe parafiscale corporel", NatureRegleFiscale.TPF,
                CategorieQuittance.CORPOREL, tpf);
        seedCategory("TPF_EVCAT", "Taxe parafiscale EVCAT", NatureRegleFiscale.TPF,
                CategorieQuittance.EVCAT, tpf);

        seed("EVCAT_RC", "EVCAT - responsabilité civile", NatureRegleFiscale.EVCAT,
                BaseCalculRegleFiscale.PRIME_GARANTIE, evcatRc, CategorieQuittance.EVCAT,
                rc, null, null, 100);
        seed("EVCAT_VEHICULE", "EVCAT - autres garanties véhicule", NatureRegleFiscale.EVCAT,
                BaseCalculRegleFiscale.PRIME_GARANTIE, evcatAutres, CategorieQuittance.EVCAT,
                null, TypeGarantie.VEHICULE, null, 0);
        seedTpv(rc, "B1", evcatTpvRc);
        seedTpv(rc, "B2", evcatTpvRc);

        seed("CNPAC_UNITAIRE", "CNPAC par unité assurée", NatureRegleFiscale.CNPAC,
                BaseCalculRegleFiscale.UNITE_ASSUREE, cnpac, CategorieQuittance.AUTOMOBILE,
                null, null, null, 0, ModeCalculRegleFiscale.MONTANT_FIXE);
    }

    private void seedTpv(Garantie rc, String usageCode, String value) {
        Usage usage = usageRepository.findByCodeIgnoreCase(usageCode).orElse(null);
        if (usage == null) return;
        seed("EVCAT_RC_" + usageCode, "EVCAT RC - usage " + usageCode, NatureRegleFiscale.EVCAT,
                BaseCalculRegleFiscale.PRIME_GARANTIE, value, CategorieQuittance.EVCAT,
                rc, null, usage, 200);
    }

    private String globalParam(String code, String fallback) {
        return parametreApplicationService.getDecimal(null, code, new BigDecimal(fallback)).toPlainString();
    }

    private void seedCategory(String code, String label, NatureRegleFiscale nature,
                              CategorieQuittance category, String value) {
        RegleFiscale rule = repository.findByCodeIgnoreCaseAndDateDebut(code, INITIAL_DATE).orElse(null);
        if (rule != null) return;
        repository.save(RegleFiscale.builder()
                .code(code).libelle(label).nature(nature).modeCalcul(ModeCalculRegleFiscale.TAUX)
                .valeur(new BigDecimal(value)).baseCalcul(BaseCalculRegleFiscale.PRIME_CATEGORIE)
                .categorieBase(category).categorieResultat(category).dateDebut(INITIAL_DATE)
                .applicable(true).priorite(0).actif(true).build());
    }

    private void seed(String code, String label, NatureRegleFiscale nature, BaseCalculRegleFiscale base,
                      String value, CategorieQuittance resultCategory, Garantie guarantee,
                      TypeGarantie guaranteeType, Usage usage, int priority) {
        seed(code, label, nature, base, value, resultCategory, guarantee, guaranteeType, usage, priority,
                ModeCalculRegleFiscale.TAUX);
    }

    private void seed(String code, String label, NatureRegleFiscale nature, BaseCalculRegleFiscale base,
                      String value, CategorieQuittance resultCategory, Garantie guarantee,
                      TypeGarantie guaranteeType, Usage usage, int priority, ModeCalculRegleFiscale mode) {
        if (repository.findByCodeIgnoreCaseAndDateDebut(code, INITIAL_DATE).isPresent()) return;
        repository.save(RegleFiscale.builder()
                .code(code).libelle(label).nature(nature).modeCalcul(mode).valeur(new BigDecimal(value))
                .baseCalcul(base).categorieResultat(resultCategory).garantie(guarantee)
                .typeGarantie(guaranteeType).usage(usage).dateDebut(INITIAL_DATE)
                .applicable(true).priorite(priority).actif(true).build());
    }
}
