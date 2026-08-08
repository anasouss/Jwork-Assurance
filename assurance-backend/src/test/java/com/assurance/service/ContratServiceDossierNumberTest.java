package com.assurance.service;

import com.assurance.entity.CompagnieAssurance;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratServiceDossierNumberTest {

    @Test
    void usesConfiguredCompanyPrefixWithCompactYearAndFourDigitSequence() {
        CompagnieAssurance company = CompagnieAssurance.builder()
                .code("ATLANTA_SANAD")
                .prefixeDossier("at")
                .build();

        String result = ContratService.formatNumeroDossier(
                company,
                company.getCode(),
                2026,
                1
        );

        assertThat(result).isEqualTo("AT26-0001");
    }

    @Test
    void preservesLegacyFormatWhenCompanyHasNoDossierPrefix() {
        CompagnieAssurance company = CompagnieAssurance.builder()
                .code("ATLANTA_SANAD")
                .build();

        String result = ContratService.formatNumeroDossier(
                company,
                company.getCode(),
                2026,
                1
        );

        assertThat(result).isEqualTo("ATLANTA_SANAD/2026/00001");
    }
}
