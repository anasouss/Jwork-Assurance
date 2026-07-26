package com.assurance.controller;

import com.assurance.dto.request.ResetUserPasswordRequest;
import com.assurance.dto.request.UpsertAgenceRequest;
import com.assurance.dto.request.UpsertProfilRequest;
import com.assurance.dto.request.UpsertUtilisateurRequest;
import com.assurance.dto.response.AdminAgenceResponse;
import com.assurance.dto.response.AdminPermissionResponse;
import com.assurance.dto.response.AdminProfilResponse;
import com.assurance.dto.response.AdminUtilisateurResponse;
import com.assurance.dto.response.ApiResponse;
import com.assurance.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    public ResponseEntity<ApiResponse<AdminUtilisateurResponse>> updateUser(@PathVariable String id, @Valid @RequestBody UpsertUtilisateurRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateUser(id, request), "Utilisateur modifie"));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable String id) {
        adminService.deactivateUser(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Utilisateur desactive"));
    }

    @PutMapping("/users/{id}/password")
    public ResponseEntity<ApiResponse<Void>> resetUserPassword(@PathVariable String id, @Valid @RequestBody ResetUserPasswordRequest request) {
        adminService.resetPassword(id, request);
        return ResponseEntity.ok(ApiResponse.success(null, "Mot de passe modifie"));
    }

    @GetMapping("/roles")
    public ResponseEntity<ApiResponse<List<AdminProfilResponse>>> roles() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listRoles()));
    }

    @PostMapping("/roles")
    public ResponseEntity<ApiResponse<AdminProfilResponse>> createRole(@Valid @RequestBody UpsertProfilRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createRole(request), "Profil cree"));
    }

    @PutMapping("/roles/{id}")
    public ResponseEntity<ApiResponse<AdminProfilResponse>> updateRole(@PathVariable String id, @Valid @RequestBody UpsertProfilRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateRole(id, request), "Profil modifie"));
    }

    @DeleteMapping("/roles/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable String id) {
        adminService.deleteRole(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Profil supprime"));
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
    public ResponseEntity<ApiResponse<AdminAgenceResponse>> updateAgency(@PathVariable String id, @Valid @RequestBody UpsertAgenceRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateAgency(id, request), "Agence modifiee"));
    }
}
