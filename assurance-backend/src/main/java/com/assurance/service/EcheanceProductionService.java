package com.assurance.service;

import com.assurance.dto.response.EcheanceAutomobileResponse;
import com.assurance.entity.Client;
import com.assurance.entity.ClientTelephone;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.Vehicule;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ContratRepository;
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
                "Observation"
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

    private EcheanceAutomobileResponse.Row toRow(Contrat contrat) {
        ContratClient link = souscripteur(contrat);
        Client client = link == null ? null : link.getClient();
        Vehicule vehicule = contrat.getTypeContrat() == TypeContrat.FLOTTE ? null : firstVehicule(contrat);
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
                .observation(observation(client, vehicule))
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
        return ids.stream()
                .map(contratsById::get)
                .filter(contrat -> contrat != null)
                .map(this::toRow)
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
        return contrat.getVehicules() == null || contrat.getVehicules().isEmpty() ? null : contrat.getVehicules().get(0);
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

    private String observation(Client client, Vehicule vehicule) {
        LocalDate today = LocalDate.now();
        if (client != null && client.getDateValiditePermis() != null && client.getDateValiditePermis().isBefore(today)) {
            return "Permis expiré";
        }
        if (client != null && client.getCinValidite() != null && client.getCinValidite().isBefore(today)) {
            return "CIN expiré";
        }
        if (vehicule != null && vehicule.getDateExpirationCarteGrise() != null && vehicule.getDateExpirationCarteGrise().isBefore(today)) {
            return "Carte grise expirée";
        }
        return "-";
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
