package com.assurance.controller;

import com.assurance.dto.request.ChangerStatutCompteTresorerieRequest;
import com.assurance.dto.request.CloturerSessionCaisseRequest;
import com.assurance.dto.request.CreerAjustementTresorerieRequest;
import com.assurance.dto.request.CreerTransfertTresorerieRequest;
import com.assurance.dto.request.AnnulerOperationTresorerieRequest;
import com.assurance.dto.request.OuvrirSessionCaisseRequest;
import com.assurance.dto.request.UpsertAffectationsCompteTresorerieRequest;
import com.assurance.dto.request.UpsertCompteTresorerieRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.CompteTresorerieResponse;
import com.assurance.dto.response.AffectationCompteTresorerieResponse;
import com.assurance.dto.response.MouvementTresorerieResponse;
import com.assurance.dto.response.MouvementTresoreriePageResponse;
import com.assurance.dto.response.OperationTresoreriePageResponse;
import com.assurance.dto.response.OperationTresorerieResponse;
import com.assurance.dto.response.SessionCaisseResponse;
import com.assurance.dto.response.UtilisateurTresorerieResponse;
import com.assurance.enums.TypeOperationTresorerie;
import com.assurance.security.TenantContext;
import com.assurance.service.TresorerieService;
import com.assurance.service.OperationTresorerieService;
import com.assurance.service.SessionCaisseService;
import com.assurance.service.TresorerieAccessService;
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
    private final TresorerieAccessService accessService;
    private final SessionCaisseService sessionCaisseService;
    private final OperationTresorerieService operationTresorerieService;

    @GetMapping("/comptes")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<List<CompteTresorerieResponse>>> accounts() {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.listAccounts(
                TenantContext.getCurrentAgence(),
                false
        )));
    }

    @GetMapping("/comptes/administration")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<List<CompteTresorerieResponse>>> administrationAccounts() {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.listAccounts(
                TenantContext.getCurrentAgence(),
                true
        )));
    }

    @GetMapping("/utilisateurs")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<List<UtilisateurTresorerieResponse>>> users() {
        return ResponseEntity.ok(ApiResponse.success(accessService.listAgencyUsers(
                TenantContext.getCurrentAgence()
        )));
    }

    @GetMapping("/comptes/{accountId}/affectations")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<List<AffectationCompteTresorerieResponse>>> assignments(
            @PathVariable Long accountId
    ) {
        return ResponseEntity.ok(ApiResponse.success(accessService.listAssignments(
                TenantContext.getCurrentAgence(),
                accountId
        )));
    }

    @PutMapping("/comptes/{accountId}/affectations")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<List<AffectationCompteTresorerieResponse>>> saveAssignments(
            @PathVariable Long accountId,
            @Valid @RequestBody UpsertAffectationsCompteTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(accessService.replaceAssignments(
                TenantContext.getCurrentAgence(),
                accountId,
                request
        ), "Affectations du compte enregistrées"));
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

    @PutMapping("/comptes/{accountId}/statut")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<CompteTresorerieResponse>> changeAccountStatus(
            @PathVariable Long accountId,
            @Valid @RequestBody ChangerStatutCompteTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(tresorerieService.changeAccountStatus(
                TenantContext.getCurrentAgence(),
                accountId,
                request.getActif()
        ), Boolean.TRUE.equals(request.getActif())
                ? "Compte de trésorerie activé"
                : "Compte de trésorerie désactivé"));
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

    @GetMapping("/sessions-caisse")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<List<SessionCaisseResponse>>> cashSessions() {
        return ResponseEntity.ok(ApiResponse.success(sessionCaisseService.list(
                TenantContext.getCurrentAgence()
        )));
    }

    @PostMapping("/sessions-caisse")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<SessionCaisseResponse>> openCashSession(
            @Valid @RequestBody OuvrirSessionCaisseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(sessionCaisseService.open(
                TenantContext.getCurrentAgence(),
                request
        ), "Session de caisse ouverte"));
    }

    @PostMapping("/sessions-caisse/{sessionId}/cloture")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<SessionCaisseResponse>> closeCashSession(
            @PathVariable Long sessionId,
            @Valid @RequestBody CloturerSessionCaisseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(sessionCaisseService.close(
                TenantContext.getCurrentAgence(),
                sessionId,
                request
        ), "Session de caisse clôturée"));
    }

    @GetMapping("/operations")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<OperationTresoreriePageResponse>> operations(
            @RequestParam(required = false) Long compteId,
            @RequestParam(required = false) TypeOperationTresorerie type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(operationTresorerieService.search(
                TenantContext.getCurrentAgence(),
                compteId,
                type,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @PostMapping("/operations/transferts")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<OperationTresorerieResponse>> createTransfer(
            @Valid @RequestBody CreerTransfertTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(operationTresorerieService.createTransfer(
                TenantContext.getCurrentAgence(),
                request
        ), "Transfert enregistré"));
    }

    @PostMapping("/operations/ajustements")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<OperationTresorerieResponse>> createAdjustment(
            @Valid @RequestBody CreerAjustementTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(operationTresorerieService.createAdjustment(
                TenantContext.getCurrentAgence(),
                request
        ), "Ajustement enregistré"));
    }

    @PostMapping("/operations/{operationId}/annulation")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<OperationTresorerieResponse>> cancelOperation(
            @PathVariable Long operationId,
            @Valid @RequestBody AnnulerOperationTresorerieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(operationTresorerieService.cancel(
                TenantContext.getCurrentAgence(),
                operationId,
                request
        ), "Opération annulée par contre-écriture"));
    }
}
