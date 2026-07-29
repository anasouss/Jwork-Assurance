package com.assurance.service;

import com.assurance.dto.request.AssignGroupeClientRequest;
import com.assurance.dto.request.UpsertGroupeClientRequest;
import com.assurance.dto.response.ClientResponse;
import com.assurance.dto.response.GroupeClientResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.GroupeClientMembre;
import com.assurance.enums.RelationGroupeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.GroupeClientMembreRepository;
import com.assurance.repository.GroupeClientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GroupeClientService {

    private final GroupeClientRepository groupeClientRepository;
    private final GroupeClientMembreRepository membreRepository;
    private final ClientRepository clientRepository;
    private final AgenceRepository agenceRepository;

    @Transactional(readOnly = true)
    public List<GroupeClientResponse> list(Long agenceId) {
        return groupeClientRepository.findByAgenceIdOrderByLibelleAsc(agenceId).stream()
                .map(groupe -> toResponse(agenceId, groupe, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public GroupeClientResponse get(Long agenceId, Long groupeId) {
        return toResponse(agenceId, requireGroupe(agenceId, groupeId), true);
    }

    @Transactional(readOnly = true)
    public List<GroupeClientResponse> groupsForClient(Long agenceId, Long clientId) {
        requireClient(agenceId, clientId);
        return membreRepository.findActiveByClient(agenceId, clientId, LocalDate.now()).stream()
                .map(GroupeClientMembre::getGroupe)
                .distinct()
                .map(groupe -> toResponse(agenceId, groupe, true))
                .toList();
    }

    @Transactional
    public GroupeClientResponse create(Long agenceId, UpsertGroupeClientRequest request) {
        String code = normalizeRequired(request.getCode(), "Le code du groupe est obligatoire");
        if (groupeClientRepository.existsByAgenceIdAndCodeIgnoreCase(agenceId, code)) {
            throw new BadRequestException("Ce code de groupe est deja utilise");
        }
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        GroupeClient groupe = GroupeClient.builder()
                .agence(agence)
                .code(code)
                .libelle(normalizeRequired(request.getLibelle(), "Le nom du groupe est obligatoire"))
                .facturationConsolideeDefaut(Boolean.TRUE.equals(request.getFacturationConsolideeDefaut()))
                .actif(request.getActif() == null || request.getActif())
                .build();
        applyResponsibleClients(agenceId, groupe, request);
        groupe = groupeClientRepository.save(groupe);
        ensureResponsibleMemberships(groupe);
        return toResponse(agenceId, groupe, true);
    }

    @Transactional
    public GroupeClientResponse update(Long agenceId, Long groupeId, UpsertGroupeClientRequest request) {
        GroupeClient groupe = requireGroupe(agenceId, groupeId);
        String code = normalizeRequired(request.getCode(), "Le code du groupe est obligatoire");
        if (groupeClientRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, groupeId)) {
            throw new BadRequestException("Ce code de groupe est deja utilise");
        }
        groupe.setCode(code);
        groupe.setLibelle(normalizeRequired(request.getLibelle(), "Le nom du groupe est obligatoire"));
        groupe.setFacturationConsolideeDefaut(Boolean.TRUE.equals(request.getFacturationConsolideeDefaut()));
        if (request.getActif() != null) {
            groupe.setActif(request.getActif());
        }
        applyResponsibleClients(agenceId, groupe, request);
        groupeClientRepository.save(groupe);
        ensureResponsibleMemberships(groupe);
        return toResponse(agenceId, groupe, true);
    }

    @Transactional
    public ClientResponse.GroupeView assign(
            Long agenceId,
            Long clientId,
            Long groupeId,
            RelationGroupeClient relation,
            boolean principal,
            LocalDate dateDebut
    ) {
        Client client = requireClient(agenceId, clientId);
        GroupeClient groupe = requireGroupe(agenceId, groupeId);
        if (!Boolean.TRUE.equals(groupe.getActif())) {
            throw new BadRequestException("Le groupe client est inactif");
        }
        LocalDate effectiveDate = dateDebut == null ? LocalDate.now() : dateDebut;
        if (effectiveDate.isAfter(LocalDate.now())) {
            throw new BadRequestException("La date de rattachement ne peut pas etre future");
        }
        RelationGroupeClient effectiveRelation = relation == null ? RelationGroupeClient.SOCIETE_LIEE : relation;
        if (principal) {
            for (GroupeClientMembre current : membreRepository.findActiveByClient(agenceId, clientId, LocalDate.now())) {
                if (Boolean.TRUE.equals(current.getPrincipal()) && !current.getGroupe().getId().equals(groupeId)) {
                    current.setDateFin(LocalDate.now());
                    membreRepository.save(current);
                }
            }
        }
        GroupeClientMembre membership = membreRepository.findActiveMembership(groupeId, clientId, LocalDate.now())
                .orElseGet(() -> GroupeClientMembre.builder()
                        .groupe(groupe)
                        .client(client)
                        .dateDebut(effectiveDate)
                        .build());
        membership.setTypeRelation(effectiveRelation);
        membership.setPrincipal(principal);
        membership.setDateFin(null);
        membreRepository.save(membership);
        return toClientGroupView(membership);
    }

    @Transactional
    public ClientResponse.GroupeView assign(Long agenceId, Long clientId, AssignGroupeClientRequest request) {
        return assign(
                agenceId,
                clientId,
                request.getGroupeClientId(),
                request.getTypeRelation(),
                request.getPrincipal() == null || request.getPrincipal(),
                request.getDateDebut()
        );
    }

    @Transactional
    public void endMembership(Long agenceId, Long clientId, Long membershipId) {
        GroupeClientMembre membership = membreRepository.findById(membershipId)
                .orElseThrow(() -> new ResourceNotFoundException("Rattachement groupe", membershipId));
        if (!membership.getClient().getId().equals(clientId)
                || !membership.getGroupe().getAgence().getId().equals(agenceId)) {
            throw new ResourceNotFoundException("Rattachement groupe", membershipId);
        }
        membership.setDateFin(LocalDate.now());
        membership.setPrincipal(false);
        membreRepository.save(membership);
    }

    @Transactional
    public void endActiveMemberships(Long agenceId, Long clientId) {
        requireClient(agenceId, clientId);
        for (GroupeClientMembre membership : membreRepository.findActiveByClient(agenceId, clientId, LocalDate.now())) {
            membership.setDateFin(LocalDate.now());
            membership.setPrincipal(false);
            membreRepository.save(membership);
        }
    }

    @Transactional(readOnly = true)
    public ClientResponse.GroupeView activePrincipalMembership(Long agenceId, Long clientId) {
        List<GroupeClientMembre> memberships = membreRepository.findActiveByClient(agenceId, clientId, LocalDate.now());
        return memberships.stream()
                .filter(item -> Boolean.TRUE.equals(item.getPrincipal()))
                .findFirst()
                .or(() -> memberships.stream().findFirst())
                .map(this::toClientGroupView)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public boolean isActiveMember(Long agenceId, Long groupeId, Long clientId, LocalDate date) {
        GroupeClient groupe = requireGroupe(agenceId, groupeId);
        return Boolean.TRUE.equals(groupe.getActif())
                && membreRepository.findActiveMembership(groupeId, clientId, date == null ? LocalDate.now() : date).isPresent();
    }

    @Transactional(readOnly = true)
    public GroupeClient requireGroupe(Long agenceId, Long groupeId) {
        return groupeClientRepository.findByAgenceIdAndId(agenceId, groupeId)
                .orElseThrow(() -> new ResourceNotFoundException("Groupe client", groupeId));
    }

    private void applyResponsibleClients(Long agenceId, GroupeClient groupe, UpsertGroupeClientRequest request) {
        groupe.setClientTete(request.getClientTeteId() == null ? null : requireClient(agenceId, request.getClientTeteId()));
        groupe.setClientTresorerie(request.getClientTresorerieId() == null ? null : requireClient(agenceId, request.getClientTresorerieId()));
    }

    private void ensureResponsibleMemberships(GroupeClient groupe) {
        if (groupe.getClientTete() != null) {
            assign(
                    groupe.getAgence().getId(),
                    groupe.getClientTete().getId(),
                    groupe.getId(),
                    RelationGroupeClient.TETE_GROUPE,
                    true,
                    LocalDate.now()
            );
        }
        if (groupe.getClientTresorerie() != null
                && (groupe.getClientTete() == null || !groupe.getClientTresorerie().getId().equals(groupe.getClientTete().getId()))) {
            assign(
                    groupe.getAgence().getId(),
                    groupe.getClientTresorerie().getId(),
                    groupe.getId(),
                    RelationGroupeClient.SOCIETE_LIEE,
                    false,
                    LocalDate.now()
            );
        }
    }

    private Client requireClient(Long agenceId, Long clientId) {
        return clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
    }

    private GroupeClientResponse toResponse(Long agenceId, GroupeClient groupe, boolean includeMembers) {
        List<GroupeClientResponse.MembreView> membres = includeMembers
                ? membreRepository.findActiveByGroupe(agenceId, groupe.getId(), LocalDate.now()).stream()
                .map(item -> GroupeClientResponse.MembreView.builder()
                        .membershipId(item.getId())
                        .clientId(item.getClient().getId())
                        .clientNom(item.getClient().getNomAffichage())
                        .typeRelation(item.getTypeRelation())
                        .dateDebut(item.getDateDebut())
                        .dateFin(item.getDateFin())
                        .principal(item.getPrincipal())
                        .build())
                .toList()
                : List.of();
        return GroupeClientResponse.builder()
                .id(groupe.getId())
                .code(groupe.getCode())
                .libelle(groupe.getLibelle())
                .clientTeteId(groupe.getClientTete() == null ? null : groupe.getClientTete().getId())
                .clientTeteNom(groupe.getClientTete() == null ? null : groupe.getClientTete().getNomAffichage())
                .clientTresorerieId(groupe.getClientTresorerie() == null ? null : groupe.getClientTresorerie().getId())
                .clientTresorerieNom(groupe.getClientTresorerie() == null ? null : groupe.getClientTresorerie().getNomAffichage())
                .facturationConsolideeDefaut(groupe.getFacturationConsolideeDefaut())
                .actif(groupe.getActif())
                .membres(membres)
                .build();
    }

    private ClientResponse.GroupeView toClientGroupView(GroupeClientMembre membership) {
        GroupeClient groupe = membership.getGroupe();
        return ClientResponse.GroupeView.builder()
                .id(groupe.getId())
                .code(groupe.getCode())
                .libelle(groupe.getLibelle())
                .typeRelation(membership.getTypeRelation())
                .clientTresorerieId(groupe.getClientTresorerie() == null ? null : groupe.getClientTresorerie().getId())
                .clientTresorerieNom(groupe.getClientTresorerie() == null ? null : groupe.getClientTresorerie().getNomAffichage())
                .facturationConsolideeDefaut(groupe.getFacturationConsolideeDefaut())
                .build();
    }

    private String normalizeRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }
}
