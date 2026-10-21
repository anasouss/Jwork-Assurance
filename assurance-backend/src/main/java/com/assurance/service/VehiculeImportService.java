package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.response.VehiculeImportPreviewResponse;
import com.assurance.entity.Carburant;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.Contrat;
import com.assurance.entity.SousClasse;
import com.assurance.entity.Usage;
import com.assurance.enums.ChampMoteurSousClasse;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeVehiculeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.CarburantRepository;
import com.assurance.repository.CarrosserieRepository;
import com.assurance.repository.CategorieTransportRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.FormuleGarantiePersonneRepository;
import com.assurance.repository.LigneGrilleTarifaireRepository;
import com.assurance.repository.MarqueRepository;
import com.assurance.repository.SousClasseRepository;
import com.assurance.repository.TarifUsageRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Name;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class VehiculeImportService {

    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final int MAX_ROWS = 1_000;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<String> TEMPLATE_HEADERS = List.of(
            "Usage", "Immatriculation", "Marque", "Carrosserie", "Carburant",
            "Puissance fiscale", "Cylindrée", "Sous-classe", "PTC", "Catégorie transport",
            "Date mise en circulation", "Date validité CG", "Nombre de places",
            "Valeur à neuf", "Valeur vénale", "Valeur glace", "CRM"
    );

    private final ContratRepository contratRepository;
    private final VehiculeRepository vehiculeRepository;
    private final UsageRepository usageRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CarburantRepository carburantRepository;
    private final CategorieTransportRepository categorieTransportRepository;
    private final SousClasseRepository sousClasseRepository;
    private final TarifUsageRepository tarifUsageRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;
    private final FormuleGarantiePersonneRepository formuleGarantiePersonneRepository;

    @Transactional(readOnly = true)
    public VehiculeImportPreviewResponse preview(Long agenceId, Long contratId, MultipartFile file) {
        Contrat contrat = requireFleetDraft(agenceId, contratId);
        validateFile(file);

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new BadRequestException("Le fichier Excel ne contient aucune feuille");
            }
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(sheet.getFirstRowNum());
            if (header == null) {
                throw new BadRequestException("La ligne d'en-tête est absente");
            }
            Map<String, Integer> columns = columns(header);
            requireColumns(columns, "usage", "immatriculation", "marque", "carrosserie",
                    "datevaliditecg", "nombredeplaces", "crm");

            Set<String> existingRegistrations = new HashSet<>();
            vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contratId).stream()
                    .map(item -> normalizedRegistration(item.getImmatriculation()))
                    .filter(value -> !value.isBlank())
                    .forEach(existingRegistrations::add);
            Set<String> fileRegistrations = new HashSet<>();
            List<VehiculeImportPreviewResponse.Ligne> rows = new ArrayList<>();
            DataFormatter formatter = new DataFormatter(Locale.FRANCE);
            int firstDataRow = sheet.getFirstRowNum() + 1;
            int lastRow = Math.min(sheet.getLastRowNum(), firstDataRow + MAX_ROWS - 1);
            for (int rowIndex = firstDataRow; rowIndex <= lastRow; rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (isBlank(row, formatter)) {
                    continue;
                }
                rows.add(parseRow(contrat, row, rowIndex + 1, columns, formatter,
                        existingRegistrations, fileRegistrations));
            }
            if (sheet.getLastRowNum() >= firstDataRow + MAX_ROWS) {
                throw new BadRequestException("Le fichier dépasse la limite de " + MAX_ROWS + " véhicules");
            }
            if (rows.isEmpty()) {
                throw new BadRequestException("Le fichier ne contient aucun véhicule");
            }
            int valid = (int) rows.stream().filter(item -> item.getErreurs().isEmpty()).count();
            return VehiculeImportPreviewResponse.builder()
                    .totalLignes(rows.size())
                    .lignesValides(valid)
                    .lignesEnErreur(rows.size() - valid)
                    .lignes(rows)
                    .build();
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BadRequestException("Lecture du fichier Excel impossible");
        }
    }

    @Transactional(readOnly = true)
    public byte[] template(Long agenceId, Long contratId) {
        Contrat contrat = requireFleetDraft(agenceId, contratId);
        List<Usage> usages = allowedTemplateUsages(contrat);
        if (usages.isEmpty()) {
            throw new BadRequestException("Aucun usage n'est disponible pour la grille tarifaire et la catégorie client");
        }
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Véhicules");
            CellStyle headerStyle = workbook.createCellStyle();
            var font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);
            Row header = sheet.createRow(0);
            for (int index = 0; index < TEMPLATE_HEADERS.size(); index++) {
                Cell cell = header.createCell(index);
                cell.setCellValue(TEMPLATE_HEADERS.get(index));
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(index, Math.min(32, Math.max(14, TEMPLATE_HEADERS.get(index).length() + 4)) * 256);
            }
            Sheet references = workbook.createSheet("Références");
            addReferenceList(workbook, references, 0, "USAGES", "Usages",
                    usages.stream().map(Usage::getCode).toList());
            addReferenceList(workbook, references, 1, "MARQUES", "Marques",
                    marqueRepository.findAll().stream()
                            .filter(item -> Boolean.TRUE.equals(item.getActif()))
                            .map(item -> item.getLibelle().trim())
                            .distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList());
            addReferenceList(workbook, references, 2, "CARROSSERIES", "Carrosseries",
                    carrosserieRepository.findAll().stream()
                            .filter(item -> Boolean.TRUE.equals(item.getActif()))
                            .map(item -> item.getLibelle().trim())
                            .distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList());
            addReferenceList(workbook, references, 3, "CARBURANTS", "Carburants",
                    carburantRepository.findAll().stream()
                            .filter(item -> Boolean.TRUE.equals(item.getActif()))
                            .map(Carburant::getCode)
                            .distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList());
            addReferenceList(workbook, references, 4, "SOUS_CLASSES", "Sous-classes",
                    allowedTemplateSubclasses(usages));
            addReferenceList(workbook, references, 5, "CATEGORIES_TRANSPORT", "Catégories transport",
                    categorieTransportRepository.findByActifTrueOrderByLibelleAsc().stream()
                            .map(CategorieTransport::getCode).distinct().toList());

            addListValidation(sheet, 0, "USAGES", "Sélectionnez un usage proposé");
            addListValidation(sheet, 2, "MARQUES", "Sélectionnez une marque proposée");
            addListValidation(sheet, 3, "CARROSSERIES", "Sélectionnez une carrosserie proposée");
            addListValidation(sheet, 4, "CARBURANTS", "Sélectionnez un carburant proposé");
            addListValidation(sheet, 7, "SOUS_CLASSES", "Sélectionnez une sous-classe proposée");
            addListValidation(sheet, 9, "CATEGORIES_TRANSPORT", "Sélectionnez une catégorie proposée");
            sheet.createFreezePane(0, 1);
            workbook.setSheetHidden(workbook.getSheetIndex(references), true);
            workbook.write(output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BadRequestException("Génération du modèle Excel impossible");
        }
    }

    private Contrat requireFleetDraft(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (contrat.getTypeContrat() != TypeContrat.FLOTTE || !Boolean.TRUE.equals(contrat.getBrouillon())) {
            throw new BadRequestException("L'import est disponible uniquement pour un brouillon flotte");
        }
        return contrat;
    }

    private List<Usage> allowedTemplateUsages(Contrat contrat) {
        if (contrat.getCategorieClient() == null) {
            throw new BadRequestException("Enregistrez la catégorie client avant de télécharger le modèle");
        }
        if (contrat.getGrilleTarifaire() == null) {
            throw new BadRequestException("Enregistrez la grille tarifaire avant de télécharger le modèle");
        }
        Long gridId = contrat.getGrilleTarifaire().getId();
        Set<Long> tariffedUsageIds = new HashSet<>();
        ligneGrilleTarifaireRepository.findByGrilleTarifaireIdAndActifTrue(gridId).stream()
                .filter(item -> item.getUsage() != null)
                .map(item -> item.getUsage().getId())
                .forEach(tariffedUsageIds::add);
        formuleGarantiePersonneRepository.findByGrilleTarifaireIdInAndActifTrue(Set.of(gridId)).stream()
                .filter(item -> item.getUsage() != null)
                .map(item -> item.getUsage().getId())
                .forEach(tariffedUsageIds::add);
        Set<Long> categoryUsageIds = contrat.getCategorieClient().getUsages() == null
                ? Set.of()
                : contrat.getCategorieClient().getUsages().stream().map(Usage::getId).collect(java.util.stream.Collectors.toSet());
        return usageRepository.findAll().stream()
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .filter(item -> tariffedUsageIds.contains(item.getId()))
                .filter(item -> categoryUsageIds.isEmpty() || categoryUsageIds.contains(item.getId()))
                .sorted(Comparator.comparing(Usage::getCode, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<String> allowedTemplateSubclasses(List<Usage> usages) {
        Set<Long> usageIds = usages.stream().map(Usage::getId).collect(java.util.stream.Collectors.toSet());
        return usageIds.stream()
                .flatMap(usageId -> tarifUsageRepository.findByUsage_IdAndActifTrue(usageId).stream())
                .map(item -> item.getSousClasse())
                .filter(java.util.Objects::nonNull)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .map(SousClasse::getCode)
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private void addReferenceList(
            Workbook workbook,
            Sheet references,
            int column,
            String rangeName,
            String heading,
            List<String> values
    ) {
        Row headingRow = references.getRow(0);
        if (headingRow == null) {
            headingRow = references.createRow(0);
        }
        headingRow.createCell(column).setCellValue(heading);
        for (int index = 0; index < values.size(); index++) {
            Row row = references.getRow(index + 1) == null
                    ? references.createRow(index + 1)
                    : references.getRow(index + 1);
            row.createCell(column).setCellValue(values.get(index));
        }
        if (values.isEmpty()) {
            Row row = references.getRow(1) == null ? references.createRow(1) : references.getRow(1);
            row.createCell(column).setCellValue("");
        }
        Name name = workbook.createName();
        name.setNameName(rangeName);
        int lastRow = Math.max(2, values.size() + 1);
        String columnLetter = org.apache.poi.ss.util.CellReference.convertNumToColString(column);
        name.setRefersToFormula("'Références'!$" + columnLetter + "$2:$" + columnLetter + "$" + lastRow);
    }

    private void addListValidation(Sheet sheet, int column, String rangeName, String errorMessage) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createFormulaListConstraint(rangeName);
        DataValidation validation = helper.createValidation(
                constraint,
                new CellRangeAddressList(1, MAX_ROWS, column, column)
        );
        validation.setErrorStyle(DataValidation.ErrorStyle.STOP);
        validation.createErrorBox("Valeur invalide", errorMessage);
        validation.setShowErrorBox(true);
        validation.setSuppressDropDownArrow(false);
        sheet.addValidationData(validation);
    }

    private VehiculeImportPreviewResponse.Ligne parseRow(
            Contrat contrat,
            Row row,
            int rowNumber,
            Map<String, Integer> columns,
            DataFormatter formatter,
            Set<String> existingRegistrations,
            Set<String> fileRegistrations
    ) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String usageValue = text(row, columns, "usage", formatter);
        String registration = text(row, columns, "immatriculation", formatter).toUpperCase(Locale.ROOT);
        String brandValue = text(row, columns, "marque", formatter);
        CreateContratRequest.VehiculeInput input = new CreateContratRequest.VehiculeInput();
        input.setTypeVehicule(TypeVehiculeContrat.AUTOMOBILE);
        input.setImmatriculation(registration);
        input.setNombrePlaces(text(row, columns, "nombredeplaces", formatter));
        input.setCrm(text(row, columns, "crm", formatter));
        input.setPuissanceFiscale(optionalText(row, columns, "puissancefiscale", formatter));
        input.setCylindree(optionalText(row, columns, "cylindree", formatter));
        input.setPtc(optionalText(row, columns, "ptc", formatter));
        input.setValeurNeuf(decimal(row, columns, "valeuraneuf", formatter, "Valeur à neuf", errors));
        input.setValeurVenale(decimal(row, columns, "valeurvenale", formatter, "Valeur vénale", errors));
        input.setValeurGlace(decimal(row, columns, "valeurglace", formatter, "Valeur glace", errors));
        input.setDatePremiereCirculation(date(row, columns, "datemiseencirculation", formatter,
                "Date mise en circulation", errors));
        input.setDateExpirationCarteGrise(date(row, columns, "datevaliditecg", formatter,
                "Date validité CG", errors));

        Usage usage = resolveUsage(usageValue, errors);
        if (usage != null) {
            input.setUsageId(usage.getId());
            validateUsageContext(contrat, usage, errors);
        }
        marqueRepository.findByLibelleIgnoreCase(brandValue)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .ifPresentOrElse(item -> input.setMarqueId(item.getId()),
                        () -> errors.add("Marque inconnue ou inactive : " + display(brandValue)));
        String bodyValue = text(row, columns, "carrosserie", formatter);
        carrosserieRepository.findByLibelleIgnoreCase(bodyValue)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .ifPresentOrElse(item -> input.setCarrosserieId(item.getId()),
                        () -> errors.add("Carrosserie inconnue ou inactive : " + display(bodyValue)));

        resolveConditionalReferences(input, usage, row, columns, formatter, errors);
        validateRequired(input, usage, errors);
        String normalized = normalizedRegistration(registration);
        if (normalized.isBlank()) {
            errors.add("Immatriculation obligatoire");
        } else if (existingRegistrations.contains(normalized)) {
            errors.add("Immatriculation déjà présente dans le brouillon");
        } else if (!fileRegistrations.add(normalized)) {
            errors.add("Immatriculation en double dans le fichier");
        }
        if (input.getValeurVenale() != null && input.getValeurNeuf() != null
                && input.getValeurVenale().compareTo(input.getValeurNeuf()) > 0) {
            errors.add("La valeur vénale ne peut pas dépasser la valeur à neuf");
        }
        return VehiculeImportPreviewResponse.Ligne.builder()
                .numeroLigne(rowNumber)
                .immatriculation(registration)
                .usage(usage == null ? usageValue : usage.getCode() + " - " + usage.getLibelle())
                .marque(brandValue)
                .vehicule(errors.isEmpty() ? input : null)
                .erreurs(errors)
                .avertissements(warnings)
                .build();
    }

    private void resolveConditionalReferences(CreateContratRequest.VehiculeInput input, Usage usage, Row row,
                                               Map<String, Integer> columns, DataFormatter formatter,
                                               List<String> errors) {
        String fuelValue = optionalText(row, columns, "carburant", formatter);
        if (fuelValue != null) {
            Carburant fuel = carburantRepository.findByCodeIgnoreCase(fuelValue)
                    .or(() -> carburantRepository.findByLibelleIgnoreCase(fuelValue))
                    .filter(item -> Boolean.TRUE.equals(item.getActif()))
                    .orElse(null);
            if (fuel == null) errors.add("Carburant inconnu ou inactif : " + fuelValue);
            else input.setCarburant(fuel.getLibelle());
        }
        String transportValue = optionalText(row, columns, "categorietransport", formatter);
        if (transportValue != null) {
            CategorieTransport category = categorieTransportRepository.findByCodeIgnoreCase(transportValue)
                    .filter(item -> Boolean.TRUE.equals(item.getActif())).orElse(null);
            if (category == null) errors.add("Catégorie transport inconnue ou inactive : " + transportValue);
            else input.setCategorieTransportId(category.getId());
        }
        String subclassValue = optionalText(row, columns, "sousclasse", formatter);
        if (subclassValue != null) {
            SousClasse subclass = sousClasseRepository.findByCodeIgnoreCase(subclassValue)
                    .filter(item -> Boolean.TRUE.equals(item.getActif())).orElse(null);
            if (subclass == null) {
                errors.add("Sous-classe inconnue ou inactive : " + subclassValue);
            } else {
                input.setSousClasse(subclass.getCode());
                if (usage != null && tarifUsageRepository.findByUsage_IdAndActifTrue(usage.getId()).stream()
                        .noneMatch(item -> item.getSousClasse() != null
                                && item.getSousClasse().getId().equals(subclass.getId()))) {
                    errors.add("Sous-classe non tarifée pour l'usage " + usage.getCode());
                }
                if (subclass.getChampMoteur() == ChampMoteurSousClasse.CYLINDREE && blank(input.getCylindree())) {
                    errors.add("Cylindrée obligatoire pour cette sous-classe");
                }
                if (subclass.getChampMoteur() != ChampMoteurSousClasse.CYLINDREE && blank(input.getPuissanceFiscale())) {
                    errors.add("Puissance fiscale obligatoire pour cette sous-classe");
                }
            }
        }
    }

    private void validateRequired(CreateContratRequest.VehiculeInput input, Usage usage, List<String> errors) {
        if (blank(input.getNombrePlaces())) errors.add("Nombre de places obligatoire");
        if (blank(input.getCrm())) errors.add("CRM obligatoire");
        if (input.getDateExpirationCarteGrise() == null) errors.add("Date validité CG obligatoire");
        if (usage == null) return;
        if (Boolean.TRUE.equals(usage.getByCarburant()) && blank(input.getCarburant())) errors.add("Carburant obligatoire pour cet usage");
        if (Boolean.TRUE.equals(usage.getByPuissanceFiscale()) && blank(input.getPuissanceFiscale())) errors.add("Puissance fiscale obligatoire pour cet usage");
        if (Boolean.TRUE.equals(usage.getBySousClasse()) && blank(input.getSousClasse())) errors.add("Sous-classe obligatoire pour cet usage");
        if (Boolean.TRUE.equals(usage.getByPtc()) && blank(input.getPtc())) errors.add("PTC obligatoire pour cet usage");
        if (Boolean.TRUE.equals(usage.getByCategorieTransport()) && input.getCategorieTransportId() == null) errors.add("Catégorie transport obligatoire pour cet usage");
    }

    private Usage resolveUsage(String value, List<String> errors) {
        if (value.isBlank()) {
            errors.add("Usage obligatoire");
            return null;
        }
        Usage usage = usageRepository.findByCodeIgnoreCase(value)
                .or(() -> usageRepository.findByLibelleIgnoreCase(value))
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElse(null);
        if (usage == null) errors.add("Usage inconnu ou inactif : " + value);
        return usage;
    }

    private void validateUsageContext(Contrat contrat, Usage usage, List<String> errors) {
        if (contrat.getCategorieClient() == null) {
            errors.add("La catégorie client doit être enregistrée avant l'import");
        } else if (!Boolean.TRUE.equals(contrat.getCategorieClient().getActif())) {
            errors.add("La catégorie client du contrat est inactive");
        } else if (contrat.getCategorieClient().getUsages() != null
                && !contrat.getCategorieClient().getUsages().isEmpty()
                && contrat.getCategorieClient().getUsages().stream()
                .noneMatch(allowed -> allowed.getId().equals(usage.getId()))) {
            errors.add("Usage non autorisé pour la catégorie client");
        }
        if (contrat.getGrilleTarifaire() == null) {
            errors.add("La grille tarifaire doit être enregistrée avant l'import");
            return;
        }
        Long gridId = contrat.getGrilleTarifaire().getId();
        boolean tariffed = !ligneGrilleTarifaireRepository
                .findByGrilleTarifaireIdAndUsageIdAndActifTrue(gridId, usage.getId()).isEmpty()
                || !formuleGarantiePersonneRepository
                .findByGrilleTarifaireIdAndUsageIdAndActifTrue(gridId, usage.getId()).isEmpty();
        if (!tariffed) {
            errors.add("Usage non configuré dans la grille tarifaire sélectionnée");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BadRequestException("Sélectionnez un fichier Excel");
        if (file.getSize() > MAX_FILE_SIZE) throw new BadRequestException("Le fichier Excel ne doit pas dépasser 5 Mo");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
            throw new BadRequestException("Formats acceptés : XLSX et XLS");
        }
    }

    private Map<String, Integer> columns(Row header) {
        Map<String, Integer> columns = new LinkedHashMap<>();
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        for (Cell cell : header) columns.put(normalize(formatter.formatCellValue(cell)), cell.getColumnIndex());
        return columns;
    }

    private void requireColumns(Map<String, Integer> columns, String... required) {
        List<String> missing = new ArrayList<>();
        for (String column : required) if (!columns.containsKey(column)) missing.add(column);
        if (!missing.isEmpty()) throw new BadRequestException("Colonnes obligatoires absentes : " + String.join(", ", missing));
    }

    private String text(Row row, Map<String, Integer> columns, String key, DataFormatter formatter) {
        Integer index = columns.get(key);
        return index == null ? "" : formatter.formatCellValue(row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL)).trim();
    }

    private String optionalText(Row row, Map<String, Integer> columns, String key, DataFormatter formatter) {
        String value = text(row, columns, key, formatter);
        return value.isBlank() ? null : value;
    }

    private LocalDate date(Row row, Map<String, Integer> columns, String key, DataFormatter formatter,
                           String label, List<String> errors) {
        Integer index = columns.get(key);
        if (index == null) return null;
        Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        String value = formatter.formatCellValue(cell).trim();
        if (value.isBlank()) return null;
        for (DateTimeFormatter candidate : List.of(DATE_FORMAT, DateTimeFormatter.ISO_LOCAL_DATE)) {
            try { return LocalDate.parse(value, candidate); } catch (DateTimeParseException ignored) { }
        }
        errors.add(label + " invalide (format attendu JJ/MM/AAAA)");
        return null;
    }

    private BigDecimal decimal(Row row, Map<String, Integer> columns, String key, DataFormatter formatter,
                               String label, List<String> errors) {
        String value = optionalText(row, columns, key, formatter);
        if (value == null) return null;
        try {
            return new BigDecimal(value.replace(" ", "").replace("\u00a0", "").replace(',', '.'));
        } catch (NumberFormatException exception) {
            errors.add(label + " invalide");
            return null;
        }
    }

    private boolean isBlank(Row row, DataFormatter formatter) {
        if (row == null) return true;
        for (Cell cell : row) if (!formatter.formatCellValue(cell).trim().isBlank()) return false;
        return true;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String normalizedRegistration(String value) {
        return normalize(value);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String display(String value) {
        return value == null || value.isBlank() ? "valeur vide" : value;
    }
}
