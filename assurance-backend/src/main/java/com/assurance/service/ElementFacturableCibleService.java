package com.assurance.service;

import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.ElementFacturableCible;
import com.assurance.entity.Remorque;
import com.assurance.entity.Vehicule;
import com.assurance.enums.CategorieQuittance;
import com.assurance.repository.ElementFacturableCibleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ElementFacturableCibleService {

    private static final String KIND_VEHICULE = "VEHICULE";
    private static final String KIND_REMORQUE = "REMORQUE";

    private final QuittanceCalculService quittanceCalculService;
    private final ElementFacturableCibleRepository elementFacturableCibleRepository;

    public List<QuittanceResponse.TargetSummary> calculer(
            Contrat contrat,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        return buildRows(contrat, garanties, vehicules, remorques).stream()
                .map(Row::summary)
                .toList();
    }

    public List<QuittanceResponse.TargetSummary> calculerDifference(
            Contrat contrat,
            List<ContratGarantie> garantiesAvant,
            List<ContratGarantie> garantiesApres,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        List<QuittanceResponse.TargetSummary> summaries = new ArrayList<>();
        List<Vehicule> sourceVehicules = vehicules == null ? List.of() : vehicules;
        for (int index = 0; index < sourceVehicules.size(); index++) {
            Vehicule vehicule = sourceVehicules.get(index);
            QuittanceCalculService.Resultat difference = differenceForTarget(
                    contrat, garantiesAvant, garantiesApres, vehicule, null
            );
            if (difference != null) {
                summaries.add(toResponse(KIND_VEHICULE, index, null, difference));
            }
        }
        List<Remorque> sourceRemorques = remorques == null ? List.of() : remorques;
        for (int index = 0; index < sourceRemorques.size(); index++) {
            Remorque remorque = sourceRemorques.get(index);
            QuittanceCalculService.Resultat difference = differenceForTarget(
                    contrat, garantiesAvant, garantiesApres, null, remorque
            );
            if (difference != null) {
                summaries.add(toResponse(KIND_REMORQUE, null, index, difference));
            }
        }
        return summaries;
    }

    public List<ElementFacturableCible> generer(
            ElementFacturable elementFacturable,
            Contrat contrat,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        List<ElementFacturableCible> cibles = buildRows(contrat, garanties, vehicules, remorques).stream()
                .map(row -> toEntity(elementFacturable, contrat, row))
                .toList();
        return elementFacturableCibleRepository.saveAll(cibles);
    }

    public List<ElementFacturableCible> genererDepuisResumes(
            ElementFacturable elementFacturable,
            Contrat contrat,
            List<QuittanceResponse.TargetSummary> summaries,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        List<ElementFacturableCible> cibles = (summaries == null ? List.<QuittanceResponse.TargetSummary>of() : summaries)
                .stream()
                .map(summary -> toEntity(
                        elementFacturable,
                        contrat,
                        summary,
                        resolveVehicule(summary, vehicules),
                        resolveRemorque(summary, remorques)
                ))
                .toList();
        return elementFacturableCibleRepository.saveAll(cibles);
    }

    public List<QuittanceResponse.TargetSummary> listByElementFacturable(Long elementFacturableId) {
        if (elementFacturableId == null) {
            return List.of();
        }
        return elementFacturableCibleRepository.findByElementFacturableIdOrderByTargetIndexAscIdAsc(elementFacturableId).stream()
                .map(this::toResponse)
                .toList();
    }

    private List<Row> buildRows(
            Contrat contrat,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        if (contrat == null) {
            return List.of();
        }
        List<ContratGarantie> sourceGaranties = garanties == null ? List.of() : garanties;
        List<Row> rows = new ArrayList<>();
        List<Vehicule> sourceVehicules = vehicules == null ? List.of() : vehicules;
        for (int index = 0; index < sourceVehicules.size(); index++) {
            Vehicule vehicule = sourceVehicules.get(index);
            List<ContratGarantie> targetGaranties = sourceGaranties.stream()
                    .filter(garantie -> sameVehicule(garantie, vehicule))
                    .toList();
            if (!targetGaranties.isEmpty()) {
                rows.add(buildRow(contrat, targetGaranties, KIND_VEHICULE, index, null, vehicule, null));
            }
        }
        List<Remorque> sourceRemorques = remorques == null ? List.of() : remorques;
        for (int index = 0; index < sourceRemorques.size(); index++) {
            Remorque remorque = sourceRemorques.get(index);
            List<ContratGarantie> targetGaranties = sourceGaranties.stream()
                    .filter(garantie -> sameRemorque(garantie, remorque))
                    .toList();
            if (!targetGaranties.isEmpty()) {
                rows.add(buildRow(contrat, targetGaranties, KIND_REMORQUE, null, index, null, remorque));
            }
        }
        return rows;
    }

    private Row buildRow(
            Contrat contrat,
            List<ContratGarantie> garanties,
            String kind,
            Integer vehiculeIndex,
            Integer remorqueIndex,
            Vehicule vehicule,
            Remorque remorque
    ) {
        boolean hasRc = hasRcGarantie(garanties);
        QuittanceCalculService.Resultat calcul = quittanceCalculService.calculer(contrat, null, garanties, hasRc ? 1 : 0);
        QuittanceResponse.TargetSummary summary = toResponse(kind, vehiculeIndex, remorqueIndex, calcul, hasRc);
        return new Row(kind, vehiculeIndex, remorqueIndex, vehicule, remorque, summary);
    }

    private QuittanceCalculService.Resultat differenceForTarget(
            Contrat contrat,
            List<ContratGarantie> garantiesAvant,
            List<ContratGarantie> garantiesApres,
            Vehicule vehicule,
            Remorque remorque
    ) {
        List<ContratGarantie> avant = targetGaranties(garantiesAvant, vehicule, remorque);
        List<ContratGarantie> apres = targetGaranties(garantiesApres, vehicule, remorque);
        if (avant.isEmpty() && apres.isEmpty()) {
            return null;
        }
        QuittanceCalculService.Resultat calculVide = quittanceCalculService.calculer(contrat, null, List.of(), 0);
        QuittanceCalculService.Resultat zero = quittanceCalculService.difference(calculVide, calculVide);
        QuittanceCalculService.Resultat calculAvant = avant.isEmpty()
                ? zero
                : quittanceCalculService.calculer(contrat, null, avant, hasRcGarantie(avant) ? 1 : 0);
        QuittanceCalculService.Resultat calculApres = apres.isEmpty()
                ? zero
                : quittanceCalculService.calculer(contrat, null, apres, hasRcGarantie(apres) ? 1 : 0);
        return quittanceCalculService.difference(calculApres, calculAvant);
    }

    private List<ContratGarantie> targetGaranties(
            List<ContratGarantie> garanties,
            Vehicule vehicule,
            Remorque remorque
    ) {
        return (garanties == null ? List.<ContratGarantie>of() : garanties).stream()
                .filter(garantie -> vehicule != null ? sameVehicule(garantie, vehicule) : sameRemorque(garantie, remorque))
                .toList();
    }

    private ElementFacturableCible toEntity(ElementFacturable elementFacturable, Contrat contrat, Row row) {
        QuittanceResponse.TargetSummary summary = row.summary();
        return ElementFacturableCible.builder()
                .elementFacturable(elementFacturable)
                .contrat(contrat)
                .vehicule(row.vehicule())
                .remorque(row.remorque())
                .kind(row.kind())
                .targetIndex(row.targetIndex())
                .primeNette(summary.getPrimeNette())
                .primeNetteHorsEvcat(summary.getPrimeNetteHorsEvcat())
                .automobilePrimeNette(summary.getAutomobilePrimeNette())
                .corporelPrimeNette(summary.getCorporelPrimeNette())
                .evcatPrimeNette(summary.getEvcatPrimeNette())
                .taxe(summary.getTaxe())
                .taxeParafiscale(summary.getTaxeParafiscale())
                .accessoire(summary.getAccessoire())
                .cnpac(summary.getCnpac())
                .primeTotale(summary.getPrimeTotale())
                .actif(true)
                .build();
    }

    private ElementFacturableCible toEntity(
            ElementFacturable elementFacturable,
            Contrat contrat,
            QuittanceResponse.TargetSummary summary,
            Vehicule vehicule,
            Remorque remorque
    ) {
        return ElementFacturableCible.builder()
                .elementFacturable(elementFacturable)
                .contrat(contrat)
                .vehicule(vehicule)
                .remorque(remorque)
                .kind(summary.getKind())
                .targetIndex(summary.getVehiculeIndex() != null ? summary.getVehiculeIndex() : summary.getRemorqueIndex())
                .primeNette(summary.getPrimeNette())
                .primeNetteHorsEvcat(summary.getPrimeNetteHorsEvcat())
                .automobilePrimeNette(summary.getAutomobilePrimeNette())
                .corporelPrimeNette(summary.getCorporelPrimeNette())
                .evcatPrimeNette(summary.getEvcatPrimeNette())
                .taxe(summary.getTaxe())
                .taxeParafiscale(summary.getTaxeParafiscale())
                .accessoire(summary.getAccessoire())
                .cnpac(summary.getCnpac())
                .primeTotale(summary.getPrimeTotale())
                .actif(true)
                .build();
    }

    private QuittanceResponse.TargetSummary toResponse(
            String kind,
            Integer vehiculeIndex,
            Integer remorqueIndex,
            QuittanceCalculService.Resultat calcul,
            boolean hasRc
    ) {
        QuittanceCalculService.Ligne automobile = ligne(calcul, CategorieQuittance.AUTOMOBILE);
        QuittanceCalculService.Ligne corporel = ligne(calcul, CategorieQuittance.CORPOREL);
        QuittanceCalculService.Ligne evcat = ligne(calcul, CategorieQuittance.EVCAT);
        BigDecimal evcatPrimeNette = value(evcat == null ? null : evcat.primeNette());
        return QuittanceResponse.TargetSummary.builder()
                .kind(kind)
                .vehiculeIndex(vehiculeIndex)
                .remorqueIndex(remorqueIndex)
                .primeNette(calcul.primeNette())
                .primeNetteHorsEvcat(scale(calcul.primeNette().subtract(evcatPrimeNette)))
                .automobilePrimeNette(value(automobile == null ? null : automobile.primeNette()))
                .corporelPrimeNette(value(corporel == null ? null : corporel.primeNette()))
                .evcatPrimeNette(evcatPrimeNette)
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(hasRc ? calcul.cnpac() : BigDecimal.ZERO)
                .primeTotale(hasRc ? calcul.primeTotale() : scale(calcul.primeTotale().subtract(calcul.cnpac())))
                .build();
    }

    private QuittanceResponse.TargetSummary toResponse(
            String kind,
            Integer vehiculeIndex,
            Integer remorqueIndex,
            QuittanceCalculService.Resultat calcul
    ) {
        QuittanceCalculService.Ligne automobile = ligne(calcul, CategorieQuittance.AUTOMOBILE);
        QuittanceCalculService.Ligne corporel = ligne(calcul, CategorieQuittance.CORPOREL);
        QuittanceCalculService.Ligne evcat = ligne(calcul, CategorieQuittance.EVCAT);
        BigDecimal automobileNet = value(automobile == null ? null : automobile.primeNette());
        BigDecimal corporelNet = value(corporel == null ? null : corporel.primeNette());
        BigDecimal evcatNet = value(evcat == null ? null : evcat.primeNette());
        return QuittanceResponse.TargetSummary.builder()
                .kind(kind)
                .vehiculeIndex(vehiculeIndex)
                .remorqueIndex(remorqueIndex)
                .primeNette(calcul.primeNette())
                .primeNetteHorsEvcat(scale(automobileNet.add(corporelNet)))
                .automobilePrimeNette(scale(automobileNet))
                .corporelPrimeNette(scale(corporelNet))
                .evcatPrimeNette(scale(evcatNet))
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(calcul.cnpac())
                .primeTotale(calcul.primeTotale())
                .build();
    }

    private Vehicule resolveVehicule(QuittanceResponse.TargetSummary summary, List<Vehicule> vehicules) {
        Integer index = summary == null ? null : summary.getVehiculeIndex();
        return index != null && vehicules != null && index >= 0 && index < vehicules.size() ? vehicules.get(index) : null;
    }

    private Remorque resolveRemorque(QuittanceResponse.TargetSummary summary, List<Remorque> remorques) {
        Integer index = summary == null ? null : summary.getRemorqueIndex();
        return index != null && remorques != null && index >= 0 && index < remorques.size() ? remorques.get(index) : null;
    }

    private QuittanceResponse.TargetSummary toResponse(ElementFacturableCible cible) {
        return QuittanceResponse.TargetSummary.builder()
                .kind(cible.getKind())
                .vehiculeIndex(KIND_VEHICULE.equals(cible.getKind()) ? cible.getTargetIndex() : null)
                .remorqueIndex(KIND_REMORQUE.equals(cible.getKind()) ? cible.getTargetIndex() : null)
                .primeNette(cible.getPrimeNette())
                .primeNetteHorsEvcat(cible.getPrimeNetteHorsEvcat())
                .automobilePrimeNette(cible.getAutomobilePrimeNette())
                .corporelPrimeNette(cible.getCorporelPrimeNette())
                .evcatPrimeNette(cible.getEvcatPrimeNette())
                .taxe(cible.getTaxe())
                .taxeParafiscale(cible.getTaxeParafiscale())
                .accessoire(cible.getAccessoire())
                .cnpac(cible.getCnpac())
                .primeTotale(cible.getPrimeTotale())
                .build();
    }

    private QuittanceCalculService.Ligne ligne(QuittanceCalculService.Resultat calcul, CategorieQuittance categorie) {
        return calcul.lignes().stream()
                .filter(ligne -> ligne.categorie() == categorie)
                .findFirst()
                .orElse(null);
    }

    private boolean sameVehicule(ContratGarantie garantie, Vehicule vehicule) {
        if (garantie == null || garantie.getVehicule() == null || vehicule == null) {
            return false;
        }
        return garantie.getVehicule() == vehicule || sameId(garantie.getVehicule().getId(), vehicule.getId());
    }

    private boolean sameRemorque(ContratGarantie garantie, Remorque remorque) {
        if (garantie == null || garantie.getRemorque() == null || remorque == null) {
            return false;
        }
        return garantie.getRemorque() == remorque || sameId(garantie.getRemorque().getId(), remorque.getId());
    }

    private boolean sameId(Long left, Long right) {
        return left != null && left.equals(right);
    }

    private boolean hasRcGarantie(List<ContratGarantie> garanties) {
        return garanties.stream().anyMatch(garantie -> {
            if (garantie.getGarantie() == null) {
                return false;
            }
            String code = garantie.getGarantie().getCode() == null ? "" : garantie.getGarantie().getCode().trim().toUpperCase(Locale.ROOT);
            return Boolean.TRUE.equals(garantie.getGarantie().getResponsabiliteCivile()) || "RC".equals(code);
        });
    }

    private BigDecimal value(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private record Row(
            String kind,
            Integer vehiculeIndex,
            Integer remorqueIndex,
            Vehicule vehicule,
            Remorque remorque,
            QuittanceResponse.TargetSummary summary
    ) {
        private Integer targetIndex() {
            return vehiculeIndex != null ? vehiculeIndex : remorqueIndex;
        }
    }
}
