package com.assurance.service;

import com.assurance.dto.response.SinistreContratLookupResponse;
import com.assurance.entity.ContratClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.SinistreContratLookupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SinistreContratLookupService {

    private final SinistreContratLookupRepository contracts;
    private final ContratClientRepository clients;

    @Transactional(readOnly = true)
    public List<SinistreContratLookupResponse> search(Long agenceId, Long brancheId, String query) {
        if (brancheId == null || query == null || query.trim().length() < 2 || query.trim().length() > 120) {
            throw new BadRequestException("Sélectionnez une branche et renseignez une recherche de 2 à 120 caractères");
        }
        String literal = query.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_");
        var results = contracts.search(agenceId, brancheId, "%" + literal + "%", PageRequest.of(0, 20));
        if (results.isEmpty()) return List.of();
        var contractIds = results.stream().map(item -> item.getId()).toList();
        var vehiclesByContract = contracts.matchingVehicles(agenceId, contractIds, "%" + literal + "%")
                .stream().filter(item -> item.getVehicule() != null)
                .collect(Collectors.groupingBy(item -> item.getMouvementContrat().getContrat().getId()));
        var rolesByContract = clients.findByContratIdIn(results.stream().map(item -> item.getId()).toList())
                .stream().sorted(Comparator.comparing((ContratClient item) -> !Boolean.TRUE.equals(item.getPrincipalPourRole()))
                        .thenComparing(ContratClient::getId))
                .collect(Collectors.groupingBy(item -> item.getContrat().getId()));
        return results.stream().map(contract -> new SinistreContratLookupResponse(
                contract.getId(), contract.getNumeroPolice(), contract.getNumeroDossier(),
                contract.getBrancheAssurance().getCode(), contract.getBrancheAssurance().getLibelle(),
                contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getCode(),
                contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getNom(),
                contract.getDateEffet(), contract.getDateEcheance(),
                rolesByContract.getOrDefault(contract.getId(), List.of()).stream()
                        .map(role -> new SinistreContratLookupResponse.ClientRole(role.getRole(), role.getClient().getNomAffichage()))
                        .toList(),
                vehiclesByContract.getOrDefault(contract.getId(), List.of()).stream()
                        .map(vehicle -> new SinistreContratLookupResponse.MatchedVehicle(vehicle.getVehicule().getId(),
                                vehicle.getImmatriculation() == null || vehicle.getImmatriculation().isBlank()
                                        ? vehicle.getImmatriculationProvisoire() : vehicle.getImmatriculation()))
                        .distinct().toList()
        )).toList();
    }
}
