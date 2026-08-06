package com.assurance.service;

import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreDocument;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.SinistreDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SinistreDocumentService {

    private static final long MAX_FILE_SIZE = 20L * 1024L * 1024L;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE,
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final SinistreDocumentRepository documentRepository;
    private final SinistreService sinistreService;
    private final SinistreWorkflowService workflowService;
    private final SinistreEvenementService evenementService;
    private final SinistreResponseMapper responseMapper;
    private final StorageLayoutService storageLayoutService;

    @Transactional
    public SinistreDetailResponse upload(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            TypeDocumentSinistre type,
            String commentaire,
            MultipartFile file
    ) {
        Sinistre sinistre = sinistreService.resolve(agenceId, sinistreId);
        assertEditable(sinistre);
        Utilisateur acteur = sinistreService.resolveCurrentUser(agenceId, utilisateurId);
        validateFile(file);
        StoredDocument stored = store(agenceId, sinistreId, file);
        deleteOnRollback(stored.path());
        documentRepository.save(SinistreDocument.builder()
                .sinistre(sinistre)
                .deposePar(acteur)
                .type(type)
                .statut(StatutDocumentSinistre.RECU)
                .nomFichier(stored.fileName())
                .contentType(stored.contentType())
                .cheminStockage(stored.storageKey())
                .tailleOctets(stored.size())
                .commentaire(trimToNull(commentaire))
                .build());
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.DOCUMENT,
                "Document ajouté : " + stored.fileName()
        );
        return responseMapper.toDetail(sinistre);
    }

    @Transactional(readOnly = true)
    public DownloadedDocument download(Long agenceId, Long sinistreId, Long documentId) {
        sinistreService.resolve(agenceId, sinistreId);
        SinistreDocument document = resolve(documentId, sinistreId);
        Path path = resolveStorageKey(document.getCheminStockage());
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("FichierSinistre", documentId);
        }
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(document.getContentType());
        } catch (RuntimeException error) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return new DownloadedDocument(document, new FileSystemResource(path), mediaType);
    }

    @Transactional
    public SinistreDetailResponse review(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            Long documentId,
            StatutDocumentSinistre statut,
            String commentaire
    ) {
        if (statut == StatutDocumentSinistre.RECU) {
            throw new BadRequestException("Le contrôle doit valider ou rejeter le document");
        }
        Sinistre sinistre = sinistreService.resolve(agenceId, sinistreId);
        assertEditable(sinistre);
        Utilisateur acteur = sinistreService.resolveCurrentUser(agenceId, utilisateurId);
        SinistreDocument document = resolve(documentId, sinistreId);
        document.setStatut(statut);
        document.setValidePar(acteur);
        document.setDateValidation(LocalDateTime.now());
        document.setCommentaire(trimToNull(commentaire));
        documentRepository.save(document);
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.DOCUMENT,
                "Document " + (statut == StatutDocumentSinistre.VALIDE ? "validé" : "rejeté")
                        + " : " + document.getNomFichier()
        );
        return responseMapper.toDetail(sinistre);
    }

    @Transactional
    public SinistreDetailResponse delete(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            Long documentId
    ) {
        Sinistre sinistre = sinistreService.resolve(agenceId, sinistreId);
        assertEditable(sinistre);
        Utilisateur acteur = sinistreService.resolveCurrentUser(agenceId, utilisateurId);
        SinistreDocument document = resolve(documentId, sinistreId);
        if (document.getStatut() == StatutDocumentSinistre.VALIDE) {
            throw new BadRequestException("Un document validé ne peut pas être supprimé");
        }
        Path path = resolveStorageKey(document.getCheminStockage());
        String fileName = document.getNomFichier();
        documentRepository.delete(document);
        deleteAfterCommit(path);
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.DOCUMENT,
                "Document supprimé : " + fileName
        );
        return responseMapper.toDetail(sinistre);
    }

    private SinistreDocument resolve(Long documentId, Long sinistreId) {
        return documentRepository.findByIdAndSinistreId(documentId, sinistreId)
                .orElseThrow(() -> new ResourceNotFoundException("SinistreDocument", documentId));
    }

    private void assertEditable(Sinistre sinistre) {
        if (!workflowService.isEditable(sinistre.getStatut())) {
            throw new BadRequestException("Le sinistre doit être rouvert avant de modifier ses documents");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Aucun fichier sélectionné");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Le fichier dépasse la taille maximale de 20 Mo");
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BadRequestException("Format de fichier non autorisé");
        }
    }

    private StoredDocument store(Long agenceId, Long sinistreId, MultipartFile file) {
        String originalName = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
        String extension = safeExtension(originalName);
        String storageKey = Path.of(agenceId.toString())
                .resolve(sinistreId.toString())
                .resolve(UUID.randomUUID() + extension)
                .toString();
        Path path = resolveStorageKey(storageKey);
        Path directory = path.getParent();
        try {
            Files.createDirectories(directory);
            Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            return new StoredDocument(
                    storageKey,
                    originalName,
                    normalizeContentType(file.getContentType()),
                    file.getSize(),
                    path
            );
        } catch (IOException error) {
            throw new IllegalStateException("Impossible d'enregistrer le document du sinistre", error);
        }
    }

    private String safeExtension(String fileName) {
        int index = fileName.lastIndexOf('.');
        if (index < 0) {
            return "";
        }
        String extension = fileName.substring(index).toLowerCase(Locale.ROOT);
        return extension.matches("\\.(pdf|png|jpe?g|docx?)") ? extension : "";
    }

    private String normalizeContentType(String contentType) {
        return contentType == null || contentType.isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : contentType.toLowerCase(Locale.ROOT);
    }

    private Path resolveStorageKey(String storageKey) {
        try {
            return storageLayoutService.resolveClaimDocument(storageKey);
        } catch (IllegalArgumentException | IllegalStateException error) {
            throw new BadRequestException("Chemin de stockage invalide");
        }
    }

    private void deleteOnRollback(Path path) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    deleteQuietly(path);
                }
            }
        });
    }

    private void deleteAfterCommit(Path path) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(path);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(path);
            }
        });
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Database state remains authoritative; orphan cleanup can retry later.
        }
    }

    private String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private record StoredDocument(
            String storageKey,
            String fileName,
            String contentType,
            long size,
            Path path
    ) {
    }

    public record DownloadedDocument(
            SinistreDocument document,
            Resource resource,
            MediaType mediaType
    ) {
    }
}
