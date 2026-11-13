package com.assurance.service;

import com.assurance.dto.response.SinistreContratLookupResponse;
import com.assurance.entity.ContratClient;
import com.assurance.entity.MouvementVehicule;
import com.assurance.enums.TypeRechercheContratSinistre;
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
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SinistreContratLookupService {

    private final SinistreContratLookupRepository contracts;
    private final ContratClientRepository clients;

    @Transactional(readOnly = true)
    public List<SinistreContratLookupResponse> search(Long agenceId, Long brancheId, String query, TypeRechercheContratSinistre type) {
        if (brancheId == null || type == null || query == null || query.isBlank() || query.trim().length() > 120) {
            throw new BadRequestException("Sélectionnez une branche, un type de recherche et renseignez une valeur de 1 à 120 caractères");
        }
        String value = query.trim().toLowerCase(Locale.ROOT);
        if (type == TypeRechercheContratSinistre.ASSURE) {
            if (value.length() < 3) throw new BadRequestException("Renseignez au moins 3 caractères du nom de l'assuré");
            value = "%" + value.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        } else if (type == TypeRechercheContratSinistre.IMMATRICULATION) {
            value = value.replace(" ", "").replace("-", "");
            if (value.isEmpty()) throw new BadRequestException("Renseignez une immatriculation complète");
        }
        var results = contracts.search(agenceId, brancheId, type.name(), value, PageRequest.of(0, 20));
        if (results.isEmpty()) return List.of();
        var contractIds = results.stream().map(item -> item.getId()).toList();
        Map<Long, List<MouvementVehicule>> vehiclesByContract = type == TypeRechercheContratSinistre.IMMATRICULATION
                ? contracts.matchingVehicles(agenceId, contractIds, value)
                .stream().filter(item -> item.getVehicule() != null)
                .collect(Collectors.groupingBy(item -> item.getMouvementContrat().getContrat().getId())) : Map.of();
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
