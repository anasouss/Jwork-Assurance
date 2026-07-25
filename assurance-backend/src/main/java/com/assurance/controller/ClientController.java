package com.assurance.controller;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ClientResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.ClientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<ClientResponse>> search(
            @RequestParam(required = false) String cin,
            @RequestParam(required = false) String rc
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                clientService.searchByIdentity(TenantContext.getCurrentAgence(), cin, rc).orElse(null)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ClientResponse>> create(@Valid @RequestBody CreateClientRequest request) {
        return ResponseEntity.ok(ApiResponse.success(clientService.create(request), "Client cree"));
    }
}
