package com.assurance.service;

import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.SinistreIntervenantResponse;
import com.assurance.dto.response.SpecialitePrestataireResponse;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PrestataireDirectoryExportService {
    private final SinistreIntervenantService directory;
    private final DomaineInterventionSinistreService domains;

    public record Filters(TypePrestataireSinistre typePrestataire, boolean tousOperateurs, boolean includeInactive,
                          String query, Long villeId, Long compagnieId, Long specialiteId, Long brancheId, Long domaineId) {
    }

    @Transactional(readOnly = true)
    public byte[] export(Long agency, Filters filters) {
        boolean automobile = filters.domaineId() != null
                && "AUTOMOBILE".equals(domains.require(agency, filters.domaineId()).getBrancheAssurance().getCode());
        boolean doctor = !automobile && !filters.tousOperateurs() && filters.typePrestataire() == TypePrestataireSinistre.MEDECIN;
        String[] headers = automobile
                ? new String[]{"Opérateur", "Usage", "Prestataire", "N° tél.", "E-mail", "Adresse", "Ville", "Statut"}
                : doctor ? new String[]{"Médecin", "Ville", "Adresse", "Contact", "Spécialité"}
                : new String[]{"Code", "Prestataire", "Contact", "Ville", "Spécialités", "Usages par compagnie", "Compagnies et accords", "Statut"};
        try (Workbook workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet(automobile ? "Automobile" : doctor ? "Médecins" : "Prestataires");
            var headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            var font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            var textStyle = workbook.createCellStyle();
            textStyle.setWrapText(true);
            textStyle.setVerticalAlignment(VerticalAlignment.TOP);
            textStyle.setDataFormat(workbook.createDataFormat().getFormat("@"));
            var header = sheet.createRow(0);
            header.setHeightInPoints(24);
            for (int column = 0; column < headers.length; column++) {
                var cell = header.createCell(column);
                cell.setCellValue(headers[column]);
                cell.setCellStyle(headerStyle);
            }
            int page = 0;
            int index = 1;
            PagedResponse<SinistreIntervenantResponse> result;
            do {
                result = read(agency, filters, page++);
                for (var item : result.getItems()) {
                    if (index >= 1_048_576) throw new BadRequestException("Trop de résultats pour Excel. Précisez les filtres.");
                    var row = sheet.createRow(index++);
                    var values = automobile ? automobile(item, filters) : doctor ? doctor(item, filters) : general(item, filters);
                    int lines = 1;
                    for (int column = 0; column < values.size(); column++) {
                        String value = values.get(column);
                        if (value.length() > 32_767) throw new BadRequestException("Une cellule dépasse la capacité d'Excel. Précisez les filtres.");
                        // Explicit string cells preserve leading zeros and never interpret user data as formulas.
                        var cell = row.createCell(column, CellType.STRING);
                        cell.setCellValue(value);
                        cell.setCellStyle(textStyle);
                        lines = Math.max(lines, (int) value.lines().count());
                    }
                    row.setHeightInPoints(Math.min(120, Math.max(24, lines * 15)));
                }
            } while (page < result.getPage().getTotalPages());
            for (int column = 0; column < headers.length; column++) sheet.setColumnWidth(column, 32 * 256);
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, sheet.getLastRowNum()), 0, headers.length - 1));
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new BadRequestException("Génération du fichier Excel des prestataires impossible");
        }
    }

    private PagedResponse<SinistreIntervenantResponse> read(Long agency, Filters f, int page) {
        return f.tousOperateurs()
                ? directory.directoryAll(agency, f.includeInactive(), f.query(), f.villeId(), f.compagnieId(), f.specialiteId(), f.brancheId(), f.domaineId(), page, 100)
                : directory.directory(agency, f.typePrestataire(), f.includeInactive(), f.query(), f.villeId(), f.compagnieId(), f.specialiteId(), f.brancheId(), f.domaineId(), page, 100);
    }

    private List<String> automobile(SinistreIntervenantResponse item, Filters f) {
        var agreements = agreements(item).stream().filter(a -> a.conventionneActuellement() && companyMatches(a, f)).toList();
        var specialties = specialties(item).stream().filter(s -> s.actif() && specialtyMatches(s, f)).toList();
        var labels = new ArrayList<String>();
        boolean garage = item.getTypePrestataire() == TypePrestataireSinistre.GARAGE;
        if (garage) {
            if (f.specialiteId() == null || specialties.isEmpty()) {
                labels.add(agreements.isEmpty() ? "Garage" : "Garage conventionné");
                if (f.compagnieId() == null && !agreements.isEmpty()) labels.add(agreements.stream().map(SinistreIntervenantResponse.Accord::compagnie).collect(Collectors.joining(", ")));
            }
            specialties.forEach(s -> labels.add(s.libelle()));
        } else labels.add(typeLabel(item.getTypePrestataire()));
        String usage = garage ? agreements.stream().map(a -> usage(a, f.compagnieId() == null)).collect(Collectors.joining("\n")) : "";
        return List.of(text(String.join("\n", labels)), text(usage), text(item.getNom()), text(item.getTelephone()),
                text(item.getEmail()), text(item.getAdresse()), text(item.getVille()), status(item));
    }

    private List<String> doctor(SinistreIntervenantResponse item, Filters f) {
        String specialty = specialties(item).stream().filter(s -> specialtyMatches(s, f)).map(SpecialitePrestataireResponse::libelle).collect(Collectors.joining(", "));
        String contact = join(item.getTelephone(), item.getEmail());
        return List.of(text(item.getNom()) + (item.isActif() ? "" : " (Inactif)"), text(item.getVille()), text(item.getAdresse()), text(contact), text(specialty));
    }

    private List<String> general(SinistreIntervenantResponse item, Filters f) {
        String provider = join(item.getNom(), typeLabel(item.getTypePrestataire()) + " · "
                + text(item.getDomaines() == null ? null : item.getDomaines().stream().map(SpecialitePrestataireResponse.Reference::libelle).collect(Collectors.joining(", "))), item.getAdresse());
        String usage = item.getTypePrestataire() != TypePrestataireSinistre.GARAGE ? "" : agreements(item).stream()
                .filter(a -> companyMatches(a, f)).map(a -> usage(a, true)).collect(Collectors.joining("\n"));
        String companies = (item.isToutesCompagnies() ? "Toutes compagnies" : "Compagnies liées uniquement")
                + agreements(item).stream().map(a -> "\n" + a.compagnie() + " · "
                + (!a.actif() ? "Inactif" : a.conventionne() ? "Conventionné" : "Non conventionné")
                + (a.dateFin() == null ? "" : " · au " + a.dateFin().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))))
                .collect(Collectors.joining());
        return List.of(text(item.getCode()), text(provider), join(text(item.getTelephone()), item.getEmail()), text(item.getVille()),
                text(specialties(item).stream().map(SpecialitePrestataireResponse::libelle).collect(Collectors.joining(", "))), text(usage), companies, status(item));
    }

    private String usage(SinistreIntervenantResponse.Accord agreement, boolean includeCompany) {
        String labels = agreement.tousUsages() ? "Tous les usages"
                : text(agreement.usages().stream().map(SpecialitePrestataireResponse.Reference::libelle).collect(Collectors.joining(", ")));
        return (includeCompany ? agreement.compagnie() + " : " : "") + labels;
    }

    private boolean companyMatches(SinistreIntervenantResponse.Accord a, Filters f) {
        return f.compagnieId() == null || Objects.equals(a.compagnieId(), f.compagnieId());
    }

    private boolean specialtyMatches(SpecialitePrestataireResponse s, Filters f) {
        return f.specialiteId() == null || Objects.equals(s.id(), f.specialiteId());
    }

    private List<SinistreIntervenantResponse.Accord> agreements(SinistreIntervenantResponse item) {
        return item.getAccords() == null ? List.of() : item.getAccords();
    }

    private List<SpecialitePrestataireResponse> specialties(SinistreIntervenantResponse item) {
        return item.getSpecialites() == null ? List.of() : item.getSpecialites();
    }

    private String text(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String join(String... values) {
        return java.util.Arrays.stream(values).filter(v -> v != null && !v.isBlank()).collect(Collectors.joining("\n"));
    }

    private String status(SinistreIntervenantResponse item) {
        return item.isActif() ? "Actif" : "Inactif";
    }

    private String typeLabel(TypePrestataireSinistre type) {
        if (type == null) return "-";
        return switch (type) {
            case GARAGE -> "Garage";
            case EXPERT -> "Expert";
            case MEDECIN -> "Médecin";
            case CLINIQUE -> "Clinique";
            case PHARMACIE -> "Pharmacie";
            case RADIOLOGIE -> "Radiologie";
            case KINESITHERAPIE -> "Kinésithérapie";
        };
    }
}
