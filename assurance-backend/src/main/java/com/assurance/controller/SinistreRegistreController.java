package com.assurance.controller;

import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreRegistreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/sinistres/registre")
@RequiredArgsConstructor
public class SinistreRegistreController {

    private final SinistreRegistreService registreService;

    @GetMapping("/export")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Long contratId,
            @RequestParam(required = false) Long brancheId,
            @RequestParam(required = false) StatutSinistre statut,
            @RequestParam(required = false) NatureSinistre nature,
            @RequestParam(required = false) EtapeSuiviSinistre etapeSuivi,
            @RequestParam(required = false) LocalDate dateDu,
            @RequestParam(required = false) LocalDate dateAu
    ) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=registre-sinistres.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(registreService.export(TenantContext.getCurrentAgence(), query, clientId, contratId,
                        brancheId, statut, nature, etapeSuivi, dateDu, dateAu));
    }
}
