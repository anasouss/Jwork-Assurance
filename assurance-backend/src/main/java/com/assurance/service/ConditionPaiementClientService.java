package com.assurance.service;

import com.assurance.dto.response.ConditionPaiementClientResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.ConditionPaiementClient;
import com.assurance.entity.GroupeClient;
import com.assurance.enums.OrigineDelaiPaiement;
import com.assurance.enums.TypeJustificationConditionPaiement;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ConditionPaiementClientRepository;
import com.assurance.repository.GroupeClientRepository;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConditionPaiementClientService {

    public static final int DEFAULT_DAYS = 60;
    private static final Set<Integer> ALLOWED_DAYS = Set.of(30, 60, 90, 120, 180);
    private static final long MAX_FILE_SIZE = 30L * 1024L * 1024L;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE,
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final ConditionPaiementClientRepository repository;
    private final AgenceRepository agenceRepository;
    private final ClientRepository clientRepository;
    private final GroupeClientRepository groupeClientRepository;
    private final StorageLayoutService storageLayoutService;

    @Transactional(readOnly = true)
    public List<ConditionPaiementClientResponse> list(Long agenceId, String payeurType, Long payeurId) {
        Payer payer = resolvePayer(agenceId, payeurType, payeurId);
        List<ConditionPaiementClient> rows = payer.client() != null
                ? repository.findByAgenceIdAndClientPayeurIdOrderByDateDebutDescIdDesc(agenceId, payeurId)
                : repository.findByAgenceIdAndGroupePayeurIdOrderByDateDebutDescIdDesc(agenceId, payeurId);
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional
    public ConditionPaiementClientResponse create(
            Long agenceId,
            String payeurType,
            Long payeurId,
            Integer delaiJours,
            TypeJustificationConditionPaiement typeJustification,
            LocalDate dateDebut,
            LocalDate dateFin,
            String commentaire,
            MultipartFile justificatif
    ) {
        validate(delaiJours, typeJustification, dateDebut, dateFin, justificatif);
        Payer payer = resolvePayer(agenceId, payeurType, payeurId);
        List<ConditionPaiementClient> history = payer.client() != null
                ? repository.findByAgenceIdAndClientPayeurIdOrderByDateDebutDescIdDesc(agenceId, payeurId)
                : repository.findByAgenceIdAndGroupePayeurIdOrderByDateDebutDescIdDesc(agenceId, payeurId);
        closePreviousVersion(history, dateDebut);

        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        ConditionPaiementClient condition = repository.saveAndFlush(ConditionPaiementClient.builder()
                .agence(agence)
                .clientPayeur(payer.client())
                .groupePayeur(payer.group())
                .delaiJours(delaiJours)
                .typeJustification(typeJustification)
                .dateDebut(dateDebut)
                .dateFin(dateFin)
                .commentaire(trimToNull(commentaire))
                .build());

        if (justificatif != null && !justificatif.isEmpty()) {
            StoredFile stored = store(agenceId, condition.getId(), justificatif);
            deleteOnRollback(stored.path());
            condition.setNomFichier(stored.fileName());
            condition.setContentType(stored.contentType());
            condition.setCheminStockage(stored.storageKey());
            condition.setTailleOctets(stored.size());
            condition = repository.save(condition);
        }
        return toResponse(condition);
    }

    @Transactional(readOnly = true)
    public ResolvedCondition resolve(Long agenceId, Client client, GroupeClient group, LocalDate referenceDate) {
        if (group != null) {
            List<ConditionPaiementClient> groupConditions = repository.findEffectiveForGroup(
                    agenceId,
                    group.getId(),
                    referenceDate
            );
            if (!groupConditions.isEmpty()) {
                return resolved(groupConditions.get(0), OrigineDelaiPaiement.CONDITION_GROUPE);
            }
        }
        if (client != null) {
            List<ConditionPaiementClient> clientConditions = repository.findEffectiveForClient(
                    agenceId,
                    client.getId(),
                    referenceDate
            );
            if (!clientConditions.isEmpty()) {
                return resolved(clientConditions.get(0), OrigineDelaiPaiement.CONDITION_CLIENT);
            }
        }
        return new ResolvedCondition(
                DEFAULT_DAYS,
                OrigineDelaiPaiement.DEFAUT_60_JOURS,
                null,
                null,
                false,
                null
        );
    }

    @Transactional(readOnly = true)
    public DownloadedFile download(Long agenceId, Long conditionId) {
        ConditionPaiementClient condition = repository.findByAgenceIdAndId(agenceId, conditionId)
                .orElseThrow(() -> new ResourceNotFoundException("ConditionPaiementClient", conditionId));
        if (condition.getCheminStockage() == null) {
            throw new ResourceNotFoundException("JustificatifConditionPaiement", conditionId);
        }
        Path path = storageLayoutService.resolveClientPaymentCondition(agenceId, condition.getCheminStockage());
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("JustificatifConditionPaiement", conditionId);
        }
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(condition.getContentType());
        } catch (RuntimeException error) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return new DownloadedFile(new FileSystemResource(path), mediaType, condition.getNomFichier());
    }

    private void closePreviousVersion(List<ConditionPaiementClient> history, LocalDate newStart) {
        if (history.isEmpty()) {
            return;
        }
        ConditionPaiementClient latest = history.get(0);
        if (!newStart.isAfter(latest.getDateDebut())) {
            throw new BadRequestException("La nouvelle condition doit commencer après la dernière version enregistrée");
        }
        if (latest.getDateFin() == null || !latest.getDateFin().isBefore(newStart)) {
            latest.setDateFin(newStart.minusDays(1));
            repository.save(latest);
        }
    }

    private void validate(
            Integer days,
            TypeJustificationConditionPaiement type,
            LocalDate start,
            LocalDate end,
            MultipartFile file
    ) {
        if (days == null || !ALLOWED_DAYS.contains(days)) {
            throw new BadRequestException("Le délai doit être de 30, 60, 90, 120 ou 180 jours");
        }
        if (type == null || start == null) {
            throw new BadRequestException("Le type de condition et sa date de début sont obligatoires");
        }
        if (end != null && end.isBefore(start)) {
            throw new BadRequestException("La date de fin doit être postérieure ou égale à la date de début");
        }
        if (days == 180 && type != TypeJustificationConditionPaiement.DEROGATION_SECTORIELLE) {
            throw new BadRequestException("Le délai de 180 jours est réservé à une dérogation sectorielle");
        }
        if ((days == 90 || days == 120) && type != TypeJustificationConditionPaiement.ACCORD_CONTRACTUEL) {
            throw new BadRequestException("Un délai de 90 ou 120 jours doit reposer sur un accord contractuel");
        }
        if (days <= 60 && type == TypeJustificationConditionPaiement.DEROGATION_SECTORIELLE) {
            throw new BadRequestException("Une dérogation sectorielle n'est applicable qu'au délai de 180 jours");
        }
        if (file != null && !file.isEmpty()) {
            if (file.getSize() > MAX_FILE_SIZE) {
                throw new BadRequestException("Le justificatif dépasse la taille maximale de 30 Mo");
            }
            if (!ALLOWED_CONTENT_TYPES.contains(normalizeContentType(file.getContentType()))) {
                throw new BadRequestException("Format de justificatif non autorisé");
            }
        }
    }

    private Payer resolvePayer(Long agenceId, String payeurType, Long payeurId) {
        if (payeurId == null || payeurType == null) {
            throw new BadRequestException("Le payeur est obligatoire");
        }
        if ("CLIENT".equalsIgnoreCase(payeurType)) {
            Client client = clientRepository.findByAgenceIdAndId(agenceId, payeurId)
                    .orElseThrow(() -> new ResourceNotFoundException("Client", payeurId));
            return new Payer(client, null);
        }
        if ("GROUPE".equalsIgnoreCase(payeurType)) {
            GroupeClient group = groupeClientRepository.findByAgenceIdAndId(agenceId, payeurId)
                    .orElseThrow(() -> new ResourceNotFoundException("GroupeClient", payeurId));
            return new Payer(null, group);
        }
        throw new BadRequestException("Le type de payeur doit être CLIENT ou GROUPE");
    }

    private StoredFile store(Long agenceId, Long conditionId, MultipartFile file) {
        String originalName = file.getOriginalFilename() == null ? "justificatif" : file.getOriginalFilename();
        String extension = safeExtension(originalName);
        String key = Path.of(agenceId.toString(), conditionId.toString(), UUID.randomUUID() + extension).toString();
        Path path = storageLayoutService.resolveClientPaymentCondition(agenceId, key);
        try {
            Files.createDirectories(path.getParent());
            Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            return new StoredFile(key, originalName, normalizeContentType(file.getContentType()), file.getSize(), path);
        } catch (IOException error) {
            throw new IllegalStateException("Impossible d'enregistrer le justificatif de délai de paiement", error);
        }
    }

    private ResolvedCondition resolved(ConditionPaiementClient condition, OrigineDelaiPaiement origin) {
        return new ResolvedCondition(
                condition.getDelaiJours(),
                origin,
                condition.getId(),
                condition.getDateFin(),
                condition.getCheminStockage() != null,
                condition
        );
    }

    private ConditionPaiementClientResponse toResponse(ConditionPaiementClient condition) {
        LocalDate today = LocalDate.now();
        String status = condition.getDateDebut().isAfter(today)
                ? "A_VENIR"
                : condition.getDateFin() != null && condition.getDateFin().isBefore(today)
                        ? "EXPIREE"
                        : "ACTIVE";
        return ConditionPaiementClientResponse.builder()
                .id(condition.getId())
                .payeurType(condition.getGroupePayeur() == null ? "CLIENT" : "GROUPE")
                .payeurId(condition.getGroupePayeur() == null
                        ? condition.getClientPayeur().getId()
                        : condition.getGroupePayeur().getId())
                .delaiJours(condition.getDelaiJours())
                .typeJustification(condition.getTypeJustification())
                .dateDebut(condition.getDateDebut())
                .dateFin(condition.getDateFin())
                .statut(status)
                .justificatifPresent(condition.getCheminStockage() != null)
                .nomFichier(condition.getNomFichier())
                .commentaire(condition.getCommentaire())
                .createdAt(condition.getCreatedAt())
                .build();
    }

    private void deleteOnRollback(Path path) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                        // Database state remains authoritative.
                    }
                }
            }
        });
    }

    private String safeExtension(String fileName) {
        int index = fileName.lastIndexOf('.');
        if (index < 0) {
            return "";
        }
        String extension = fileName.substring(index).toLowerCase(Locale.ROOT);
        return extension.matches("\\.(pdf|png|jpe?g|docx?)") ? extension : "";
    }

    private String normalizeContentType(String value) {
        return value == null || value.isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : value.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record Payer(Client client, GroupeClient group) {
    }

    private record StoredFile(String storageKey, String fileName, String contentType, long size, Path path) {
    }

    public record ResolvedCondition(
            int days,
            OrigineDelaiPaiement origin,
            Long conditionId,
            LocalDate conditionEndDate,
            boolean evidencePresent,
            ConditionPaiementClient condition
    ) {
    }

    public record DownloadedFile(Resource resource, MediaType mediaType, String fileName) {
    }
}
