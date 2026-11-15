package com.assurance.service;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.dto.response.ClientPortalResponses;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.*;
import com.assurance.enums.*;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import com.assurance.security.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class ClientPortalManagementService {
    private final ClientPortalAccountRepository accounts;
    private final ClientPortalSessionRepository sessions;
    private final ClientPortalAccessRepository accesses;
    private final ClientPortalDocumentRepository documents;
    private final ClientPortalClaimUpdateRepository updates;
    private final ClientRepository clients;
    private final ContratRepository contracts;
    private final SinistreRepository claims;
    private final PieceJointeRepository pieces;
    private final SinistreDocumentRepository claimDocuments;
    private final PasswordEncoder encoder;
    private final AuditEventRepository audits;
    private final ObjectMapper mapper;
    private final ClientPortalFeatureService feature;
    private final ClientPortalContractCandidateRepository contractCandidates;
    private final ClientPortalClaimCandidateRepository claimCandidates;

    @Transactional(readOnly = true)
    public PagedResponse<ClientPortalResponses.Account> accounts(int page, int size) {
        BusinessPermission.require("client-portal-account:view");
        Page<ClientPortalAccount> result = accounts.findByAgenceId(agency(), pageable(page, size));
        return PagedResponse.<ClientPortalResponses.Account>builder()
                .items(result.map(this::accountResponse).getContent()).page(PageMetadata.from(result)).build();
    }

    public ClientPortalResponses.Account create(ClientPortalRequests.CreateAccount request) {
        BusinessPermission.require("client-portal-account:create");
        Long agency = agency();
        Client client = clients.findByAgenceIdAndId(agency, request.clientId())
                .filter(c -> Boolean.TRUE.equals(c.getActif())).orElseThrow(() -> missing(request.clientId()));
        String identifier = request.identifiant();
        if (identifier == null || identifier.isBlank()) {
            identifier = client.getTypeClient() == TypeClient.PERSONNE_MORALE ? client.getRc() : client.getCin();
            if (identifier == null || identifier.isBlank()) {
                identifier = client.getPassport();
            }
            if (identifier == null || identifier.isBlank()) {
                identifier = client.getCarteResidence();
            }
        }
        identifier = ClientPortalCredentials.normalizeIdentifier(identifier);
        ClientPortalCredentials.validatePassword(request.password());
        if (accounts.existsByAgenceIdAndClientId(agency, client.getId())
                || accounts.existsByAgenceIdAndIdentifiant(agency, identifier)) {
            throw new BadRequestException("Un compte existe déjà pour ce client ou cet identifiant dans l'agence");
        }
        ClientPortalAccount account = new ClientPortalAccount();
        account.setAgence(client.getAgence());
        account.setClient(client);
        account.setIdentifiant(identifier);
        account.setPasswordHash(encoder.encode(request.password()));
        try {
            account = accounts.saveAndFlush(account);
        } catch (org.springframework.dao.DataIntegrityViolationException duplicate) {
            throw new com.assurance.exception.ConflictException("CLIENT_PORTAL_ACCOUNT_EXISTS",
                    "Un compte existe déjà pour ce client ou cet identifiant dans l'agence");
        }
        audit("ClientPortalAccount", account.getId(), "CREATE", account.getId());
        return accountResponse(account);
    }

    @Transactional(readOnly = true)
    public ClientPortalResponses.Account account(Long id) {
        BusinessPermission.require("client-portal-account:view");
        return accountResponse(resolveAccount(id));
    }

    public void setActive(Long id, boolean active) {
        BusinessPermission.require("client-portal-account:deactivate");
        ClientPortalAccount account = accountForUpdate(id);
        account.setActif(active);
        if (!active) {
            sessions.revokeAll(id);
        }
        audit("ClientPortalAccount", id, active ? "ENABLE" : "DISABLE", id);
    }

    public void resetPassword(Long id, String password) {
        BusinessPermission.require("client-portal-account:reset-password");
        ClientPortalCredentials.validatePassword(password);
        ClientPortalAccount account = accountForUpdate(id);
        account.setPasswordHash(encoder.encode(password));
        account.setPasswordChangeRequired(true);
        account.setFailedAttempts(0);
        account.setLockedUntil(null);
        sessions.revokeAll(id);
        audit("ClientPortalAccount", id, "RESET_PASSWORD", id);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ClientPortalResponses.Access> accesses(Long account, int page, int size) {
        BusinessPermission.require("client-portal-account:view");
        resolveAccount(account);
        Page<ClientPortalAccess> result = accesses.findForStaff(agency(), account, pageable(page, size));
        return PagedResponse.<ClientPortalResponses.Access>builder()
                .items(result.map(this::accessResponse).getContent()).page(PageMetadata.from(result)).build();
    }

    public ClientPortalResponses.Access grant(Long accountId, ClientPortalRequests.Grant request) {
        BusinessPermission.require("client-portal-account:assign");
        if ((request.contratId() == null) == (request.sinistreId() == null)) {
            throw new BadRequestException("Choisissez un contrat ou un sinistre, pas les deux");
        }
        ClientPortalAccount account = accountForUpdate(accountId);
        ClientPortalAccess access;
        if (request.contratId() != null) {
            BusinessPermission.require("contrat:view");
            Contrat contract = contracts.findByAgenceIdAndId(agency(), request.contratId())
                    .filter(c -> !Boolean.TRUE.equals(c.getBrouillon()) && !Boolean.TRUE.equals(c.getProspection()))
                    .orElseThrow(() -> missing(request.contratId()));
            access = accesses.findContractGrant(agency(), accountId, contract.getId()).orElseGet(ClientPortalAccess::new);
            access.setContrat(contract);
        } else {
            BusinessPermission.require("sinistre:view");
            Sinistre claim = claims.findByIdAndAgenceId(request.sinistreId(), agency())
                    .filter(s -> s.getStatut() != StatutSinistre.BROUILLON)
                    .orElseThrow(() -> missing(request.sinistreId()));
            access = accesses.findClaimGrant(agency(), accountId, claim.getId()).orElseGet(ClientPortalAccess::new);
            access.setSinistre(claim);
        }
        access.setAccount(account);
        access.setActif(true);
        access = accesses.saveAndFlush(access);
        audit("ClientPortalAccess", access.getId(), "GRANT", accountId);
        return accessResponse(access);
    }

    public void revokeAccess(Long id) {
        BusinessPermission.require("client-portal-account:assign");
        ClientPortalAccess access = resolveAccess(id);
        access.setActif(false);
        audit("ClientPortalAccess", id, "REVOKE", access.getAccount().getId());
    }

    public ClientPortalResponses.Document publishDocument(Long accessId, ClientPortalRequests.PublishDocument request) {
        BusinessPermission.require("client-portal-publication:create");
        ClientPortalAccess access = resolveAccess(accessId);
        if (!access.isActif()) {
            throw new BadRequestException("L'accès au dossier est révoqué");
        }
        ClientPortalDocument document = new ClientPortalDocument();
        document.setAccess(access);
        document.setTitre(request.titre().strip());
        if (access.getContrat() != null && request.pieceJointeId() != null && request.sinistreDocumentId() == null) {
            BusinessPermission.require("contrat:view");
            PieceJointe piece = pieces.findById(request.pieceJointeId()).orElseThrow(() -> missing(request.pieceJointeId()));
            if (piece.getContrat() == null || !piece.getContrat().getId().equals(access.getContrat().getId())
                    || Boolean.TRUE.equals(piece.getArchived())
                    || !piece.getContrat().getAgence().getId().equals(agency())
                    || (piece.getAgence() != null && !piece.getAgence().getId().equals(agency()))) {
                throw missing(request.pieceJointeId());
            }
            document.setPieceJointe(piece);
        } else if (access.getSinistre() != null && request.sinistreDocumentId() != null && request.pieceJointeId() == null) {
            BusinessPermission.require("sinistre:view");
            SinistreDocument source = claimDocuments.findByIdAndSinistreId(request.sinistreDocumentId(), access.getSinistre().getId())
                    .filter(d -> d.getSinistre().getAgence().getId().equals(agency()))
                    .orElseThrow(() -> missing(request.sinistreDocumentId()));
            document.setSinistreDocument(source);
        } else {
            throw new BadRequestException("Le document doit appartenir au dossier partagé");
        }
        document = documents.saveAndFlush(document);
        audit("ClientPortalDocument", document.getId(), "PUBLISH", access.getAccount().getId());
        return new ClientPortalResponses.Document(document.getId(), document.getTitre(),
                access.getContrat() == null ? null : access.getContrat().getId(),
                access.getSinistre() == null ? null : access.getSinistre().getId(), document.getCreatedAt());
    }

    public void withdrawDocument(Long id) {
        BusinessPermission.require("client-portal-publication:deactivate");
        ClientPortalDocument document = documents.findForStaff(agency(), id).orElseThrow(() -> missing(id));
        document.setPublished(false);
        document.setPieceJointe(null);
        document.setSinistreDocument(null);
        audit("ClientPortalDocument", id, "WITHDRAW", document.getAccess().getAccount().getId());
    }

    public ClientPortalResponses.Update publishUpdate(Long accessId, ClientPortalRequests.PublishUpdate request) {
        BusinessPermission.require("client-portal-publication:create");
        BusinessPermission.require("sinistre:view");
        ClientPortalAccess access = resolveAccess(accessId);
        if (!access.isActif() || access.getSinistre() == null) {
            throw new BadRequestException("Choisissez un accès actif à un sinistre");
        }
        ClientPortalClaimUpdate update = new ClientPortalClaimUpdate();
        update.setAccess(access);
        update.setTitre(request.titre().strip());
        update.setMessage(request.message().strip());
        update = updates.saveAndFlush(update);
        audit("ClientPortalClaimUpdate", update.getId(), "PUBLISH", access.getAccount().getId());
        return new ClientPortalResponses.Update(update.getId(), update.getTitre(), update.getMessage(), update.getCreatedAt());
    }

    public void withdrawUpdate(Long id) {
        BusinessPermission.require("client-portal-publication:deactivate");
        ClientPortalClaimUpdate update = updates.findForStaff(agency(), id).orElseThrow(() -> missing(id));
        update.setPublished(false);
        audit("ClientPortalClaimUpdate", id, "WITHDRAW", update.getAccess().getAccount().getId());
    }

    @Transactional(readOnly = true)
    public PagedResponse<ClientPortalResponses.StaffPublication> publications(Long accessId, boolean claimUpdates, int page, int size) {
        BusinessPermission.require("client-portal-publication:view");
        resolveAccess(accessId);
        Page<ClientPortalResponses.StaffPublication> result = claimUpdates
                ? updates.findForStaff(agency(), accessId, pageable(page, size)).map(u ->
                    new ClientPortalResponses.StaffPublication(u.getId(), u.getTitre(), u.getMessage(), u.isPublished(), null, null, u.getCreatedAt()))
                : documents.findForStaff(agency(), accessId, pageable(page, size)).map(d ->
                    new ClientPortalResponses.StaffPublication(d.getId(), d.getTitre(), null, d.isPublished(),
                        d.getPieceJointe() == null ? null : d.getPieceJointe().getId(),
                        d.getSinistreDocument() == null ? null : d.getSinistreDocument().getId(), d.getCreatedAt()));
        return PagedResponse.<ClientPortalResponses.StaffPublication>builder()
                .items(result.getContent()).page(PageMetadata.from(result)).build();
    }

    private ClientPortalAccount resolveAccount(Long id) {
        return accounts.findByIdAndAgenceId(id, agency()).orElseThrow(() -> missing(id));
    }

    private ClientPortalAccount accountForUpdate(Long id) {
        return accounts.findForUpdate(id, agency()).orElseThrow(() -> missing(id));
    }

    private ClientPortalAccess resolveAccess(Long id) {
        ClientPortalAccess access = accesses.findForStaff(agency(), id).orElseThrow(() -> missing(id));
        if ((access.getContrat() != null && !agency().equals(access.getContrat().getAgence().getId()))
                || (access.getSinistre() != null && !agency().equals(access.getSinistre().getAgence().getId()))) {
            throw missing(id);
        }
        return access;
    }

    private ClientPortalResponses.Account accountResponse(ClientPortalAccount account) {
        return new ClientPortalResponses.Account(account.getId(), account.getClient().getId(),
                account.getClient().getNomAffichage(), account.getIdentifiant(), account.isActif(),
                account.isPasswordChangeRequired(), account.getLastLoginAt());
    }

    private ClientPortalResponses.Access accessResponse(ClientPortalAccess access) {
        Contrat contract = access.getContrat();
        Sinistre claim = access.getSinistre();
        return new ClientPortalResponses.Access(access.getId(),
                contract == null ? null : contract.getId(), claim == null ? null : claim.getId(), access.isActif(),
                contract != null ? contract.getNumeroDossier() : claim.getNumeroSinistre(),
                contract != null ? contract.getNumeroPolice() : claim.getContrat().getNumeroPolice(),
                contract != null ? contract.getDateEffet() : claim.getDateSinistre(),
                contract != null ? contract.getDateEcheance() : claim.getDateCloture(),
                contract != null ? contract.getStatut().name() : claim.getStatut().name());
    }

    @Transactional(readOnly = true)
    public PagedResponse<ClientPortalResponses.Candidate> candidates(Long accountId, boolean isClaim, String query, int page, int size) {
        BusinessPermission.require("client-portal-account:assign");
        ClientPortalAccount account = resolveAccount(accountId);
        String search = query == null ? "" : query.strip();
        if (search.length() > 120) throw new BadRequestException("Recherche trop longue");
        Page<ClientPortalResponses.Candidate> result;
        if (isClaim) {
            BusinessPermission.require("sinistre:view");
            result = claimCandidates.findCandidates(agency(), account.getClient().getId(), search, pageable(page, size))
                    .map(s -> new ClientPortalResponses.Candidate(s.getId(), s.getNumeroSinistre(), s.getContrat().getNumeroPolice(), s.getDateSinistre(), s.getStatut().name()));
        } else {
            BusinessPermission.require("contrat:view");
            result = contractCandidates.findCandidates(agency(), account.getClient().getId(), search, pageable(page, size))
                    .map(c -> new ClientPortalResponses.Candidate(c.getId(), c.getNumeroDossier(), c.getNumeroPolice(), c.getDateEffet(), c.getStatut().name()));
        }
        return PagedResponse.<ClientPortalResponses.Candidate>builder().items(result.getContent()).page(PageMetadata.from(result)).build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<ClientPortalResponses.Source> sources(Long accessId, int page, int size) {
        if (!BusinessPermission.has("client-portal-publication:create")) BusinessPermission.require("client-portal-publication:view");
        ClientPortalAccess access = resolveAccess(accessId);
        Page<ClientPortalResponses.Source> result;
        if (access.getContrat() != null) {
            BusinessPermission.require("contrat:view");
            result = pieces.findPortalSources(agency(), access.getContrat().getId(), pageable(page, size))
                    .map(p -> new ClientPortalResponses.Source(p.getId(), p.getNomFichier(), p.getCreatedAt()));
        } else {
            BusinessPermission.require("sinistre:view");
            result = claimDocuments.findPortalSources(agency(), access.getSinistre().getId(), pageable(page, size))
                    .map(d -> new ClientPortalResponses.Source(d.getId(), d.getNomFichier(), d.getCreatedAt()));
        }
        return PagedResponse.<ClientPortalResponses.Source>builder().items(result.getContent()).page(PageMetadata.from(result)).build();
    }

    static PageRequest pageable(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BadRequestException("Pagination invalide (taille entre 1 et 100)");
        }
        return PageRequest.of(page, size);
    }

    private Long agency() {
        Long agency = currentAgency();
        feature.requireEnabled(agency);
        return agency;
    }

    public boolean enabled() {
        return feature.isEnabled(currentAgency());
    }

    @Transactional(readOnly = true)
    public ClientPortalResponses.Account accountForClient(Long clientId) {
        BusinessPermission.require("client-portal-account:view");
        Long agency = agency();
        clients.findByAgenceIdAndId(agency, clientId).orElseThrow(() -> missing(clientId));
        return accounts.findByAgenceIdAndClientId(agency, clientId).map(this::accountResponse).orElse(null);
    }

    private Long currentAgency() {
        Long agency = TenantContext.getCurrentAgence();
        if (agency == null || TenantContext.getCurrentUser() == null) {
            throw new org.springframework.security.access.AccessDeniedException("Un contexte agence et un utilisateur sont requis");
        }
        return agency;
    }

    private ResourceNotFoundException missing(Long id) {
        return new ResourceNotFoundException("Dossier ou compte client", id);
    }

    private void audit(String type, Long id, String action, Long accountId) {
        try {
            String snapshot = mapper.writeValueAsString(Map.of("action", action, "accountId", accountId));
            audits.save(AuditEvent.operationSnapshot(agency(), TenantContext.getCurrentUser(),
                    TenantContext.getCurrentUsername(), AuditActorType.USER, type, String.valueOf(id),
                    "CREATE".equals(action) ? AuditAction.CREATED : AuditAction.UPDATED, snapshot,
                    AuditRequestContext.getRequestId(), AuditRequestContext.getSource(), AuditRequestContext.getOperationCode()));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Journalisation du portail client impossible", error);
        }
    }
}
