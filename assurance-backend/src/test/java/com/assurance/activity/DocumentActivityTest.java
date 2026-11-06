package com.assurance.activity;

import com.assurance.entity.PieceJointe;
import com.assurance.entity.TypePieceJointe;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentActivityTest {
    @Test
    void doesNotExposeStoragePathsOrTechnicalMetadata() {
        PieceJointe piece = PieceJointe.builder().nomFichier("cin.pdf")
                .cheminStockage("private/agency/secret-storage-key.pdf").lockVersion(8L)
                .createdBy("operator@example.com").typePieceJointe(TypePieceJointe.builder().libelle("CIN").build()).build();
        piece.setId(12L);
        var snapshot = DocumentActivity.snapshot(piece);
        assertThat(snapshot).containsEntry("Fichier", "cin.pdf");
        assertThat(snapshot.values()).doesNotContain("private/agency/secret-storage-key.pdf", "operator@example.com");
        assertThat(DocumentActivity.reference(piece).label()).isEqualTo("CIN - cin.pdf");
    }

    @Test
    void archivingIsAnActualStateChangeNotAFileDeletion() {
        PieceJointe piece = PieceJointe.builder().nomFichier("cin.pdf").archived(false).build();
        var before = DocumentActivity.snapshot(piece);
        piece.setArchived(true);
        assertThat(ActivityValues.changes(before, DocumentActivity.snapshot(piece)))
                .containsExactly(new ActivityChange("Archivé", "Non", "Oui"));
    }
}
