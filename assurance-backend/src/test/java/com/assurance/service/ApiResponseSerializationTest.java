package com.assurance.service;

import com.assurance.dto.response.ApiResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseSerializationTest {
    @Test
    void nullDataRemainsExplicitWithNonNullApplicationSerialization() throws Exception {
        ObjectMapper mapper = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
        var response = mapper.readTree(mapper.writeValueAsString(ApiResponse.success(null)));
        assertThat(response.has("data")).isTrue();
        assertThat(response.get("data").isNull()).isTrue();
        assertThat(response.has("message")).isFalse();
        assertThat(response.get("success").asBoolean()).isTrue();
    }
}
