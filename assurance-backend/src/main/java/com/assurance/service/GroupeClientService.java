package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityCommand;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityValues;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.activity.ClientActivity;
import com.assurance.activity.ClientGroupActivity;
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
    private final BusinessActivityRecorder businessActivityRecorder;

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
        return businessActivityRecorder.perform(() -> createRecord(agenceId, request), result ->
                ClientGroupActivity.command(agenceId, null, result, ActivityAction.CREATED,
                        "Groupe client créé", "CLIENT_GROUP_CREATION"));
    }

    private GroupeClientResponse createRecord(Long agenceId, UpsertGroupeClientRequest request) {
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
        synchronizeResponsibleMemberships(groupe);
        return toResponse(agenceId, groupe, true);
    }

    @Transactional
    public GroupeClientResponse update(Long agenceId, Long groupeId, UpsertGroupeClientRequest request) {
        GroupeClient groupe = requireGroupe(agenceId, groupeId);
        var before = toResponse(agenceId, groupe, true);
        return businessActivityRecorder.perform(() -> updateRecord(agenceId, groupeId, groupe, request), result ->
                ClientGroupActivity.command(agenceId, before, result, ActivityAction.UPDATED,
                        "Groupe client modifié", "CLIENT_GROUP_UPDATE"));
    }

    private GroupeClientResponse updateRecord(Long agenceId, Long groupeId, GroupeClient groupe, UpsertGroupeClientRequest request) {
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
        synchronizeResponsibleMemberships(groupe);
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
        var before = membershipSnapshot(agenceId, clientId, groupeId, effectiveDate);
        RelationGroupeClient effectiveRelation = relation == null ? RelationGroupeClient.SOCIETE_LIEE : relation;
        if (effectiveRelation != RelationGroupeClient.TETE_GROUPE
                && groupe.getClientTete() != null
                && groupe.getClientTete().getId().equals(clientId)) {
            throw new BadRequestException("Définissez une autre tête de groupe avant de modifier la relation de ce client");
        }
        if (effectiveRelation == RelationGroupeClient.TETE_GROUPE) {
            for (GroupeClientMembre current : membreRepository.findActiveByGroupe(agenceId, groupeId, effectiveDate)) {
                if (current.getTypeRelation() == RelationGroupeClient.TETE_GROUPE
                        && !current.getClient().getId().equals(clientId)) {
                    current.setTypeRelation(RelationGroupeClient.SOCIETE_LIEE);
                    current.setPrincipal(false);
                    membreRepository.save(current);
                }
            }
            groupe.setClientTete(client);
            groupeClientRepository.save(groupe);
            principal = true;
        }
        if (principal) {
            for (GroupeClientMembre current : membreRepository.findActiveByClient(agenceId, clientId, effectiveDate)) {
                if (Boolean.TRUE.equals(current.getPrincipal()) && !current.getGroupe().getId().equals(groupeId)) {
                    current.setDateFin(effectiveDate);
                    current.setPrincipal(false);
                    membreRepository.save(current);
                }
            }
        }
        GroupeClientMembre membership = membreRepository.findOpenMemberships(groupeId, clientId).stream()
                .findFirst()
                .orElseGet(() -> GroupeClientMembre.builder()
                        .groupe(groupe)
                        .client(client)
                        .dateDebut(effectiveDate)
                        .build());
        if (membership.getDateDebut() == null || effectiveDate.isBefore(membership.getDateDebut())) {
            membership.setDateDebut(effectiveDate);
        }
        membership.setTypeRelation(effectiveRelation);
        membership.setPrincipal(principal);
        membership.setDateFin(null);
        membreRepository.save(membership);
        var changes = ActivityValues.changes(before, membershipSnapshot(agenceId, clientId, groupeId, effectiveDate));
        if (!changes.isEmpty()) businessActivityRecorder.record(new ActivityCommand(agenceId, ActivityModule.CRM,
                ActivityAction.ASSIGNED, "Rattachement au groupe enregistré", "CLIENT_GROUP_ASSIGNMENT",
                ClientActivity.reference(client), List.of(ClientGroupActivity.reference(groupe)), changes));
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
        assertMembershipCanEnd(membership);
        var before = new ActivityValues();
        ClientGroupActivity.addMembership(before, membership);
        membership.setDateFin(LocalDate.now());
        membership.setPrincipal(false);
        membreRepository.save(membership);
        var after = new ActivityValues();
        ClientGroupActivity.addMembership(after, membership);
        var changes = ActivityValues.changes(before.snapshot(), after.snapshot());
        if (!changes.isEmpty()) businessActivityRecorder.record(new ActivityCommand(agenceId, ActivityModule.CRM,
                ActivityAction.UNASSIGNED, "Rattachement au groupe terminé", "CLIENT_GROUP_MEMBERSHIP_END",
                ClientActivity.reference(membership.getClient()), List.of(ClientGroupActivity.reference(membership.getGroupe())), changes));
    }

    @Transactional
    public void endActiveMemberships(Long agenceId, Long clientId) {
        Client client = requireClient(agenceId, clientId);
        var before = new ActivityValues();
        var after = new ActivityValues();
        var references = new java.util.ArrayList<com.assurance.activity.ActivityReference>();
        for (GroupeClientMembre membership : membreRepository.findActiveByClient(agenceId, clientId, LocalDate.now())) {
            assertMembershipCanEnd(membership);
            ClientGroupActivity.addMembership(before, membership);
            references.add(ClientGroupActivity.reference(membership.getGroupe()));
            membership.setDateFin(LocalDate.now());
            membership.setPrincipal(false);
            membreRepository.save(membership);
            ClientGroupActivity.addMembership(after, membership);
        }
        var changes = ActivityValues.changes(before.snapshot(), after.snapshot());
        if (!changes.isEmpty()) businessActivityRecorder.record(new ActivityCommand(agenceId, ActivityModule.CRM,
                ActivityAction.UNASSIGNED, "Client détaché de ses groupes", "CLIENT_GROUP_MEMBERSHIPS_END",
                ClientActivity.reference(client), references, changes));
    }

    private java.util.Map<String, String> membershipSnapshot(Long agenceId, Long clientId, Long groupeId, LocalDate date) {
        var values = new ActivityValues();
        membreRepository.findActiveByClient(agenceId, clientId, date).forEach(member -> ClientGroupActivity.addMembership(values, member));
        membreRepository.findActiveByGroupe(agenceId, groupeId, date).forEach(member -> ClientGroupActivity.addMembership(values, member));
        var group = requireGroupe(agenceId, groupeId);
        values.put("Tête de groupe", group.getClientTete() == null ? null : ClientActivity.reference(group.getClientTete()).label());
        return values.snapshot();
    }

    @Transactional(readOnly = true)
    public ClientResponse.GroupeView activePrincipalMembership(Long agenceId, Long clientId) {
        return activePrincipalMembership(agenceId, clientId, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public ClientResponse.GroupeView activePrincipalMembership(Long agenceId, Long clientId, LocalDate date) {
        List<GroupeClientMembre> memberships = membreRepository.findActiveByClient(
                agenceId,
                clientId,
                date == null ? LocalDate.now() : date
        );
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
        groupe.setClientTete(request.getClientTeteId() == null ? null : requireActiveClient(agenceId, request.getClientTeteId()));
        groupe.setClientTresorerie(request.getClientTresorerieId() == null ? null : requireActiveClient(agenceId, request.getClientTresorerieId()));
    }

    private void assertMembershipCanEnd(GroupeClientMembre membership) {
        GroupeClient groupe = membership.getGroupe();
        Long clientId = membership.getClient().getId();
        if (groupe.getClientTete() != null && groupe.getClientTete().getId().equals(clientId)) {
            throw new BadRequestException("Définissez une autre tête de groupe avant de retirer ce client");
        }
        if (groupe.getClientTresorerie() != null && groupe.getClientTresorerie().getId().equals(clientId)) {
            throw new BadRequestException("Définissez une autre entité responsable des paiements avant de retirer ce client");
        }
    }

    private void synchronizeResponsibleMemberships(GroupeClient groupe) {
        if (!Boolean.TRUE.equals(groupe.getActif())) {
            return;
        }
        LocalDate today = LocalDate.now();
        Long headId = groupe.getClientTete() == null ? null : groupe.getClientTete().getId();
        for (GroupeClientMembre membership : membreRepository.findActiveByGroupe(
                groupe.getAgence().getId(),
                groupe.getId(),
                today
        )) {
            if (membership.getTypeRelation() == RelationGroupeClient.TETE_GROUPE
                    && (headId == null || !headId.equals(membership.getClient().getId()))) {
                membership.setTypeRelation(RelationGroupeClient.SOCIETE_LIEE);
                membership.setPrincipal(false);
                membreRepository.save(membership);
            }
        }
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
            if (membreRepository.findActiveMembership(
                    groupe.getId(),
                    groupe.getClientTresorerie().getId(),
                    today
            ).isEmpty()) {
                assign(
                        groupe.getAgence().getId(),
                        groupe.getClientTresorerie().getId(),
                        groupe.getId(),
                        RelationGroupeClient.SOCIETE_LIEE,
                        false,
                        today
                );
            }
        }
    }

    private Client requireClient(Long agenceId, Long clientId) {
        return clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
    }

    private Client requireActiveClient(Long agenceId, Long clientId) {
        Client client = requireClient(agenceId, clientId);
        if (!Boolean.TRUE.equals(client.getActif())) {
            throw new BadRequestException("Le client responsable doit être actif");
        }
        return client;
    }

    private GroupeClientResponse toResponse(Long agenceId, GroupeClient groupe, boolean includeMembers) {
        List<GroupeClientResponse.MembreView> membres = includeMembers
                ? membreRepository.findActiveByGroupe(agenceId, groupe.getId(), LocalDate.now()).stream()
                .map(item -> GroupeClientResponse.MembreView.builder()
                        .membershipId(item.getId())
                        .clientId(item.getClient().getId())
                        .clientCode(item.getClient().getCodeClient())
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
