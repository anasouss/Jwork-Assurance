package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.LigneBordereauEspeces;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import com.assurance.repository.BordereauRemiseRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BordereauRemisePdfServiceTest {

    private final BordereauRemiseRepository repository = mock(BordereauRemiseRepository.class);
    private final BordereauRemisePdfService service = new BordereauRemisePdfService(
            repository, mock(AgencyLogoStorageService.class));

    @Test
    void cashSlipUsesCompactLabelsWithoutOperationalStatus() throws Exception {
        for (StatutBordereauRemise status : new StatutBordereauRemise[]{
                StatutBordereauRemise.CLOTURE, StatutBordereauRemise.BROUILLON}) {
            BordereauRemise slip = cashSlip(1);
            slip.setStatut(status);
            when(repository.findByIdAndAgenceId(10L, 1L)).thenReturn(Optional.of(slip));
            try (PDDocument pdf = PDDocument.load(service.generate(1L, 10L))) {
                String text = new PDFTextStripper().getText(pdf);
                assertThat(pdf.getNumberOfPages()).isEqualTo(1);
                assertThat(text).contains("Réf. cabinet", "DATE D’ENCAISSEMENT", "OPÉRATEUR", "TOTAL", "5 620,00 MAD")
                        .doesNotContain("Réf. interne", "DATE DE REMISE", "ENCAISSEMENTS", "CAISSIER",
                                "ENCAISS.", "MONTANT VERSÉ", "DATE DE VALEUR", "CLÔTURÉ", "PROVISOIRE",
                                "Journées de caisse versées", "Caisse source");
            }
        }
    }

    @Test
    void longCashSlipKeepsLastRowAndTotalAcrossPages() throws Exception {
        BordereauRemise slip = cashSlip(60);
        when(repository.findByIdAndAgenceId(10L, 1L)).thenReturn(Optional.of(slip));
        try (PDDocument pdf = PDDocument.load(service.generate(1L, 10L))) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            assertThat(new PDFTextStripper().getText(pdf)).contains("11/12/2026", "337 200,00 MAD", "TOTAL");
        }
    }

    private BordereauRemise cashSlip(int days) {
        Agence agence = Agence.builder().nom("Agence test").ville("Agadir").build();
        Utilisateur operator = Utilisateur.builder().prenom("Mohammed").nom("Melymane").build();
        CompteTresorerie source = CompteTresorerie.builder().libelle("Caisse source")
                .utilisateurTitulaire(operator).build();
        source.setId(3L);
        CompteTresorerie destination = CompteTresorerie.builder().libelle("BANQUE").devise("MAD").build();
        BordereauRemise slip = BordereauRemise.builder().agence(agence).numero("BRV-2026-000001")
                .type(TypeBordereauRemise.VERSEMENT_ESPECES).statut(StatutBordereauRemise.CLOTURE)
                .dateBordereau(LocalDate.of(2026, 10, 27)).dateDepot(LocalDate.of(2026, 10, 27))
                .compteDestination(destination).montantTotal(new BigDecimal("5620").multiply(BigDecimal.valueOf(days))).build();
        for (int day = 0; day < days; day++) {
            MouvementTresorerie movement = MouvementTresorerie.builder().compteTresorerie(source)
                    .dateOperation(LocalDate.of(2026, 10, 13).plusDays(day)).build();
            slip.getLignesEspeces().add(LigneBordereauEspeces.builder().bordereau(slip)
                    .mouvementTresorerie(movement).montant(new BigDecimal("5620")).build());
        }
        return slip;
    }
}
