package com.assurance.service;

import com.assurance.dto.request.AcquisitionClientRequest;
import com.assurance.dto.request.UpsertOrigineCommercialeRequest;
import com.assurance.dto.response.AcquisitionClientResponse;
import com.assurance.dto.response.AcquisitionOptionsResponse;
import com.assurance.dto.response.OrigineCommercialeResponse;
import com.assurance.entity.AcquisitionClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.OrigineCommerciale;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.TypeOrigineCommerciale;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AcquisitionClientRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.OrigineCommercialeRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AcquisitionClientService {

    private static final List<DefaultOrigin> DEFAULT_ORIGINS = List.of(
            new DefaultOrigin("PASSAGE_AGENCE", "Passage en agence", TypeOrigineCommerciale.PASSAGE_AGENCE, 10),
            new DefaultOrigin("COLLABORATEUR", "Équipe de l'agence", TypeOrigineCommerciale.COLLABORATEUR, 20),
            new DefaultOrigin("CLIENT", "Recommandation d'un client", TypeOrigineCommerciale.CLIENT, 30),
            new DefaultOrigin("SITE_WEB", "Site web", TypeOrigineCommerciale.SITE_WEB, 40),
            new DefaultOrigin("RESEAUX_SOCIAUX", "Réseaux sociaux", TypeOrigineCommerciale.RESEAUX_SOCIAUX, 50),
            new DefaultOrigin("AUTRE", "Autre", TypeOrigineCommerciale.AUTRE, 100)
    );

    private final AcquisitionClientRepository acquisitionRepository;
    private final OrigineCommercialeRepository origineRepository;
    private final AgenceRepository agenceRepository;
    private final ClientRepository clientRepository;
    private final UtilisateurRepository utilisateurRepository;

    @Transactional
    public AcquisitionOptionsResponse options(Long agenceId) {
        ensureDefaultOrigins(agenceId);
        return AcquisitionOptionsResponse.builder()
                .origines(origineRepository.findByAgenceIdOrderByOrdreAscLibelleAsc(agenceId).stream()
                        .map(this::toOriginResponse)
                        .toList())
                .collaborateurs(utilisateurRepository.findByAgenceIdOrderByNomAscPrenomAsc(agenceId).stream()
                        .map(user -> AcquisitionOptionsResponse.UtilisateurOption.builder()
                                .id(user.getId())
                                .nom(user.getFullName())
                                .actif(user.getActif())
                                .build())
                        .toList())
                .build();
    }

    @Transactional
    public OrigineCommercialeResponse createOrigin(Long agenceId, UpsertOrigineCommercialeRequest request) {
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        String code = normalizeCode(request.getCode());
        if (origineRepository.findByAgenceIdAndCodeIgnoreCase(agenceId, code).isPresent()) {
            throw new BadRequestException("Une origine commerciale utilise déjà ce code");
        }
        OrigineCommerciale origin = OrigineCommerciale.builder()
                .agence(agence)
                .code(code)
                .libelle(request.getLibelle().trim())
                .type(request.getType())
                .actif(request.getActif() == null || request.getActif())
                .ordre(safeOrder(request.getOrdre()))
                .build();
        return toOriginResponse(origineRepository.save(origin));
    }

    @Transactional
    public OrigineCommercialeResponse updateOrigin(
            Long agenceId,
            Long originId,
            UpsertOrigineCommercialeRequest request
    ) {
        OrigineCommerciale origin = getOrigin(agenceId, originId);
        String code = normalizeCode(request.getCode());
        if (origineRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, originId)) {
            throw new BadRequestException("Une origine commerciale utilise déjà ce code");
        }
        boolean used = acquisitionRepository.existsByAgenceIdAndOrigineCommercialeId(agenceId, originId);
        if (used && origin.getType() != request.getType()) {
            throw new BadRequestException("Le type d'une origine déjà utilisée ne peut pas être modifié");
        }
        origin.setCode(code);
        origin.setLibelle(request.getLibelle().trim());
        origin.setType(request.getType());
        origin.setActif(request.getActif() == null || request.getActif());
        origin.setOrdre(safeOrder(request.getOrdre()));
        return toOriginResponse(origineRepository.save(origin));
    }

    @Transactional
    public AcquisitionClientResponse upsert(
            Long agenceId,
            Long clientId,
            AcquisitionClientRequest request,
            Long actorId
    ) {
        Client client = clientRepository.findByAgenceIdAndId(agenceId, clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));
        return upsert(agenceId, client, request, actorId);
    }

    @Transactional
    public AcquisitionClientResponse upsert(
            Long agenceId,
            Client client,
            AcquisitionClientRequest request,
            Long actorId
    ) {
        if (request == null) {
            return find(agenceId, client.getId());
        }
        if (!client.getAgence().getId().equals(agenceId)) {
            throw new BadRequestException("Le client n'appartient pas à cette agence");
        }
        OrigineCommerciale origin = getOrigin(agenceId, request.getOrigineCommercialeId());
        if (!Boolean.TRUE.equals(origin.getActif())) {
            throw new BadRequestException("L'origine commerciale sélectionnée est inactive");
        }

        Utilisateur employee = resolveEmployee(agenceId, request.getRecommandeParUtilisateurId());
        Client referringClient = resolveReferringClient(agenceId, client.getId(), request.getRecommandeParClientId());
        validateReferrer(origin.getType(), employee, referringClient);
        Utilisateur actor = actorId == null ? null : utilisateurRepository.findById(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", actorId));

        AcquisitionClient acquisition = acquisitionRepository.findByAgenceIdAndClientId(agenceId, client.getId())
                .orElseGet(() -> AcquisitionClient.builder()
                        .agence(client.getAgence())
                        .client(client)
                        .saisiPar(actor)
                        .build());
        acquisition.setOrigineCommerciale(origin);
        acquisition.setRecommandeParUtilisateur(employee);
        acquisition.setRecommandeParClient(referringClient);
        acquisition.setDateAcquisition(request.getDateAcquisition() == null
                ? LocalDate.now()
                : request.getDateAcquisition());
        acquisition.setNotes(trimToNull(request.getNotes()));
        acquisition.setModifiePar(actor);
        return toResponse(acquisitionRepository.save(acquisition));
    }

    @Transactional(readOnly = true)
    public AcquisitionClientResponse find(Long agenceId, Long clientId) {
        return acquisitionRepository.findByAgenceIdAndClientId(agenceId, clientId)
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional
    public List<OrigineCommercialeResponse> listOrigins(Long agenceId) {
        ensureDefaultOrigins(agenceId);
        return origineRepository.findByAgenceIdOrderByOrdreAscLibelleAsc(agenceId).stream()
                .map(this::toOriginResponse)
                .toList();
    }

    @Transactional
    public void provisionDefaultOrigins(Long agenceId) {
        ensureDefaultOrigins(agenceId);
    }

    private void ensureDefaultOrigins(Long agenceId) {
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        for (DefaultOrigin value : DEFAULT_ORIGINS) {
            if (origineRepository.findByAgenceIdAndCodeIgnoreCase(agenceId, value.code()).isEmpty()) {
                origineRepository.save(OrigineCommerciale.builder()
                        .agence(agence)
                        .code(value.code())
                        .libelle(value.label())
                        .type(value.type())
                        .actif(true)
                        .ordre(value.order())
                        .build());
            }
        }
    }

    private OrigineCommerciale getOrigin(Long agenceId, Long originId) {
        return origineRepository.findByAgenceIdAndId(agenceId, originId)
                .orElseThrow(() -> new ResourceNotFoundException("Origine commerciale", originId));
    }

    private Utilisateur resolveEmployee(Long agenceId, Long userId) {
        if (userId == null) {
            return null;
        }
        Utilisateur user = utilisateurRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Membre de l'équipe", userId));
        if (user.getAgence() == null || !agenceId.equals(user.getAgence().getId())) {
            throw new BadRequestException("Le collaborateur n'appartient pas à cette agence");
        }
        if (!Boolean.TRUE.equals(user.getActif())) {
            throw new BadRequestException("Le collaborateur sélectionné est inactif");
        }
        return user;
    }

    private Client resolveReferringClient(Long agenceId, Long clientId, Long referringClientId) {
        if (referringClientId == null) {
            return null;
        }
        if (referringClientId.equals(clientId)) {
            throw new BadRequestException("Un client ne peut pas se recommander lui-même");
        }
        return clientRepository.findByAgenceIdAndId(agenceId, referringClientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client recommandant", referringClientId));
    }

    private void validateReferrer(
            TypeOrigineCommerciale type,
            Utilisateur employee,
            Client referringClient
    ) {
        if (type == TypeOrigineCommerciale.COLLABORATEUR && employee == null) {
            throw new BadRequestException("Le membre de l'équipe à l'origine du client est obligatoire");
        }
        if (type == TypeOrigineCommerciale.CLIENT && referringClient == null) {
            throw new BadRequestException("Le client recommandant est obligatoire");
        }
        if (type != TypeOrigineCommerciale.COLLABORATEUR && employee != null) {
            throw new BadRequestException("Cette origine commerciale n'accepte pas de membre de l'équipe");
        }
        if (type != TypeOrigineCommerciale.CLIENT && referringClient != null) {
            throw new BadRequestException("Cette origine commerciale n'accepte pas de client recommandant");
        }
    }

    private OrigineCommercialeResponse toOriginResponse(OrigineCommerciale origin) {
        return OrigineCommercialeResponse.builder()
                .id(origin.getId())
                .code(origin.getCode())
                .libelle(origin.getLibelle())
                .type(origin.getType())
                .actif(origin.getActif())
                .ordre(origin.getOrdre())
                .build();
    }

    public AcquisitionClientResponse toResponse(AcquisitionClient acquisition) {
        return AcquisitionClientResponse.builder()
                .id(acquisition.getId())
                .origineCommercialeId(acquisition.getOrigineCommerciale().getId())
                .origineCode(acquisition.getOrigineCommerciale().getCode())
                .origineLibelle(acquisition.getOrigineCommerciale().getLibelle())
                .origineType(acquisition.getOrigineCommerciale().getType())
                .recommandeParUtilisateurId(id(acquisition.getRecommandeParUtilisateur()))
                .recommandeParUtilisateurNom(name(acquisition.getRecommandeParUtilisateur()))
                .recommandeParClientId(id(acquisition.getRecommandeParClient()))
                .recommandeParClientNom(name(acquisition.getRecommandeParClient()))
                .dateAcquisition(acquisition.getDateAcquisition())
                .notes(acquisition.getNotes())
                .saisiParId(id(acquisition.getSaisiPar()))
                .saisiParNom(name(acquisition.getSaisiPar()))
                .modifieParId(id(acquisition.getModifiePar()))
                .modifieParNom(name(acquisition.getModifiePar()))
                .build();
    }

    private Long id(Object entity) {
        return entity instanceof Client client ? client.getId()
                : entity instanceof Utilisateur user ? user.getId()
                : null;
    }

    private String name(Object entity) {
        return entity instanceof Client client ? client.getNomAffichage()
                : entity instanceof Utilisateur user ? user.getFullName()
                : null;
    }

    private String normalizeCode(String value) {
        return value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    private int safeOrder(Integer value) {
        return value == null ? 100 : Math.max(value, 0);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record DefaultOrigin(
            String code,
            String label,
            TypeOrigineCommerciale type,
            int order
    ) {
    }
}
