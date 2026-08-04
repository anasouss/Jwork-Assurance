package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.RegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeGarantie;
import com.assurance.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RegleFiscaleQuittanceEngine {

    private final RegleFiscaleResolver resolver;

    @Transactional(readOnly = true)
    public Calcul calculer(Contrat contrat, List<ContratGarantie> garanties, int nombreUnites, LocalDate dateEffet) {
        if (dateEffet == null) {
            throw new BadRequestException("La date d'effet est obligatoire pour calculer la quittance");
        }
        RegleFiscaleResolver.Catalogue catalogue = resolver.catalogue(dateEffet);
        Map<CategorieQuittance, Montants> montants = initialiserMontants();
        List<Application> applications = new ArrayList<>();

        for (ContratGarantie contratGarantie : garanties == null ? List.<ContratGarantie>of() : garanties) {
            if (contratGarantie == null || contratGarantie.getGarantie() == null) continue;
            BigDecimal prime = zero(contratGarantie.getPrime());
            CategorieQuittance categoriePrime = categoriePrime(contratGarantie);
            Montants montantsPrime = montants.get(categoriePrime);
            montantsPrime.primeNette = montantsPrime.primeNette.add(prime);
            montantsPrime.accessoire = montantsPrime.accessoire.add(zero(contratGarantie.getAccessoire()));

            if (prime.signum() != 0) {
                RegleFiscale taxe = obligatoire(
                        catalogue.forGuarantee(NatureRegleFiscale.TAXE_ASSURANCE, contrat, contratGarantie),
                        "la taxe d'assurance de " + contratGarantie.getGarantie().getCode());
                Application application = appliquer(taxe, prime, 1, dateEffet, contratGarantie);
                applications.add(application);
                montants.get(taxe.getCategorieResultat()).taxe =
                        montants.get(taxe.getCategorieResultat()).taxe.add(application.montantCalcule());
            }

            catalogue.forGuarantee(NatureRegleFiscale.EVCAT, contrat, contratGarantie).ifPresent(regle -> {
                Application application = appliquer(regle, prime, 1, dateEffet, contratGarantie);
                applications.add(application);
                montants.get(regle.getCategorieResultat()).primeNette =
                        montants.get(regle.getCategorieResultat()).primeNette.add(application.montantCalcule());
            });
        }

        for (CategorieQuittance categorie : List.of(
                CategorieQuittance.AUTOMOBILE, CategorieQuittance.CORPOREL,
                CategorieQuittance.EVCAT)) {
            BigDecimal base = montants.get(categorie).primeNette;
            if (base.signum() == 0) continue;

            catalogue.forCategory(NatureRegleFiscale.TAXE_ASSURANCE, categorie, contrat).ifPresent(regle -> {
                Application application = appliquer(regle, base, 1, dateEffet, null);
                applications.add(application);
                montants.get(regle.getCategorieResultat()).taxe =
                        montants.get(regle.getCategorieResultat()).taxe.add(application.montantCalcule());
            });

            RegleFiscale tpf = obligatoire(
                    catalogue.forCategory(NatureRegleFiscale.TPF, categorie, contrat),
                    "la TPF de la catégorie " + categorie.name());
            Application application = appliquer(tpf, base, 1, dateEffet, null);
            applications.add(application);
            montants.get(tpf.getCategorieResultat()).taxeParafiscale =
                    montants.get(tpf.getCategorieResultat()).taxeParafiscale.add(application.montantCalcule());
        }

        int unites = Math.max(1, nombreUnites);
        RegleFiscale cnpac = obligatoire(catalogue.forUnits(NatureRegleFiscale.CNPAC, contrat), "la CNPAC");
        Application applicationCnpac = appliquer(cnpac, BigDecimal.valueOf(unites), unites, dateEffet, null);
        applications.add(applicationCnpac);
        montants.get(cnpac.getCategorieResultat()).cnpac =
                montants.get(cnpac.getCategorieResultat()).cnpac.add(applicationCnpac.montantCalcule());

        List<Ligne> lignes = new ArrayList<>();
        ajouterLigne(lignes, montants, CategorieQuittance.AUTOMOBILE, 10, true);
        ajouterLigne(lignes, montants, CategorieQuittance.CORPOREL, 20, true);
        ajouterLigne(lignes, montants, CategorieQuittance.EVCAT, 30, true);
        return new Calcul(List.copyOf(lignes), List.copyOf(applications));
    }

    @Transactional(readOnly = true)
    public Application calculerCnpac(Contrat contrat, int nombreUnites, LocalDate dateEffet) {
        int unites = Math.max(1, nombreUnites);
        RegleFiscale rule = obligatoire(
                resolver.catalogue(dateEffet).forUnits(NatureRegleFiscale.CNPAC, contrat), "la CNPAC");
        return appliquer(rule, BigDecimal.valueOf(unites), unites, dateEffet, null);
    }

    private Map<CategorieQuittance, Montants> initialiserMontants() {
        Map<CategorieQuittance, Montants> result = new EnumMap<>(CategorieQuittance.class);
        result.put(CategorieQuittance.AUTOMOBILE, new Montants());
        result.put(CategorieQuittance.CORPOREL, new Montants());
        result.put(CategorieQuittance.EVCAT, new Montants());
        return result;
    }

    private void ajouterLigne(List<Ligne> lignes, Map<CategorieQuittance, Montants> montants,
                              CategorieQuittance categorie, int ordre, boolean toujours) {
        Montants value = montants.get(categorie);
        if (toujours || value.nonVide()) lignes.add(value.toLigne(categorie, ordre));
    }

    private CategorieQuittance categoriePrime(ContratGarantie garantie) {
        String code = garantie.getGarantie().getCode() == null ? ""
                : garantie.getGarantie().getCode().trim().toUpperCase(Locale.ROOT);
        return garantie.getGarantie().getTypeGarantie() == TypeGarantie.PERSONNE
                || "PC".equals(code) || "PP".equals(code) || "PTA".equals(code)
                ? CategorieQuittance.CORPOREL : CategorieQuittance.AUTOMOBILE;
    }

    private RegleFiscale obligatoire(Optional<RegleFiscale> rule, String label) {
        return rule.orElseThrow(() -> new BadRequestException("Aucune règle fiscale active trouvée pour " + label));
    }

    private Application appliquer(RegleFiscale rule, BigDecimal base, int multiplicateur,
                                   LocalDate dateEffet, ContratGarantie garantie) {
        BigDecimal montant = BigDecimal.ZERO;
        if (Boolean.TRUE.equals(rule.getApplicable())) {
            montant = rule.getModeCalcul() == ModeCalculRegleFiscale.TAUX
                    ? base.multiply(rule.getValeur())
                    : rule.getValeur().multiply(BigDecimal.valueOf(Math.max(1, multiplicateur)));
        }
        return new Application(rule, dateEffet,
                garantie == null || garantie.getGarantie() == null ? null : garantie.getGarantie().getId(),
                garantie == null || garantie.getVehicule() == null ? null : garantie.getVehicule().getId(),
                garantie == null || garantie.getRemorque() == null ? null : garantie.getRemorque().getId(),
                base, montant);
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static final class Montants {
        private BigDecimal primeNette = BigDecimal.ZERO;
        private BigDecimal taxe = BigDecimal.ZERO;
        private BigDecimal taxeParafiscale = BigDecimal.ZERO;
        private BigDecimal accessoire = BigDecimal.ZERO;
        private BigDecimal cnpac = BigDecimal.ZERO;

        private boolean nonVide() {
            return primeNette.signum() != 0 || taxe.signum() != 0 || taxeParafiscale.signum() != 0
                    || accessoire.signum() != 0 || cnpac.signum() != 0;
        }

        private Ligne toLigne(CategorieQuittance categorie, int ordre) {
            return new Ligne(categorie, ordre, primeNette, taxe, taxeParafiscale, accessoire, cnpac,
                    primeNette.add(taxe).add(taxeParafiscale).add(accessoire).add(cnpac));
        }
    }

    public record Calcul(List<Ligne> lignes, List<Application> applications) {
    }

    public record Ligne(CategorieQuittance categorie, int ordre, BigDecimal primeNette,
                        BigDecimal taxe, BigDecimal taxeParafiscale, BigDecimal accessoire,
                        BigDecimal cnpac, BigDecimal primeTotale) {
    }

    public record Application(RegleFiscale regle, LocalDate dateEffet, Long garantieId,
                              Long vehiculeId, Long remorqueId, BigDecimal baseMontant,
                              BigDecimal montantCalcule) {
        public Application multiplier(BigDecimal factor) {
            return new Application(regle, dateEffet, garantieId, vehiculeId, remorqueId,
                    baseMontant.multiply(factor), montantCalcule.multiply(factor));
        }
    }
}
