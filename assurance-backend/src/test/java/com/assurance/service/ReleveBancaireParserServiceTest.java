package com.assurance.service;

import com.assurance.dto.request.ConfigurationImportReleveBancaireRequest;
import com.assurance.enums.FormatReleveBancaire;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ReleveBancaireParserServiceTest {

    private final ReleveBancaireParserService service = new ReleveBancaireParserService();

    @TempDir
    Path temporaryDirectory;

    @Test
    void parsesQuotedCsvAndFrenchAmounts() throws Exception {
        Path file = temporaryDirectory.resolve("releve.csv");
        Files.writeString(file, """
                Date;Libellé;Référence;Débit;Crédit
                10/08/2026;\"Virement, client\";VIR-42;;1 234,50
                11/08/2026;Frais bancaires;FRAIS-1;25,00;
                """);

        ReleveBancaireParserService.ParseResult result = service.parse(
                file,
                FormatReleveBancaire.CSV,
                new ConfigurationImportReleveBancaireRequest()
        );

        assertThat(result.complete()).isTrue();
        assertThat(result.lines()).hasSize(2);
        assertThat(result.lines().get(0).description()).isEqualTo("Virement, client");
        assertThat(result.lines().get(0).credit()).isEqualByComparingTo(new BigDecimal("1234.50"));
        assertThat(result.lines().get(1).debit()).isEqualByComparingTo(new BigDecimal("25.00"));
    }

    @Test
    void previewsUnmappedCsvWithoutPersistableLines() throws Exception {
        Path file = temporaryDirectory.resolve("inconnu.csv");
        Files.writeString(file, "Colonne A;Colonne B\n10/08/2026;100,00\n");

        ReleveBancaireParserService.ParseResult result = service.parse(
                file,
                FormatReleveBancaire.CSV,
                new ConfigurationImportReleveBancaireRequest()
        );

        assertThat(result.complete()).isFalse();
        assertThat(result.lines()).isEmpty();
        assertThat(result.preview()).hasSize(1);
    }

    @Test
    void detectsFrenchAndInternationalAmountsInTheSameFile() throws Exception {
        Path file = temporaryDirectory.resolve("mixed-amounts.csv");
        Files.writeString(file, """
                Date;Libellé;Débit;Crédit
                10/08/2026;Format français;;1.234,50
                11/08/2026;Format international;;1,234.50
                12/08/2026;Point décimal;25.75;
                13/08/2026;Virgule décimale;25,75;
                """);

        ReleveBancaireParserService.ParseResult result = service.parse(
                file,
                FormatReleveBancaire.CSV,
                new ConfigurationImportReleveBancaireRequest()
        );

        assertThat(result.lines()).hasSize(4);
        assertThat(result.lines().get(0).credit()).isEqualByComparingTo("1234.50");
        assertThat(result.lines().get(1).credit()).isEqualByComparingTo("1234.50");
        assertThat(result.lines().get(2).debit()).isEqualByComparingTo("25.75");
        assertThat(result.lines().get(3).debit()).isEqualByComparingTo("25.75");
    }
}
