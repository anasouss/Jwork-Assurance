package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeImpactMouvement;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuittanceCalculService {

    private final RegleFiscaleQuittanceEngine regleFiscaleEngine;

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
        return calculerAvecReglesFiscales(
                contrat, typeMouvement, garanties, nombreUnitesCnpac, dateEffet);
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
