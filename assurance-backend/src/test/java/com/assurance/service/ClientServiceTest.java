package com.assurance.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClientServiceTest {

    @Test
    void generatesShortClientCodeFromDatabaseId() {
        assertThat(ClientService.generateClientCode(1L)).isEqualTo("C000001");
        assertThat(ClientService.generateClientCode(1234567L)).isEqualTo("C1234567");
    }
}
