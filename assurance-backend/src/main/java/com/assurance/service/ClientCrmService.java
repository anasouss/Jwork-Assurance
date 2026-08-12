package com.assurance.service;

import com.assurance.dto.response.ClientCrmResponse;
import com.assurance.dto.response.ClientPageResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.Quittance;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.QuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClientCrmService {

    private final ClientRepository clientRepository;
    private final ContratRepository contratRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final QuittanceRepository quittanceRepository;
    private final ClientService clientService;
    private final GroupeClientService groupeClientService;
    private final AcquisitionClientService acquisitionClientService;

    @Transactional(readOnly = true)
    public ClientPageResponse search(
            Long agenceId,
            String query,
            Long groupeId,
            Long origineCommercialeId,
            Long collaborateurId,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 10), 100);
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        Page<com.assurance.entity.Client> result = clientRepository.searchCrm(
                agenceId,
                normalizedQuery,
                groupeId,
                origineCommercialeId,
                collaborateurId,
                PageRequest.of(safePage, safeSize, Sort.unsorted())
        );
        return ClientPageResponse.builder()
                .items(result.getContent().stream().map(clientService::toResponse).toList())
                .page(ClientPageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalPages(result.getTotalPages())
                        .totalElements(result.getTotalElements())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .build();
    }

    @Transactional(readOnly = true)
    public ClientCrmResponse get(Long agenceId, Long clientId) {
        com.assurance.entity.Client client = clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        List<Contrat> contrats = contratRepository.findForClientCrm(agenceId, clientId);
        Map<Long, List<MouvementContrat>> mouvementsByContrat = contrats.isEmpty()
                ? Collections.emptyMap()
                : mouvementContratRepository.findByContratIdInOrderByCreatedAtDesc(
                                contrats.stream().map(Contrat::getId).toList()
                        ).stream()
                        .collect(Collectors.groupingBy(
                                mouvement -> mouvement.getContrat().getId(),
                                java.util.LinkedHashMap::new,
                                Collectors.toList()
                        ));
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal impaye = BigDecimal.ZERO;
        List<ClientCrmResponse.ContratView> contractViews = new java.util.ArrayList<>();
        for (Contrat contrat : contrats) {
            List<Quittance> quittances = quittanceRepository
                    .findByContratIdAndGlobaleTrueOrderByCreatedAtAsc(contrat.getId()).stream()
                    .filter(this::isAccountingQuittance)
                    .toList();
            BigDecimal primeTotale = quittances.stream()
                    .map(Quittance::getPrimeTotale)
                    .filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            total = total.add(primeTotale);
            impaye = impaye.add(quittances.stream()
                    .filter(quittance -> !Boolean.TRUE.equals(quittance.getPayee()))
                    .map(Quittance::getPrimeTotale)
                    .filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add));
            String roles = contrat.getClients().stream()
                    .filter(link -> link.getClient().getId().equals(clientId))
                    .map(ContratClient::getRole)
                    .map(Enum::name)
                    .distinct()
                    .sorted()
                    .collect(java.util.stream.Collectors.joining(", "));
            if (roles.isBlank() && contrat.getPayeurPrime() != null
                    && contrat.getPayeurPrime().getId().equals(clientId)) {
                roles = "PAYEUR";
            }
            contractViews.add(ClientCrmResponse.ContratView.builder()
                    .id(contrat.getId())
                    .numeroDossier(contrat.getNumeroDossier())
                    .numeroPolice(contrat.getNumeroPolice())
                    .typeContrat(contrat.getTypeContrat() == null ? null : contrat.getTypeContrat().name())
                    .statut(contrat.getStatut() == null ? null : contrat.getStatut().name())
                    .dateEffet(contrat.getDateEffet())
                    .dateEcheance(contrat.getDateEcheance())
                    .compagnie(contrat.getCompagnieAssurance() == null ? null : contrat.getCompagnieAssurance().getNom())
                    .roleClient(roles)
                    .typePayeurPrime(contrat.getTypePayeurPrime() == null ? "SOUSCRIPTEUR" : contrat.getTypePayeurPrime().name())
                    .payeurPrimeNom(contrat.getPayeurPrime() == null ? null : contrat.getPayeurPrime().getNomAffichage())
                    .modeFacturation(contrat.getModeFacturation() == null ? "DIRECTE" : contrat.getModeFacturation().name())
                    .primeTotale(primeTotale)
                    .mouvements(mouvementsByContrat.getOrDefault(contrat.getId(), List.of()).stream()
                            .filter(mouvement -> mouvement.getStatut() != StatutMouvementContrat.ANNULE)
                            .map(this::toMouvementView)
                            .toList())
                    .build());
        }
        return ClientCrmResponse.builder()
                .client(clientService.toResponse(client))
                .acquisition(acquisitionClientService.find(agenceId, clientId))
                .groupes(groupeClientService.groupsForClient(agenceId, clientId))
                .contrats(contractViews)
                .totalQuittances(total)
                .totalImpayes(impaye)
                .build();
    }

    private ClientCrmResponse.MouvementView toMouvementView(MouvementContrat mouvement) {
        return ClientCrmResponse.MouvementView.builder()
                .id(mouvement.getId())
                .numeroMouvement(mouvement.getNumeroMouvement())
                .code(mouvement.getTypeMouvement() == null ? null : mouvement.getTypeMouvement().getCode())
                .libelle(mouvement.getTypeMouvement() == null ? null : mouvement.getTypeMouvement().getLibelle())
                .categorie(mouvement.getTypeMouvement() == null || mouvement.getTypeMouvement().getCategorie() == null
                        ? null
                        : mouvement.getTypeMouvement().getCategorie().name())
                .statut(mouvement.getStatut() == null ? null : mouvement.getStatut().name())
                .dateEffet(mouvement.getDateEffet())
                .dateEcheance(mouvement.getDateEcheance())
                .primeTotale(mouvement.getPrimeTotale() == null ? BigDecimal.ZERO : mouvement.getPrimeTotale())
                .build();
    }

    private boolean isAccountingQuittance(Quittance quittance) {
        if (Boolean.TRUE.equals(quittance.getAlternative())) {
            return false;
        }
        if (quittance.getMouvementContrat() != null
                && quittance.getMouvementContrat().getStatut() == StatutMouvementContrat.ANNULE) {
            return false;
        }
        return quittance.getElementFacturable() == null
                || quittance.getElementFacturable().getStatut() != StatutElementFacturable.ANNULE;
    }
}
