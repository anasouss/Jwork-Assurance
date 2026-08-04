package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Usage;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeGarantie;
import com.assurance.enums.TypeImpactMouvement;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuittanceCalculService {

    private final ParametreApplicationService parametreApplicationService;
    private final RegleFiscaleQuittanceEngine regleFiscaleEngine;

    @Value("${app.fiscal-rules.enabled:false}")
    private boolean fiscalRulesEnabled;

    public Resultat calculer(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<ContratGarantie> garanties,
            int nombreUnitesCnpac
    ) {
        return calculer(contrat, typeMouvement, garanties, nombreUnitesCnpac, contrat.getDateEffet());
    }

    public Resultat calculer(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<ContratGarantie> garanties,
            int nombreUnitesCnpac,
            LocalDate dateEffet
    ) {
        if (fiscalRulesEnabled) {
            return calculerAvecReglesFiscales(
                    contrat, typeMouvement, garanties, nombreUnitesCnpac, dateEffet);
        }
        return calculerAvecParametresLegacy(contrat, typeMouvement, garanties, nombreUnitesCnpac);
    }

    private Resultat calculerAvecParametresLegacy(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<ContratGarantie> garanties,
            int nombreUnitesCnpac
    ) {
        Long agenceId = contrat.getAgence() == null ? null : contrat.getAgence().getId();
        TypeImpactMouvement impact = typeMouvement == null || typeMouvement.getTypeImpact() == null ? TypeImpactMouvement.NORMAL : typeMouvement.getTypeImpact();
        if (impact == TypeImpactMouvement.ZERO) {
            return totalOnly(BigDecimal.ZERO);
        }
        if (impact == TypeImpactMouvement.CNPAC_SEUL || Boolean.TRUE.equals(typeMouvement != null ? typeMouvement.getCnpacSeul() : null)) {
            BigDecimal cnpac = param(agenceId, "CNPAC").multiply(BigDecimal.valueOf(Math.max(1, nombreUnitesCnpac)));
            Ligne ligne = new Ligne(CategorieQuittance.AUTOMOBILE, 10, false, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, cnpac, cnpac);
            return withTotal(List.of(ligne), BigDecimal.ONE);
        }

        BigDecimal tauxTaxeRc = param(agenceId, "TAUX_TAXE_1");
        BigDecimal tauxTaxeGarantie = param(agenceId, "TAUX_TAXE_2");
        BigDecimal tauxTaxePf = param(agenceId, "TAUX_TAXE_PF");
        BigDecimal tauxEvcatAutres = param(agenceId, "TAUX_EVCAT_2");
        BigDecimal cnpacUnitaire = param(agenceId, "CNPAC");

        BigDecimal netAuto = BigDecimal.ZERO;
        BigDecimal taxeAuto = BigDecimal.ZERO;
        BigDecimal accessoireAuto = BigDecimal.ZERO;
        BigDecimal netCorporel = BigDecimal.ZERO;
        BigDecimal taxeCorporel = BigDecimal.ZERO;
        BigDecimal taxePfCorporel = BigDecimal.ZERO;
        BigDecimal basePta = BigDecimal.ZERO;
        BigDecimal accessoireCorporel = BigDecimal.ZERO;
        BigDecimal netEvcat = BigDecimal.ZERO;
        BigDecimal accessoireEvcat = BigDecimal.ZERO;

        for (ContratGarantie contratGarantie : garanties == null ? List.<ContratGarantie>of() : garanties) {
            if (contratGarantie == null || contratGarantie.getGarantie() == null) {
                continue;
            }
            BigDecimal prime = zeroIfNull(contratGarantie.getPrime());
            BigDecimal accessoire = zeroIfNull(contratGarantie.getAccessoire());
            String codeGarantie = contratGarantie.getGarantie().getCode() == null ? "" : contratGarantie.getGarantie().getCode().trim().toUpperCase(Locale.ROOT);

            if (contratGarantie.getGarantie().getTypeGarantie() == TypeGarantie.PERSONNE || "PC".equals(codeGarantie) || "PP".equals(codeGarantie) || "PTA".equals(codeGarantie)) {
                netCorporel = netCorporel.add(prime);
                taxeCorporel = taxeCorporel.add(prime.multiply(tauxTaxeGarantie));
                basePta = basePta.add(prime);
                accessoireCorporel = accessoireCorporel.add(accessoire);
                continue;
            }

            if (Boolean.TRUE.equals(contratGarantie.getGarantie().getResponsabiliteCivile()) || "RC".equals(codeGarantie)) {
                netAuto = netAuto.add(prime);
                taxeAuto = taxeAuto.add(prime.multiply(tauxTaxeRc));
                netEvcat = netEvcat.add(prime.multiply(resolveTauxEvcatRc(agenceId, contrat, contratGarantie)));
            } else {
                netAuto = netAuto.add(prime);
                taxeAuto = taxeAuto.add(prime.multiply(tauxTaxeGarantie));
                netEvcat = netEvcat.add(prime.multiply(tauxEvcatAutres));
            }
            accessoireAuto = accessoireAuto.add(accessoire);
        }

        BigDecimal taxePfAuto = netAuto.multiply(tauxTaxePf);
        BigDecimal taxeEvcat = netEvcat.multiply(tauxTaxeGarantie);
        BigDecimal taxePfEvcat = netEvcat.multiply(tauxTaxePf);
        taxePfCorporel = basePta.multiply(tauxTaxePf);
        BigDecimal cnpac = cnpacUnitaire.multiply(BigDecimal.valueOf(Math.max(1, nombreUnitesCnpac)));

        List<Ligne> lignes = new ArrayList<>();
        lignes.add(new Ligne(CategorieQuittance.AUTOMOBILE, 10, false, netAuto, taxeAuto, taxePfAuto, accessoireAuto, cnpac, total(netAuto, taxeAuto, taxePfAuto, accessoireAuto, cnpac)));
        lignes.add(new Ligne(CategorieQuittance.CORPOREL, 20, false, netCorporel, taxeCorporel, taxePfCorporel, accessoireCorporel, BigDecimal.ZERO, total(netCorporel, taxeCorporel, taxePfCorporel, accessoireCorporel, BigDecimal.ZERO)));
        lignes.add(new Ligne(CategorieQuittance.EVCAT, 30, false, netEvcat, taxeEvcat, taxePfEvcat, accessoireEvcat, BigDecimal.ZERO, total(netEvcat, taxeEvcat, taxePfEvcat, accessoireEvcat, BigDecimal.ZERO)));
        if (impact == TypeImpactMouvement.RETOUR_PRIME) {
            return withRetourPrime(lignes);
        }
        return withTotal(lignes, BigDecimal.ONE);
    }

    public Resultat calculerAvecReglesFiscales(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<ContratGarantie> garanties,
            int nombreUnitesCnpac,
            LocalDate dateEffet
    ) {
        TypeImpactMouvement impact = typeMouvement == null || typeMouvement.getTypeImpact() == null
                ? TypeImpactMouvement.NORMAL : typeMouvement.getTypeImpact();
        if (impact == TypeImpactMouvement.ZERO) {
            return totalOnly(BigDecimal.ZERO);
        }
        if (impact == TypeImpactMouvement.CNPAC_SEUL
                || Boolean.TRUE.equals(typeMouvement != null ? typeMouvement.getCnpacSeul() : null)) {
            RegleFiscaleQuittanceEngine.Application application =
                    regleFiscaleEngine.calculerCnpac(contrat, nombreUnitesCnpac, dateEffet);
            CategorieQuittance categorie = application.regle().getCategorieResultat();
            BigDecimal cnpac = application.montantCalcule();
            Ligne ligne = new Ligne(categorie, ordre(categorie), false, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, cnpac, cnpac);
            return withTotal(List.of(ligne), BigDecimal.ONE, List.of(application));
        }

        RegleFiscaleQuittanceEngine.Calcul calcul =
                regleFiscaleEngine.calculer(contrat, garanties, nombreUnitesCnpac, dateEffet);
        List<Ligne> lignes = calcul.lignes().stream()
                .map(ligne -> new Ligne(ligne.categorie(), ligne.ordre(), false, ligne.primeNette(),
                        ligne.taxe(), ligne.taxeParafiscale(), ligne.accessoire(), ligne.cnpac(),
                        ligne.primeTotale()))
                .toList();
        if (impact == TypeImpactMouvement.RETOUR_PRIME) {
            return withRetourPrime(lignes, calcul.applications());
        }
        return withTotal(lignes, BigDecimal.ONE, calcul.applications());
    }

    public Resultat difference(Resultat apres, Resultat avant) {
        return difference(apres, avant, false);
    }

    public Resultat differenceGaranties(Resultat apres, Resultat avant) {
        Resultat differentiel = difference(apres, avant, false);
        List<Ligne> lignes = differentiel.lignes().stream()
                .filter(ligne -> ligne.categorie() != CategorieQuittance.TOTAL)
                .map(ligne -> new Ligne(
                        ligne.categorie(),
                        ligne.ordre(),
                        false,
                        ligne.primeNette(),
                        ligne.taxe(),
                        ligne.taxeParafiscale(),
                        ligne.accessoire(),
                        BigDecimal.ZERO,
                        total(
                                ligne.primeNette(),
                                ligne.taxe(),
                                ligne.taxeParafiscale(),
                                ligne.accessoire(),
                                BigDecimal.ZERO
                        )
                ))
                .toList();
        return buildResult(lignes, applicationsSansNature(differentiel.applications(), NatureRegleFiscale.CNPAC));
    }

    private Resultat difference(Resultat apres, Resultat avant, boolean autoriserTaxeNegative) {
        Map<CategorieQuittance, Ligne> apresParCategorie = lignesParCategorie(apres);
        Map<CategorieQuittance, Ligne> avantParCategorie = lignesParCategorie(avant);
        Set<CategorieQuittance> categories = new LinkedHashSet<>();
        categories.addAll(apresParCategorie.keySet());
        categories.addAll(avantParCategorie.keySet());

        List<Ligne> lignes = new ArrayList<>();
        for (CategorieQuittance categorie : categories) {
            if (categorie == CategorieQuittance.TOTAL) {
                continue;
            }
            Ligne ligneApres = apresParCategorie.get(categorie);
            Ligne ligneAvant = avantParCategorie.get(categorie);
            lignes.add(differenceLine(
                    categorie,
                    ligneApres != null ? ligneApres.ordre() : ligneAvant != null ? ligneAvant.ordre() : 99,
                    moins(ligneApres != null ? ligneApres.primeNette() : BigDecimal.ZERO, ligneAvant != null ? ligneAvant.primeNette() : BigDecimal.ZERO),
                    moins(ligneApres != null ? ligneApres.taxe() : BigDecimal.ZERO, ligneAvant != null ? ligneAvant.taxe() : BigDecimal.ZERO),
                    moins(ligneApres != null ? ligneApres.taxeParafiscale() : BigDecimal.ZERO, ligneAvant != null ? ligneAvant.taxeParafiscale() : BigDecimal.ZERO),
                    moins(ligneApres != null ? ligneApres.accessoire() : BigDecimal.ZERO, ligneAvant != null ? ligneAvant.accessoire() : BigDecimal.ZERO),
                    moins(ligneApres != null ? ligneApres.cnpac() : BigDecimal.ZERO, ligneAvant != null ? ligneAvant.cnpac() : BigDecimal.ZERO),
                    moins(ligneApres != null ? ligneApres.primeTotale() : BigDecimal.ZERO, ligneAvant != null ? ligneAvant.primeTotale() : BigDecimal.ZERO),
                    autoriserTaxeNegative
            ));
        }
        List<RegleFiscaleQuittanceEngine.Application> applications = new ArrayList<>();
        if (apres != null && apres.applications() != null) {
            applications.addAll(apres.applications());
        }
        if (avant != null && avant.applications() != null) {
            avant.applications().stream()
                    .map(application -> application.multiplier(BigDecimal.valueOf(-1)))
                    .forEach(applications::add);
        }
        Resultat resultat = withTotal(lignes, BigDecimal.ONE, applications);
        return new Resultat(
                resultat.lignes(),
                applicationsPourLignes(resultat.lignes(), resultat.applications()),
                resultat.primeNette(),
                resultat.taxe(),
                resultat.taxeParafiscale(),
                resultat.accessoire(),
                resultat.cnpac(),
                resultat.primeTotale()
        );
    }

    public Resultat differenceChangementVehicule(Resultat apres, Resultat avant) {
        Resultat differentiel = difference(apres, avant, true);
        BigDecimal cnpacNouvelleAttestation = lignesParCategorie(apres).getOrDefault(
                CategorieQuittance.AUTOMOBILE,
                zeroLine(CategorieQuittance.AUTOMOBILE, 10)
        ).cnpac();
        List<Ligne> lignes = differentiel.lignes().stream()
                .filter(ligne -> ligne.categorie() != CategorieQuittance.TOTAL)
                .map(ligne -> ligne.categorie() == CategorieQuittance.AUTOMOBILE
                        ? new Ligne(
                                ligne.categorie(),
                                ligne.ordre(),
                                false,
                                ligne.primeNette(),
                                ligne.taxe(),
                                ligne.taxeParafiscale(),
                                ligne.accessoire(),
                                cnpacNouvelleAttestation,
                                ligne.primeTotale().add(cnpacNouvelleAttestation)
                        )
                        : ligne)
                .toList();
        List<RegleFiscaleQuittanceEngine.Application> applications =
                applicationsSansNature(differentiel.applications(), NatureRegleFiscale.CNPAC);
        if (apres != null && apres.applications() != null) {
            apres.applications().stream()
                    .filter(application -> application.regle().getNature() == NatureRegleFiscale.CNPAC)
                    .forEach(applications::add);
        }
        return buildResult(lignes, applicationsPourLignes(lignes, applications));
    }

    private Ligne differenceLine(
            CategorieQuittance categorie,
            int ordre,
            BigDecimal primeNette,
            BigDecimal taxe,
            BigDecimal taxeParafiscale,
            BigDecimal accessoire,
            BigDecimal cnpac,
            BigDecimal primeTotale,
            boolean autoriserTaxeNegative
    ) {
        if (primeNette.compareTo(BigDecimal.ZERO) < 0) {
            BigDecimal taxeApplicable = autoriserTaxeNegative ? taxe : BigDecimal.ZERO;
            return new Ligne(
                    categorie,
                    ordre,
                    false,
                    primeNette,
                    taxeApplicable,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    primeNette.add(taxeApplicable)
            );
        }
        return new Ligne(categorie, ordre, false, primeNette, taxe, taxeParafiscale, accessoire, cnpac, primeTotale);
    }

    private Ligne zeroLine(CategorieQuittance categorie, int ordre) {
        return new Ligne(
                categorie,
                ordre,
                false,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO
        );
    }

    public int compterUnitesCnpac(List<ContratGarantie> garanties, int fallback) {
        Set<String> cibles = new LinkedHashSet<>();
        for (ContratGarantie contratGarantie : garanties == null ? List.<ContratGarantie>of() : garanties) {
            if (contratGarantie == null || contratGarantie.getGarantie() == null) {
                continue;
            }
            String codeGarantie = contratGarantie.getGarantie().getCode() == null ? "" : contratGarantie.getGarantie().getCode().trim().toUpperCase(Locale.ROOT);
            if (!Boolean.TRUE.equals(contratGarantie.getGarantie().getResponsabiliteCivile()) && !"RC".equals(codeGarantie)) {
                continue;
            }
            if (contratGarantie.getVehicule() != null) {
                cibles.add("V:" + contratGarantie.getVehicule().getId());
            } else if (contratGarantie.getRemorque() != null) {
                cibles.add("R:" + contratGarantie.getRemorque().getId());
            }
        }
        if (!cibles.isEmpty()) {
            return cibles.size();
        }
        return Math.max(1, fallback);
    }

    private Resultat totalOnly(BigDecimal montant) {
        Ligne total = new Ligne(CategorieQuittance.TOTAL, 99, true, montant, montant, montant, montant, montant, montant);
        return new Resultat(List.of(total), montant, montant, montant, montant, montant, montant);
    }

    private Map<CategorieQuittance, Ligne> lignesParCategorie(Resultat resultat) {
        Map<CategorieQuittance, Ligne> lignes = new EnumMap<>(CategorieQuittance.class);
        if (resultat == null || resultat.lignes() == null) {
            return lignes;
        }
        for (Ligne ligne : resultat.lignes()) {
            if (ligne != null && ligne.categorie() != null) {
                lignes.put(ligne.categorie(), ligne);
            }
        }
        return lignes;
    }

    private BigDecimal moins(BigDecimal apres, BigDecimal avant) {
        return scale(zeroIfNull(apres).subtract(zeroIfNull(avant)));
    }

    private Resultat withTotal(List<Ligne> source, BigDecimal signe) {
        return withTotal(source, signe, List.of());
    }

    private Resultat withTotal(
            List<Ligne> source,
            BigDecimal signe,
            List<RegleFiscaleQuittanceEngine.Application> applications
    ) {
        List<Ligne> lignes = source.stream()
                .map(ligne -> ligne.multiplier(signe))
                .toList();
        List<RegleFiscaleQuittanceEngine.Application> applicationsSignees = applications == null ? List.of()
                : applications.stream().map(application -> application.multiplier(signe)).toList();
        return buildResult(lignes, applicationsSignees);
    }

    private Resultat withRetourPrime(List<Ligne> source) {
        return withRetourPrime(source, List.of());
    }

    private Resultat withRetourPrime(
            List<Ligne> source,
            List<RegleFiscaleQuittanceEngine.Application> applications
    ) {
        List<Ligne> lignes = source.stream()
                .map(Ligne::retourPrime)
                .toList();
        List<RegleFiscaleQuittanceEngine.Application> applicationsRetour = applications == null
                ? List.of()
                : applications.stream()
                        .filter(application -> application.regle().getNature() == NatureRegleFiscale.EVCAT)
                        .map(application -> application.multiplier(BigDecimal.valueOf(-1)))
                        .toList();
        return buildResult(lignes, applicationsRetour);
    }

    private Resultat buildResult(List<Ligne> lignes) {
        return buildResult(lignes, List.of());
    }

    private Resultat buildResult(
            List<Ligne> lignes,
            List<RegleFiscaleQuittanceEngine.Application> applications
    ) {
        BigDecimal primeNette = lignes.stream().map(Ligne::primeNette).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxe = lignes.stream().map(Ligne::taxe).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxeParafiscale = lignes.stream().map(Ligne::taxeParafiscale).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal accessoire = lignes.stream().map(Ligne::accessoire).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cnpac = lignes.stream().map(Ligne::cnpac).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal primeTotale = lignes.stream().map(Ligne::primeTotale).reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Ligne> toutesLignes = new ArrayList<>(lignes);
        toutesLignes.add(new Ligne(CategorieQuittance.TOTAL, 99, true, primeNette, taxe, taxeParafiscale, accessoire, cnpac, primeTotale));
        return new Resultat(
                toutesLignes,
                applications == null ? List.of() : List.copyOf(applications),
                scale(primeNette),
                scale(taxe),
                scale(taxeParafiscale),
                scale(accessoire),
                scale(cnpac),
                scale(primeTotale)
        );
    }

    private BigDecimal resolveTauxEvcatRc(Long agenceId, Contrat contrat, ContratGarantie contratGarantie) {
        Usage usage = contratGarantie.getVehicule() != null ? contratGarantie.getVehicule().getUsage()
                : contratGarantie.getRemorque() != null ? contratGarantie.getRemorque().getUsage()
                : contrat.getUsage();
        String usageCode = usage == null || usage.getCode() == null ? "" : usage.getCode().trim().toUpperCase(Locale.ROOT);
        String usageLibelle = usage == null || usage.getLibelle() == null ? "" : usage.getLibelle().trim().toUpperCase(Locale.ROOT);
        if (usageCode.startsWith("B") || usageLibelle.contains("TAXI") || usageLibelle.contains("BUS") || usageLibelle.contains("TPV")) {
            return param(agenceId, "TAUX_EVCAT_TPV_RC");
        }
        return param(agenceId, "TAUX_EVCAT_1");
    }

    private BigDecimal total(BigDecimal primeNette, BigDecimal taxe, BigDecimal taxeParafiscale, BigDecimal accessoire, BigDecimal cnpac) {
        return primeNette.add(taxe).add(taxeParafiscale).add(accessoire).add(cnpac);
    }

    private int ordre(CategorieQuittance categorie) {
        return switch (categorie) {
            case AUTOMOBILE -> 10;
            case CORPOREL -> 20;
            case EVCAT -> 30;
            case ASSISTANCE -> 40;
            case TOTAL -> 99;
        };
    }

    private List<RegleFiscaleQuittanceEngine.Application> applicationsSansNature(
            List<RegleFiscaleQuittanceEngine.Application> applications,
            NatureRegleFiscale nature
    ) {
        if (applications == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(applications.stream()
                .filter(application -> application.regle().getNature() != nature)
                .toList());
    }

    private List<RegleFiscaleQuittanceEngine.Application> applicationsPourLignes(
            List<Ligne> lignes,
            List<RegleFiscaleQuittanceEngine.Application> applications
    ) {
        Map<CategorieQuittance, Ligne> parCategorie = new EnumMap<>(CategorieQuittance.class);
        lignes.stream()
                .filter(ligne -> ligne.categorie() != CategorieQuittance.TOTAL)
                .forEach(ligne -> parCategorie.put(ligne.categorie(), ligne));
        return applications.stream().filter(application -> {
            Ligne ligne = parCategorie.get(application.regle().getCategorieResultat());
            if (ligne == null) {
                return false;
            }
            return switch (application.regle().getNature()) {
                case EVCAT -> ligne.primeNette().signum() != 0;
                case TAXE_ASSURANCE -> ligne.taxe().signum() != 0;
                case TPF -> ligne.taxeParafiscale().signum() != 0;
                case CNPAC -> ligne.cnpac().signum() != 0;
            };
        }).toList();
    }

    private BigDecimal param(Long agenceId, String code) {
        return parametreApplicationService.getDecimal(agenceId, code, BigDecimal.ZERO);
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public record Resultat(
            List<Ligne> lignes,
            List<RegleFiscaleQuittanceEngine.Application> applications,
            BigDecimal primeNette,
            BigDecimal taxe,
            BigDecimal taxeParafiscale,
            BigDecimal accessoire,
            BigDecimal cnpac,
            BigDecimal primeTotale
    ) {
        public Resultat(List<Ligne> lignes, BigDecimal primeNette, BigDecimal taxe,
                        BigDecimal taxeParafiscale, BigDecimal accessoire,
                        BigDecimal cnpac, BigDecimal primeTotale) {
            this(lignes, List.of(), primeNette, taxe, taxeParafiscale, accessoire, cnpac, primeTotale);
        }
    }

    public record Ligne(
            CategorieQuittance categorie,
            int ordre,
            boolean globale,
            BigDecimal primeNette,
            BigDecimal taxe,
            BigDecimal taxeParafiscale,
            BigDecimal accessoire,
            BigDecimal cnpac,
            BigDecimal primeTotale
    ) {
        private Ligne multiplier(BigDecimal signe) {
            return new Ligne(
                    categorie,
                    ordre,
                    globale,
                    scale(primeNette.multiply(signe)),
                    scale(taxe.multiply(signe)),
                    scale(taxeParafiscale.multiply(signe)),
                    scale(accessoire.multiply(signe)),
                    scale(cnpac.multiply(signe)),
                    scale(primeTotale.multiply(signe))
            );
        }

        private Ligne retourPrime() {
            BigDecimal retour = scale(primeNette.multiply(BigDecimal.valueOf(-1)));
            return new Ligne(
                    categorie,
                    ordre,
                    globale,
                    retour,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    retour
            );
        }
    }
}
