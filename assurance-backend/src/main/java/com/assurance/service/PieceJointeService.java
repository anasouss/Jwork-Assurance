package com.assurance.service;

import com.assurance.dto.request.UpsertTypePieceJointeRequest;
import com.assurance.dto.response.PieceJointeResponse;
import com.assurance.dto.response.PiecesJointesContratResponse;
import com.assurance.dto.response.ReferenceOptionResponse;
import com.assurance.dto.response.TypePieceJointeResponse;
import com.assurance.entity.Client;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.BaseEntity;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.NaturePieceJointe;
import com.assurance.entity.PieceJointe;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.TypePieceJointe;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.TypeAssistance;
import com.assurance.enums.TypeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.BrancheAssuranceRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.NaturePieceJointeRepository;
import com.assurance.repository.PieceJointeRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import com.assurance.repository.TypePieceJointeRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PieceJointeService {

    private final ContratRepository contratRepository;
    private final AgenceRepository agenceRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final NaturePieceJointeRepository naturePieceJointeRepository;
    private final TypeMouvementContratRepository typeMouvementContratRepository;
    private final TypePieceJointeRepository typePieceJointeRepository;
    private final PieceJointeRepository pieceJointeRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final BrancheAssuranceRepository brancheAssuranceRepository;
    private final StorageLayoutService storageLayoutService;

    @Transactional(readOnly = true)
    public List<TypePieceJointeResponse> listTypes(Long agenceId, boolean includeInactive) {
        return effectiveTypes(agenceId, includeInactive).stream()
                .sorted(typeComparator())
                .map(this::toTypeResponse)
                .toList();
    }

    @Transactional
    public TypePieceJointeResponse upsertType(Long agenceId, Long id, UpsertTypePieceJointeRequest request) {
        TypePieceJointe type = id == null ? new TypePieceJointe() : typePieceJointeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TypePieceJointe", id));
        if (id == null) {
            type.setAgence(agenceRepository.findById(agenceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId)));
        } else if (type.getAgence() == null) {
            type = agencyOverride(agenceId, type);
        }
        if (type.getAgence() != null && !agenceId.equals(type.getAgence().getId())) {
            throw new ResourceNotFoundException("TypePieceJointe", id);
        }
        BrancheAssurance branche = request.getBrancheAssuranceId() == null
                ? null
                : brancheAssuranceRepository.findById(request.getBrancheAssuranceId())
                        .filter(item -> Boolean.TRUE.equals(item.getActif()))
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "BrancheAssurance", request.getBrancheAssuranceId()));
        validateScope(branche, request);
        TypeMouvementContrat mouvement = request.getTypeMouvementId() == null ? null :
                typeMouvementContratRepository.findById(request.getTypeMouvementId())
                        .orElseThrow(() -> new ResourceNotFoundException("TypeMouvementContrat", request.getTypeMouvementId()));
        NaturePieceJointe nature = resolveNature(
                agenceId,
                request.getNaturePieceJointeId(),
                type.getNaturePieceJointe(),
                request.getLibelle()
        );
        type.setNaturePieceJointe(nature);
        type.setLibelle(nature.getLibelle());
        type.setBrancheAssurance(branche);
        type.setTypeAssistance(request.getTypeAssistance());
        type.setTypeContrat(request.getTypeContrat());
        type.setTypeClient(request.getTypeClient());
        type.setTypeMouvement(mouvement);
        type.setObligatoire(Boolean.TRUE.equals(request.getObligatoire()));
        type.setActif(request.getActif() == null || Boolean.TRUE.equals(request.getActif()));
        type.setOrdreAffichage(request.getOrdreAffichage());
        validateNoDuplicateScope(agenceId, type);
        return toTypeResponse(typePieceJointeRepository.save(type));
    }

    @Transactional
    public void deactivateType(Long agenceId, Long id) {
        TypePieceJointe type = typePieceJointeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TypePieceJointe", id));
        if (type.getAgence() == null) {
            type = agencyOverride(agenceId, type);
        }
        if (type.getAgence() != null && !agenceId.equals(type.getAgence().getId())) {
            throw new ResourceNotFoundException("TypePieceJointe", id);
        }
        type.setActif(false);
        typePieceJointeRepository.save(type);
    }

    @Transactional(readOnly = true)
    public List<ReferenceOptionResponse> listTypesMouvement() {
        return typeMouvementContratRepository.findByActifTrueOrderByOrdreAffichageAsc().stream()
                .map(type -> ReferenceOptionResponse.builder()
                        .id(type.getId())
                        .code(type.getCode())
                        .libelle(type.getLibelle())
                        .actif(type.getActif())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public PiecesJointesContratResponse listContratPieces(Long agenceId, Long contratId, Long mouvementId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        MouvementContrat mouvement = resolveMouvement(contrat, mouvementId);
        TypeClient typeClient = resolveTypeClient(contrat);
        String typeAssistance = resolveStandaloneAssistanceType(contrat);
        List<TypePieceJointeResponse> types = eligibleTypes(agenceId, contrat, mouvement, typeClient).stream()
                .map(this::toTypeResponse)
                .toList();
        List<PieceJointe> pieces = mouvement == null
                ? pieceJointeRepository.findByContratIdAndMouvementContratIsNullOrderByCreatedAtDesc(contratId)
                : pieceJointeRepository.findByContratIdAndMouvementContratIdOrderByCreatedAtDesc(contratId, mouvement.getId());
        return PiecesJointesContratResponse.builder()
                .contratId(contrat.getId())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroPolice(contrat.getNumeroPolice())
                .typeContrat(contrat.getTypeContrat())
                .brancheAssuranceCode(contrat.getBrancheAssurance() == null ? null : contrat.getBrancheAssurance().getCode())
                .typeAssistance(typeAssistance)
                .typeClient(typeClient)
                .mouvementContratId(mouvement == null ? null : mouvement.getId())
                .mouvementCode(mouvement == null ? null : mouvement.getTypeMouvement().getCode())
                .mouvementLibelle(mouvement == null ? null : mouvement.getTypeMouvement().getLibelle())
                .types(types)
                .pieces(pieces.stream().map(this::toPieceResponse).toList())
                .build();
    }

    private String resolveStandaloneAssistanceType(Contrat contrat) {
        if (contrat.getBrancheAssurance() == null
                || !"ASSISTANCE".equalsIgnoreCase(contrat.getBrancheAssurance().getCode())) {
            return null;
        }
        return assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(contrat.getId())
                .stream()
                .map(AssistanceContrat::getProduitAssistance)
                .filter(Objects::nonNull)
                .map(produit -> produit.getType())
                .filter(Objects::nonNull)
                .findFirst()
                .orElse("Assistance");
    }

    @Transactional
    public PieceJointeResponse upload(
            Long agenceId,
            Long contratId,
            Long mouvementId,
            Long typePieceJointeId,
            String customTypeLabel,
            List<MultipartFile> files
    ) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        MouvementContrat mouvement = resolveMouvement(contrat, mouvementId);
        TypeClient typeClient = resolveTypeClient(contrat);
        TypePieceJointe type = resolveUploadType(
                agenceId,
                contrat,
                mouvement,
                typeClient,
                typePieceJointeId,
                customTypeLabel
        );
        if (files == null || files.isEmpty() || files.stream().allMatch(MultipartFile::isEmpty)) {
            throw new BadRequestException("Aucun fichier selectionne");
        }
        StoredUpload stored = storeFiles(agenceId, contrat, mouvement, type, files.stream().filter(file -> !file.isEmpty()).toList());
        deleteOnRollback(stored.path());
        PieceJointe piece = pieceJointeRepository.save(PieceJointe.builder()
                .contrat(contrat)
                .mouvementContrat(mouvement)
                .typePieceJointe(type)
                .nomFichier(stored.fileName())
                .contentType(stored.contentType())
                .cheminStockage(stored.storageKey())
                .tailleOctets(stored.size())
                .build());
        return toPieceResponse(piece);
    }

    private TypePieceJointe resolveUploadType(
            Long agenceId,
            Contrat contrat,
            MouvementContrat mouvement,
            TypeClient typeClient,
            Long typePieceJointeId,
            String customTypeLabel
    ) {
        String customLabel = customTypeLabel == null ? null : customTypeLabel.trim();
        if (customLabel != null && !customLabel.isEmpty()) {
            if (customLabel.length() > 160) {
                throw new BadRequestException("Le nom du document ne doit pas depasser 160 caracteres");
            }
            TypePieceJointe existing = eligibleTypes(agenceId, contrat, mouvement, typeClient).stream()
                    .filter(type -> customLabel.equalsIgnoreCase(type.getLibelle()))
                    .findFirst()
                    .orElse(null);
            if (existing != null) {
                return existing;
            }
            NaturePieceJointe nature = resolveNature(agenceId, null, null, customLabel);
            return typePieceJointeRepository.save(TypePieceJointe.builder()
                    .agence(contrat.getAgence())
                    .naturePieceJointe(nature)
                    .libelle(nature.getLibelle())
                    .brancheAssurance(contrat.getBrancheAssurance())
                    .typeAssistance(resolveAssistanceType(contrat))
                    .typeContrat(isAssistanceBranch(contrat) ? null : contrat.getTypeContrat())
                    .typeClient(typeClient)
                    .typeMouvement(mouvement == null ? null : mouvement.getTypeMouvement())
                    .obligatoire(false)
                    .actif(true)
                    .build());
        }
        if (typePieceJointeId == null) {
            throw new BadRequestException("Le type de piece jointe est obligatoire");
        }
        TypePieceJointe type = typePieceJointeRepository.findById(typePieceJointeId)
                .orElseThrow(() -> new ResourceNotFoundException("TypePieceJointe", typePieceJointeId));
        boolean allowed = eligibleTypes(agenceId, contrat, mouvement, typeClient).stream()
                .anyMatch(eligible -> eligible.getId().equals(type.getId()));
        if (!allowed) {
            throw new BadRequestException("Ce type de piece jointe n'est pas autorise pour ce mouvement");
        }
        return type;
    }

    @Transactional(readOnly = true)
    public DownloadedPiece download(Long agenceId, Long contratId, Long pieceId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        PieceJointe piece = pieceJointeRepository.findById(pieceId)
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        if (!contrat.getId().equals(piece.getContrat().getId())) {
            throw new ResourceNotFoundException("PieceJointe", pieceId);
        }
        Path path = resolveStoredPath(piece);
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("PieceJointe", pieceId);
        }
        return DownloadedPiece.builder()
                .piece(piece)
                .resource(new FileSystemResource(path))
                .mediaType(resolveMediaType(piece.getContentType()))
                .build();
    }

    @Transactional
    public void delete(Long agenceId, Long contratId, Long pieceId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        PieceJointe piece = pieceJointeRepository.findById(pieceId)
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        if (!contrat.getId().equals(piece.getContrat().getId())) {
            throw new ResourceNotFoundException("PieceJointe", pieceId);
        }
        pieceJointeRepository.delete(piece);
        deleteAfterCommit(resolveStoredPath(piece));
    }

    private Contrat resolveContrat(Long agenceId, Long contratId) {
        return contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
    }

    private MouvementContrat resolveMouvement(Contrat contrat, Long mouvementId) {
        if (mouvementId != null) {
            return mouvementContratRepository.findByContratIdAndId(contrat.getId(), mouvementId)
                    .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", mouvementId));
        }
        return mouvementContratRepository.findFirstByContratIdOrderByCreatedAtDesc(contrat.getId()).orElse(null);
    }

    private TypeClient resolveTypeClient(Contrat contrat) {
        return contrat.getClients().stream()
                .filter(link -> link.getRole() == RoleClientContrat.SOUSCRIPTEUR)
                .map(ContratClient::getClient)
                .filter(Objects::nonNull)
                .map(Client::getTypeClient)
                .filter(Objects::nonNull)
                .findFirst()
                .orElseGet(() -> contrat.getClients().stream()
                        .map(ContratClient::getClient)
                        .filter(Objects::nonNull)
                        .map(Client::getTypeClient)
                        .filter(Objects::nonNull)
                        .findFirst()
                        .orElse(null));
    }

    private List<TypePieceJointe> eligibleTypes(Long agenceId, Contrat contrat, MouvementContrat mouvement, TypeClient typeClient) {
        TypeMouvementContrat typeMouvement = mouvement == null ? null : mouvement.getTypeMouvement();
        TypeAssistance typeAssistance = resolveAssistanceType(contrat);
        return effectiveTypes(agenceId, false).stream()
                .filter(type -> type.getBrancheAssurance() == null
                        || (contrat.getBrancheAssurance() != null
                        && type.getBrancheAssurance().getId().equals(contrat.getBrancheAssurance().getId())))
                .filter(type -> type.getTypeAssistance() == null || type.getTypeAssistance() == typeAssistance)
                .filter(type -> type.getTypeContrat() == null || type.getTypeContrat() == contrat.getTypeContrat())
                .filter(type -> type.getTypeClient() == null || type.getTypeClient() == typeClient)
                .filter(type -> type.getTypeMouvement() == null
                        || (typeMouvement != null && type.getTypeMouvement().getId().equals(typeMouvement.getId())))
                .sorted(typeComparator())
                .toList();
    }

    private List<TypePieceJointe> effectiveTypes(Long agenceId, boolean includeInactive) {
        List<TypePieceJointe> candidates = typePieceJointeRepository
                .findByAgenceIdOrAgenceIsNullOrderByLibelleAsc(agenceId);
        Set<Long> overriddenSystemIds = new HashSet<>();
        candidates.stream()
                .filter(type -> type.getAgence() != null && type.getSourceSysteme() != null)
                .map(type -> type.getSourceSysteme().getId())
                .forEach(overriddenSystemIds::add);
        return candidates.stream()
                .filter(type -> type.getAgence() != null || !overriddenSystemIds.contains(type.getId()))
                .filter(type -> includeInactive || Boolean.TRUE.equals(type.getActif()))
                .toList();
    }

    private TypePieceJointe agencyOverride(Long agenceId, TypePieceJointe systemType) {
        return typePieceJointeRepository.findByAgenceIdAndSourceSystemeId(agenceId, systemType.getId())
                .orElseGet(() -> TypePieceJointe.builder()
                        .agence(agenceRepository.findById(agenceId)
                                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId)))
                        .sourceSysteme(systemType)
                        .naturePieceJointe(systemType.getNaturePieceJointe())
                        .libelle(systemType.getLibelle())
                        .brancheAssurance(systemType.getBrancheAssurance())
                        .typeAssistance(systemType.getTypeAssistance())
                        .typeContrat(systemType.getTypeContrat())
                        .typeClient(systemType.getTypeClient())
                        .typeMouvement(systemType.getTypeMouvement())
                        .obligatoire(systemType.getObligatoire())
                        .ordreAffichage(systemType.getOrdreAffichage())
                        .actif(systemType.getActif())
                        .build());
    }

    private TypeAssistance resolveAssistanceType(Contrat contrat) {
        if (!isAssistanceBranch(contrat)) {
            return null;
        }
        return TypeAssistance.fromProductType(resolveStandaloneAssistanceType(contrat));
    }

    private boolean isAssistanceBranch(Contrat contrat) {
        return contrat.getBrancheAssurance() != null
                && "ASSISTANCE".equalsIgnoreCase(contrat.getBrancheAssurance().getCode());
    }

    private void validateScope(BrancheAssurance branche, UpsertTypePieceJointeRequest request) {
        boolean assistance = branche != null && "ASSISTANCE".equalsIgnoreCase(branche.getCode());
        if (request.getTypeAssistance() != null && !assistance) {
            throw new BadRequestException("Le type d'assistance nécessite la branche Assistance");
        }
        if (assistance && request.getTypeContrat() != null) {
            throw new BadRequestException("Le type de contrat ne s'applique pas à la branche Assistance");
        }
    }

    private void validateNoDuplicateScope(Long agenceId, TypePieceJointe candidate) {
        Long candidateId = candidate.getId();
        Long sourceId = candidate.getSourceSysteme() == null ? null : candidate.getSourceSysteme().getId();
        boolean duplicate = effectiveTypes(agenceId, true).stream()
                .filter(existing -> !Objects.equals(existing.getId(), candidateId))
                .filter(existing -> !Objects.equals(existing.getId(), sourceId))
                .anyMatch(existing -> sameNature(existing, candidate)
                        && Objects.equals(entityId(existing.getBrancheAssurance()), entityId(candidate.getBrancheAssurance()))
                        && existing.getTypeAssistance() == candidate.getTypeAssistance()
                        && existing.getTypeContrat() == candidate.getTypeContrat()
                        && existing.getTypeClient() == candidate.getTypeClient()
                        && Objects.equals(entityId(existing.getTypeMouvement()), entityId(candidate.getTypeMouvement())));
        if (duplicate) {
            throw new BadRequestException("Un type de pièce jointe existe déjà pour cette portée");
        }
    }

    private Long entityId(BaseEntity entity) {
        return entity == null ? null : entity.getId();
    }

    private boolean sameNature(TypePieceJointe first, TypePieceJointe second) {
        if (first.getNaturePieceJointe() != null && second.getNaturePieceJointe() != null) {
            return Objects.equals(first.getNaturePieceJointe().getId(), second.getNaturePieceJointe().getId());
        }
        return first.getLibelle().equalsIgnoreCase(second.getLibelle());
    }

    private NaturePieceJointe resolveNature(
            Long agenceId,
            Long requestedNatureId,
            NaturePieceJointe currentNature,
            String requestedLabel
    ) {
        if (requestedNatureId != null) {
            NaturePieceJointe nature = naturePieceJointeRepository.findById(requestedNatureId)
                    .orElseThrow(() -> new ResourceNotFoundException("NaturePieceJointe", requestedNatureId));
            if (nature.getAgence() != null && !agenceId.equals(nature.getAgence().getId())) {
                throw new ResourceNotFoundException("NaturePieceJointe", requestedNatureId);
            }
            return nature;
        }
        if (currentNature != null) {
            return currentNature;
        }
        String label = requireText(requestedLabel, "Le libelle est obligatoire");
        String key = normalizeNatureKey(label);
        return naturePieceJointeRepository.findByAgenceIdAndCleNormalisee(agenceId, key)
                .or(() -> naturePieceJointeRepository.findByAgenceIsNullAndCleNormalisee(key))
                .orElseGet(() -> naturePieceJointeRepository.save(NaturePieceJointe.builder()
                        .agence(agenceRepository.findById(agenceId)
                                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId)))
                        .cleNormalisee(key)
                        .libelle(label)
                        .actif(true)
                        .build()));
    }

    private String normalizeNatureKey(String label) {
        return requireText(label, "Le libelle est obligatoire").toUpperCase(Locale.ROOT);
    }

    private Comparator<TypePieceJointe> typeComparator() {
        return Comparator.comparing((TypePieceJointe type) -> type.getOrdreAffichage() == null ? Integer.MAX_VALUE : type.getOrdreAffichage())
                .thenComparing(TypePieceJointe::getLibelle, String.CASE_INSENSITIVE_ORDER);
    }

    private StoredUpload storeFiles(Long agenceId, Contrat contrat, MouvementContrat mouvement, TypePieceJointe type, List<MultipartFile> files) {
        try {
            Path folderKey = Path.of(String.valueOf(agenceId))
                    .resolve(String.valueOf(contrat.getId()))
                    .resolve(mouvement == null ? "contrat" : "mouvement-" + mouvement.getId())
                    .normalize();
            Path folder = resolveStorageKey(folderKey);
            Files.createDirectories(folder);
            if (files.size() > 1) {
                if (!files.stream().allMatch(this::isImage)) {
                    throw new BadRequestException("Plusieurs fichiers sont acceptes uniquement pour des images a convertir en PDF");
                }
                String fileName = storageName(type.getLibelle(), "pdf");
                Path target = folder.resolve(fileName);
                byte[] pdf = imagesToPdf(files);
                Files.write(target, pdf);
                return new StoredUpload(target, folderKey.resolve(fileName).toString(), fileName, MediaType.APPLICATION_PDF_VALUE, (long) pdf.length);
            }
            MultipartFile file = files.get(0);
            String extension = extension(file.getOriginalFilename(), file.getContentType());
            String fileName = storageName(type.getLibelle(), extension);
            Path target = folder.resolve(fileName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return new StoredUpload(target, folderKey.resolve(fileName).toString(), fileName, file.getContentType(), file.getSize());
        } catch (IOException error) {
            throw new BadRequestException("Stockage de la piece jointe impossible");
        }
    }

    private Path resolveStorageKey(Path storageKey) {
        return storageLayoutService.resolveContractAttachment(storageKey);
    }

    private Path resolveStoredPath(PieceJointe piece) {
        String storageKey = piece.getCheminStockage();
        if (storageKey == null || storageKey.isBlank()) {
            throw new ResourceNotFoundException("PieceJointe", piece.getId());
        }
        try {
            return resolveStorageKey(Path.of(storageKey));
        } catch (IllegalArgumentException | IllegalStateException error) {
            throw new ResourceNotFoundException("PieceJointe", piece.getId());
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
            // The database remains authoritative; orphan cleanup can safely retry later.
        }
    }

    private byte[] imagesToPdf(List<MultipartFile> files) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            for (MultipartFile file : files) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                PDImageXObject image = PDImageXObject.createFromByteArray(document, file.getBytes(), file.getOriginalFilename());
                float margin = 24;
                float availableWidth = page.getMediaBox().getWidth() - margin * 2;
                float availableHeight = page.getMediaBox().getHeight() - margin * 2;
                float scale = Math.min(availableWidth / image.getWidth(), availableHeight / image.getHeight());
                float width = image.getWidth() * scale;
                float height = image.getHeight() * scale;
                float x = (page.getMediaBox().getWidth() - width) / 2;
                float y = (page.getMediaBox().getHeight() - height) / 2;
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.drawImage(image, x, y, width, height);
                }
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    private boolean isImage(MultipartFile file) {
        String contentType = file.getContentType();
        return contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("image/");
    }

    private String storageName(String libelle, String extension) {
        return slug(libelle) + "-" + LocalDateTime.now().toString().replace(":", "-") + "-" + UUID.randomUUID() + "." + extension;
    }

    private String extension(String filename, String contentType) {
        if (filename != null && filename.contains(".")) {
            String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
            if (!extension.isBlank()) {
                return extension;
            }
        }
        if (MediaType.APPLICATION_PDF_VALUE.equalsIgnoreCase(contentType)) {
            return "pdf";
        }
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            return contentType.substring(contentType.indexOf('/') + 1).replace("jpeg", "jpg");
        }
        return "bin";
    }

    private String slug(String value) {
        String normalized = Normalizer.normalize(value == null ? "piece-jointe" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? "piece-jointe" : normalized;
    }

    private MediaType resolveMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            return MediaType.parseMediaType(contentType);
        } catch (Exception ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }

    private TypePieceJointeResponse toTypeResponse(TypePieceJointe type) {
        return TypePieceJointeResponse.builder()
                .id(type.getId())
                .libelle(type.getNaturePieceJointe() == null
                        ? type.getLibelle()
                        : type.getNaturePieceJointe().getLibelle())
                .naturePieceJointeId(type.getNaturePieceJointe() == null ? null : type.getNaturePieceJointe().getId())
                .naturePieceJointeLibelle(type.getNaturePieceJointe() == null
                        ? null
                        : type.getNaturePieceJointe().getLibelle())
                .brancheAssuranceId(type.getBrancheAssurance() == null ? null : type.getBrancheAssurance().getId())
                .brancheAssuranceCode(type.getBrancheAssurance() == null ? null : type.getBrancheAssurance().getCode())
                .brancheAssuranceLibelle(type.getBrancheAssurance() == null ? null : type.getBrancheAssurance().getLibelle())
                .typeAssistance(type.getTypeAssistance())
                .typeContrat(type.getTypeContrat())
                .typeClient(type.getTypeClient())
                .typeMouvementId(type.getTypeMouvement() == null ? null : type.getTypeMouvement().getId())
                .typeMouvementCode(type.getTypeMouvement() == null ? null : type.getTypeMouvement().getCode())
                .typeMouvementLibelle(type.getTypeMouvement() == null ? null : type.getTypeMouvement().getLibelle())
                .obligatoire(type.getObligatoire())
                .actif(type.getActif())
                .ordreAffichage(type.getOrdreAffichage())
                .systeme(type.getAgence() == null)
                .build();
    }

    private PieceJointeResponse toPieceResponse(PieceJointe piece) {
        return PieceJointeResponse.builder()
                .id(piece.getId())
                .contratId(piece.getContrat().getId())
                .mouvementContratId(piece.getMouvementContrat() == null ? null : piece.getMouvementContrat().getId())
                .typePieceJointeId(piece.getTypePieceJointe() == null ? null : piece.getTypePieceJointe().getId())
                .typePieceJointeLibelle(piece.getTypePieceJointe() == null ? null : piece.getTypePieceJointe().getLibelle())
                .obligatoire(piece.getTypePieceJointe() == null ? null : piece.getTypePieceJointe().getObligatoire())
                .nomFichier(piece.getNomFichier())
                .contentType(piece.getContentType())
                .tailleOctets(piece.getTailleOctets())
                .createdAt(piece.getCreatedAt())
                .build();
    }

    private record StoredUpload(Path path, String storageKey, String fileName, String contentType, Long size) {
    }

    @Builder
    public record DownloadedPiece(PieceJointe piece, Resource resource, MediaType mediaType) {
    }
}
