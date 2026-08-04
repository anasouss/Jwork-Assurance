package com.assurance.service;

import com.assurance.dto.response.AvenantDraftSummaryResponse;
import com.assurance.dto.response.ContratListGroupResponse;
import com.assurance.dto.response.ContratListItemResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.Vehicule;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.VehiculeRepository;
import com.assurance.service.renewal.RenewalPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContratSearchService {

    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 100;

    private final ContratRepository contratRepository;
    private final ContratClientRepository contratClientRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final VehiculeRepository vehiculeRepository;
    private final AvenantDraftService avenantDraftService;
    private final RenewalPolicy renewalPolicy;

    @Transactional(readOnly = true)
    public PagedResponse<ContratListGroupResponse> searchContracts(
            Long agenceId,
            TypeContrat typeContrat,
            String typeDate,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            Long compagnieId,
            String numeroPolice,
            Long clientId,
            Integer page,
            Integer size
    ) {
        Page<Long> leafIds = contratRepository.searchCurrentContractIds(
                agenceId,
                typeContrat,
                normalizeDateType(typeDate),
                dateDu,
                dateAu,
                normalize(search),
                compagnieId,
                normalize(numeroPolice),
                clientId,
                pageRequest(page, size)
        );
        Map<Long, Contrat> contractsById = loadRenewalChains(agenceId, leafIds.getContent());
        List<ContratListGroupResponse> groups = buildGroups(agenceId, leafIds.getContent(), contractsById);
        return PagedResponse.<ContratListGroupResponse>builder()
                .items(groups)
                .page(PageMetadata.from(leafIds))
                .build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<ContratListItemResponse> searchProspections(
            Long agenceId,
            Long compagnieId,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            String numeroDevis,
            Integer page,
            Integer size
    ) {
        LocalDateTime dateDuTime = dateDu == null ? null : dateDu.atStartOfDay();
        LocalDateTime dateAuExclusive = dateAu == null ? null : dateAu.plusDays(1).atStartOfDay();
        Page<Long> ids = contratRepository.searchProspectionIds(
                agenceId,
                compagnieId,
                dateDuTime,
                dateAuExclusive,
                normalize(search),
                normalize(numeroDevis),
                pageRequest(page, size)
        );
        Map<Long, Contrat> contractsById = loadContracts(agenceId, ids.getContent());
        List<ContratListItemResponse> items = mapItems(
                agenceId,
                ids.getContent().stream().map(contractsById::get).filter(java.util.Objects::nonNull).toList()
        );
        return PagedResponse.<ContratListItemResponse>builder()
                .items(items)
                .page(PageMetadata.from(ids))
                .build();
    }

    private List<ContratListGroupResponse> buildGroups(
            Long agenceId,
            List<Long> leafIds,
            Map<Long, Contrat> contractsById
    ) {
        List<Contrat> allContracts = new ArrayList<>(contractsById.values());
        Map<Long, ContratListItemResponse> itemsById = mapItems(agenceId, allContracts).stream()
                .collect(Collectors.toMap(
                        ContratListItemResponse::getId,
                        Function.identity(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
        List<ContratListGroupResponse> groups = new ArrayList<>();
        for (Long leafId : leafIds) {
            List<ContratListItemResponse> chain = new ArrayList<>();
            Set<Long> visited = new LinkedHashSet<>();
            Contrat current = contractsById.get(leafId);
            while (current != null && visited.add(current.getId())) {
                ContratListItemResponse item = itemsById.get(current.getId());
                if (item != null) {
                    chain.add(item);
                }
                current = current.getContratOrigine() == null
                        ? null
                        : contractsById.get(current.getContratOrigine().getId());
            }
            groups.add(ContratListGroupResponse.builder()
                    .key(String.valueOf(leafId))
                    .contrats(chain)
                    .build());
        }
        return groups;
    }

    private List<ContratListItemResponse> mapItems(Long agenceId, List<Contrat> contracts) {
        if (contracts.isEmpty()) {
            return List.of();
        }
        List<Long> ids = contracts.stream().map(Contrat::getId).toList();
        Map<Long, List<ContratClient>> clients = groupByContract(
                contratClientRepository.findByContratIdIn(ids),
                link -> link.getContrat().getId()
        );
        Map<Long, List<MouvementContrat>> movements = groupByContract(
                mouvementContratRepository.findByContratIdInOrderByCreatedAtDesc(ids),
                movement -> movement.getContrat().getId()
        );
        Map<Long, List<Vehicule>> vehicles = groupByContract(
                vehiculeRepository.findByContratIdInOrderByCreatedAtAsc(ids),
                vehicle -> vehicle.getContrat().getId()
        );
        Map<Long, List<AvenantDraftSummaryResponse>> drafts = avenantDraftService
                .listSummaries(agenceId, ids)
                .stream()
                .collect(Collectors.groupingBy(AvenantDraftSummaryResponse::getContratId));

        return contracts.stream()
                .map(contract -> toItem(
                        contract,
                        clients.getOrDefault(contract.getId(), List.of()),
                        movements.getOrDefault(contract.getId(), List.of()),
                        vehicles.getOrDefault(contract.getId(), List.of()),
                        drafts.getOrDefault(contract.getId(), List.of())
                ))
                .toList();
    }

    private ContratListItemResponse toItem(
            Contrat contract,
            List<ContratClient> clients,
            List<MouvementContrat> movements,
            List<Vehicule> vehicles,
            List<AvenantDraftSummaryResponse> drafts
    ) {
        List<MouvementContrat> activeMovements = movements.stream()
                .filter(movement -> movement.getStatut() != StatutMouvementContrat.ANNULE)
                .sorted(Comparator
                        .comparing(MouvementContrat::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MouvementContrat::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<ContratListItemResponse.MovementSummary> movementViews = new ArrayList<>();
        for (int index = 0; index < activeMovements.size(); index++) {
            movementViews.add(toMovement(activeMovements.get(index), index + 1));
        }
        Vehicule firstVehicle = vehicles.stream()
                .filter(vehicle -> !Boolean.FALSE.equals(vehicle.getActif()))
                .findFirst()
                .orElse(null);

        return ContratListItemResponse.builder()
                .id(contract.getId())
                .numeroContrat(contract.getNumeroContrat())
                .numeroDevis(contract.getNumeroDevis())
                .numeroDossier(contract.getNumeroDossier())
                .numeroPolice(contract.getNumeroPolice())
                .createdAt(contract.getCreatedAt())
                .typeContrat(contract.getTypeContrat())
                .statut(contract.getStatut())
                .compagnieAssuranceId(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getId())
                .compagnieCode(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getCode())
                .compagnieLibelle(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getNom())
                .conventionId(contract.getConvention() == null ? null : contract.getConvention().getId())
                .conventionCode(contract.getConvention() == null ? null : contract.getConvention().getCode())
                .conventionLibelle(contract.getConvention() == null ? null : contract.getConvention().getIntitule())
                .contratOrigineId(contract.getContratOrigine() == null ? null : contract.getContratOrigine().getId())
                .renouvele(contract.getRenouvele())
                .modeTermeRenouvellement(contract.getModeTermeRenouvellement())
                .renouvellementTermeCompagnieEligible(renewalPolicy.isCompanyTermEligible(contract))
                .dateEffet(contract.getDateEffet())
                .dateEcheance(contract.getDateEcheance())
                .typeRenouvellement(contract.getTypeRenouvellement())
                .brouillon(contract.getBrouillon())
                .prospection(contract.getProspection())
                .premierTypeVehicule(firstVehicle == null ? null : firstVehicle.getTypeVehicule().name())
                .clients(clients.stream().map(this::toClientLink).toList())
                .mouvements(movementViews)
                .avenantDrafts(drafts)
                .build();
    }

    private ContratListItemResponse.ClientLink toClientLink(ContratClient link) {
        return ContratListItemResponse.ClientLink.builder()
                .clientId(link.getClient().getId())
                .codeClient(link.getClient().getCodeClient())
                .nomAffichage(link.getClient().getNomAffichage())
                .role(link.getRole().name())
                .principalPourRole(Boolean.TRUE.equals(link.getPrincipalPourRole()))
                .build();
    }

    private ContratListItemResponse.MovementSummary toMovement(MouvementContrat movement, int fallbackPosition) {
        String numero = movement.getNumeroMouvement();
        String displayedNumber = numero != null && numero.trim().matches("\\d+")
                ? numero.trim()
                : String.valueOf(fallbackPosition);
        return ContratListItemResponse.MovementSummary.builder()
                .id(movement.getId())
                .code(movement.getTypeMouvement() == null ? null : movement.getTypeMouvement().getCode())
                .libelle(movement.getTypeMouvement() == null ? null : movement.getTypeMouvement().getLibelle())
                .categorie(movement.getTypeMouvement() == null || movement.getTypeMouvement().getCategorie() == null
                        ? null
                        : movement.getTypeMouvement().getCategorie().name())
                .statut(movement.getStatut() == null ? null : movement.getStatut().name())
                .numeroMouvement(displayedNumber)
                .dateEffet(movement.getDateEffet())
                .dateEcheance(movement.getDateEcheance())
                .autoriseAssistance(movement.getTypeMouvement() != null
                        && Boolean.TRUE.equals(movement.getTypeMouvement().getAutoriseAssistance()))
                .autoriseCarteVerte(movement.getTypeMouvement() != null
                        && Boolean.TRUE.equals(movement.getTypeMouvement().getAutoriseCarteVerte()))
                .primeNette(movement.getPrimeNette())
                .taxe(movement.getTaxe())
                .taxeParafiscale(movement.getTaxeParafiscale())
                .accessoire(movement.getAccessoire())
                .cnpac(movement.getCnpac())
                .primeTotale(movement.getPrimeTotale())
                .build();
    }

    private Map<Long, Contrat> loadRenewalChains(Long agenceId, Collection<Long> leafIds) {
        Map<Long, Contrat> result = new LinkedHashMap<>();
        Set<Long> pending = new LinkedHashSet<>(leafIds);
        while (!pending.isEmpty()) {
            List<Contrat> batch = contratRepository.findByAgenceIdAndIdIn(agenceId, List.copyOf(pending));
            pending.clear();
            for (Contrat contract : batch) {
                result.put(contract.getId(), contract);
                if (contract.getContratOrigine() != null
                        && !result.containsKey(contract.getContratOrigine().getId())) {
                    pending.add(contract.getContratOrigine().getId());
                }
            }
        }
        return result;
    }

    private Map<Long, Contrat> loadContracts(Long agenceId, Collection<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return contratRepository.findByAgenceIdAndIdIn(agenceId, List.copyOf(ids)).stream()
                .collect(Collectors.toMap(Contrat::getId, Function.identity()));
    }

    private <T> Map<Long, List<T>> groupByContract(List<T> values, Function<T, Long> contractId) {
        return values.stream().collect(Collectors.groupingBy(contractId, LinkedHashMap::new, Collectors.toList()));
    }

    private PageRequest pageRequest(Integer page, Integer size) {
        int safePage = Math.max(page == null ? 0 : page, 0);
        int requestedSize = size == null ? DEFAULT_PAGE_SIZE : size;
        int safeSize = Math.min(Math.max(requestedSize, 10), MAX_PAGE_SIZE);
        return PageRequest.of(safePage, safeSize, Sort.unsorted());
    }

    private String normalizeDateType(String value) {
        return "ECHEANCE".equalsIgnoreCase(value) ? "ECHEANCE" : "EFFET";
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

}
