package com.assurance.controller;

import com.assurance.dto.request.UpsertCompteTresorerieRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.CompteTresorerieResponse;
import com.assurance.dto.response.MouvementTresorerieResponse;
import com.assurance.dto.response.MouvementTresoreriePageResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.TresorerieService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/compta/tresorerie")
@RequiredArgsConstructor
public class TresorerieController {

    private final TresorerieService tresorerieService;

    @GetMapping("/comptes")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<List<CompteTresorerieResponse>>> accounts() {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.listAccounts(
                TenantContext.getCurrentAgence()
        )));
    }

    @PostMapping("/comptes")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<CompteTresorerieResponse>> createAccount(
            @Valid @RequestBody UpsertCompteTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.createAccount(
                TenantContext.getCurrentAgence(),
                request
        ), "Compte de trésorerie créé"));
    }

    @PutMapping("/comptes/{accountId}")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<CompteTresorerieResponse>> updateAccount(
            @PathVariable Long accountId,
            @Valid @RequestBody UpsertCompteTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.updateAccount(
                TenantContext.getCurrentAgence(),
                accountId,
                request
        ), "Compte de trésorerie modifié"));
    }

    @GetMapping("/mouvements")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<List<MouvementTresorerieResponse>>> movements() {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.listMovements(
                TenantContext.getCurrentAgence()
        )));
    }

    @GetMapping("/journal")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<MouvementTresoreriePageResponse>> journal(
            @RequestParam(required = false) Long compteId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.searchMovements(
                TenantContext.getCurrentAgence(),
                compteId,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }
}
