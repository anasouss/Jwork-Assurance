package com.assurance.service;

import com.assurance.dto.request.UpdateContactCompagnieStatusRequest;
import com.assurance.dto.request.UpsertContactCompagnieRequest;
import com.assurance.dto.response.ContactCompagnieResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.ContactCompagnie;
import com.assurance.enums.ServiceContactCompagnie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.ContactCompagnieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ContactCompagnieService {

    private final ContactCompagnieRepository contactRepository;
    private final CompagnieAssuranceRepository compagnieRepository;
    private final AgenceRepository agenceRepository;

    @Transactional(readOnly = true)
    public PagedResponse<ContactCompagnieResponse> list(Long agenceId, String query, Long compagnieId,
                                                        ServiceContactCompagnie service, Boolean actif,
                                                        int page, int size) {
        if (agenceId == null) {
            return PagedResponse.<ContactCompagnieResponse>builder()
                    .items(List.of())
                    .page(PageMetadata.builder()
                            .number(0).size(Math.min(Math.max(size, 1), 100))
                            .totalPages(0).totalElements(0).first(true).last(true)
                            .build())
                    .build();
        }
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by("compagnieAssurance.nom").ascending()
                        .and(Sort.by("principal").descending())
                        .and(Sort.by("nom").ascending())
                        .and(Sort.by("prenom").ascending())
        );
        Page<ContactCompagnie> result = contactRepository.search(
                agenceId, compagnieId, service, actif, searchTerm(query), pageable);
        return PagedResponse.<ContactCompagnieResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .page(PageMetadata.from(result))
                .build();
    }

    @Transactional
    public ContactCompagnieResponse create(Long agenceId, Long compagnieId,
                                            UpsertContactCompagnieRequest request) {
        Agence agence = resolveAgence(agenceId);
        CompagnieAssurance compagnie = resolveCompagnie(compagnieId);
        if (!Boolean.TRUE.equals(compagnie.getActif())) {
            throw new BadRequestException("Impossible d'ajouter un contact à une compagnie inactive.");
        }
        validateContactMethod(request);
        ContactCompagnie contact = ContactCompagnie.builder()
                .agence(agence)
                .compagnieAssurance(compagnie)
                .actif(true)
                .build();
        apply(contact, request);
        ensureSinglePrincipal(contact);
        return toResponse(contactRepository.save(contact));
    }

    @Transactional
    public ContactCompagnieResponse update(Long agenceId, Long compagnieId, Long contactId,
                                            UpsertContactCompagnieRequest request) {
        requireAgenceId(agenceId);
        validateContactMethod(request);
        ContactCompagnie contact = resolveContact(agenceId, compagnieId, contactId);
        apply(contact, request);
        ensureSinglePrincipal(contact);
        return toResponse(contactRepository.save(contact));
    }

    @Transactional
    public ContactCompagnieResponse updateStatus(Long agenceId, Long compagnieId, Long contactId,
                                                  UpdateContactCompagnieStatusRequest request) {
        requireAgenceId(agenceId);
        ContactCompagnie contact = resolveContact(agenceId, compagnieId, contactId);
        contact.setActif(request.getActif());
        if (!Boolean.TRUE.equals(request.getActif())) {
            contact.setPrincipal(false);
        }
        return toResponse(contactRepository.save(contact));
    }

    private ContactCompagnie resolveContact(Long agenceId, Long compagnieId, Long contactId) {
        ContactCompagnie contact = contactRepository.findByIdAndAgenceId(contactId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Contact compagnie", contactId));
        if (!contact.getCompagnieAssurance().getId().equals(compagnieId)) {
            throw new ResourceNotFoundException("Contact compagnie", contactId);
        }
        return contact;
    }

    private Agence resolveAgence(Long agenceId) {
        requireAgenceId(agenceId);
        return agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
    }

    private CompagnieAssurance resolveCompagnie(Long compagnieId) {
        return compagnieRepository.findById(compagnieId)
                .orElseThrow(() -> new ResourceNotFoundException("Compagnie d'assurance", compagnieId));
    }

    private void requireAgenceId(Long agenceId) {
        if (agenceId == null) {
            throw new BadRequestException("Une agence active est requise pour gérer les contacts compagnie.");
        }
    }

    private void validateContactMethod(UpsertContactCompagnieRequest request) {
        if (blank(request.getEmail()) && blank(request.getTelephoneMobile()) && blank(request.getTelephoneFixe())) {
            throw new BadRequestException("Renseignez au moins un e-mail, un mobile ou un téléphone fixe.");
        }
        if (Boolean.TRUE.equals(request.getWhatsapp()) && blank(request.getTelephoneMobile())) {
            throw new BadRequestException("Un numéro mobile est requis pour activer WhatsApp.");
        }
    }

    private void apply(ContactCompagnie contact, UpsertContactCompagnieRequest request) {
        contact.setNom(required(request.getNom()));
        contact.setPrenom(optional(request.getPrenom()));
        contact.setService(request.getService());
        contact.setFonction(optional(request.getFonction()));
        contact.setEmail(lowercase(request.getEmail()));
        contact.setTelephoneMobile(optional(request.getTelephoneMobile()));
        contact.setTelephoneFixe(optional(request.getTelephoneFixe()));
        contact.setPosteTelephonique(optional(request.getPosteTelephonique()));
        contact.setWhatsapp(Boolean.TRUE.equals(request.getWhatsapp()));
        contact.setFax(optional(request.getFax()));
        contact.setPrincipal(Boolean.TRUE.equals(request.getPrincipal()));
        contact.setNotes(optional(request.getNotes()));
    }

    private void ensureSinglePrincipal(ContactCompagnie contact) {
        if (!Boolean.TRUE.equals(contact.getPrincipal())) return;
        if (!Boolean.TRUE.equals(contact.getActif())) {
            throw new BadRequestException("Un contact inactif ne peut pas être défini comme principal.");
        }
        contactRepository.clearOtherPrincipalContacts(
                contact.getAgence().getId(), contact.getCompagnieAssurance().getId(),
                contact.getService(), contact.getId());
    }

    private ContactCompagnieResponse toResponse(ContactCompagnie contact) {
        CompagnieAssurance compagnie = contact.getCompagnieAssurance();
        return ContactCompagnieResponse.builder()
                .id(contact.getId())
                .compagnieAssuranceId(compagnie.getId())
                .compagnieAssuranceCode(compagnie.getCode())
                .compagnieAssuranceNom(compagnie.getNom())
                .nom(contact.getNom()).prenom(contact.getPrenom()).service(contact.getService())
                .fonction(contact.getFonction()).email(contact.getEmail())
                .telephoneMobile(contact.getTelephoneMobile()).telephoneFixe(contact.getTelephoneFixe())
                .posteTelephonique(contact.getPosteTelephonique()).whatsapp(contact.getWhatsapp())
                .fax(contact.getFax()).principal(contact.getPrincipal()).notes(contact.getNotes())
                .actif(contact.getActif()).createdAt(contact.getCreatedAt()).updatedAt(contact.getUpdatedAt())
                .build();
    }

    private String searchTerm(String value) {
        String normalized = optional(value);
        return normalized == null ? null : "%" + normalized.toLowerCase(Locale.ROOT) + "%";
    }

    private String required(String value) {
        String normalized = optional(value);
        if (normalized == null) throw new BadRequestException("Le nom est obligatoire.");
        return normalized;
    }

    private String lowercase(String value) {
        String normalized = optional(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
