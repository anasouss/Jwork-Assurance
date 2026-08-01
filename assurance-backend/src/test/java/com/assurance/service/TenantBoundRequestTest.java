package com.assurance.service;

import com.assurance.controller.AttestationStockController;
import com.assurance.controller.ClientController;
import com.assurance.controller.GroupeClientController;
import com.assurance.controller.VehiculeController;
import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TenantBoundRequestTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void contractRequestIgnoresAgenceIdFromJson() throws Exception {
        CreateContratRequest request = objectMapper.readValue(
                "{\"agenceId\":999,\"typeContrat\":\"PARTICULIER\"}",
                CreateContratRequest.class
        );

        assertThat(request.getAgenceId()).isNull();
    }

    @Test
    void clientRequestIgnoresAgenceIdFromJson() throws Exception {
        CreateClientRequest request = objectMapper.readValue(
                "{\"agenceId\":999,\"typeClient\":\"PERSONNE_PHYSIQUE\"}",
                CreateClientRequest.class
        );

        assertThat(request.getAgenceId()).isNull();
    }

    @Test
    void tenantBoundEndpointsRequireMethodAuthorization() {
        List.of(
                        AttestationStockController.class,
                        ClientController.class,
                        GroupeClientController.class,
                        VehiculeController.class
                )
                .forEach(controller -> Arrays.stream(controller.getDeclaredMethods())
                        .filter(this::isEndpoint)
                        .forEach(method -> assertThat(method.getAnnotation(PreAuthorize.class))
                                .as("%s.%s must declare @PreAuthorize", controller.getSimpleName(), method.getName())
                                .isNotNull()));
    }

    private boolean isEndpoint(Method method) {
        return Arrays.stream(method.getAnnotations())
                .anyMatch(annotation -> annotation.annotationType().isAnnotationPresent(RequestMapping.class));
    }
}
