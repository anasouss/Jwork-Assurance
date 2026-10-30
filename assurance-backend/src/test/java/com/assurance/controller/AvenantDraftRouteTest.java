package com.assurance.controller;

import com.assurance.exception.GlobalExceptionHandler;
import com.assurance.security.TenantContext;
import com.assurance.service.avenant.AvenantApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AvenantDraftRouteTest {

    @Test
    void supportsBothDraftReadUrlsWithTenantScope() throws Exception {
        var service = mock(AvenantApplicationService.class);
        var mvc = MockMvcBuilders.standaloneSetup(new AvenantController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        TenantContext.setCurrentAgence(7L);
        try {
            mvc.perform(get("/api/v1/contrats/97/avenants/EXG_M/brouillon"))
                    .andExpect(status().isOk());
            verify(service).getDraft(7L, 97L, "EXG_M");
            mvc.perform(get("/api/v1/contrats/97/avenants/brouillon").param("code", "MOG_M"))
                    .andExpect(status().isOk());
            verify(service).getDraft(7L, 97L, "MOG_M");
        } finally {
            TenantContext.clear();
        }
    }
}
