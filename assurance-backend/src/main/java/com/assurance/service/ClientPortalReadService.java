package com.assurance.service;

import com.assurance.dto.response.*;
import com.assurance.entity.*;
import com.assurance.enums.StatutSinistre;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import com.assurance.security.ClientPortalPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.*;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClientPortalReadService {
    private final ClientPortalAuthService auth;
    private final ClientPortalAccessRepository accesses;
    private final ClientPortalDocumentRepository documents;
    private final ClientPortalClaimUpdateRepository updates;
    private final ClientPortalVehicleRepository vehicles;
    private final ClientPortalCoverageRepository coverages;
    private final ClientPortalAssistanceRepository assistances;
    private final StorageLayoutService storage;

    public ClientPortalResponses.Dashboard dashboard() {
        ClientPortalPrincipal p = principal();
        LocalDate today = LocalDate.now(ZoneId.of("Africa/Casablanca"));
        return new ClientPortalResponses.Dashboard(
                accesses.countContracts(p.agenceId(), p.accountId()),
                accesses.countActiveContracts(p.agenceId(), p.accountId(), today),
                accesses.countExpiringContracts(p.agenceId(), p.accountId(), today, today.plusDays(30)),
                accesses.countClaims(p.agenceId(), p.accountId()),
                accesses.countOpenClaims(p.agenceId(), p.accountId()));
    }

    public PagedResponse<ClientPortalResponses.Contract> contracts(int page, int size) {
        ClientPortalPrincipal p = principal();
        return paged(accesses.contracts(p.agenceId(), p.accountId(), ClientPortalManagementService.pageable(page, size))
                .map(a -> contract(a.getContrat())));
    }

    public ClientPortalResponses.ContractDetail contract(Long id, int page, int size) {
        ClientPortalPrincipal p = principal();
        ClientPortalAccess access = accesses.visibleContract(p.agenceId(), p.accountId(), id).orElseThrow(() -> missing(id));
        Page<ClientPortalResponses.Vehicle> result = vehicles.findForContract(p.agenceId(), id,
                ClientPortalManagementService.pageable(page, size)).map(v -> new ClientPortalResponses.Vehicle(
                        v.getId(), v.getImmatriculation(), v.getMarque() == null ? null : v.getMarque().getLibelle(),
                        v.getDateEffet(), v.getDateEcheance()));
        return new ClientPortalResponses.ContractDetail(contract(access.getContrat()), paged(result));
    }

    public PagedResponse<ClientPortalResponses.Claim> claims(int page, int size) {
        ClientPortalPrincipal p = principal();
        return paged(accesses.claims(p.agenceId(), p.accountId(), ClientPortalManagementService.pageable(page, size))
                .map(a -> claim(a.getSinistre())));
    }

    public PagedResponse<ClientPortalResponses.Coverage> coverages(Long contract, int page, int size) {
        ClientPortalPrincipal p = principal();
        accesses.visibleContract(p.agenceId(), p.accountId(), contract).orElseThrow(() -> missing(contract));
        return paged(coverages.findForContract(p.agenceId(), contract, ClientPortalManagementService.pageable(page, size))
                .map(g -> new ClientPortalResponses.Coverage(g.getId(), g.getVehicule() == null ? null : g.getVehicule().getId(),
                        g.getRemorque() == null ? null : g.getRemorque().getId(),
                        g.getGarantie().getCode(), g.getGarantie().getLibelle(),
                        g.getVehicule() != null ? g.getVehicule().getImmatriculation()
                                : g.getRemorque() != null ? g.getRemorque().getImmatriculation() : null,
                        g.getCapital(), g.getTauxFranchise(), g.getFranchiseMinimale())));
    }

    public PagedResponse<ClientPortalResponses.Assistance> assistances(Long contract, int page, int size) {
        ClientPortalPrincipal p = principal();
        accesses.visibleContract(p.agenceId(), p.accountId(), contract).orElseThrow(() -> missing(contract));
        return paged(assistances.findForContract(p.agenceId(), contract, ClientPortalManagementService.pageable(page, size))
                .map(a -> new ClientPortalResponses.Assistance(a.getId(), a.getVehicule() == null ? null : a.getVehicule().getId(),
                        a.getNumeroContratOuQuittance(), a.getCompagnieAssistance() == null ? null : a.getCompagnieAssistance().getNom(),
                        a.getProduit(), a.getDateEffet(), a.getDateEcheance())));
    }

    public ClientPortalResponses.Claim claim(Long id) {
        ClientPortalPrincipal p = principal();
        return claim(accesses.visibleClaim(p.agenceId(), p.accountId(), id).orElseThrow(() -> missing(id)).getSinistre());
    }

    public PagedResponse<ClientPortalResponses.Update> updates(Long claim, int page, int size) {
        ClientPortalPrincipal p = principal();
        accesses.visibleClaim(p.agenceId(), p.accountId(), claim).orElseThrow(() -> missing(claim));
        return paged(updates.visible(p.agenceId(), p.accountId(), claim, ClientPortalManagementService.pageable(page, size))
                .map(u -> new ClientPortalResponses.Update(u.getId(), u.getTitre(), u.getMessage(), u.getCreatedAt())));
    }

    public PagedResponse<ClientPortalResponses.Document> documents(int page, int size) {
        return documents(null, null, page, size);
    }

    public PagedResponse<ClientPortalResponses.Document> documents(Long contratId, Long sinistreId, int page, int size) {
        ClientPortalPrincipal p = principal();
        return paged(documents.visibleForDossier(p.agenceId(), p.accountId(), contratId, sinistreId,
                        ClientPortalManagementService.pageable(page, size))
                .map(d -> new ClientPortalResponses.Document(d.getId(), d.getTitre(),
                        d.getAccess().getContrat() == null ? null : d.getAccess().getContrat().getId(),
                        d.getAccess().getSinistre() == null ? null : d.getAccess().getSinistre().getId(), d.getCreatedAt())));
    }

    public Download download(Long id) {
        ClientPortalPrincipal p = principal();
        ClientPortalDocument document = documents.visible(p.agenceId(), p.accountId(), id).orElseThrow(() -> missing(id));
        String key;
        String name;
        String contentType;
        boolean claimDocument;
        Long dossierId;
        SinistreDocument claimSource = null;
        if (document.getPieceJointe() != null && document.getSinistreDocument() == null) {
            PieceJointe source = document.getPieceJointe();
            if (Boolean.TRUE.equals(source.getArchived()) || source.getContrat() == null
                    || document.getAccess().getContrat() == null
                    || !source.getContrat().getId().equals(document.getAccess().getContrat().getId())
                    || !source.getContrat().getAgence().getId().equals(p.agenceId())
                    || (source.getAgence() != null && !source.getAgence().getId().equals(p.agenceId()))) {
                throw missing(id);
            }
            key = source.getCheminStockage();
            name = source.getNomFichier();
            contentType = source.getContentType();
            claimDocument = false;
            dossierId = source.getContrat().getId();
        } else if (document.getSinistreDocument() != null && document.getPieceJointe() == null) {
            SinistreDocument source = document.getSinistreDocument();
            claimSource = source;
            if (document.getAccess().getSinistre() == null
                    || !source.getSinistre().getId().equals(document.getAccess().getSinistre().getId())
                    || !source.getSinistre().getAgence().getId().equals(p.agenceId())) {
                throw missing(id);
            }
            key = source.getCheminStockage();
            name = source.getNomFichier();
            contentType = source.getContentType();
            claimDocument = true;
            dossierId = source.getSinistre().getId();
        } else {
            throw missing(id);
        }
        try {
            Path relative = Path.of(key).normalize();
            if (claimSource == null && (relative.isAbsolute() || relative.getNameCount() < 3
                    || !relative.getName(0).toString().equals(p.agenceId().toString())
                    || !relative.getName(1).toString().equals(dossierId.toString()))) {
                throw missing(id);
            }
            Path path = claimDocument ? storage.resolveClaimDocument(claimSource)
                    : storage.resolveContractAttachment(relative);
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                throw missing(id);
            }
            MediaType type;
            try {
                type = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
            } catch (IllegalArgumentException invalid) {
                type = MediaType.APPLICATION_OCTET_STREAM;
            }
            return new Download(new FileSystemResource(path), name, type);
        } catch (IllegalArgumentException | NullPointerException invalid) {
            throw missing(id);
        }
    }

    private ClientPortalPrincipal principal() {
        auth.currentAccount(true);
        return ClientPortalPrincipal.current();
    }

    private ClientPortalResponses.Contract contract(Contrat c) {
        return new ClientPortalResponses.Contract(c.getId(), c.getNumeroDossier(), c.getNumeroPolice(),
                c.getTypeContrat().name(), c.getStatut().name(),
                c.getCompagnieAssurance() == null ? null : c.getCompagnieAssurance().getNom(),
                c.getDateEffet(), c.getDateEcheance());
    }

    private ClientPortalResponses.Claim claim(Sinistre s) {
        return new ClientPortalResponses.Claim(s.getId(), s.getNumeroSinistre(), s.getContrat().getNumeroPolice(),
                publicClaimStatus(s.getStatut()), s.getDateSinistre(), s.getDateDeclaration(), s.getDateCloture());
    }

    public static String publicClaimStatus(StatutSinistre status) {
        return switch (status) {
            case BROUILLON -> throw new IllegalArgumentException("Un brouillon ne doit pas être publié");
            case DECLARE, ROUVERT -> "EN_COURS";
            case DOSSIER_INCOMPLET -> "DOCUMENTS_EN_ATTENTE";
            case TRANSMIS_COMPAGNIE -> "TRANSMIS";
            case EXPERTISE -> "EXPERTISE";
            case EN_ATTENTE_REGLEMENT, PARTIELLEMENT_REGLE -> "REGLEMENT_EN_COURS";
            case REGLE -> "REGLE";
            case CLOTURE -> "CLOTURE";
            case REJETE -> "REFUSE";
            case ANNULE -> "ANNULE";
        };
    }

    private <T> PagedResponse<T> paged(Page<T> page) {
        return PagedResponse.<T>builder().items(page.getContent()).page(PageMetadata.from(page)).build();
    }

    private ResourceNotFoundException missing(Long id) {
        return new ResourceNotFoundException("Dossier ou document", id);
    }

    public record Download(Resource resource, String fileName, MediaType mediaType) {
    }
}
