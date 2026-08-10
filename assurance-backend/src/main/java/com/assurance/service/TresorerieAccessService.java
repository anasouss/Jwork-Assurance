package com.assurance.service;

import com.assurance.dto.request.UpsertAffectationsCompteTresorerieRequest;
import com.assurance.dto.response.AffectationCompteTresorerieResponse;
import com.assurance.dto.response.UtilisateurTresorerieResponse;
import com.assurance.entity.AffectationCompteTresorerie;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.NiveauAccesCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AffectationCompteTresorerieRepository;
import com.assurance.repository.CompteTresorerieRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TresorerieAccessService {

    private final AffectationCompteTresorerieRepository affectationRepository;
    private final CompteTresorerieRepository compteRepository;
    private final UtilisateurRepository utilisateurRepository;

    @Transactional(readOnly = true)
    public List<CompteTresorerie> visibleAccounts(Long agenceId, Long utilisateurId) {
        Set<Long> visibleIds = affectationRepository
                .findByAgenceIdAndUtilisateurIdAndActifTrue(agenceId, utilisateurId)
                .stream()
                .filter(row -> row.getNiveauAcces().allows(NiveauAccesCompteTresorerie.CONSULTATION))
                .map(row -> row.getCompteTresorerie().getId())
                .collect(java.util.stream.Collectors.toSet());
        return compteRepository.findByAgenceIdOrderByTypeCompteAscLibelleAsc(agenceId).stream()
                .filter(account -> visibleIds.contains(account.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public AffectationCompteTresorerie requireAccess(
            Long agenceId,
            Long compteId,
            NiveauAccesCompteTresorerie required
    ) {
        Long utilisateurId = currentUserId();
        AffectationCompteTresorerie access = affectationRepository
                .findByAgenceIdAndCompteTresorerieIdAndUtilisateurIdAndActifTrue(
                        agenceId,
                        compteId,
                        utilisateurId
                )
                .orElseThrow(() -> new AccessDeniedException(
                        "Ce compte de trésorerie ne vous est pas affecté"
                ));
        if (!access.getNiveauAcces().allows(required)) {
            throw new AccessDeniedException("Niveau d'accès insuffisant sur ce compte de trésorerie");
        }
        return access;
    }

    @Transactional(readOnly = true)
    public List<AffectationCompteTresorerieResponse> listAssignments(Long agenceId, Long compteId) {
        requireAccount(agenceId, compteId);
        return affectationRepository
                .findByAgenceIdAndCompteTresorerieIdOrderByUtilisateurNomAscUtilisateurPrenomAsc(
                        agenceId,
                        compteId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UtilisateurTresorerieResponse> listAgencyUsers(Long agenceId) {
        return utilisateurRepository.findByAgenceIdOrderByNomAscPrenomAsc(agenceId).stream()
                .map(user -> UtilisateurTresorerieResponse.builder()
                        .id(user.getId())
                        .nomComplet(user.getFullName())
                        .email(user.getEmail())
                        .role(user.getRole() == null ? null : user.getRole().getNom())
                        .actif(user.getActif())
                        .build())
                .toList();
    }

    @Transactional
    public List<AffectationCompteTresorerieResponse> replaceAssignments(
            Long agenceId,
            Long compteId,
            UpsertAffectationsCompteTresorerieRequest request
    ) {
        CompteTresorerie account = requireAccount(agenceId, compteId);
        Map<Long, UpsertAffectationsCompteTresorerieRequest.Ligne> requested = new LinkedHashMap<>();
        for (UpsertAffectationsCompteTresorerieRequest.Ligne row : request.getAffectations()) {
            if (requested.putIfAbsent(row.getUtilisateurId(), row) != null) {
                throw new BadRequestException("Un utilisateur ne peut être affecté qu'une fois au même compte");
            }
        }
        Map<Long, Utilisateur> users = utilisateurRepository.findAllById(requested.keySet()).stream()
                .collect(java.util.stream.Collectors.toMap(Utilisateur::getId, user -> user));
        if (users.size() != requested.size() || users.values().stream().anyMatch(user ->
                user.getAgence() == null || !agenceId.equals(user.getAgence().getId()))) {
            throw new BadRequestException("Un ou plusieurs utilisateurs n'appartiennent pas à cette agence");
        }

        Map<Long, AffectationCompteTresorerie> existing = affectationRepository
                .findByAgenceIdAndCompteTresorerieIdOrderByUtilisateurNomAscUtilisateurPrenomAsc(
                        agenceId,
                        compteId
                )
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> row.getUtilisateur().getId(),
                        row -> row
                ));
        existing.values().forEach(row -> row.setActif(false));
        for (Map.Entry<Long, UpsertAffectationsCompteTresorerieRequest.Ligne> entry : requested.entrySet()) {
            UpsertAffectationsCompteTresorerieRequest.Ligne input = entry.getValue();
            AffectationCompteTresorerie row = existing.getOrDefault(entry.getKey(),
                    AffectationCompteTresorerie.builder()
                            .agence(account.getAgence())
                            .compteTresorerie(account)
                            .utilisateur(users.get(entry.getKey()))
                            .build());
            row.setNiveauAcces(input.getNiveauAcces());
            row.setActif(input.getActif());
            existing.put(entry.getKey(), row);
        }
        affectationRepository.saveAll(existing.values());
        return listAssignments(agenceId, compteId);
    }

    @Transactional
    public void assignCreatorAsSupervisor(CompteTresorerie account) {
        Long userId = currentUserId();
        Utilisateur user = utilisateurRepository.findById(userId)
                .filter(candidate -> candidate.getAgence() != null
                        && account.getAgence().getId().equals(candidate.getAgence().getId()))
                .orElseThrow(() -> new AccessDeniedException("Utilisateur de l'agence introuvable"));
        AffectationCompteTresorerie assignment = affectationRepository
                .findByCompteTresorerieIdAndUtilisateurId(account.getId(), userId)
                .orElseGet(() -> AffectationCompteTresorerie.builder()
                        .agence(account.getAgence())
                        .compteTresorerie(account)
                        .utilisateur(user)
                        .build());
        assignment.setNiveauAcces(NiveauAccesCompteTresorerie.SUPERVISION);
        assignment.setActif(true);
        affectationRepository.save(assignment);
    }

    public Long currentUserId() {
        Long userId = TenantContext.getCurrentUser();
        if (userId == null) {
            throw new AccessDeniedException("Utilisateur non authentifié");
        }
        return userId;
    }

    private CompteTresorerie requireAccount(Long agenceId, Long compteId) {
        return compteRepository.findByIdAndAgenceId(compteId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Compte de trésorerie", compteId));
    }

    private AffectationCompteTresorerieResponse toResponse(AffectationCompteTresorerie row) {
        return AffectationCompteTresorerieResponse.builder()
                .id(row.getId())
                .utilisateurId(row.getUtilisateur().getId())
                .utilisateur(row.getUtilisateur().getFullName())
                .email(row.getUtilisateur().getEmail())
                .niveauAcces(row.getNiveauAcces())
                .actif(row.getActif())
                .build();
    }
}
