package com.assurance.service;

import com.assurance.dto.response.SinistreAssistanceResponse;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreAssistance;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AssistanceContratRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SinistreAssistanceService {
    private final AssistanceContratRepository repository;
    private final SinistreCouvertureService couvertureService;

    @Transactional(readOnly = true)
    public List<SinistreAssistanceResponse> available(Long agenceId, Long contratId, Long vehiculeId, LocalDate dateSinistre) {
        var coverage = couvertureService.resolve(agenceId, contratId, vehiculeId, dateSinistre);
        Long coveredVehicleId = coverage.vehicule() == null ? null : coverage.vehicule().getId();
        return repository.findForClaim(agenceId, contratId, coveredVehicleId, dateSinistre).stream()
                .map(assistance -> toResponse(snapshot(assistance))).toList();
    }

    public void select(Sinistre claim, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        var selected = new HashSet<>(ids);
        if (selected.size() != ids.size() || selected.contains(null)) {
            throw new BadRequestException("La sélection d'assistance contient un identifiant invalide ou répété");
        }
        Long vehicleId = claim.getVehicule() == null ? null : claim.getVehicule().getId();
        var eligible = repository.findForClaim(claim.getAgence().getId(), claim.getContrat().getId(), vehicleId, claim.getDateSinistre())
                .stream().filter(assistance -> selected.contains(assistance.getId())).toList();
        if (eligible.size() != selected.size()) {
            throw new BadRequestException("Une assistance sélectionnée ne couvre pas ce contrat et ce véhicule à la date du sinistre");
        }
        claim.getAssistances().addAll(eligible.stream().map(this::snapshot).toList());
    }

    private SinistreAssistance snapshot(AssistanceContrat assistance) {
        String produit = assistance.getProduit();
        if ((produit == null || produit.isBlank()) && assistance.getProduitAssistance() != null) {
            produit = assistance.getProduitAssistance().getLibelle();
        }
        return SinistreAssistance.builder().assistance(assistance)
                .reference(assistance.getNumeroContratOuQuittance())
                .compagnie(assistance.getCompagnieAssistance() == null ? null : assistance.getCompagnieAssistance().getNom())
                .produit(produit).dateEffet(assistance.getDateEffet()).dateEcheance(assistance.getDateEcheance()).build();
    }

    public static SinistreAssistanceResponse toResponse(SinistreAssistance snapshot) {
        return new SinistreAssistanceResponse(snapshot.getAssistance().getId(), snapshot.getReference(), snapshot.getCompagnie(),
                snapshot.getProduit(), snapshot.getDateEffet(), snapshot.getDateEcheance());
    }
}
