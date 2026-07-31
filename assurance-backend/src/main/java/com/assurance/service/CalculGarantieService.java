package com.assurance.service;

import com.assurance.entity.CapitalResponsabiliteCivile;
import com.assurance.entity.Carburant;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.Remorque;
import com.assurance.entity.TarifUsage;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.RoleClientContrat;
import com.assurance.repository.CapitalResponsabiliteCivileRepository;
import com.assurance.repository.LigneGrilleTarifaireRepository;
import com.assurance.repository.TarifUsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalculGarantieService {

    private static final BigDecimal DEFAULT_CAPITAL_RC = BigDecimal.valueOf(50_000_000L);
    private static final BigDecimal CYCLOS_CAPITAL_RC = BigDecimal.valueOf(5_000_000L);

    private final ParametreApplicationService parametreApplicationService;
    private final TarifUsageRepository tarifUsageRepository;
    private final CapitalResponsabiliteCivileRepository capitalResponsabiliteCivileRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;

    public BigDecimal calculerProrata(LocalDate dateEffet, LocalDate dateEcheance) {
        if (dateEffet == null || dateEcheance == null || dateEcheance.isBefore(dateEffet)) {
            return BigDecimal.ONE;
        }
        long joursAnnee = Math.max(1, ChronoUnit.DAYS.between(dateEffet, dateEffet.plusYears(1)));
        long joursCouverts = ChronoUnit.DAYS.between(dateEffet, dateEcheance.plusDays(1));
        return BigDecimal.valueOf(joursCouverts)
                .divide(BigDecimal.valueOf(joursAnnee), 8, RoundingMode.HALF_UP);
    }

    public BigDecimal resolveProrata(Contrat contrat, Vehicule vehicule, Remorque remorque) {
        LocalDate dateEffet = vehicule != null ? vehicule.getDateEffet() : remorque != null ? remorque.getDateEffet() : null;
        LocalDate dateEcheance = vehicule != null ? vehicule.getDateEcheance() : remorque != null ? remorque.getDateEcheance() : null;
        if (dateEffet != null && dateEcheance != null) {
            return calculerProrata(dateEffet, dateEcheance);
        }
        BigDecimal coefficient = vehicule != null ? vehicule.getCoefficientProrata()
                : remorque != null ? remorque.getCoefficientProrata() : null;
        if (coefficient != null && coefficient.compareTo(BigDecimal.ZERO) > 0) {
            return coefficient;
        }
        return contrat == null ? BigDecimal.ONE : calculerProrata(contrat.getDateEffet(), contrat.getDateEcheance());
    }

    public BigDecimal appliquerProrata(BigDecimal montant, BigDecimal prorata) {
        if (montant == null) {
            return null;
        }
        return montant.multiply(prorata == null ? BigDecimal.ONE : prorata).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculerPrimeLigne(
            LigneGrilleTarifaire ligne,
            ModeTarificationGarantie modeSelectionne,
            BigDecimal capital,
            BigDecimal prorata,
            boolean remorque
    ) {
        if (ligne == null) {
            return null;
        }
        BigDecimal primeLigne = ligne.getPrime();
        BigDecimal taux = resolveTauxLigne(ligne, remorque);
        BigDecimal prime;
        if (modeSelectionne == ModeTarificationGarantie.CAPITAL || modeSelectionne == ModeTarificationGarantie.PRIME_FIXE) {
            prime = taux != null && taux.compareTo(BigDecimal.ZERO) != 0
                    ? percent(taux).multiply(firstNonNull(primeLigne, BigDecimal.ZERO))
                    : primeLigne;
        } else {
            prime = taux == null || capital == null ? primeLigne : percent(taux).multiply(capital);
        }
        return appliquerProrata(prime, prorata);
    }

    public BigDecimal calculerPrimeResponsabiliteCivile(Contrat contrat, Vehicule vehicule, Remorque remorque) {
        if (remorque != null) {
            return calculerPrimeRcRemorque(contrat, remorque);
        }
        if (vehicule != null) {
            return calculerPrimeRcVehicule(contrat, vehicule);
        }
        return null;
    }

    public BigDecimal resolveCapitalResponsabiliteCivile(Usage usage) {
        String codeUsage = usage == null || usage.getCode() == null ? "DEFAULT" : usage.getCode();
        return capitalResponsabiliteCivileRepository.findByUsageCodeIgnoreCaseAndActifTrue(codeUsage)
                .or(() -> capitalResponsabiliteCivileRepository.findByUsageCodeIgnoreCaseAndActifTrue("DEFAULT"))
                .map(CapitalResponsabiliteCivile::getCapital)
                .orElse(isCyclos(codeUsage) ? CYCLOS_CAPITAL_RC : DEFAULT_CAPITAL_RC);
    }

    public BigDecimal resolveMultiplicateurRc(Contrat contrat, Usage usage) {
        BigDecimal tauxLocationGrille = resolveTauxRcLocationGrille(contrat, usage);
        if (tauxLocationGrille != null) {
            return tauxLocationGrille;
        }
        if (contrat != null && contrat.getTauxRc() != null && contrat.getTauxRc().compareTo(BigDecimal.ZERO) > 0) {
            return contrat.getTauxRc();
        }
        Long agenceId = contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null;
        if (isUsageTpv(contrat, usage)) {
            return parametreApplicationService.getDecimal(agenceId, "MULTIPLICATEUR_RC_TPV", BigDecimal.ONE);
        }
        return parametreApplicationService.getDecimal(agenceId, "MULTIPLICATEUR_RC_DEFAUT", BigDecimal.ONE);
    }

    private BigDecimal resolveTauxRcLocationGrille(Contrat contrat, Usage usage) {
        if (!isContratLocation(contrat) || usage == null || usage.getId() == null || contrat.getGrilleTarifaire() == null) {
            return null;
        }
        Long grilleId = contrat.getGrilleTarifaire().getId();
        if (grilleId == null) {
            return null;
        }
        return ligneGrilleTarifaireRepository
                .findByGrilleTarifaireIdAndUsageIdAndGarantieResponsabiliteCivileTrueAndActifTrueOrderByOrdreAffichageAsc(grilleId, usage.getId())
                .stream()
                .map(LigneGrilleTarifaire::getTaux)
                .filter(taux -> taux != null && taux.compareTo(BigDecimal.ZERO) > 0)
                .findFirst()
                .orElse(null);
    }

    public BigDecimal resolveTauxLigne(LigneGrilleTarifaire ligne, boolean remorque) {
        if (ligne == null) {
            return null;
        }
        return ligne.getTaux();
    }

    public BigDecimal resolveTauxFranchiseLigne(LigneGrilleTarifaire ligne, boolean remorque) {
        if (ligne == null) {
            return null;
        }
        return ligne.getTauxFranchise();
    }

    public BigDecimal resolveFranchiseMinimaleLigne(LigneGrilleTarifaire ligne, boolean remorque) {
        if (ligne == null) {
            return null;
        }
        return ligne.getFranchiseMinimale();
    }

    private BigDecimal calculerPrimeRcVehicule(Contrat contrat, Vehicule vehicule) {
        TarifUsage tarif = resolveTarifUsage(vehicule);
        if (tarif == null || tarif.getPrimeNette() == null) {
            return null;
        }
        BigDecimal prime = tarif.getPrimeNette();
        BigDecimal nombrePlaces = parsePositiveDecimal(vehicule.getNombrePlaces());
        if (tarif.getPrimeParPlace() != null && nombrePlaces != null) {
            prime = prime.add(tarif.getPrimeParPlace().multiply(nombrePlaces));
        }
        prime = prime.multiply(resolveProrata(contrat, vehicule, null));
        prime = prime.multiply(resolveCrm(vehicule.getCrm()));
        prime = prime.multiply(resolveCoefficientSahara(contrat));
        prime = prime.multiply(resolveMultiplicateurRc(contrat, vehicule.getUsage()));
        return prime.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculerPrimeRcRemorque(Contrat contrat, Remorque remorque) {
        BigDecimal prorata = resolveProrata(contrat, null, remorque);
        BigDecimal crm = resolveCrm(remorque.getCrm());
        BigDecimal referenceRc = resolveReferenceRcVehicule(contrat);
        if (referenceRc != null && referenceRc.compareTo(BigDecimal.ZERO) > 0) {
            return referenceRc
                    .multiply(resolveTauxRemorque(contrat))
                    .multiply(prorata)
                    .multiply(crm)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        TarifUsage tarif = resolveTarifUsageRemorque(remorque);
        if (tarif == null || tarif.getPrimeNette() == null) {
            return null;
        }
        return tarif.getPrimeNette()
                .multiply(prorata)
                .multiply(crm)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveReferenceRcVehicule(Contrat contrat) {
        if (contrat == null || contrat.getVehicules() == null || contrat.getVehicules().isEmpty()) {
            return null;
        }
        return contrat.getVehicules().stream()
                .filter(Objects::nonNull)
                .map(vehicule -> calculerPrimeRcVehicule(contrat, vehicule))
                .filter(prime -> prime != null && prime.compareTo(BigDecimal.ZERO) > 0)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    private BigDecimal resolveTauxRemorque(Contrat contrat) {
        Long agenceId = contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null;
        String usageDominant = resolveUsageDominantVehicules(contrat);
        return switch (usageDominant) {
            case "A" -> parametreApplicationService.getDecimal(agenceId, "TAUX_RC_REMORQUE_A", BigDecimal.valueOf(0.10));
            case "C1" -> parametreApplicationService.getDecimal(agenceId, "TAUX_RC_REMORQUE_C1", BigDecimal.valueOf(0.20));
            case "C2" -> parametreApplicationService.getDecimal(agenceId, "TAUX_RC_REMORQUE_C2", BigDecimal.valueOf(0.30));
            default -> parametreApplicationService.getDecimal(agenceId, "TAUX_RC_REMORQUE_DEFAUT", BigDecimal.valueOf(0.20));
        };
    }

    private String resolveUsageDominantVehicules(Contrat contrat) {
        if (contrat == null || contrat.getVehicules() == null) {
            return "";
        }
        Map<String, Long> counts = contrat.getVehicules().stream()
                .filter(Objects::nonNull)
                .map(Vehicule::getUsage)
                .filter(Objects::nonNull)
                .map(Usage::getCode)
                .filter(Objects::nonNull)
                .map(code -> code.toUpperCase(Locale.ROOT))
                .collect(Collectors.groupingBy(code -> code, Collectors.counting()));
        return counts.entrySet().stream()
                .max(Comparator.comparingLong((Map.Entry<String, Long> entry) -> entry.getValue())
                        .thenComparingInt(entry -> usagePriority(entry.getKey())))
                .map(Map.Entry::getKey)
                .orElse("");
    }

    private TarifUsage resolveTarifUsage(Vehicule vehicule) {
        if (vehicule == null || vehicule.getUsage() == null) {
            return null;
        }
        List<TarifUsage> tarifs = tarifUsageRepository.findByUsage_IdAndActifTrue(vehicule.getUsage().getId());
        Optional<TarifUsage> exact = tarifs.stream().filter(tarif -> matchesVehicule(tarif, vehicule)).findFirst();
        if (exact.isPresent()) {
            return exact.get();
        }
        if (Boolean.TRUE.equals(vehicule.getUsage().getByCategorieTransport())) {
            return null;
        }
        return tarifs.size() == 1 ? tarifs.get(0) : null;
    }

    private TarifUsage resolveTarifUsageRemorque(Remorque remorque) {
        if (remorque == null || remorque.getUsage() == null) {
            return null;
        }
        List<TarifUsage> tarifs = tarifUsageRepository.findByUsage_IdAndActifTrue(remorque.getUsage().getId());
        Optional<TarifUsage> exact = tarifs.stream().filter(tarif -> matchesRemorque(tarif, remorque)).findFirst();
        if (exact.isPresent()) {
            return exact.get();
        }
        return tarifs.size() == 1 ? tarifs.get(0) : null;
    }

    private boolean matchesVehicule(TarifUsage tarif, Vehicule vehicule) {
        Usage usage = vehicule.getUsage();
        if (!matchesCategorieTransport(tarif.getCategorieTransport(), vehicule.getCategorieTransport(), Boolean.TRUE.equals(usage.getByCategorieTransport()))) {
            return false;
        }
        if (Boolean.TRUE.equals(usage.getBySousClasse())) {
            return equalsIgnoreCase(tarif.getSousClasse(), vehicule.getSousClasse())
                    && matchesCarburant(tarif.getCarburant(), vehicule.getCarburant());
        }
        if (Boolean.TRUE.equals(usage.getByPtc())) {
            return inRange(parsePositiveDecimal(vehicule.getPtc()), tarif.getPtcMin(), tarif.getPtcMax());
        }
        if (Boolean.TRUE.equals(usage.getByCarburantAndPf())) {
            return inRange(parsePositiveDecimal(vehicule.getPuissanceFiscale()), tarif.getPuissanceFiscaleMin(), tarif.getPuissanceFiscaleMax())
                    && matchesCarburant(tarif.getCarburant(), vehicule.getCarburant());
        }
        if (Boolean.TRUE.equals(usage.getByPrime())) {
            return inRange(parsePositiveDecimal(vehicule.getNombrePlaces()), tarif.getNombrePlacesMin(), tarif.getNombrePlacesMax());
        }
        return true;
    }

    private boolean matchesCarburant(Carburant tarifCarburant, String vehiculeCarburant) {
        if (tarifCarburant == null) {
            return true;
        }
        return equalsIgnoreCase(tarifCarburant.getCode(), vehiculeCarburant)
                || equalsIgnoreCase(tarifCarburant.getLibelle(), vehiculeCarburant);
    }

    private boolean matchesCategorieTransport(
            com.assurance.entity.CategorieTransport tarifCategorie,
            com.assurance.entity.CategorieTransport vehiculeCategorie,
            boolean obligatoire
    ) {
        if (tarifCategorie == null) {
            return !obligatoire || vehiculeCategorie == null;
        }
        return vehiculeCategorie != null && tarifCategorie.getId().equals(vehiculeCategorie.getId());
    }

    private boolean matchesRemorque(TarifUsage tarif, Remorque remorque) {
        if (Boolean.TRUE.equals(remorque.getUsage().getByPtc())) {
            return inRange(parsePositiveDecimal(remorque.getPtc()), tarif.getPtcMin(), tarif.getPtcMax());
        }
        return true;
    }

    private BigDecimal resolveCoefficientSahara(Contrat contrat) {
        if (contrat == null || contrat.getClients() == null) {
            return BigDecimal.ONE;
        }
        boolean sahara = contrat.getClients().stream()
                .map(ContratClient::getClient)
                .filter(Objects::nonNull)
                .map(Client::getSahara)
                .anyMatch(Boolean.TRUE::equals);
        if (!sahara) {
            return BigDecimal.ONE;
        }
        Long agenceId = contrat.getAgence() == null ? null : contrat.getAgence().getId();
        return parametreApplicationService.getDecimal(agenceId, "TAUX_RSS", BigDecimal.valueOf(0.60));
    }

    private boolean isUsageTpv(Contrat contrat, Usage usage) {
        if (usage != null && isUsageInCategorie(usage, "TPV")) {
            return true;
        }
        if (contrat != null && contrat.getUsage() != null && isUsageInCategorie(contrat.getUsage(), "TPV")) {
            return true;
        }
        if (contrat == null || contrat.getVehicules() == null) {
            return false;
        }
        return contrat.getVehicules().stream()
                .map(Vehicule::getUsage)
                .filter(Objects::nonNull)
                .anyMatch(candidate -> isUsageInCategorie(candidate, "TPV"));
    }

    private boolean isContratLocation(Contrat contrat) {
        if (contrat == null || contrat.getClients() == null) {
            return false;
        }
        boolean proprietaireLocation = contrat.getClients().stream()
                .filter(Objects::nonNull)
                .filter(link -> link.getRole() == RoleClientContrat.PROPRIETAIRE)
                .map(ContratClient::getClient)
                .anyMatch(this::isClientLocation);
        if (proprietaireLocation) {
            return true;
        }
        return contrat.getClients().stream()
                .filter(Objects::nonNull)
                .map(ContratClient::getClient)
                .anyMatch(this::isClientLocation);
    }

    private boolean isClientLocation(Client client) {
        if (client == null) {
            return false;
        }
        CategorieClient categorieClient = client.getCategorieClient();
        return categorieClient != null && equalsIgnoreCase(categorieClient.getCode(), "LOCATION");
    }

    private boolean isUsageInCategorie(Usage usage, String codeCategorie) {
        if (usage == null || usage.getCode() == null) {
            return false;
        }
        return usage.getCode().startsWith("B") || (usage.getCriteria() != null && usage.getCriteria().equalsIgnoreCase(codeCategorie));
    }

    private BigDecimal resolveCrm(String crm) {
        BigDecimal parsed = parsePositiveDecimal(crm);
        return parsed == null ? BigDecimal.ONE : parsed;
    }

    private BigDecimal parsePositiveDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal value = new BigDecimal(raw.trim().replace(",", "."));
            return value.compareTo(BigDecimal.ZERO) > 0 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private boolean inRange(BigDecimal value, BigDecimal min, BigDecimal max) {
        if (value == null) {
            return false;
        }
        return (min == null || value.compareTo(min) >= 0) && (max == null || value.compareTo(max) <= 0);
    }

    private boolean equalsIgnoreCase(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private boolean isCyclos(String usageCode) {
        return usageCode != null && usageCode.toUpperCase(Locale.ROOT).contains("CYCLO");
    }

    private int usagePriority(String usageCode) {
        return switch (usageCode) {
            case "C2" -> 3;
            case "C1" -> 2;
            case "A" -> 1;
            default -> 0;
        };
    }

    private BigDecimal percent(BigDecimal value) {
        return value.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
