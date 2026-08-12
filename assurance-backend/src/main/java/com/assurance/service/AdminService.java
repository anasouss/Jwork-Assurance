package com.assurance.service;

import com.assurance.dto.request.ResetUserPasswordRequest;
import com.assurance.dto.request.UpsertAgenceRequest;
import com.assurance.dto.request.UpsertPlatformAdminRequest;
import com.assurance.dto.request.UpsertRoleRequest;
import com.assurance.dto.request.UpsertUtilisateurRequest;
import com.assurance.dto.response.AdminAgenceResponse;
import com.assurance.dto.response.AdminPermissionResponse;
import com.assurance.dto.response.AdminRoleResponse;
import com.assurance.dto.response.AdminUtilisateurResponse;
import com.assurance.dto.response.SessionResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Permission;
import com.assurance.entity.RefreshSession;
import com.assurance.entity.Role;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.StatutAgence;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.exception.UnauthorizedException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.PermissionRepository;
import com.assurance.repository.RefreshSessionRepository;
import com.assurance.repository.RoleRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.security.TenantContext;
import com.assurance.util.DeviceInfoParser;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final String SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";

    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final AgenceRepository agenceRepository;
    private final PasswordEncoder passwordEncoder;
    private final AgencyLogoStorageService agencyLogoStorageService;
    private final AgencySignatureStorageService agencySignatureStorageService;
    private final AcquisitionClientService acquisitionClientService;

    @Transactional(readOnly = true)
    public List<AdminUtilisateurResponse> listPlatformAdmins() {
        requirePlatformAdmin(currentUser());
        return utilisateurRepository
                .findByRole_CodeIgnoreCaseOrderByNomAscPrenomAsc(SUPER_ADMIN_ROLE_CODE)
                .stream()
                .map(AdminUtilisateurResponse::from)
                .toList();
    }

    @Transactional
    public AdminUtilisateurResponse createPlatformAdmin(UpsertPlatformAdminRequest request) {
        requirePlatformAdmin(currentUser());
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new BadRequestException("Mot de passe obligatoire");
        }
        if (utilisateurRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw new BadRequestException("Email deja utilise");
        }
        Role role = platformAdminRole();
        Utilisateur user = Utilisateur.builder()
                .agence(null)
                .role(role)
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .prenom(request.getPrenom().trim())
                .nom(request.getNom().trim())
                .telephone(blankToNull(request.getTelephone()))
                .actif(request.getActif() == null || request.getActif())
                .build();
        return AdminUtilisateurResponse.from(utilisateurRepository.save(user));
    }

    @Transactional
    public AdminUtilisateurResponse updatePlatformAdmin(Long id, UpsertPlatformAdminRequest request) {
        Utilisateur actor = currentUser();
        requirePlatformAdmin(actor);
        Utilisateur user = platformAdmin(id);
        boolean active = request.getActif() == null || request.getActif();
        validatePlatformAdminDeactivation(actor, user, active);
        if (utilisateurRepository.existsByEmailIgnoreCaseAndIdNot(request.getEmail(), id)) {
            throw new BadRequestException("Email deja utilise");
        }
        user.setAgence(null);
        user.setRole(platformAdminRole());
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPrenom(request.getPrenom().trim());
        user.setNom(request.getNom().trim());
        user.setTelephone(blankToNull(request.getTelephone()));
        user.setActif(active);
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
            refreshSessionRepository.revokeAllByUserId(id);
        }
        Utilisateur saved = utilisateurRepository.save(user);
        if (!active) {
            refreshSessionRepository.revokeAllByUserId(id);
        }
        return AdminUtilisateurResponse.from(saved);
    }

    @Transactional
    public void deactivatePlatformAdmin(Long id) {
        Utilisateur actor = currentUser();
        requirePlatformAdmin(actor);
        Utilisateur user = platformAdmin(id);
        validatePlatformAdminDeactivation(actor, user, false);
        user.setActif(false);
        utilisateurRepository.save(user);
        refreshSessionRepository.revokeAllByUserId(id);
    }

    @Transactional
    public void resetPlatformAdminPassword(Long id, ResetUserPasswordRequest request) {
        requirePlatformAdmin(currentUser());
        Utilisateur user = platformAdmin(id);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        utilisateurRepository.save(user);
        refreshSessionRepository.revokeAllByUserId(id);
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> listPlatformAdminSessions(Long id) {
        requirePlatformAdmin(currentUser());
        platformAdmin(id);
        return refreshSessionRepository
                .findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByLastActivityAtDesc(id, LocalDateTime.now())
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    @Transactional
    public void revokePlatformAdminSession(Long id, Long sessionId) {
        requirePlatformAdmin(currentUser());
        platformAdmin(id);
        RefreshSession session = refreshSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId));
        if (!session.getUser().getId().equals(id)) {
            throw new BadRequestException("La session ne correspond pas a cet administrateur");
        }
        session.setRevoked(true);
        refreshSessionRepository.save(session);
    }

    @Transactional
    public void revokeAllPlatformAdminSessions(Long id) {
        requirePlatformAdmin(currentUser());
        platformAdmin(id);
        refreshSessionRepository.revokeAllByUserId(id);
    }

    @Transactional(readOnly = true)
    public List<AdminUtilisateurResponse> listUsers() {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:view", "user:manage", "config:view");
        Long contextAgenceId = TenantContext.getCurrentAgence();
        List<Utilisateur> users = contextAgenceId != null
                ? utilisateurRepository.findByAgenceIdOrderByNomAscPrenomAsc(contextAgenceId)
                : can(actor, "agence:view")
                ? utilisateurRepository.findAllByOrderByNomAscPrenomAsc()
                : utilisateurRepository.findByAgenceIdOrderByNomAscPrenomAsc(requiredActorAgence(actor));
        return users.stream()
                .filter(user -> !isSuperAdmin(user))
                .map(AdminUtilisateurResponse::from)
                .toList();
    }

    @Transactional
    public AdminUtilisateurResponse createUser(UpsertUtilisateurRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:manage", "config:manage");
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new BadRequestException("Mot de passe obligatoire");
        }
        if (utilisateurRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw new BadRequestException("Email deja utilise");
        }
        Agence agence = resolveManagedAgence(actor, request.getAgenceId());
        Role role = resolveAssignableRole(actor, request.getRoleId(), agence);
        Utilisateur user = Utilisateur.builder()
                .agence(agence)
                .role(role)
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .prenom(request.getPrenom().trim())
                .nom(request.getNom().trim())
                .telephone(blankToNull(request.getTelephone()))
                .actif(request.getActif() == null || request.getActif())
                .build();
        return AdminUtilisateurResponse.from(utilisateurRepository.save(user));
    }

    @Transactional
    public AdminUtilisateurResponse updateUser(Long id, UpsertUtilisateurRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:manage", "config:manage");
        Utilisateur user = utilisateurRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", id));
        ensureAgencyUser(user);
        ensureManagedAgence(actor, user.getAgence());
        if (utilisateurRepository.existsByEmailIgnoreCaseAndIdNot(request.getEmail(), id)) {
            throw new BadRequestException("Email deja utilise");
        }
        Agence agence = resolveManagedAgence(actor, request.getAgenceId());
        Role role = resolveAssignableRole(actor, request.getRoleId(), agence);
        user.setAgence(agence);
        user.setRole(role);
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPrenom(request.getPrenom().trim());
        user.setNom(request.getNom().trim());
        user.setTelephone(blankToNull(request.getTelephone()));
        user.setActif(request.getActif() == null || request.getActif());
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        return AdminUtilisateurResponse.from(utilisateurRepository.save(user));
    }

    @Transactional
    public void deactivateUser(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:manage", "config:manage");
        if (id.equals(actor.getId())) {
            throw new BadRequestException("Vous ne pouvez pas desactiver votre propre compte");
        }
        Utilisateur user = utilisateurRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", id));
        ensureAgencyUser(user);
        ensureManagedAgence(actor, user.getAgence());
        user.setActif(false);
        utilisateurRepository.save(user);
        refreshSessionRepository.revokeAllByUserId(id);
    }

    @Transactional
    public void resetPassword(Long id, ResetUserPasswordRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:manage", "config:manage");
        Utilisateur user = utilisateurRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", id));
        ensureAgencyUser(user);
        ensureManagedAgence(actor, user.getAgence());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        utilisateurRepository.save(user);
        refreshSessionRepository.revokeAllByUserId(id);
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> listUserSessions(Long userId) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:view", "user:manage", "config:view");
        managedAgencyUser(actor, userId);
        return refreshSessionRepository
                .findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByLastActivityAtDesc(userId, LocalDateTime.now())
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    @Transactional
    public void revokeUserSession(Long userId, Long sessionId) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:manage", "config:manage");
        managedAgencyUser(actor, userId);
        RefreshSession session = refreshSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId));
        if (!session.getUser().getId().equals(userId)) {
            throw new BadRequestException("La session ne correspond pas à cet utilisateur");
        }
        session.setRevoked(true);
        refreshSessionRepository.save(session);
    }

    @Transactional
    public void revokeAllUserSessions(Long userId) {
        Utilisateur actor = currentUser();
        requireAny(actor, "user:manage", "config:manage");
        managedAgencyUser(actor, userId);
        refreshSessionRepository.revokeAllByUserId(userId);
    }

    @Transactional(readOnly = true)
    public List<AdminRoleResponse> listRoles() {
        Utilisateur actor = currentUser();
        requireAny(actor, "role:view", "role:manage", "config:view");
        Long contextAgenceId = TenantContext.getCurrentAgence();
        List<Role> roles = contextAgenceId != null
                ? roleRepository.findByAgenceIdOrAgenceIsNullOrderByNomAsc(contextAgenceId)
                : can(actor, "agence:view")
                ? roleRepository.findAllByOrderByNomAsc()
                : roleRepository.findByAgenceIdOrAgenceIsNullOrderByNomAsc(requiredActorAgence(actor));
        return roles.stream()
                .filter(role -> role.getAgence() != null)
                .filter(role -> !"SUPER_ADMIN".equalsIgnoreCase(role.getCode()))
                .map(AdminRoleResponse::from)
                .toList();
    }

    @Transactional
    public AdminRoleResponse createRole(UpsertRoleRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "role:manage", "config:manage");
        Agence agence = resolveRoleAgence(actor, request.getAgenceId());
        ensureUniqueRoleCode(agence, request.getCode(), null);
        Role role = Role.builder()
                .agence(agence)
                .code(request.getCode().trim().toUpperCase())
                .nom(request.getNom().trim())
                .description(blankToNull(request.getDescription()))
                .systemRole(Boolean.TRUE.equals(request.getSystemRole()) && can(actor, "config:manage"))
                .permissions(resolvePermissions(actor, request.getPermissionIds()))
                .build();
        return AdminRoleResponse.from(roleRepository.save(role));
    }

    @Transactional
    public AdminRoleResponse updateRole(Long id, UpsertRoleRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "role:manage", "config:manage");
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id));
        ensureAgencyRole(role);
        ensureManagedAgence(actor, role.getAgence());
        if (Boolean.TRUE.equals(role.getSystemRole()) && !can(actor, "config:manage")) {
            throw new UnauthorizedException("Role systeme non modifiable");
        }
        Agence agence = resolveRoleAgence(actor, request.getAgenceId());
        ensureUniqueRoleCode(agence, request.getCode(), id);
        role.setAgence(agence);
        role.setCode(request.getCode().trim().toUpperCase());
        role.setNom(request.getNom().trim());
        role.setDescription(blankToNull(request.getDescription()));
        if (can(actor, "config:manage")) {
            role.setSystemRole(Boolean.TRUE.equals(request.getSystemRole()));
        }
        role.setPermissions(resolvePermissions(actor, request.getPermissionIds()));
        return AdminRoleResponse.from(roleRepository.save(role));
    }

    @Transactional
    public void deleteRole(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "role:manage", "config:manage");
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id));
        ensureAgencyRole(role);
        ensureManagedAgence(actor, role.getAgence());
        if (Boolean.TRUE.equals(role.getSystemRole())) {
            throw new BadRequestException("Role systeme non supprimable");
        }
        if (utilisateurRepository.existsByRoleId(id)) {
            throw new BadRequestException("Role utilise par des utilisateurs");
        }
        roleRepository.delete(role);
    }

    @Transactional(readOnly = true)
    public List<AdminPermissionResponse> listPermissions() {
        Utilisateur actor = currentUser();
        requireAny(actor, "role:view", "role:manage", "config:view");
        return permissionRepository.findAll().stream()
                .filter(permission -> !Boolean.TRUE.equals(permission.getSuperAdminOnly()))
                .map(AdminPermissionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminAgenceResponse> listAgencies() {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:view", "config:view", "agence:manage-self");
        Long contextAgenceId = TenantContext.getCurrentAgence();
        if (contextAgenceId != null) {
            return List.of(AdminAgenceResponse.from(managedAgency(actor, contextAgenceId)));
        }
        if (can(actor, "agence:manage-self") && !can(actor, "agence:view") && !can(actor, "config:view")) {
            return List.of(AdminAgenceResponse.from(managedAgency(actor, requiredActorAgence(actor))));
        }
        return agenceRepository.findAllByOrderByNomAsc().stream().map(AdminAgenceResponse::from).toList();
    }

    @Transactional
    public AdminAgenceResponse createAgency(UpsertAgenceRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage");
        if (agenceRepository.existsByCodeIgnoreCase(request.getCode())) {
            throw new BadRequestException("Code agence deja utilise");
        }
        Agence agence = Agence.builder()
                .code(request.getCode().trim().toUpperCase())
                .nom(request.getNom().trim())
                .adresse(blankToNull(request.getAdresse()))
                .ville(blankToNull(request.getVille()))
                .telephone(blankToNull(request.getTelephone()))
                .fax(blankToNull(request.getFax()))
                .email(blankToNull(request.getEmail()))
                .identifiantFiscal(blankToNull(request.getIdentifiantFiscal()))
                .patente(blankToNull(request.getPatente()))
                .ice(blankToNull(request.getIce()))
                .numeroAgrement(blankToNull(request.getNumeroAgrement()))
                .dateAgrement(request.getDateAgrement())
                .banque(blankToNull(request.getBanque()))
                .rib(blankToNull(request.getRib()))
                .statut(request.getStatut() == null ? StatutAgence.ACTIVE : request.getStatut())
                .build();
        Agence saved = agenceRepository.save(agence);
        acquisitionClientService.provisionDefaultOrigins(saved.getId());
        return AdminAgenceResponse.from(saved);
    }

    @Transactional
    public AdminAgenceResponse updateAgency(Long id, UpsertAgenceRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        boolean managesPlatformAgencies = can(actor, "agence:create") || can(actor, "config:manage");
        if (managesPlatformAgencies) {
            if (agenceRepository.existsByCodeIgnoreCaseAndIdNot(request.getCode(), id)) {
                throw new BadRequestException("Code agence deja utilise");
            }
            agence.setCode(request.getCode().trim().toUpperCase());
            agence.setStatut(request.getStatut() == null ? StatutAgence.ACTIVE : request.getStatut());
        }
        agence.setNom(request.getNom().trim());
        agence.setAdresse(blankToNull(request.getAdresse()));
        agence.setVille(blankToNull(request.getVille()));
        agence.setTelephone(blankToNull(request.getTelephone()));
        agence.setFax(blankToNull(request.getFax()));
        agence.setEmail(blankToNull(request.getEmail()));
        agence.setIdentifiantFiscal(blankToNull(request.getIdentifiantFiscal()));
        agence.setPatente(blankToNull(request.getPatente()));
        agence.setIce(blankToNull(request.getIce()));
        agence.setNumeroAgrement(blankToNull(request.getNumeroAgrement()));
        agence.setDateAgrement(request.getDateAgrement());
        agence.setBanque(blankToNull(request.getBanque()));
        agence.setRib(blankToNull(request.getRib()));
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional
    public AdminAgenceResponse updateAgencyLogo(Long id, MultipartFile file) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        String previousStorageKey = agence.getLogoCheminStockage();
        AgencyLogoStorageService.StoredLogo stored = agencyLogoStorageService.store(agence.getId(), agence.getCode(), file);
        agence.setLogoCheminStockage(stored.storageKey());
        agence.setLogoTypeMime(stored.contentType());
        agence.setLogoNomFichier(stored.fileName());
        agencyLogoStorageService.deleteAfterCommit(previousStorageKey);
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional
    public AdminAgenceResponse deleteAgencyLogo(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        agencyLogoStorageService.deleteAfterCommit(agence.getLogoCheminStockage());
        agence.setLogoCheminStockage(null);
        agence.setLogoTypeMime(null);
        agence.setLogoNomFichier(null);
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional(readOnly = true)
    public AgencyLogo getAgencyLogo(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:view", "config:view", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        if (agence.getLogoCheminStockage() == null || agence.getLogoCheminStockage().isBlank()) {
            throw new ResourceNotFoundException("Logo agence introuvable");
        }
        return new AgencyLogo(
                agencyLogoStorageService.load(agence.getLogoCheminStockage()),
                agence.getLogoTypeMime(),
                agence.getLogoNomFichier()
        );
    }

    @Transactional
    public AdminAgenceResponse updateAgencySignature(Long id, MultipartFile file) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        String previousStorageKey = agence.getSignatureCheminStockage();
        AgencySignatureStorageService.StoredSignature stored = agencySignatureStorageService.store(
                agence.getId(),
                agence.getCode(),
                file
        );
        agence.setSignatureCheminStockage(stored.storageKey());
        agence.setSignatureTypeMime(stored.contentType());
        agence.setSignatureNomFichier(stored.fileName());
        agencySignatureStorageService.deleteAfterCommit(previousStorageKey);
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional
    public AdminAgenceResponse deleteAgencySignature(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        agencySignatureStorageService.deleteAfterCommit(agence.getSignatureCheminStockage());
        agence.setSignatureCheminStockage(null);
        agence.setSignatureTypeMime(null);
        agence.setSignatureNomFichier(null);
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional(readOnly = true)
    public AgencySignature getAgencySignature(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage", "agence:manage-self");
        Agence agence = managedAgency(actor, id);
        if (agence.getSignatureCheminStockage() == null || agence.getSignatureCheminStockage().isBlank()) {
            throw new ResourceNotFoundException("Signature agence introuvable");
        }
        return new AgencySignature(
                agencySignatureStorageService.load(agence.getSignatureCheminStockage()),
                agence.getSignatureTypeMime(),
                agence.getSignatureNomFichier()
        );
    }

    private Agence managedAgency(Utilisateur actor, Long id) {
        Agence agence = agenceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", id));
        ensureManagedAgence(actor, agence);
        return agence;
    }

    public record AgencyLogo(Resource resource, String contentType, String filename) {
    }

    public record AgencySignature(Resource resource, String contentType, String filename) {
    }

    private Utilisateur currentUser() {
        Long userId = TenantContext.getCurrentUser();
        if (userId == null) {
            throw new UnauthorizedException("Utilisateur non authentifie");
        }
        return utilisateurRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Utilisateur non authentifie"));
    }

    private void requireAny(Utilisateur actor, String... permissions) {
        for (String permission : permissions) {
            if (can(actor, permission)) {
                return;
            }
        }
        throw new UnauthorizedException("Permission insuffisante");
    }

    private boolean can(Utilisateur actor, String permission) {
        return actor.getPermissions().contains(permission);
    }

    private Long requiredActorAgence(Utilisateur actor) {
        if (actor.getAgence() == null) {
            throw new UnauthorizedException("Agence utilisateur manquante");
        }
        return actor.getAgence().getId();
    }

    private Agence resolveManagedAgence(Utilisateur actor, Long agenceId) {
        Long contextAgenceId = TenantContext.getCurrentAgence();
        if (contextAgenceId != null && agenceId != null && !contextAgenceId.equals(agenceId)) {
            throw new UnauthorizedException("Agence hors du contexte de travail actif");
        }
        Long effectiveAgenceId = contextAgenceId != null
                ? contextAgenceId
                : can(actor, "agence:view") ? agenceId : requiredActorAgence(actor);
        if (effectiveAgenceId == null) {
            throw new BadRequestException("Agence obligatoire");
        }
        Agence agence = agenceRepository.findById(effectiveAgenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", effectiveAgenceId));
        ensureManagedAgence(actor, agence);
        return agence;
    }

    private Agence resolveRoleAgence(Utilisateur actor, Long agenceId) {
        return resolveManagedAgence(actor, agenceId);
    }

    private void ensureManagedAgence(Utilisateur actor, Agence agence) {
        Long contextAgenceId = TenantContext.getCurrentAgence();
        if (contextAgenceId != null) {
            if (agence == null || !contextAgenceId.equals(agence.getId())) {
                throw new UnauthorizedException("Agence hors du contexte de travail actif");
            }
            return;
        }
        if (can(actor, "agence:view") || can(actor, "config:manage")) {
            return;
        }
        if (agence == null || actor.getAgence() == null || !agence.getId().equals(actor.getAgence().getId())) {
            throw new UnauthorizedException("Agence non autorisee");
        }
    }

    private Role resolveAssignableRole(Utilisateur actor, Long roleId, Agence agence) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId));
        if (role.getAgence() == null || "SUPER_ADMIN".equalsIgnoreCase(role.getCode())) {
            throw new UnauthorizedException("Rôle plateforme non assignable depuis l'administration d'agence");
        }
        if (role.getAgence() != null && !role.getAgence().getId().equals(agence.getId())) {
            throw new BadRequestException("Le role ne correspond pas a l'agence");
        }
        return role;
    }

    private Set<Permission> resolvePermissions(Utilisateur actor, Set<Long> permissionIds) {
        Set<Permission> permissions = new HashSet<>();
        for (Long permissionId : permissionIds == null ? Set.<Long>of() : permissionIds) {
            Permission permission = permissionRepository.findById(permissionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Permission", permissionId));
            if (Boolean.TRUE.equals(permission.getSuperAdminOnly())) {
                throw new UnauthorizedException("Permission réservée à l'administration de la plateforme");
            }
            permissions.add(permission);
        }
        return permissions;
    }

    private void ensureUniqueRoleCode(Agence agence, String code, Long currentId) {
        boolean exists = agence == null
                ? (currentId == null
                    ? roleRepository.existsByAgenceIsNullAndCodeIgnoreCase(code)
                    : roleRepository.existsByAgenceIsNullAndCodeIgnoreCaseAndIdNot(code, currentId))
                : (currentId == null
                    ? roleRepository.existsByAgenceIdAndCodeIgnoreCase(agence.getId(), code)
                    : roleRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agence.getId(), code, currentId));
        if (exists) {
            throw new BadRequestException("Code role deja utilise");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Utilisateur managedAgencyUser(Utilisateur actor, Long userId) {
        Utilisateur user = utilisateurRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", userId));
        ensureAgencyUser(user);
        ensureManagedAgence(actor, user.getAgence());
        return user;
    }

    private void requirePlatformAdmin(Utilisateur actor) {
        if (!isSuperAdmin(actor) || actor.getAgence() != null) {
            throw new UnauthorizedException("Accès réservé aux administrateurs de la plateforme");
        }
    }

    private Role platformAdminRole() {
        return roleRepository.findByAgenceIsNullAndCode(SUPER_ADMIN_ROLE_CODE)
                .orElseThrow(() -> new ResourceNotFoundException("Rôle administrateur plateforme introuvable"));
    }

    private Utilisateur platformAdmin(Long id) {
        Utilisateur user = utilisateurRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Administrateur plateforme", id));
        if (!isSuperAdmin(user) || user.getAgence() != null) {
            throw new ResourceNotFoundException("Administrateur plateforme", id);
        }
        return user;
    }

    private void validatePlatformAdminDeactivation(Utilisateur actor, Utilisateur target, boolean active) {
        if (active || !Boolean.TRUE.equals(target.getActif())) {
            return;
        }
        if (actor.getId().equals(target.getId())) {
            throw new BadRequestException("Vous ne pouvez pas désactiver votre propre compte");
        }
        if (utilisateurRepository.findByRole_CodeIgnoreCaseAndActifTrue(SUPER_ADMIN_ROLE_CODE).size() <= 1) {
            throw new BadRequestException("Au moins un administrateur plateforme actif est obligatoire");
        }
    }

    private void ensureAgencyUser(Utilisateur user) {
        if (isSuperAdmin(user)) {
            throw new UnauthorizedException("Compte plateforme géré hors de l'administration d'agence");
        }
    }

    private boolean isSuperAdmin(Utilisateur user) {
        return user.getRole() != null && "SUPER_ADMIN".equalsIgnoreCase(user.getRole().getCode());
    }

    private void ensureAgencyRole(Role role) {
        if (role.getAgence() == null || "SUPER_ADMIN".equalsIgnoreCase(role.getCode())) {
            throw new UnauthorizedException("Rôle plateforme géré hors de l'administration d'agence");
        }
    }

    private SessionResponse toSessionResponse(RefreshSession session) {
        return SessionResponse.builder()
                .id(session.getId())
                .deviceName(session.getDeviceName() != null
                        ? session.getDeviceName()
                        : DeviceInfoParser.parseDeviceName(session.getUserAgent()))
                .deviceType(session.getDeviceType() != null
                        ? session.getDeviceType()
                        : DeviceInfoParser.parseDeviceType(session.getUserAgent()))
                .ipAddress(session.getIpAddress())
                .current(false)
                .lastActivityAt(session.getLastActivityAt())
                .createdAt(session.getCreatedAt())
                .build();
    }
}
