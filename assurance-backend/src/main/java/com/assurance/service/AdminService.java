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
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final String SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";

    private static final long MAX_LOGO_SIZE = 4L * 1024L * 1024L;
    private static final int MAX_LOGO_WIDTH = 1600;
    private static final int MAX_LOGO_HEIGHT = 800;

    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final AgenceRepository agenceRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<AdminUtilisateurResponse> listPlatformAdmins() {
        requirePlatformAdmin(currentUser());
        return utilisateurRepository
                .findByRoleCodeIgnoreCaseOrderByNomAscPrenomAsc(SUPER_ADMIN_ROLE_CODE)
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
        List<Utilisateur> users = can(actor, "agence:view")
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
        List<Role> roles = can(actor, "agence:view")
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
        requireAny(actor, "agence:view", "config:view");
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
                .statut(request.getStatut() == null ? StatutAgence.ACTIVE : request.getStatut())
                .build();
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional
    public AdminAgenceResponse updateAgency(Long id, UpsertAgenceRequest request) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage");
        Agence agence = agenceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", id));
        if (agenceRepository.existsByCodeIgnoreCaseAndIdNot(request.getCode(), id)) {
            throw new BadRequestException("Code agence deja utilise");
        }
        agence.setCode(request.getCode().trim().toUpperCase());
        agence.setNom(request.getNom().trim());
        agence.setAdresse(blankToNull(request.getAdresse()));
        agence.setVille(blankToNull(request.getVille()));
        agence.setTelephone(blankToNull(request.getTelephone()));
        agence.setFax(blankToNull(request.getFax()));
        agence.setEmail(blankToNull(request.getEmail()));
        agence.setStatut(request.getStatut() == null ? StatutAgence.ACTIVE : request.getStatut());
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional
    public AdminAgenceResponse updateAgencyLogo(Long id, MultipartFile file) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage");
        Agence agence = managedAgency(actor, id);
        byte[] normalizedLogo = normalizeLogo(file);
        agence.setLogoContenu(normalizedLogo);
        agence.setLogoTypeMime("image/png");
        agence.setLogoNomFichier("logo-" + agence.getCode().toLowerCase() + ".png");
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional
    public AdminAgenceResponse deleteAgencyLogo(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:create", "config:manage");
        Agence agence = managedAgency(actor, id);
        agence.setLogoContenu(null);
        agence.setLogoTypeMime(null);
        agence.setLogoNomFichier(null);
        return AdminAgenceResponse.from(agenceRepository.save(agence));
    }

    @Transactional(readOnly = true)
    public AgencyLogo getAgencyLogo(Long id) {
        Utilisateur actor = currentUser();
        requireAny(actor, "agence:view", "config:view");
        Agence agence = managedAgency(actor, id);
        if (agence.getLogoContenu() == null || agence.getLogoContenu().length == 0) {
            throw new ResourceNotFoundException("Logo agence introuvable");
        }
        return new AgencyLogo(
                agence.getLogoContenu(),
                agence.getLogoTypeMime(),
                agence.getLogoNomFichier()
        );
    }

    private Agence managedAgency(Utilisateur actor, Long id) {
        Agence agence = agenceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", id));
        ensureManagedAgence(actor, agence);
        return agence;
    }

    private byte[] normalizeLogo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Le fichier logo est obligatoire");
        }
        if (file.getSize() > MAX_LOGO_SIZE) {
            throw new BadRequestException("Le logo ne doit pas dépasser 4 Mo");
        }
        String contentType = file.getContentType();
        if (!"image/png".equals(contentType) && !"image/jpeg".equals(contentType)) {
            throw new BadRequestException("Le logo doit être au format PNG ou JPEG");
        }
        try {
            BufferedImage source = ImageIO.read(file.getInputStream());
            if (source == null || source.getWidth() < 32 || source.getHeight() < 32) {
                throw new BadRequestException("Le fichier image est invalide ou trop petit");
            }
            double ratio = Math.min(
                    1d,
                    Math.min(
                            (double) MAX_LOGO_WIDTH / source.getWidth(),
                            (double) MAX_LOGO_HEIGHT / source.getHeight()
                    )
            );
            int width = Math.max(1, (int) Math.round(source.getWidth() * ratio));
            int height = Math.max(1, (int) Math.round(source.getHeight() * ratio));
            BufferedImage normalized = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            Graphics2D graphics = normalized.createGraphics();
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, width, height, null);
            graphics.dispose();
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (!ImageIO.write(normalized, "png", output)) {
                    throw new BadRequestException("Impossible de convertir le logo");
                }
                return output.toByteArray();
            }
        } catch (IOException exception) {
            throw new BadRequestException("Impossible de lire le fichier logo");
        }
    }

    public record AgencyLogo(byte[] content, String contentType, String filename) {
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
        Long effectiveAgenceId = can(actor, "agence:view") ? agenceId : requiredActorAgence(actor);
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
        if (utilisateurRepository.findByRoleCodeIgnoreCaseAndActifTrue(SUPER_ADMIN_ROLE_CODE).size() <= 1) {
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
                .deviceName(session.getDeviceName())
                .deviceType(session.getDeviceType())
                .ipAddress(session.getIpAddress())
                .current(false)
                .lastActivityAt(session.getLastActivityAt())
                .createdAt(session.getCreatedAt())
                .build();
    }
}
