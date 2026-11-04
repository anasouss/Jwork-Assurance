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
import com.assurance.entity.DocumentPolicy;
import com.assurance.entity.DocumentUsage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.DocumentOwner;
import com.assurance.enums.DocumentExpiry;
import com.assurance.enums.DocumentValiditySource;
import com.assurance.dto.response.DocumentOwnerOptionResponse;
import com.assurance.repository.DocumentPolicyRepository;
import com.assurance.repository.DocumentUsageRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.VehiculeRepository;
import com.assurance.security.TenantContext;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PieceJointeService {

    private static final Pattern GENERATED_FILE_NAME = Pattern.compile(
            ".+-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}(?:-\\d{2}(?:\\.\\d{1,9})?)?"
                    + "-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]+",
            Pattern.CASE_INSENSITIVE
    );

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
    private final DocumentPolicyRepository documentPolicyRepository;
    private final DocumentUsageRepository documentUsageRepository;
    private final ClientRepository clientRepository;
    private final VehiculeRepository vehiculeRepository;

    @Transactional(readOnly = true)
    public List<TypePieceJointeResponse> listTypes(Long agenceId, boolean includeInactive) {
        return effectiveTypes(agenceId, includeInactive).stream()
                .sorted(typeComparator())
                .map(type -> policyTypeResponse(agenceId, type))
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
        return policyTypeResponse(agenceId, typePieceJointeRepository.save(type));
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
                .map(type -> policyTypeResponse(agenceId, type))
                .toList();
        List<PieceJointe> pieces = mouvement == null
                ? pieceJointeRepository.findByContratIdAndMouvementContratIsNullOrderByCreatedAtDesc(contratId)
                : pieceJointeRepository.findByContratIdAndMouvementContratIdOrderByCreatedAtDesc(contratId, mouvement.getId());
        List<PieceJointeResponse> linked = new ArrayList<>(pieces.stream().map(this::toPieceResponse).toList());
        if (mouvement != null) {
            for (DocumentUsage usage : documentUsageRepository.findByContratAgenceIdAndContratIdAndMouvementId(agenceId, contratId, mouvement.getId())) {
                if (linked.stream().noneMatch(item -> item.getId().equals(usage.getPiece().getId()))) {
                    linked.add(toPieceResponse(usage.getPiece()).toBuilder()
                            .typePieceJointeId(usage.getType().getId()).obligatoire(usage.getType().getObligatoire())
                            .canUnlink(contrat.getStatut() == com.assurance.enums.StatutContrat.DRAFT).build());
                }
            }
        }
        List<PieceJointeResponse> available = new ArrayList<>();
        List<Vehicule> vehicles = vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contratId);
        for (Client client : contrat.getClients().stream().map(ContratClient::getClient).distinct().toList()) {
            pieceJointeRepository.findByAgenceIdAndClientIdOrderByCreatedAtDesc(agenceId, client.getId()).stream()
                    .filter(this::isAvailable).map(piece -> availablePiece(piece, types)).filter(Objects::nonNull)
                    .filter(piece -> linked.stream().noneMatch(item -> item.getId().equals(piece.getId())))
                    .forEach(available::add);
        }
        for (Vehicule vehicle : vehicles) {
            pieceJointeRepository.findByAgenceIdAndVehiculeIdOrderByCreatedAtDesc(agenceId, vehicle.getId()).stream()
                    .filter(this::isAvailable).map(piece -> availablePiece(piece, types)).filter(Objects::nonNull)
                    .filter(piece -> linked.stream().noneMatch(item -> item.getId().equals(piece.getId())))
                    .forEach(available::add);
        }
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
                .pieces(linked)
                .availableDocuments(available)
                .documentClients(contrat.getClients().stream().map(ContratClient::getClient).distinct().map(client -> DocumentOwnerOptionResponse.builder()
                        .id(client.getId()).libelle(client.getNomAffichage()).typeClient(client.getTypeClient())
                        .cinValidite(client.getCinValidite()).passportValidite(client.getPassportValidite())
                        .dateValiditePermis(client.getDateValiditePermis()).build()).toList())
                .documentVehicles(vehicles.stream()
                        .map(vehicle -> DocumentOwnerOptionResponse.builder().id(vehicle.getId()).libelle(vehicle.getImmatriculation())
                                .dateExpirationCarteGrise(vehicle.getDateExpirationCarteGrise()).build()).toList())
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
        return uploadForOwner(agenceId, contratId, mouvementId, typePieceJointeId, customTypeLabel, files, null, null, null);
    }

    @Transactional
    public PieceJointeResponse uploadForOwner(Long agenceId, Long contratId, Long mouvementId, Long typePieceJointeId,
                                             String customTypeLabel, List<MultipartFile> files, Long clientId,
                                             Long vehiculeId, LocalDate expiresOn) {
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
        DocumentPolicy policy = policy(agenceId, type.getNaturePieceJointe());
        Client ownerClient = null;
        Vehicule ownerVehicle = null;
        if (policy.getOwner() == DocumentOwner.CLIENT) {
            ownerClient = contrat.getClients().stream().map(ContratClient::getClient)
                    .filter(client -> client.getId().equals(clientId) && client.getAgence().getId().equals(agenceId))
                    .findFirst().orElseThrow(() -> new BadRequestException("Selectionnez le titulaire du document parmi les clients du contrat"));
            validateClientType(type, ownerClient);
        } else if (policy.getOwner() == DocumentOwner.VEHICULE) {
            ownerVehicle = vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contratId).stream()
                    .filter(vehicle -> vehicle.getId().equals(vehiculeId)).findFirst()
                    .orElseThrow(() -> new BadRequestException("Selectionnez le vehicule concerne"));
        }
        expiresOn = resolveExpiry(policy, ownerClient, ownerVehicle, expiresOn);
        validateExpiry(policy, expiresOn);
        validateFiles(files);
        StoredUpload stored = storeFiles(agenceId, contrat, mouvement, type, files.stream().filter(file -> !file.isEmpty()).toList());
        deleteOnRollback(stored.path());
        PieceJointe piece = pieceJointeRepository.save(PieceJointe.builder()
                .agence(contrat.getAgence()).client(ownerClient).vehicule(ownerVehicle)
                .documentOwner(policy.getOwner()).expiresOn(expiresOn).createdBy(TenantContext.getCurrentUsername())
                .contrat(contrat)
                .mouvementContrat(mouvement)
                .typePieceJointe(type)
                .nomFichier(stored.displayName())
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
        boolean directlyLinked = piece.getContrat() != null && contrat.getId().equals(piece.getContrat().getId());
        boolean reused = piece.getAgence() != null && agenceId.equals(piece.getAgence().getId())
                && documentUsageRepository.existsByPieceIdAndContratIdAndContratAgenceId(pieceId, contratId, agenceId);
        if (!directlyLinked && !reused) {
            throw new ResourceNotFoundException("PieceJointe", pieceId);
        }
        Path path = resolveStoredPath(piece);
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("PieceJointe", pieceId);
        }
        return DownloadedPiece.builder()
                .piece(piece)
                .fileName(displayFileName(piece))
                .resource(new FileSystemResource(path))
                .mediaType(resolveMediaType(piece.getContentType()))
                .build();
    }

    @Transactional
    public void delete(Long agenceId, Long contratId, Long pieceId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        PieceJointe piece = pieceJointeRepository.lockOwned(agenceId, pieceId)
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        if (piece.getContrat() == null || !contrat.getId().equals(piece.getContrat().getId())) {
            throw new ResourceNotFoundException("PieceJointe", pieceId);
        }
        if (piece.getClient() != null) throw new BadRequestException("Gerez ce document depuis la fiche client");
        deleteOrArchive(piece);
    }

    @Transactional
    public void updatePolicy(Long agenceId, Long natureId, DocumentOwner owner, DocumentExpiry expiry, DocumentValiditySource source) {
        NaturePieceJointe nature = resolveNature(agenceId, natureId, null, null);
        if (owner == null || expiry == null) throw new BadRequestException("Rattachement et validite obligatoires");
        DocumentPolicy policy = policy(agenceId, nature);
        source = source == null ? policy.getValiditySource() : source;
        if (expiry == DocumentExpiry.NONE) source = DocumentValiditySource.MANUAL;
        if ((source.name().startsWith("CLIENT_") && owner != DocumentOwner.CLIENT)
                || (source == DocumentValiditySource.VEHICULE_CARTE_GRISE && owner != DocumentOwner.VEHICULE)) {
            throw new BadRequestException("La source de validite ne correspond pas au rattachement du document");
        }
        policy.setAgence(agenceRepository.findById(agenceId).orElseThrow());
        policy.setNature(nature);
        policy.setOwner(owner);
        policy.setExpiry(expiry);
        policy.setValiditySource(source);
        documentPolicyRepository.save(policy);
    }

    @Transactional
    public PieceJointeResponse assignOwner(Long agenceId, Long contratId, Long pieceId, Long clientId, Long vehicleId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        PieceJointe piece = pieceJointeRepository.lockOwned(agenceId, pieceId)
                .filter(item -> item.getContrat() != null && item.getContrat().getId().equals(contratId))
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        if (piece.getClient() != null || piece.getVehicule() != null || piece.getPreviousVersion() != null || Boolean.TRUE.equals(piece.getArchived())) {
            throw new BadRequestException("Le titulaire de cette piece ne peut pas etre modifie");
        }
        if (piece.getTypePieceJointe() == null) throw new BadRequestException("Type de document manquant");
        DocumentPolicy policy = policy(agenceId, piece.getTypePieceJointe().getNaturePieceJointe());
        if (policy.getOwner() == DocumentOwner.CLIENT) {
            Client owner = contrat.getClients().stream().map(ContratClient::getClient)
                    .filter(client -> client.getId().equals(clientId) && client.getAgence().getId().equals(agenceId))
                    .findFirst().orElseThrow(() -> new BadRequestException("Selectionnez le titulaire dans ce contrat"));
            validateClientType(piece.getTypePieceJointe(), owner);
            piece.setClient(owner);
        } else if (policy.getOwner() == DocumentOwner.VEHICULE) {
            piece.setVehicule(vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contratId).stream()
                    .filter(vehicle -> vehicle.getId().equals(vehicleId)).findFirst()
                    .orElseThrow(() -> new BadRequestException("Selectionnez le vehicule dans ce contrat")));
        } else {
            throw new BadRequestException("Ce document ne requiert pas de titulaire reutilisable");
        }
        piece.setDocumentOwner(policy.getOwner());
        piece.setAssignedBy(TenantContext.getCurrentUsername());
        piece.setAssignedAt(LocalDateTime.now());
        return toPieceResponse(pieceJointeRepository.save(piece));
    }

    private DocumentPolicy policy(Long agenceId, NaturePieceJointe nature) {
        if (nature == null) return new DocumentPolicy();
        return documentPolicyRepository.findByAgenceIdAndNatureId(agenceId, nature.getId()).orElseGet(() -> {
            DocumentPolicy defaults = new DocumentPolicy();
            defaults.setOwner(nature.getDefaultOwner());
            defaults.setExpiry(nature.getDefaultExpiry());
            defaults.setValiditySource(nature.getDefaultValiditySource());
            return defaults;
        });
    }

    private TypePieceJointeResponse policyTypeResponse(Long agenceId, TypePieceJointe type) {
        TypePieceJointeResponse response = toTypeResponse(type);
        DocumentPolicy policy = policy(agenceId, type.getNaturePieceJointe());
        response.setDocumentOwner(policy.getOwner());
        response.setDocumentExpiry(policy.getExpiry());
        response.setDocumentValiditySource(policy.getValiditySource());
        return response;
    }

    @Transactional(readOnly = true)
    public List<TypePieceJointeResponse> clientTypes(Long agenceId, TypeClient typeClient) {
        return effectiveTypes(agenceId, false).stream()
                .filter(type -> type.getTypeClient() == null || type.getTypeClient() == typeClient)
                .filter(type -> policy(agenceId, type.getNaturePieceJointe()).getOwner() == DocumentOwner.CLIENT)
                .sorted(typeComparator()).map(type -> {
                    TypePieceJointeResponse response = policyTypeResponse(agenceId, type);
                    // Production requirements do not make a document mandatory during CRM creation.
                    response.setObligatoire(false);
                    return response;
                })
                .collect(java.util.stream.Collectors.toMap(TypePieceJointeResponse::getNaturePieceJointeId,
                        java.util.function.Function.identity(), (first, second) -> first, java.util.LinkedHashMap::new))
                .values().stream().toList();
    }

    @Transactional(readOnly = true)
    public List<PieceJointeResponse> clientDocuments(Long agenceId, Long clientId) {
        clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        return pieceJointeRepository.findByAgenceIdAndClientIdOrderByCreatedAtDesc(agenceId, clientId)
                .stream().map(this::toPieceResponse).toList();
    }

    @Transactional
    public PieceJointeResponse uploadClient(Long agenceId, Long clientId, Long typeId, List<MultipartFile> files,
                                           LocalDate expiresOn, Long previousId, String reason) {
        Client client = clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        TypePieceJointe type = effectiveTypes(agenceId, false).stream().filter(item -> item.getId().equals(typeId))
                .findFirst().orElseThrow(() -> new ResourceNotFoundException("TypePieceJointe", typeId));
        DocumentPolicy policy = policy(agenceId, type.getNaturePieceJointe());
        if (policy.getOwner() != DocumentOwner.CLIENT) throw new BadRequestException("Ce document ne concerne pas le client");
        validateClientType(type, client);
        expiresOn = resolveExpiry(policy, client, null, expiresOn);
        validateExpiry(policy, expiresOn);
        validateFiles(files);
        PieceJointe previous = previousId == null ? null : ownedClientPiece(agenceId, clientId, previousId);
        if (previous != null) {
            if (Boolean.TRUE.equals(previous.getArchived()) || pieceJointeRepository.existsByPreviousVersionId(previousId)) {
                throw new BadRequestException("Cette version a deja ete archivee ou remplacee");
            }
            if (!previous.getTypePieceJointe().getNaturePieceJointe().getId().equals(type.getNaturePieceJointe().getId())) {
                throw new BadRequestException("Le remplacement doit conserver la nature du document");
            }
            reason = requireText(reason, "Indiquez le motif du remplacement");
            if (reason.length() > 500) throw new BadRequestException("Motif limite a 500 caracteres");
            archive(previous);
        }
        StoredUpload stored = storeFilesAt(Path.of(agenceId.toString(), "clients", clientId.toString()), type,
                files.stream().filter(file -> !file.isEmpty()).toList());
        deleteOnRollback(stored.path());
        PieceJointe piece = PieceJointe.builder().agence(client.getAgence()).client(client)
                .documentOwner(DocumentOwner.CLIENT).typePieceJointe(type).expiresOn(expiresOn)
                .previousVersion(previous).changeReason(reason).createdBy(TenantContext.getCurrentUsername())
                .nomFichier(stored.displayName()).cheminStockage(stored.storageKey())
                .contentType(stored.contentType()).tailleOctets(stored.size()).build();
        return toPieceResponse(pieceJointeRepository.save(piece));
    }

    @Transactional
    public void deleteClientDocument(Long agenceId, Long clientId, Long pieceId) {
        deleteOrArchive(ownedClientPiece(agenceId, clientId, pieceId));
    }

    @Transactional(readOnly = true)
    public DownloadedPiece downloadClientDocument(Long agenceId, Long clientId, Long pieceId) {
        PieceJointe piece = pieceJointeRepository.findById(pieceId)
                .filter(item -> item.getAgence() != null && item.getAgence().getId().equals(agenceId)
                        && item.getClient() != null && item.getClient().getId().equals(clientId))
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        Path path = resolveStoredPath(piece);
        if (!Files.isRegularFile(path)) throw new ResourceNotFoundException("PieceJointe", pieceId);
        return new DownloadedPiece(piece, displayFileName(piece), new FileSystemResource(path), resolveMediaType(piece.getContentType()));
    }

    private PieceJointe ownedClientPiece(Long agenceId, Long clientId, Long pieceId) {
        return pieceJointeRepository.lockOwned(agenceId, pieceId)
                .filter(piece -> piece.getClient() != null && piece.getClient().getId().equals(clientId))
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
    }

    @Transactional
    public PieceJointeResponse reuse(Long agenceId, Long contratId, Long mouvementId, Long pieceId, Long typeId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        MouvementContrat mouvement = resolveMouvement(contrat, mouvementId);
        if (mouvement == null) throw new BadRequestException("Selectionnez un mouvement");
        PieceJointe piece = pieceJointeRepository.lockOwned(agenceId, pieceId)
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        boolean clientOwned = piece.getDocumentOwner() == DocumentOwner.CLIENT && piece.getClient() != null
                && contrat.getClients().stream().anyMatch(link -> link.getClient().getId().equals(piece.getClient().getId()));
        boolean vehicleOwned = piece.getDocumentOwner() == DocumentOwner.VEHICULE && piece.getVehicule() != null
                && piece.getVehicule().getContrat().getId().equals(contratId);
        if (!isAvailable(piece) || (!clientOwned && !vehicleOwned)) {
            throw new BadRequestException("Ce document n'est pas disponible pour ce contrat");
        }
        TypePieceJointe type = resolveUploadType(agenceId, contrat, mouvement, resolveTypeClient(contrat), typeId, null);
        if (!Objects.equals(type.getNaturePieceJointe().getId(), piece.getTypePieceJointe().getNaturePieceJointe().getId())) {
            throw new BadRequestException("La nature du document ne correspond pas a la piece attendue");
        }
        DocumentPolicy policy = policy(agenceId, type.getNaturePieceJointe());
        if (policy.getOwner() != piece.getDocumentOwner()) throw new BadRequestException("Le rattachement du document a change");
        if (clientOwned) validateClientType(type, piece.getClient());
        validateExpiry(policy, piece.getExpiresOn());
        if (!documentUsageRepository.existsByPieceIdAndMouvementIdAndTypeId(pieceId, mouvement.getId(), typeId)) {
            DocumentUsage usage = new DocumentUsage();
            usage.setPiece(piece);
            usage.setContrat(contrat);
            usage.setMouvement(mouvement);
            usage.setType(type);
            documentUsageRepository.save(usage);
        }
        return toPieceResponse(piece);
    }

    private boolean isAvailable(PieceJointe piece) {
        return !Boolean.TRUE.equals(piece.getArchived())
                && (piece.getExpiresOn() == null || !piece.getExpiresOn().isBefore(LocalDate.now()));
    }

    private PieceJointeResponse availablePiece(PieceJointe piece, List<TypePieceJointeResponse> types) {
        if (piece.getTypePieceJointe() == null || piece.getTypePieceJointe().getNaturePieceJointe() == null) return null;
        return types.stream().filter(type -> type.getDocumentOwner() == piece.getDocumentOwner())
                .filter(type -> Objects.equals(type.getNaturePieceJointeId(), piece.getTypePieceJointe().getNaturePieceJointe().getId()))
                .filter(type -> type.getTypeClient() == null || (piece.getClient() != null && type.getTypeClient() == piece.getClient().getTypeClient()))
                .filter(type -> type.getDocumentExpiry() != DocumentExpiry.REQUIRED || piece.getExpiresOn() != null)
                .filter(type -> type.getDocumentExpiry() != DocumentExpiry.NONE || piece.getExpiresOn() == null)
                .findFirst().map(type -> toPieceResponse(piece).toBuilder().typePieceJointeId(type.getId()).obligatoire(type.getObligatoire()).build())
                .orElse(null);
    }

    @Transactional
    public void unlink(Long agenceId, Long contratId, Long mouvementId, Long pieceId) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        if (contrat.getStatut() != com.assurance.enums.StatutContrat.DRAFT) {
            throw new BadRequestException("Les references d'un contrat valide sont conservees dans l'historique");
        }
        MouvementContrat mouvement = resolveMouvement(contrat, mouvementId);
        if (mouvement == null) throw new BadRequestException("Mouvement manquant");
        pieceJointeRepository.lockOwned(agenceId, pieceId)
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        List<DocumentUsage> usages = documentUsageRepository.findByContratAgenceIdAndContratIdAndMouvementId(agenceId, contratId, mouvement.getId())
                .stream().filter(usage -> usage.getPiece().getId().equals(pieceId)).toList();
        if (usages.isEmpty()) throw new ResourceNotFoundException("DocumentUsage", pieceId);
        documentUsageRepository.deleteAll(usages);
    }

    private void validateExpiry(DocumentPolicy policy, LocalDate expiresOn) {
        if (policy.getExpiry() == DocumentExpiry.REQUIRED && expiresOn == null) {
            throw new BadRequestException(policy.getValiditySource() == DocumentValiditySource.MANUAL
                    ? "Date de validite obligatoire" : "Renseignez la date de validite sur la fiche du titulaire avant d'ajouter ce document");
        }
        if (policy.getExpiry() == DocumentExpiry.NONE && expiresOn != null) throw new BadRequestException("Ce document ne comporte pas de date de validite");
    }

    private LocalDate resolveExpiry(DocumentPolicy policy, Client client, Vehicule vehicle, LocalDate submitted) {
        return switch (policy.getValiditySource()) {
            case MANUAL -> submitted;
            case CLIENT_CIN -> client == null ? null : client.getCinValidite();
            case CLIENT_PASSPORT -> client == null ? null : client.getPassportValidite();
            case CLIENT_PERMIS -> client == null ? null : client.getDateValiditePermis();
            case VEHICULE_CARTE_GRISE -> vehicle == null ? null : vehicle.getDateExpirationCarteGrise();
        };
    }

    @Transactional
    public PieceJointeResponse replaceContractDocument(Long agenceId, Long contratId, Long pieceId,
                                                       List<MultipartFile> files, LocalDate expiresOn, String reason) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        PieceJointe previous = pieceJointeRepository.lockOwned(agenceId, pieceId)
                .filter(piece -> piece.getContrat() != null && piece.getContrat().getId().equals(contrat.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("PieceJointe", pieceId));
        if (previous.getClient() != null) throw new BadRequestException("Remplacez ce document depuis la fiche client");
        if (previous.getTypePieceJointe() == null) throw new BadRequestException("Type de document manquant");
        if (Boolean.TRUE.equals(previous.getArchived()) || pieceJointeRepository.existsByPreviousVersionId(pieceId)) {
            throw new BadRequestException("Cette version est deja archivee ou remplacee");
        }
        reason = requireText(reason, "Indiquez le motif du remplacement");
        if (reason.length() > 500) throw new BadRequestException("Motif limite a 500 caracteres");
        validateFiles(files);
        DocumentPolicy policy = policy(agenceId, previous.getTypePieceJointe().getNaturePieceJointe());
        expiresOn = resolveExpiry(policy, null, previous.getVehicule(), expiresOn);
        validateExpiry(policy, expiresOn);
        StoredUpload stored = storeFiles(agenceId, contrat, previous.getMouvementContrat(), previous.getTypePieceJointe(), files);
        deleteOnRollback(stored.path());
        archive(previous);
        PieceJointe replacement = PieceJointe.builder().agence(contrat.getAgence()).contrat(contrat)
                .mouvementContrat(previous.getMouvementContrat()).vehicule(previous.getVehicule())
                .documentOwner(previous.getDocumentOwner()).previousVersion(previous).changeReason(reason)
                .typePieceJointe(previous.getTypePieceJointe()).expiresOn(expiresOn).createdBy(TenantContext.getCurrentUsername())
                .nomFichier(stored.displayName()).cheminStockage(stored.storageKey()).contentType(stored.contentType())
                .tailleOctets(stored.size()).build();
        return toPieceResponse(pieceJointeRepository.save(replacement));
    }

    private void validateClientType(TypePieceJointe type, Client client) {
        if (type.getTypeClient() != null && type.getTypeClient() != client.getTypeClient()) {
            throw new BadRequestException("Ce document ne correspond pas au type du titulaire");
        }
    }

    private void validateFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty() || files.stream().allMatch(MultipartFile::isEmpty)) throw new BadRequestException("Aucun fichier selectionne");
        long size = 0;
        for (MultipartFile file : files) {
            size += file.getSize();
            if (file.getSize() > 30L * 1024 * 1024) throw new BadRequestException("Fichier limite a 30 Mo");
            if (!file.isEmpty() && (file.getContentType() == null || !Set.of("application/pdf", "image/jpeg", "image/png").contains(file.getContentType()))) {
                throw new BadRequestException("Formats acceptes : PDF, JPEG et PNG");
            }
            if (!file.isEmpty()) validateFileContent(file);
        }
        if (size > 30L * 1024 * 1024) throw new BadRequestException("Envoi limite a 30 Mo");
    }

    private void validateFileContent(MultipartFile file) {
        try {
            if (MediaType.APPLICATION_PDF_VALUE.equals(file.getContentType())) {
                try (PDDocument pdf = PDDocument.load(file.getBytes())) {
                    if (pdf.getNumberOfPages() == 0) throw new BadRequestException("PDF vide");
                }
            } else {
                try (var raw = file.getInputStream(); var input = javax.imageio.ImageIO.createImageInputStream(raw)) {
                    var readers = javax.imageio.ImageIO.getImageReaders(input);
                    if (!readers.hasNext()) throw new BadRequestException("Image invalide");
                    var reader = readers.next();
                    try {
                        reader.setInput(input);
                        String format = reader.getFormatName();
                        boolean correctType = "image/png".equals(file.getContentType()) ? "png".equalsIgnoreCase(format)
                                : "JPEG".equalsIgnoreCase(format);
                        if (!correctType || (long) reader.getWidth(0) * reader.getHeight(0) > 40_000_000L) {
                            throw new BadRequestException("Image invalide ou trop grande");
                        }
                    } finally {
                        reader.dispose();
                    }
                }
            }
        } catch (IOException | IllegalArgumentException error) {
            throw new BadRequestException("Le contenu du fichier ne correspond pas a un PDF ou une image valide");
        }
    }

    private boolean canDelete(PieceJointe piece) {
        return piece.getPreviousVersion() == null && !Boolean.TRUE.equals(piece.getArchived())
                && !documentUsageRepository.existsByPieceId(piece.getId())
                && !pieceJointeRepository.existsByPreviousVersionId(piece.getId())
                && (piece.getContrat() == null || piece.getContrat().getStatut() == com.assurance.enums.StatutContrat.DRAFT);
    }

    private void deleteOrArchive(PieceJointe piece) {
        if (canDelete(piece)) {
            pieceJointeRepository.delete(piece);
            deleteAfterCommit(resolveStoredPath(piece));
        } else {
            archive(piece);
            pieceJointeRepository.save(piece);
        }
    }

    private void archive(PieceJointe piece) {
        if (Boolean.TRUE.equals(piece.getArchived())) return;
        piece.setArchived(true);
        piece.setArchivedBy(TenantContext.getCurrentUsername());
        piece.setArchivedAt(LocalDateTime.now());
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
                .filter(type -> type.getTypeClient() == null || type.getTypeClient() == typeClient
                        || (policy(agenceId, type.getNaturePieceJointe()).getOwner() == DocumentOwner.CLIENT
                        && contrat.getClients().stream().anyMatch(link -> link.getClient().getTypeClient() == type.getTypeClient())))
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
        Path folderKey = Path.of(String.valueOf(agenceId))
                    .resolve(String.valueOf(contrat.getId()))
                    .resolve(mouvement == null ? "contrat" : "mouvement-" + mouvement.getId())
                    .normalize();
        return storeFilesAt(folderKey, type, files);
    }

    private StoredUpload storeFilesAt(Path folderKey, TypePieceJointe type, List<MultipartFile> files) {
        try {
            Path folder = resolveStorageKey(folderKey);
            Files.createDirectories(folder);
            if (files.size() > 1) {
                if (!files.stream().allMatch(this::isImage)) {
                    throw new BadRequestException("Plusieurs fichiers sont acceptes uniquement pour des images a convertir en PDF");
                }
                String fileName = storageName(type.getLibelle(), "pdf");
                Path target = folder.resolve(fileName);
                deleteOnRollback(target);
                byte[] pdf = imagesToPdf(files);
                Files.write(target, pdf);
                return new StoredUpload(target, folderKey.resolve(fileName).toString(), readableFileName(type, "pdf"), MediaType.APPLICATION_PDF_VALUE, (long) pdf.length);
            }
            MultipartFile file = files.get(0);
            String extension = extension(file.getOriginalFilename(), file.getContentType());
            String fileName = storageName(type.getLibelle(), extension);
            Path target = folder.resolve(fileName);
            deleteOnRollback(target);
            try (var input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
            String originalName = safeFileName(file.getOriginalFilename());
            return new StoredUpload(target, folderKey.resolve(fileName).toString(),
                    originalName == null ? readableFileName(type, extension) : originalName, file.getContentType(), file.getSize());
        } catch (IOException error) {
            throw new BadRequestException("Stockage de la piece jointe impossible");
        }
    }

    private Path resolveStorageKey(Path storageKey) {
        if (storageKey.getNameCount() > 1 && "clients".equals(storageKey.getName(1).toString())) {
            return storageLayoutService.resolveClientDocument(storageKey);
        }
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

    private String displayFileName(PieceJointe piece) {
        String name = safeFileName(piece.getNomFichier());
        if (name == null || GENERATED_FILE_NAME.matcher(name).matches()) {
            return readableFileName(piece.getTypePieceJointe(), extension(piece.getNomFichier(), piece.getContentType()));
        }
        return name;
    }

    private String readableFileName(TypePieceJointe type, String extension) {
        String label = type == null ? null : type.getLibelle();
        String name = safeFileName(label == null || label.isBlank() ? "Document" : label.replace('/', '_').replace('\\', '_'));
        return safeFileName((name == null ? "Document" : name) + "." + extension);
    }

    private String safeFileName(String originalName) {
        if (originalName == null) return null;
        String name = originalName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1)
                .replaceAll("[\\p{Cntrl}<>:\"|?*]", "_").trim();
        if (name.isBlank() || name.equals(".") || name.equals("..")) return null;
        if (name.codePointCount(0, name.length()) > 255) {
            int dot = name.lastIndexOf('.');
            String suffix = dot > 0 && name.length() - dot <= 20 ? name.substring(dot) : "";
            int prefixLength = 255 - suffix.codePointCount(0, suffix.length());
            name = name.substring(0, name.offsetByCodePoints(0, prefixLength)) + suffix;
        }
        return name;
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
                .contratId(piece.getContrat() == null ? null : piece.getContrat().getId())
                .clientId(piece.getClient() == null ? null : piece.getClient().getId())
                .ownerName(piece.getClient() != null ? piece.getClient().getNomAffichage() : piece.getVehicule() != null ? piece.getVehicule().getImmatriculation() : null)
                .vehiculeId(piece.getVehicule() == null ? null : piece.getVehicule().getId())
                .naturePieceJointeId(piece.getTypePieceJointe() == null || piece.getTypePieceJointe().getNaturePieceJointe() == null ? null : piece.getTypePieceJointe().getNaturePieceJointe().getId())
                .documentOwner(piece.getDocumentOwner()).expiresOn(piece.getExpiresOn()).archived(piece.getArchived())
                .previousVersionId(piece.getPreviousVersion() == null ? null : piece.getPreviousVersion().getId())
                .status(Boolean.TRUE.equals(piece.getArchived()) ? "ARCHIVED" : isAvailable(piece) ? "VALID" : "EXPIRED")
                .changeReason(piece.getChangeReason()).createdBy(piece.getCreatedBy()).canDelete(canDelete(piece))
                .expectedOwner(piece.getAgence() == null || piece.getTypePieceJointe() == null ? null
                        : policy(piece.getAgence().getId(), piece.getTypePieceJointe().getNaturePieceJointe()).getOwner())
                .archivedBy(piece.getArchivedBy()).archivedAt(piece.getArchivedAt())
                .mouvementContratId(piece.getMouvementContrat() == null ? null : piece.getMouvementContrat().getId())
                .typePieceJointeId(piece.getTypePieceJointe() == null ? null : piece.getTypePieceJointe().getId())
                .typePieceJointeLibelle(piece.getTypePieceJointe() == null ? null : piece.getTypePieceJointe().getLibelle())
                .obligatoire(piece.getTypePieceJointe() == null ? null : piece.getTypePieceJointe().getObligatoire())
                .nomFichier(displayFileName(piece))
                .contentType(piece.getContentType())
                .tailleOctets(piece.getTailleOctets())
                .createdAt(piece.getCreatedAt())
                .build();
    }

    private record StoredUpload(Path path, String storageKey, String displayName, String contentType, Long size) {
    }

    @Builder
    public record DownloadedPiece(PieceJointe piece, String fileName, Resource resource, MediaType mediaType) {
    }
}
