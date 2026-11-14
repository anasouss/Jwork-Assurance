package com.assurance.activity;

import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceActivityTest {
    @Test
    void invoiceAuditIncludesConventionAddressSnapshot() {
        DocumentClient invoice = DocumentClient.builder().conventionFacturee("AOSFOC")
                .conventionAdresse("BP 1692").conventionVille("Agadir").build();
        assertThat(InvoiceActivity.snapshot(invoice))
                .containsEntry("Convention facturée", "AOSFOC")
                .containsEntry("Adresse de la convention", "BP 1692")
                .containsEntry("Ville de la convention", "Agadir");
    }

    @Test
    void oneInvoiceContainsLineContentAndSourceReferencesWithoutLineEvents() {
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        Contrat contract = Contrat.builder().numeroDossier("MATU26-0026").build();
        contract.setId(99L);
        ElementFacturable source = ElementFacturable.builder().contrat(contract).build();
        source.setId(247L);
        DocumentClient invoice = DocumentClient.builder().agence(agency).typeDocument(TypeDocumentClient.FACTURE)
                .numero("FAC-26-000001").payeurNom("Client").build();
        invoice.setId(1L);
        invoice.setLignes(List.of(LigneDocumentClient.builder().elementFacturable(source)
                .numeroDossier("MATU26-0026").numeroPolice("11207650").primeNette(new BigDecimal("1066.53"))
                .montantTtc(new BigDecimal("1257.38")).build()));
        var command = InvoiceActivity.command(invoice, Map.of(), ActivityAction.ISSUED,
                "Facture emise", "CLIENT_DOCUMENT_ISSUANCE", List.of());

        assertThat(command.subject().type()).isEqualTo(ActivityRecordType.DOCUMENT_CLIENT);
        assertThat(command.references()).extracting(ActivityReference::type)
                .contains(ActivityRecordType.CONTRAT, ActivityRecordType.ELEMENT_FACTURABLE);
        assertThat(command.changes()).contains(new ActivityChange("Ligne 1 - Montant TTC", null, "1 257,38"));
        var before = InvoiceActivity.snapshot(invoice);
        invoice.getLignes().get(0).setId(2000L);
        assertThat(ActivityValues.changes(before, InvoiceActivity.snapshot(invoice))).isEmpty();
    }
}
