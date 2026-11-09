package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Contrat;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.NatureElementFacturable;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class BillableReferencesTest {
    @Test
    void assistanceNeverFallsBackToItsParentPolicy() {
        var element = ElementFacturable.builder().nature(NatureElementFacturable.ASSISTANCE)
                .contrat(Contrat.builder().numeroPolice("PARENT-POLICY").build()).build();
        element.setId(1L);
        var assistance = AssistanceContrat.builder().elementFacturable(element)
                .numeroPoliceContrat("PARENT-POLICY").numeroContratOuQuittance("ASSIST-123").build();
        assertThat(BillableReferences.assistance(assistance)).isEqualTo("ASSIST-123");
        assertThat(BillableReferences.element(element, Map.of(1L, "ASSIST-123"))).isEqualTo("ASSIST-123");
        assertThat(BillableReferences.element(element, Map.of())).isNull();
        assistance.setNumeroContratOuQuittance(" ");
        assertThat(BillableReferences.assistance(assistance)).isNull();
    }

    @Test
    void existingDocumentUsesTheSavedAssistanceReferenceWithoutRewritingIt() {
        var element = ElementFacturable.builder().nature(NatureElementFacturable.ASSISTANCE).build();
        element.setId(1L);
        var line = LigneDocumentClient.builder().elementFacturable(element)
                .numeroPolice("PARENT-POLICY").numeroQuittance("ASSIST-OLD").build();
        var document = DocumentClient.builder().build();
        document.getLignes().add(line);
        var allocation = AffectationReglementClient.builder().elementFacturable(element).documentClient(document).build();
        assertThat(BillableReferences.allocation(allocation, Map.of(1L, "ASSIST-NEW"))).isEqualTo("ASSIST-OLD");
        assertThat(line.getNumeroPolice()).isEqualTo("PARENT-POLICY");
        line.setNumeroQuittance(null);
        assertThat(BillableReferences.documentLine(line)).isNull();
    }

    @Test
    void insuranceStillUsesItsPolicyNumber() {
        var element = ElementFacturable.builder().nature(NatureElementFacturable.CONTRAT)
                .contrat(Contrat.builder().numeroPolice("INSURANCE-1").build()).build();
        assertThat(BillableReferences.element(element, Map.of())).isEqualTo("INSURANCE-1");
        assertThat(BillableReferences.documentLine(LigneDocumentClient.builder().elementFacturable(element)
                .numeroPolice("INSURANCE-OLD").numeroQuittance("QUITTANCE-1").build())).isEqualTo("INSURANCE-OLD");
    }
}
