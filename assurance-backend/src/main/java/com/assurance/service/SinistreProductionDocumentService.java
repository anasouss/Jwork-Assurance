package com.assurance.service;

import com.assurance.entity.PieceJointe;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreDocument;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.DocumentOwner;
import com.assurance.enums.DocumentValiditySource;
import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.repository.DocumentPolicyRepository;
import com.assurance.repository.PieceJointeRepository;
import com.assurance.repository.SinistreDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SinistreProductionDocumentService {
    private final PieceJointeRepository pieces;
    private final DocumentPolicyRepository policies;
    private final SinistreDocumentRepository documents;
    private final SinistreEvenementService events;
    private final StorageLayoutService storage;

    // The caller holds the agency-scoped claim lock and owns the transaction.
    public void attachAvailable(Sinistre claim, Utilisateur actor) {
        if (claim.getVehicule() == null || claim.getDateSinistre() == null
                || claim.getStatut() == com.assurance.enums.StatutSinistre.CLOTURE
                || claim.getStatut() == com.assurance.enums.StatutSinistre.ANNULE
                || claim.getStatut() == com.assurance.enums.StatutSinistre.REJETE
                || claim.getEtapeSuivi() == com.assurance.enums.EtapeSuiviSinistre.CLOTURE
                || documents.existsBySinistreIdAndType(claim.getId(), TypeDocumentSinistre.CARTE_GRISE)) {
            return;
        }
        Long agency = claim.getAgence().getId();
        List<PieceJointe> candidates = pieces.findClaimVehicleCandidates(agency, claim.getVehicule().getId())
                .stream().filter(piece -> eligible(piece, claim)).toList();
        if (candidates.size() != 1) {
            return;
        }
        PieceJointe source = pieces.lockClaimSource(agency, candidates.get(0).getId()).orElse(null);
        if (source == null || !eligible(source, claim)) {
            return;
        }
        SinistreDocument document = SinistreDocument.builder()
                .sinistre(claim).deposePar(actor).sourcePieceJointe(source)
                .type(TypeDocumentSinistre.CARTE_GRISE).statut(StatutDocumentSinistre.RECU)
                .nomFichier(source.getNomFichier()).contentType(source.getContentType())
                .cheminStockage(source.getCheminStockage())
                .tailleOctets(source.getTailleOctets() == null ? 0 : source.getTailleOctets())
                .commentaire("Rattachement automatique du document de production, sans copie du fichier")
                .build();
        documents.save(document);
        events.record(claim, actor, TypeEvenementSinistre.DOCUMENT,
                "Carte grise rattachee automatiquement depuis la production (piece " + source.getId() + ")");
    }

    private boolean eligible(PieceJointe piece, Sinistre claim) {
        if ((piece.getAgence() != null && !Objects.equals(piece.getAgence().getId(), claim.getAgence().getId()))
                || piece.getContrat() == null || !Objects.equals(piece.getContrat().getAgence().getId(), claim.getAgence().getId())
                || piece.getVehicule() == null || !Objects.equals(piece.getVehicule().getId(), claim.getVehicule().getId())
                || piece.getDocumentOwner() != DocumentOwner.VEHICULE || Boolean.TRUE.equals(piece.getArchived())
                || piece.getTypePieceJointe() == null || piece.getTypePieceJointe().getNaturePieceJointe() == null
                || (piece.getExpiresOn() != null && piece.getExpiresOn().isBefore(claim.getDateSinistre()))) {
            return false;
        }
        if (piece.getTypePieceJointe().getAgence() != null
                && !Objects.equals(piece.getTypePieceJointe().getAgence().getId(), claim.getAgence().getId())) {
            return false;
        }
        var nature = piece.getTypePieceJointe().getNaturePieceJointe();
        if (nature.getAgence() != null && !Objects.equals(nature.getAgence().getId(), claim.getAgence().getId())) {
            return false;
        }
        var policy = policies.findByAgenceIdAndNatureId(claim.getAgence().getId(), nature.getId()).orElse(null);
        DocumentOwner owner = policy == null ? nature.getDefaultOwner() : policy.getOwner();
        DocumentValiditySource validity = policy == null ? nature.getDefaultValiditySource() : policy.getValiditySource();
        if (owner != DocumentOwner.VEHICULE || validity != DocumentValiditySource.VEHICULE_CARTE_GRISE) {
            return false;
        }
        var expiry = policy == null ? nature.getDefaultExpiry() : policy.getExpiry();
        if (expiry == com.assurance.enums.DocumentExpiry.REQUIRED && piece.getExpiresOn() == null) {
            return false;
        }
        try {
            SinistreDocument reference = SinistreDocument.builder().sinistre(claim).sourcePieceJointe(piece)
                    .cheminStockage(piece.getCheminStockage()).build();
            return Files.isRegularFile(storage.resolveClaimDocument(reference), LinkOption.NOFOLLOW_LINKS);
        } catch (IllegalArgumentException | IllegalStateException invalid) {
            return false;
        }
    }
}
