package com.assurance.controller;

import com.assurance.dto.request.ResetUserPasswordRequest;
import com.assurance.dto.request.UpsertAgenceRequest;
import com.assurance.dto.request.UpsertRoleRequest;
import com.assurance.dto.request.UpsertUtilisateurRequest;
import com.assurance.dto.response.AdminAgenceResponse;
import com.assurance.dto.response.AdminPermissionResponse;
import com.assurance.dto.response.AdminRoleResponse;
import com.assurance.dto.response.AdminUtilisateurResponse;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.SessionResponse;
import com.assurance.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<AdminUtilisateurResponse>>> users() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listUsers()));
    }

    @PostMapping("/users")
    public ResponseEntity<ApiResponse<AdminUtilisateurResponse>> createUser(@Valid @RequestBody UpsertUtilisateurRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createUser(request), "Utilisateur cree"));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<ApiResponse<AdminUtilisateurResponse>> updateUser(@PathVariable Long id, @Valid @RequestBody UpsertUtilisateurRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateUser(id, request), "Utilisateur modifie"));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable Long id) {
        adminService.deactivateUser(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Utilisateur desactive"));
    }

    @PutMapping("/users/{id}/password")
    public ResponseEntity<ApiResponse<Void>> resetUserPassword(@PathVariable Long id, @Valid @RequestBody ResetUserPasswordRequest request) {
        adminService.resetPassword(id, request);
        return ResponseEntity.ok(ApiResponse.success(null, "Mot de passe modifie"));
    }

    @GetMapping("/users/{id}/sessions")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> userSessions(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.listUserSessions(id)));
    }

    @DeleteMapping("/users/{id}/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeUserSession(
            @PathVariable Long id,
            @PathVariable Long sessionId
    ) {
        adminService.revokeUserSession(id, sessionId);
        return ResponseEntity.ok(ApiResponse.success(null, "Session révoquée"));
    }

    @DeleteMapping("/users/{id}/sessions")
    public ResponseEntity<ApiResponse<Void>> revokeAllUserSessions(@PathVariable Long id) {
        adminService.revokeAllUserSessions(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Toutes les sessions ont été révoquées"));
    }

    @GetMapping("/roles")
    public ResponseEntity<ApiResponse<List<AdminRoleResponse>>> roles() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listRoles()));
    }

    @PostMapping("/roles")
    public ResponseEntity<ApiResponse<AdminRoleResponse>> createRole(@Valid @RequestBody UpsertRoleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createRole(request), "Role cree"));
    }

    @PutMapping("/roles/{id}")
    public ResponseEntity<ApiResponse<AdminRoleResponse>> updateRole(@PathVariable Long id, @Valid @RequestBody UpsertRoleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateRole(id, request), "Role modifie"));
    }

    @DeleteMapping("/roles/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable Long id) {
        adminService.deleteRole(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Role supprime"));
    }

    @GetMapping("/permissions")
    public ResponseEntity<ApiResponse<List<AdminPermissionResponse>>> permissions() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listPermissions()));
    }

    @GetMapping("/agencies")
    public ResponseEntity<ApiResponse<List<AdminAgenceResponse>>> agencies() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listAgencies()));
    }

    @PostMapping("/agencies")
    public ResponseEntity<ApiResponse<AdminAgenceResponse>> createAgency(@Valid @RequestBody UpsertAgenceRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createAgency(request), "Agence creee"));
    }

    @PutMapping("/agencies/{id}")
    public ResponseEntity<ApiResponse<AdminAgenceResponse>> updateAgency(@PathVariable Long id, @Valid @RequestBody UpsertAgenceRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateAgency(id, request), "Agence modifiee"));
    }

    @PostMapping(value = "/agencies/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<AdminAgenceResponse>> updateAgencyLogo(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateAgencyLogo(id, file), "Logo agence modifié"));
    }

    @GetMapping("/agencies/{id}/logo")
    public ResponseEntity<byte[]> agencyLogo(@PathVariable Long id) {
        AdminService.AgencyLogo logo = adminService.getAgencyLogo(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(logo.contentType()))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(logo.filename()).build().toString()
                )
                .body(logo.content());
    }

    @DeleteMapping("/agencies/{id}/logo")
    public ResponseEntity<ApiResponse<AdminAgenceResponse>> deleteAgencyLogo(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.deleteAgencyLogo(id), "Logo agence supprimé"));
    }
}
