package com.assurance.service;

import com.assurance.dto.response.ContratActionsResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ContratActionService {

    private final ContratRepository contratRepository;
    private final TypeMouvementContratRepository typeMouvementContratRepository;

    @Transactional(readOnly = true)
    public ContratActionsResponse getActions(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        boolean contratClos = contrat.getStatut() == StatutContrat.CANCELLED
                || contrat.getStatut() == StatutContrat.EXPIRED
                || contrat.getStatut() == StatutContrat.RENEWED
                || Boolean.TRUE.equals(contrat.getRenouvele());

        var mouvements = typeMouvementContratRepository.findByActifTrueOrderByOrdreAffichageAsc().stream()
                .filter(type -> type.getTypesContratAutorises().isEmpty() || type.getTypesContratAutorises().contains(contrat.getTypeContrat()))
                .filter(type -> !contratClos)
                .filter(type -> type.getCategorie() == CategorieMouvementContrat.AVENANT || type.getCategorie() == CategorieMouvementContrat.RENOUVELLEMENT)
                .map(this::toMouvementDisponible)
                .toList();

        boolean renouvelable = !contratClos && mouvements.stream().anyMatch(mouvement -> Boolean.TRUE.equals(mouvement.getRenouvelleContrat()));
        boolean avenantsAutorises = !contratClos && mouvements.stream().anyMatch(mouvement -> !Boolean.TRUE.equals(mouvement.getRenouvelleContrat()));
        boolean carteVerteAutorisee = !contratClos && mouvements.stream().anyMatch(mouvement -> Boolean.TRUE.equals(mouvement.getAutoriseCarteVerte()));
        boolean assistanceAutorisee = !contratClos && mouvements.stream().anyMatch(mouvement -> Boolean.TRUE.equals(mouvement.getAutoriseAssistance()));

        return ContratActionsResponse.builder()
                .contratId(contrat.getId())
                .renouvelable(renouvelable)
                .avenantsAutorises(avenantsAutorises)
                .carteVerteAutorisee(carteVerteAutorisee)
                .assistanceAutorisee(assistanceAutorisee)
                .mouvementsDisponibles(mouvements)
                .build();
    }

    private ContratActionsResponse.MouvementDisponible toMouvementDisponible(TypeMouvementContrat type) {
        return ContratActionsResponse.MouvementDisponible.builder()
                .code(type.getCode())
                .libelle(type.getLibelle())
                .categorie(type.getCategorie() != null ? type.getCategorie().name() : null)
                .typeImpact(type.getTypeImpact() != null ? type.getTypeImpact().name() : null)
                .modifieGaranties(type.getModifieGaranties())
                .garantiesEditables(type.getGarantiesEditables())
                .modifieVehicule(type.getModifieVehicule())
                .modifieRemorque(type.getModifieRemorque())
                .cnpacSeul(type.getCnpacSeul())
                .genereQuittance(type.getGenereQuittance())
                .autoriseAssistance(type.getAutoriseAssistance())
                .autoriseCarteVerte(type.getAutoriseCarteVerte())
                .consommeAttestation(type.getConsommeAttestation())
                .clotureContrat(type.getClotureContrat())
                .renouvelleContrat(type.getRenouvelleContrat())
                .build();
    }
}
