package com.assurance.service;

import com.assurance.dto.response.EcheanceAutomobileResponse;
import com.assurance.entity.Client;
import com.assurance.entity.ClientTelephone;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.Vehicule;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ContratRepository;
import com.assurance.service.renewal.RenewalPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EcheanceProductionService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 200;
    private static final int EXPORT_PAGE_SIZE = 500;

    private final ContratRepository contratRepository;
    private final RenewalPolicy renewalPolicy;

    public EcheanceAutomobileResponse searchAutomobile(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu,
            Long compagnieId,
            TypeContrat typeContrat,
            String search,
            Integer page,
            Integer size
    ) {
        validateDates(dateDu, dateAu);
        Page<Long> idsPage = contratRepository.findAutomobileEcheanceIds(
                agenceId,
                dateDu,
                dateAu,
                compagnieId,
                typeContrat,
                searchFilter(search),
                PageRequest.of(safePage(page), safeSize(size))
        );
        List<EcheanceAutomobileResponse.Row> rows = toRows(agenceId, idsPage.getContent());
        return EcheanceAutomobileResponse.builder()
                .dateDu(dateDu)
                .dateAu(dateAu)
                .compagnieId(compagnieId)
                .typeContrat(typeContrat)
                .search(safe(search))
                .summary(summary(rows, idsPage.getTotalElements()))
                .page(pageInfo(idsPage))
                .rows(rows)
                .build();
    }

    public byte[] exportAutomobile(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu,
            Long compagnieId,
            TypeContrat typeContrat,
            String search
    ) {
        validateDates(dateDu, dateAu);
        String searchFilter = searchFilter(search);
        StringBuilder html = new StringBuilder();
        html.append("<!doctype html><html><head><meta charset=\"utf-8\"></head><body>");
        html.append("<table>");
        appendRow(html, List.of(
                "Dossier",
                "Client",
                "Code client",
                "Police",
                "Marque",
                "Matricule",
                "Date echeance",
                "Contrat",
                "Compagnie",
                "Telephone",
                "Alertes documents"
        ), true);
        int page = 0;
        Page<Long> idsPage;
        do {
            idsPage = contratRepository.findAutomobileEcheanceIds(
                    agenceId,
                    dateDu,
                    dateAu,
                    compagnieId,
                    typeContrat,
                    searchFilter,
                    PageRequest.of(page, EXPORT_PAGE_SIZE)
            );
            for (EcheanceAutomobileResponse.Row row : toRows(agenceId, idsPage.getContent())) {
                appendRow(html, List.of(
                        row.getDossier(),
                        row.getClient(),
                        row.getCodeClient(),
                        row.getPolice(),
                        row.getMarque(),
                        row.getMatricule(),
                        formatDate(row.getDateEcheance()),
                        row.getTypeContratLabel(),
                        row.getCompagnie(),
                        row.getTelephone(),
                        row.getObservation()
                ), false);
            }
            page++;
        } while (idsPage.hasNext());
        html.append("</table></body></html>");
        return html.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void validateDates(LocalDate dateDu, LocalDate dateAu) {
        if (dateDu == null || dateAu == null) {
            throw new BadRequestException("Merci de renseigner la periode complete : date du et date au.");
        }
        if (dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date du doit etre inferieure ou egale a la date au.");
        }
    }

    private EcheanceAutomobileResponse.Row toRow(Contrat contrat, Contrat preTermeDraft) {
        ContratClient link = souscripteur(contrat);
        Client client = link == null ? null : link.getClient();
        Vehicule vehicule = contrat.getTypeContrat() == TypeContrat.FLOTTE ? null : firstVehicule(contrat);
        ObservationResult observation = observation(contrat, client);
        return EcheanceAutomobileResponse.Row.builder()
                .contratId(contrat.getId())
                .dossier(firstNonBlank(contrat.getNumeroDossier(), contrat.getNumeroContrat(), "#" + contrat.getId()))
                .client(firstNonBlank(client == null ? null : client.getNomAffichage(), "-"))
                .codeClient(firstNonBlank(
                        client == null ? null : client.getCodeClient(),
                        client == null ? null : client.getRc(),
                        client == null ? null : client.getCin(),
                        client == null ? null : client.getIce(),
                        "-"
                ))
                .police(firstNonBlank(contrat.getNumeroPolice(), contrat.getNumeroContrat(), "-"))
                .marque(firstNonBlank(vehicule == null || vehicule.getMarque() == null ? null : vehicule.getMarque().getLibelle(), "-"))
                .matricule(firstNonBlank(vehicule == null ? null : vehicule.getImmatriculation(), "-"))
                .dateEcheance(contrat.getDateEcheance())
                .typeContrat(contrat.getTypeContrat())
                .typeContratLabel(typeContratLabel(contrat.getTypeContrat()))
                .compagnieId(contrat.getCompagnieAssurance() == null ? null : contrat.getCompagnieAssurance().getId())
                .compagnie(firstNonBlank(
                        contrat.getCompagnieAssurance() == null ? null : contrat.getCompagnieAssurance().getNom(),
                        contrat.getCompagnieAssurance() == null ? null : contrat.getCompagnieAssurance().getCode(),
                        "-"
                ))
                .telephone(primaryPhone(client))
                .observation(observation.message())
                .observationNiveau(observation.level())
                .preTermeDraftId(preTermeDraft == null ? null : preTermeDraft.getId())
                .renouvellementTermeCompagnieEligible(renewalPolicy.isCompanyTermEligible(contrat))
                .build();
    }

    private List<EcheanceAutomobileResponse.Row> toRows(Long agenceId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }
        Map<Long, Contrat> contratsById = new HashMap<>();
        for (Contrat contrat : contratRepository.findByAgenceIdAndIdIn(agenceId, ids)) {
            contratsById.put(contrat.getId(), contrat);
        }
        Map<Long, Contrat> draftsBySourceId = new HashMap<>();
        for (Contrat draft : contratRepository.findByAgenceIdAndContratOrigineIdIn(agenceId, ids)) {
            if (draft.getContratOrigine() != null
                    && draft.getStatut() == StatutContrat.DRAFT
                    && Boolean.TRUE.equals(draft.getBrouillon())) {
                draftsBySourceId.put(draft.getContratOrigine().getId(), draft);
            }
        }
        return ids.stream()
                .map(contratsById::get)
                .filter(contrat -> contrat != null)
                .map(contrat -> toRow(contrat, draftsBySourceId.get(contrat.getId())))
                .toList();
    }

    private ContratClient souscripteur(Contrat contrat) {
        if (contrat.getClients() == null || contrat.getClients().isEmpty()) {
            return null;
        }
        return contrat.getClients().stream()
                .filter(link -> link.getRole() == RoleClientContrat.SOUSCRIPTEUR)
                .findFirst()
                .orElse(contrat.getClients().get(0));
    }

    private Vehicule firstVehicule(Contrat contrat) {
        if (contrat.getVehicules() == null) {
            return null;
        }
        return contrat.getVehicules().stream()
                .filter(vehicle -> !Boolean.FALSE.equals(vehicle.getActif()))
                .findFirst()
                .orElse(null);
    }

    private String primaryPhone(Client client) {
        if (client == null) {
            return "-";
        }
        if (client.getTelephones() != null) {
            String principal = client.getTelephones().stream()
                    .filter(phone -> Boolean.TRUE.equals(phone.getPrincipal()))
                    .map(ClientTelephone::getNumero)
                    .filter(this::hasText)
                    .findFirst()
                    .orElse(null);
            if (hasText(principal)) {
                return principal;
            }
            String first = client.getTelephones().stream()
                    .map(ClientTelephone::getNumero)
                    .filter(this::hasText)
                    .findFirst()
                    .orElse(null);
            if (hasText(first)) {
                return first;
            }
        }
        return firstNonBlank(client.getTelephone(), "-");
    }

    private ObservationResult observation(Contrat contrat, Client subscriber) {
        LocalDate today = LocalDate.now();
        LocalDate renewalDate = contrat.getDateEcheance();
        Set<String> messages = new LinkedHashSet<>();
        AlertAccumulator alerts = new AlertAccumulator();

        Client driver = conducteur(contrat, subscriber);
        if (driver != null && driver.getTypeClient() == TypeClient.PERSONNE_PHYSIQUE) {
            addDocumentAlert(
                    messages,
                    alerts,
                    driver.getDateValiditePermis(),
                    today,
                    renewalDate,
                    "Permis expiré",
                    "Permis expirant avant l’échéance",
                    "Validité du permis manquante"
            );
        }

        if (subscriber != null
                && subscriber.getTypeClient() == TypeClient.PERSONNE_PHYSIQUE
                && subscriber.getCin() != null
                && !subscriber.getCin().isBlank()) {
            addDocumentAlert(
                    messages,
                    alerts,
                    subscriber.getCinValidite(),
                    today,
                    renewalDate,
                    "CIN expirée",
                    "CIN expirant avant l’échéance",
                    "Validité de la CIN manquante"
            );
        }

        List<Vehicule> vehicles = contrat.getVehicules() == null
                ? List.of()
                : contrat.getVehicules().stream()
                        .filter(vehicle -> !Boolean.FALSE.equals(vehicle.getActif()))
                        .toList();
        if (contrat.getTypeContrat() == TypeContrat.FLOTTE) {
            addFleetRegistrationAlerts(messages, alerts, vehicles, today, renewalDate);
        } else if (!vehicles.isEmpty()) {
            addDocumentAlert(
                    messages,
                    alerts,
                    vehicles.get(0).getDateExpirationCarteGrise(),
                    today,
                    renewalDate,
                    "Carte grise expirée",
                    "Carte grise expirant avant l’échéance",
                    "Validité de la carte grise manquante"
            );
        }

        if (messages.isEmpty()) {
            return new ObservationResult("À jour", "AUCUNE");
        }
        return new ObservationResult(
                String.join(" · ", messages),
                alerts.expired ? "BLOQUANT" : "AVERTISSEMENT"
        );
    }

    private Client conducteur(Contrat contrat, Client fallback) {
        if (contrat.getClients() == null) {
            return fallback;
        }
        Client designatedDriver = contrat.getClients().stream()
                .filter(link -> link.getRole() == RoleClientContrat.CONDUCTEUR)
                .map(ContratClient::getClient)
                .findFirst()
                .orElse(null);
        if (designatedDriver != null) {
            return designatedDriver;
        }
        return contrat.getClients().stream()
                .filter(link -> link.getRole() == RoleClientContrat.PROPRIETAIRE)
                .map(ContratClient::getClient)
                .filter(client -> !Boolean.FALSE.equals(client.getConducteurHabituel()))
                .findFirst()
                .orElse(fallback);
    }

    private void addFleetRegistrationAlerts(
            Set<String> messages,
            AlertAccumulator alerts,
            List<Vehicule> vehicles,
            LocalDate today,
            LocalDate renewalDate
    ) {
        int expired = 0;
        int beforeRenewal = 0;
        int missing = 0;
        for (Vehicule vehicle : vehicles) {
            DocumentStatus status = documentStatus(
                    vehicle.getDateExpirationCarteGrise(),
                    today,
                    renewalDate
            );
            if (status == DocumentStatus.EXPIRED) {
                expired++;
            } else if (status == DocumentStatus.BEFORE_RENEWAL) {
                beforeRenewal++;
            } else if (status == DocumentStatus.MISSING) {
                missing++;
            }
        }
        if (expired > 0) {
            alerts.expired = true;
            messages.add(expired + " carte(s) grise(s) expirée(s)");
        }
        if (beforeRenewal > 0) {
            messages.add(beforeRenewal + " carte(s) grise(s) expirant avant l’échéance");
        }
        if (missing > 0) {
            messages.add(missing + " validité(s) de carte grise manquante(s)");
        }
    }

    private void addDocumentAlert(
            Set<String> messages,
            AlertAccumulator alerts,
            LocalDate validityDate,
            LocalDate today,
            LocalDate renewalDate,
            String expiredMessage,
            String beforeRenewalMessage,
            String missingMessage
    ) {
        DocumentStatus status = documentStatus(validityDate, today, renewalDate);
        if (status == DocumentStatus.EXPIRED) {
            alerts.expired = true;
            messages.add(expiredMessage);
        } else if (status == DocumentStatus.BEFORE_RENEWAL) {
            messages.add(beforeRenewalMessage);
        } else if (status == DocumentStatus.MISSING) {
            messages.add(missingMessage);
        }
    }

    private DocumentStatus documentStatus(
            LocalDate validityDate,
            LocalDate today,
            LocalDate renewalDate
    ) {
        if (validityDate == null) {
            return DocumentStatus.MISSING;
        }
        if (validityDate.isBefore(today)) {
            return DocumentStatus.EXPIRED;
        }
        if (renewalDate != null && validityDate.isBefore(renewalDate)) {
            return DocumentStatus.BEFORE_RENEWAL;
        }
        return DocumentStatus.VALID;
    }

    private enum DocumentStatus {
        VALID,
        EXPIRED,
        BEFORE_RENEWAL,
        MISSING
    }

    private record ObservationResult(String message, String level) {
    }

    private static final class AlertAccumulator {
        private boolean expired;
    }

    private EcheanceAutomobileResponse.Summary summary(List<EcheanceAutomobileResponse.Row> rows, long totalElements) {
        Set<String> compagnies = new LinkedHashSet<>();
        for (EcheanceAutomobileResponse.Row row : rows) {
            if (hasText(row.getCompagnie()) && !"-".equals(row.getCompagnie())) {
                compagnies.add(row.getCompagnie());
            }
        }
        return EcheanceAutomobileResponse.Summary.builder()
                .contratCount(totalElements)
                .compagnieCount(compagnies.size())
                .build();
    }

    private EcheanceAutomobileResponse.PageInfo pageInfo(Page<Long> page) {
        return EcheanceAutomobileResponse.PageInfo.builder()
                .number(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }

    private String typeContratLabel(TypeContrat typeContrat) {
        if (typeContrat == TypeContrat.FLOTTE) {
            return "Flotte";
        }
        if (typeContrat == TypeContrat.CONVENTION) {
            return "Convention";
        }
        return "Mono";
    }

    private void appendRow(StringBuilder html, List<String> cells, boolean header) {
        html.append("<tr>");
        String tag = header ? "th" : "td";
        for (String cell : cells) {
            html.append('<').append(tag).append('>')
                    .append(escapeHtml(cell))
                    .append("</").append(tag).append('>');
        }
        html.append("</tr>");
    }

    private String escapeHtml(String value) {
        return safe(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String formatDate(LocalDate date) {
        return date == null ? "" : DATE_FORMAT.format(date);
    }

    private String normalize(String value) {
        return Normalizer.normalize(safe(value).toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim();
    }

    private String searchFilter(String value) {
        return hasText(value) ? normalize(value) : null;
    }

    private int safePage(Integer page) {
        return page == null ? 0 : Math.max(0, page);
    }

    private int safeSize(Integer size) {
        return size == null ? DEFAULT_PAGE_SIZE : Math.max(1, Math.min(size, MAX_PAGE_SIZE));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }
}
