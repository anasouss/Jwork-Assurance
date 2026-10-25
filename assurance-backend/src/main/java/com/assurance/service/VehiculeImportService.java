package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.response.AttestationNumeroValidationResponse;
import com.assurance.dto.response.VehiculeImportPreviewResponse;
import com.assurance.entity.Carburant;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.SousClasse;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.ChampMoteurSousClasse;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.ModeTermeRenouvellement;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import com.assurance.enums.TypeVehiculeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.CarburantRepository;
import com.assurance.repository.CarrosserieRepository;
import com.assurance.repository.CategorieTransportRepository;
import com.assurance.repository.ContratGarantieRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.FormuleGarantiePersonneRepository;
import com.assurance.repository.GarantieRepository;
import com.assurance.repository.LigneGrilleTarifaireRepository;
import com.assurance.repository.MarqueRepository;
import com.assurance.repository.SousClasseRepository;
import com.assurance.repository.TarifUsageRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Name;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellAddress;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;
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
    private static final int STYLED_TEMPLATE_ROWS = 100;
    private static final String VEHICLE_SHEET = "Véhicules";
    private static final String GUARANTEE_SHEET = "Garanties";
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<String> TEMPLATE_HEADERS = List.of(
            "Usage", "Immatriculation", "N° attestation", "Marque", "Carrosserie", "Carburant",
            "Puissance fiscale", "Cylindrée", "Sous-classe", "PTC", "Catégorie transport",
            "Date mise en circulation", "Date validité CG", "Nombre de places",
            "Valeur à neuf", "Valeur vénale", "Valeur glace", "CRM"
    );

    private final ContratRepository contratRepository;
    private final ContratGarantieRepository contratGarantieRepository;
    private final VehiculeRepository vehiculeRepository;
    private final GarantieRepository garantieRepository;
    private final UsageRepository usageRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CarburantRepository carburantRepository;
    private final CategorieTransportRepository categorieTransportRepository;
    private final SousClasseRepository sousClasseRepository;
    private final TarifUsageRepository tarifUsageRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;
    private final FormuleGarantiePersonneRepository formuleGarantiePersonneRepository;
    private final AttestationStockService attestationStockService;

    @Transactional(readOnly = true)
    public VehiculeImportPreviewResponse preview(Long agenceId, Long contratId, MultipartFile file) {
        Contrat contrat = requireFleetDraft(agenceId, contratId);
        validateFile(file);

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new BadRequestException("Le fichier Excel ne contient aucune feuille");
            }
            Sheet sheet = workbook.getSheet(VEHICLE_SHEET);
            if (sheet == null) {
                sheet = workbook.getSheetAt(0);
            }
            Row header = sheet.getRow(sheet.getFirstRowNum());
            if (header == null) {
                throw new BadRequestException("La ligne d'en-tête est absente");
            }
            Map<String, Integer> columns = columns(header);
            requireColumns(columns, "usage", "immatriculation", "marque", "carrosserie",
                    "datevaliditecg", "nombredeplaces", "crm");

            List<Vehicule> existingVehicles = vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contratId);
            Set<String> existingRegistrations = new HashSet<>();
            existingVehicles.stream()
                    .map(item -> normalizedRegistration(item.getImmatriculation()))
                    .filter(value -> !value.isBlank())
                    .forEach(existingRegistrations::add);
            Set<String> existingAttestations = new HashSet<>();
            existingVehicles.stream()
                    .map(Vehicule::getNumeroAttestation)
                    .filter(value -> !blank(value))
                    .map(this::normalize)
                    .forEach(existingAttestations::add);
            Set<String> fileRegistrations = new HashSet<>();
            Set<String> fileAttestations = new HashSet<>();
            List<VehiculeImportPreviewResponse.Ligne> rows = new ArrayList<>();
            DataFormatter formatter = new DataFormatter(Locale.FRANCE);
            int firstDataRow = sheet.getFirstRowNum() + 1;
            int lastRow = Math.min(sheet.getLastRowNum(), firstDataRow + MAX_ROWS - 1);
            for (int rowIndex = firstDataRow; rowIndex <= lastRow; rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (isBlank(row, formatter)) {
                    continue;
                }
                rows.add(parseRow(agenceId, contrat, row, rowIndex + 1, columns, formatter,
                        existingRegistrations, fileRegistrations, existingAttestations, fileAttestations));
            }
            if (sheet.getLastRowNum() >= firstDataRow + MAX_ROWS) {
                throw new BadRequestException("Le fichier dépasse la limite de " + MAX_ROWS + " véhicules");
            }
            if (rows.isEmpty()) {
                throw new BadRequestException("Le fichier ne contient aucun véhicule");
            }
            int valid = (int) rows.stream().filter(item -> item.getErreurs().isEmpty()).count();
            GuaranteePreview guaranteePreview = parseGuarantees(workbook, contrat, rows);
            return VehiculeImportPreviewResponse.builder()
                    .totalLignes(rows.size())
                    .lignesValides(valid)
                    .lignesEnErreur(rows.size() - valid)
                    .lignes(rows)
                    .totalLignesGaranties(guaranteePreview.rows().size())
                    .lignesGarantiesValides(guaranteePreview.validRows())
                    .lignesGarantiesEnErreur(guaranteePreview.rows().size() - guaranteePreview.validRows())
                    .garanties(guaranteePreview.guarantees())
                    .lignesGaranties(guaranteePreview.rows())
                    .build();
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BadRequestException("Lecture du fichier Excel impossible");
        }
    }

    @Transactional(readOnly = true)
    public byte[] template(Long agenceId, Long contratId) {
        Contrat contrat = requireFleetContract(agenceId, contratId);
        return createWorkbook(contrat, List.of(), List.of(), "Génération du modèle Excel impossible");
    }

    @Transactional(readOnly = true)
    public byte[] exportSubmittedVehicles(Long agenceId, Long contratId) {
        Contrat contrat = requireFleetContract(agenceId, contratId);
        List<Vehicule> vehicles = vehiculeRepository.findForExportByContratIdOrderByCreatedAtAsc(contratId);
        if (vehicles.isEmpty()) {
            throw new BadRequestException("Aucun véhicule enregistré à exporter");
        }
        List<ContratGarantie> guarantees = contratGarantieRepository.findActiveByContratId(contratId);
        return createWorkbook(contrat, vehicles, guarantees, "Export des véhicules impossible");
    }

    private byte[] createWorkbook(
            Contrat contrat,
            List<Vehicule> vehicles,
            List<ContratGarantie> selectedGuarantees,
            String errorMessage
    ) {
        List<Usage> usages = generalWorkbookUsages(vehicles);
        if (usages.isEmpty()) {
            throw new BadRequestException("Aucun usage actif n'est disponible");
        }
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(VEHICLE_SHEET);
            CellStyle headerStyle = createHeaderStyle(workbook, IndexedColors.DARK_GREEN);
            CellStyle inputStyle = createInputStyle(workbook);
            CellStyle amountStyle = workbook.createCellStyle();
            amountStyle.cloneStyleFrom(inputStyle);
            amountStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            Row header = sheet.createRow(0);
            header.setHeightInPoints(32);
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
                    generalWorkbookSubclasses(vehicles));
            addReferenceList(workbook, references, 5, "CATEGORIES_TRANSPORT", "Catégories transport",
                    categorieTransportRepository.findByActifTrueOrderByLibelleAsc().stream()
                            .map(CategorieTransport::getCode).distinct().toList());

            addListValidation(sheet, 0, "USAGES", "Sélectionnez un usage proposé");
            addListValidation(sheet, 3, "MARQUES", "Sélectionnez une marque proposée");
            addListValidation(sheet, 4, "CARROSSERIES", "Sélectionnez une carrosserie proposée");
            addListValidation(sheet, 5, "CARBURANTS", "Sélectionnez un carburant proposé");
            addListValidation(sheet, 8, "SOUS_CLASSES", "Sélectionnez une sous-classe proposée");
            addListValidation(sheet, 10, "CATEGORIES_TRANSPORT", "Sélectionnez une catégorie proposée");
            Map<String, String> fuelCodes = fuelCodesByValue();
            for (int index = 0; index < vehicles.size(); index++) {
                writeVehicleRow(sheet.createRow(index + 1), vehicles.get(index), fuelCodes);
            }
            styleInputRows(sheet, inputStyle, amountStyle,
                    Math.max(STYLED_TEMPLATE_ROWS, vehicles.size()));
            sheet.setDisplayGridlines(false);
            sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, TEMPLATE_HEADERS.size() - 1));
            sheet.createFreezePane(0, 1);
            sheet.setActiveCell(new CellAddress(1, 0));
            createGuaranteeSheet(workbook, contrat, vehicles, selectedGuarantees, headerStyle, inputStyle);
            workbook.setSheetHidden(workbook.getSheetIndex(references), true);
            workbook.write(output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BadRequestException(errorMessage);
        }
    }

    private void createGuaranteeSheet(
            Workbook workbook,
            Contrat contrat,
            List<Vehicule> vehicles,
            List<ContratGarantie> selectedGuarantees,
            CellStyle headerStyle,
            CellStyle inputStyle
    ) {
        Map<Long, Garantie> guaranteesById = new LinkedHashMap<>();
        availableGuarantees(contrat).forEach(guarantee -> guaranteesById.put(guarantee.getId(), guarantee));
        selectedGuarantees.stream()
                .map(ContratGarantie::getGarantie)
                .filter(java.util.Objects::nonNull)
                .forEach(guarantee -> guaranteesById.putIfAbsent(guarantee.getId(), guarantee));
        List<Garantie> guarantees = new ArrayList<>(guaranteesById.values());
        Sheet sheet = workbook.createSheet(GUARANTEE_SHEET);
        Row header = sheet.createRow(0);
        header.setHeightInPoints(32);
        Cell registrationHeader = header.createCell(0);
        registrationHeader.setCellValue("Immatriculation");
        registrationHeader.setCellStyle(headerStyle);
        sheet.setColumnWidth(0, 22 * 256);

        for (int index = 0; index < guarantees.size(); index++) {
            Garantie guarantee = guarantees.get(index);
            Cell cell = header.createCell(index + 1);
            cell.setCellValue(guarantee.getCode() + " - " + guarantee.getLibelle());
            cell.setCellStyle(headerStyle);
            sheet.setColumnWidth(index + 1, 24 * 256);
        }

        Map<Long, Set<Long>> selectedByVehicle = new LinkedHashMap<>();
        for (ContratGarantie selected : selectedGuarantees) {
            if (selected.getVehicule() != null && selected.getGarantie() != null) {
                selectedByVehicle.computeIfAbsent(selected.getVehicule().getId(), ignored -> new HashSet<>())
                        .add(selected.getGarantie().getId());
            }
        }

        int rowCount = Math.max(STYLED_TEMPLATE_ROWS, vehicles.size());
        DataValidationHelper validationHelper = sheet.getDataValidationHelper();
        DataValidationConstraint yesNoConstraint = validationHelper.createExplicitListConstraint(new String[]{"Oui", "Non"});
        if (!guarantees.isEmpty()) {
            DataValidation validation = validationHelper.createValidation(
                    yesNoConstraint,
                    new CellRangeAddressList(1, MAX_ROWS, 1, guarantees.size())
            );
            validation.setErrorStyle(DataValidation.ErrorStyle.STOP);
            validation.createErrorBox("Valeur invalide", "Sélectionnez Oui ou Non");
            validation.setShowErrorBox(true);
            validation.setSuppressDropDownArrow(true);
            sheet.addValidationData(validation);
        }

        for (int rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            Row row = sheet.createRow(rowIndex + 1);
            row.setHeightInPoints(22);
            Cell registration = row.createCell(0);
            if (rowIndex < vehicles.size()) {
                registration.setCellValue(vehicles.get(rowIndex).getImmatriculation());
            } else {
                registration.setCellFormula("IF('" + VEHICLE_SHEET + "'!B" + (rowIndex + 2)
                        + "=\"\",\"\",'" + VEHICLE_SHEET + "'!B" + (rowIndex + 2) + ")");
            }
            registration.setCellStyle(inputStyle);
            for (int guaranteeIndex = 0; guaranteeIndex < guarantees.size(); guaranteeIndex++) {
                Garantie guarantee = guarantees.get(guaranteeIndex);
                Cell cell = row.createCell(guaranteeIndex + 1);
                boolean selected = rowIndex < vehicles.size()
                        && selectedByVehicle.getOrDefault(vehicles.get(rowIndex).getId(), Set.of()).contains(guarantee.getId());
                if (selected) {
                    cell.setCellValue("Oui");
                } else if (rowIndex < vehicles.size()) {
                    cell.setCellValue("Non");
                } else if (Boolean.TRUE.equals(guarantee.getResponsabiliteCivile())) {
                    cell.setCellFormula("IF(A" + (rowIndex + 2) + "=\"\",\"\",\"Oui\")");
                }
                cell.setCellStyle(inputStyle);
            }
        }
        sheet.setDisplayGridlines(false);
        sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, guarantees.size()));
        sheet.createFreezePane(1, 1);
    }

    private List<Garantie> availableGuarantees(Contrat contrat) {
        Set<Long> tariffGuaranteeIds = contrat.getGrilleTarifaire() == null
                ? Set.of()
                : ligneGrilleTarifaireRepository
                .findByGrilleTarifaireIdAndActifTrue(contrat.getGrilleTarifaire().getId()).stream()
                .map(LigneGrilleTarifaire::getGarantie)
                .filter(java.util.Objects::nonNull)
                .map(Garantie::getId)
                .collect(java.util.stream.Collectors.toSet());
        return garantieRepository.findAll(Sort.by("ordreAffichage", "code")).stream()
                .filter(guarantee -> Boolean.TRUE.equals(guarantee.getActif()))
                .filter(guarantee -> guarantee.getTypeGarantie() != TypeGarantie.PERSONNE)
                .filter(guarantee -> guarantee.getBrancheAssurance() != null
                        && "AUTOMOBILE".equalsIgnoreCase(guarantee.getBrancheAssurance().getCode()))
                .filter(guarantee -> contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE
                        || tariffGuaranteeIds.isEmpty()
                        || tariffGuaranteeIds.contains(guarantee.getId())
                        || Boolean.TRUE.equals(guarantee.getResponsabiliteCivile()))
                .toList();
    }

    private GuaranteePreview parseGuarantees(
            Workbook workbook,
            Contrat contrat,
            List<VehiculeImportPreviewResponse.Ligne> vehicleRows
    ) {
        Sheet sheet = workbook.getSheet(GUARANTEE_SHEET);
        if (sheet == null) {
            return new GuaranteePreview(List.of(), List.of(), 0);
        }
        Row header = sheet.getRow(sheet.getFirstRowNum());
        if (header == null) {
            throw new BadRequestException("La ligne d'en-tête de la feuille Garanties est absente");
        }
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
        Map<String, Garantie> guaranteesByHeader = new LinkedHashMap<>();
        for (Garantie guarantee : availableGuarantees(contrat)) {
            guaranteesByHeader.put(normalize(guarantee.getCode()), guarantee);
            guaranteesByHeader.put(normalize(guarantee.getCode() + " - " + guarantee.getLibelle()), guarantee);
        }
        Map<Integer, Garantie> guaranteeColumns = new LinkedHashMap<>();
        Set<Long> guaranteeHeaderIds = new HashSet<>();
        int registrationColumn = -1;
        for (Cell cell : header) {
            String value = formatter.formatCellValue(cell, evaluator).trim();
            if (normalize(value).equals("immatriculation")) {
                registrationColumn = cell.getColumnIndex();
                continue;
            }
            if (value.isBlank()) {
                continue;
            }
            Garantie guarantee = guaranteesByHeader.get(normalize(value));
            if (guarantee == null) {
                throw new BadRequestException("Colonne de garantie inconnue ou non disponible : " + value);
            }
            if (!guaranteeHeaderIds.add(guarantee.getId())) {
                throw new BadRequestException("Colonne de garantie en double : " + guarantee.getCode());
            }
            guaranteeColumns.put(cell.getColumnIndex(), guarantee);
        }
        if (registrationColumn < 0) {
            throw new BadRequestException("Colonne obligatoire absente dans Garanties : Immatriculation");
        }

        Map<String, VehicleMatch> vehiclesByRegistration = new LinkedHashMap<>();
        int validVehicleIndex = 0;
        for (VehiculeImportPreviewResponse.Ligne row : vehicleRows) {
            if (row.getVehicule() != null) {
                vehiclesByRegistration.put(
                        normalizedRegistration(row.getImmatriculation()),
                        new VehicleMatch(validVehicleIndex++, row.getVehicule())
                );
            }
        }
        List<LigneGrilleTarifaire> tariffLines = contrat.getGrilleTarifaire() == null
                ? List.of()
                : ligneGrilleTarifaireRepository.findByGrilleTarifaireIdAndActifTrue(contrat.getGrilleTarifaire().getId());
        List<CreateContratRequest.GarantieInput> selections = new ArrayList<>();
        List<VehiculeImportPreviewResponse.LigneGaranties> rows = new ArrayList<>();
        Set<String> seenRegistrations = new HashSet<>();
        int firstDataRow = sheet.getFirstRowNum() + 1;
        int lastRow = Math.min(sheet.getLastRowNum(), firstDataRow + MAX_ROWS - 1);
        for (int rowIndex = firstDataRow; rowIndex <= lastRow; rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (isGuaranteeRowBlank(row, registrationColumn, guaranteeColumns.keySet(), formatter, evaluator)) {
                continue;
            }
            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            String registration = formatted(
                    row.getCell(registrationColumn, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL), formatter, evaluator
            ).toUpperCase(Locale.ROOT);
            String normalizedRegistration = normalizedRegistration(registration);
            VehicleMatch vehicle = vehiclesByRegistration.get(normalizedRegistration);
            if (normalizedRegistration.isBlank()) {
                errors.add("Immatriculation obligatoire");
            } else if (!seenRegistrations.add(normalizedRegistration)) {
                errors.add("Immatriculation en double dans la feuille Garanties");
            } else if (vehicle == null) {
                errors.add("Véhicule absent ou invalide dans la feuille Véhicules");
            }

            List<String> selectedCodes = new ArrayList<>();
            Map<Long, Garantie> exclusionGroups = new LinkedHashMap<>();
            for (Map.Entry<Integer, Garantie> entry : guaranteeColumns.entrySet()) {
                String raw = formatted(
                        row.getCell(entry.getKey(), Row.MissingCellPolicy.RETURN_BLANK_AS_NULL), formatter, evaluator
                );
                Boolean selected = parseYesNo(raw);
                if (selected == null) {
                    errors.add(entry.getValue().getCode() + " : utilisez Oui ou Non");
                    continue;
                }
                if (!selected) {
                    continue;
                }
                Garantie guarantee = entry.getValue();
                selectedCodes.add(guarantee.getCode());
                if (guarantee.getGroupeExclusion() != null) {
                    Garantie conflict = exclusionGroups.putIfAbsent(guarantee.getGroupeExclusion().getId(), guarantee);
                    if (conflict != null) {
                        errors.add(conflict.getCode() + " et " + guarantee.getCode() + " sont incompatibles");
                    }
                }
                if (vehicle != null
                        && contrat.getModeSaisieGaranties() == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE
                        && !Boolean.TRUE.equals(guarantee.getResponsabiliteCivile())
                        && !hasTariffLine(tariffLines, guarantee, vehicle.input())) {
                    errors.add("Aucun tarif applicable pour " + guarantee.getCode() + " et l'usage du véhicule");
                    continue;
                }
                if (vehicle != null) {
                    selections.add(toGuaranteeInput(guarantee, vehicle));
                }
            }
            if (selectedCodes.isEmpty()) {
                warnings.add("Aucune garantie sélectionnée");
            }
            rows.add(VehiculeImportPreviewResponse.LigneGaranties.builder()
                    .numeroLigne(rowIndex + 1)
                    .immatriculation(registration)
                    .nombreGaranties(selectedCodes.size())
                    .codesGaranties(selectedCodes)
                    .erreurs(errors)
                    .avertissements(warnings)
                    .build());
        }
        if (sheet.getLastRowNum() >= firstDataRow + MAX_ROWS) {
            throw new BadRequestException("La feuille Garanties dépasse la limite de " + MAX_ROWS + " véhicules");
        }
        int validRows = (int) rows.stream().filter(row -> row.getErreurs().isEmpty()).count();
        return new GuaranteePreview(selections, rows, validRows);
    }

    private boolean isGuaranteeRowBlank(
            Row row,
            int registrationColumn,
            Set<Integer> guaranteeColumns,
            DataFormatter formatter,
            FormulaEvaluator evaluator
    ) {
        if (row == null) {
            return true;
        }
        if (!formatted(row.getCell(registrationColumn, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL), formatter, evaluator).isBlank()) {
            return false;
        }
        return guaranteeColumns.stream().allMatch(column -> formatted(
                row.getCell(column, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL), formatter, evaluator
        ).isBlank());
    }

    private String formatted(Cell cell, DataFormatter formatter, FormulaEvaluator evaluator) {
        return cell == null ? "" : formatter.formatCellValue(cell, evaluator).trim();
    }

    private Boolean parseYesNo(String raw) {
        if (raw == null || raw.isBlank() || "non".equals(normalize(raw)) || "0".equals(raw.trim())) {
            return false;
        }
        if (Set.of("oui", "x", "1", "yes").contains(normalize(raw))) {
            return true;
        }
        return null;
    }

    private boolean hasTariffLine(
            List<LigneGrilleTarifaire> tariffLines,
            Garantie guarantee,
            CreateContratRequest.VehiculeInput vehicle
    ) {
        return tariffLines.stream().anyMatch(line -> line.getGarantie() != null
                && guarantee.getId().equals(line.getGarantie().getId())
                && (line.getUsage() == null || line.getUsage().getId().equals(vehicle.getUsageId()))
                && (line.getCategorieTransport() == null
                || line.getCategorieTransport().getId().equals(vehicle.getCategorieTransportId())));
    }

    private CreateContratRequest.GarantieInput toGuaranteeInput(Garantie guarantee, VehicleMatch vehicle) {
        CreateContratRequest.GarantieInput input = new CreateContratRequest.GarantieInput();
        input.setGarantieId(guarantee.getId());
        input.setVehiculeIndex(vehicle.index());
        input.setModeSelectionne(guarantee.getModeParDefaut() == null
                ? ModeTarificationGarantie.TAUX.name()
                : guarantee.getModeParDefaut().name());
        input.setSourceValeurSelectionnee(defaultValueSource(guarantee, vehicle.input()).name());
        input.setValeurVenale(vehicle.input().getValeurVenale());
        input.setValeurNeuf(vehicle.input().getValeurNeuf());
        input.setValeurGlace(vehicle.input().getValeurGlace());
        return input;
    }

    private SourceValeurGarantie defaultValueSource(
            Garantie guarantee,
            CreateContratRequest.VehiculeInput vehicle
    ) {
        SourceValeurGarantie configured = guarantee.getSourceValeurParDefaut();
        if (!Boolean.TRUE.equals(guarantee.getAvecCapital())) {
            return SourceValeurGarantie.AUCUNE;
        }
        if (configured != null && sourceAvailable(configured, vehicle)) {
            return configured;
        }
        List<SourceValeurGarantie> available = guarantee.getSourcesValeurAutorisees().stream()
                .filter(source -> source == SourceValeurGarantie.VENALE
                        || source == SourceValeurGarantie.NEUF
                        || source == SourceValeurGarantie.GLACE)
                .filter(source -> sourceAvailable(source, vehicle))
                .toList();
        if (available.size() == 1) {
            return available.get(0);
        }
        if (available.isEmpty() && Boolean.TRUE.equals(guarantee.getSaisieManuelleAutorisee())) {
            return SourceValeurGarantie.MANUEL;
        }
        return SourceValeurGarantie.AUCUNE;
    }

    private boolean sourceAvailable(SourceValeurGarantie source, CreateContratRequest.VehiculeInput vehicle) {
        return switch (source) {
            case VENALE -> vehicle.getValeurVenale() != null;
            case NEUF -> vehicle.getValeurNeuf() != null;
            case GLACE -> vehicle.getValeurGlace() != null;
            case MANUEL, AUCUNE -> true;
        };
    }

    private CellStyle createHeaderStyle(Workbook workbook, IndexedColors fillColor) {
        CellStyle style = workbook.createCellStyle();
        var font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(fillColor.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        applyBorders(style, IndexedColors.WHITE.getIndex());
        return style;
    }

    private CellStyle createInputStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorders(style, IndexedColors.GREY_40_PERCENT.getIndex());
        return style;
    }

    private void applyBorders(CellStyle style, short color) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(color);
        style.setRightBorderColor(color);
        style.setBottomBorderColor(color);
        style.setLeftBorderColor(color);
    }

    private void styleInputRows(
            Sheet sheet,
            CellStyle inputStyle,
            CellStyle amountStyle,
            int rowCount
    ) {
        for (int rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) {
                row = sheet.createRow(rowIndex);
            }
            row.setHeightInPoints(22);
            for (int column = 0; column < TEMPLATE_HEADERS.size(); column++) {
                Cell cell = row.getCell(column, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
                if (column >= 14 && column <= 16) {
                    cell.setCellStyle(amountStyle);
                } else {
                    cell.setCellStyle(inputStyle);
                }
            }
        }
    }

    private void writeVehicleRow(Row row, Vehicule vehicle, Map<String, String> fuelCodes) {
        setText(row, 0, vehicle.getUsage() == null ? null : vehicle.getUsage().getCode());
        setText(row, 1, vehicle.getImmatriculation());
        setText(row, 2, vehicle.getNumeroAttestation());
        setText(row, 3, vehicle.getMarque() == null ? null : vehicle.getMarque().getLibelle());
        setText(row, 4, vehicle.getCarrosserie() == null ? null : vehicle.getCarrosserie().getLibelle());
        setText(row, 5, exportFuel(vehicle.getCarburant(), fuelCodes));
        setText(row, 6, vehicle.getPuissanceFiscale());
        setText(row, 7, vehicle.getCylindree());
        setText(row, 8, vehicle.getSousClasse());
        setText(row, 9, vehicle.getPtc());
        setText(row, 10, vehicle.getCategorieTransport() == null ? null : vehicle.getCategorieTransport().getCode());
        setDate(row, 11, vehicle.getDatePremiereCirculation());
        setDate(row, 12, vehicle.getDateExpirationCarteGrise());
        setText(row, 13, vehicle.getNombrePlaces());
        setNumber(row, 14, vehicle.getValeurNeuf());
        setNumber(row, 15, vehicle.getValeurVenale());
        setNumber(row, 16, vehicle.getValeurGlace());
        setText(row, 17, vehicle.getCrm());
    }

    private Map<String, String> fuelCodesByValue() {
        Map<String, String> fuelCodes = new LinkedHashMap<>();
        for (Carburant fuel : carburantRepository.findAll()) {
            fuelCodes.putIfAbsent(normalize(fuel.getCode()), fuel.getCode());
            fuelCodes.putIfAbsent(normalize(fuel.getLibelle()), fuel.getCode());
        }
        return fuelCodes;
    }

    private String exportFuel(String value, Map<String, String> fuelCodes) {
        if (blank(value)) {
            return null;
        }
        return fuelCodes.getOrDefault(normalize(value), value);
    }

    private void setText(Row row, int column, String value) {
        if (!blank(value)) {
            row.createCell(column).setCellValue(value);
        }
    }

    private void setDate(Row row, int column, LocalDate value) {
        if (value != null) {
            row.createCell(column).setCellValue(value.format(DATE_FORMAT));
        }
    }

    private void setNumber(Row row, int column, BigDecimal value) {
        if (value != null) {
            row.createCell(column).setCellValue(value.doubleValue());
        }
    }

    private Contrat requireFleetDraft(Long agenceId, Long contratId) {
        Contrat contrat = requireFleetContract(agenceId, contratId);
        if (!Boolean.TRUE.equals(contrat.getBrouillon()) && !Boolean.TRUE.equals(contrat.getProspection())) {
            throw new BadRequestException("L'analyse et l'import sont disponibles uniquement pendant la préparation d'un contrat flotte");
        }
        return contrat;
    }

    private Contrat requireFleetContract(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (contrat.getTypeContrat() != TypeContrat.FLOTTE) {
            throw new BadRequestException("Cette opération est disponible uniquement pour un contrat flotte");
        }
        return contrat;
    }

    private List<Usage> generalWorkbookUsages(List<Vehicule> vehicles) {
        Map<Long, Usage> usagesById = new LinkedHashMap<>();
        usageRepository.findAll().stream()
                .filter(usage -> Boolean.TRUE.equals(usage.getActif()))
                .forEach(usage -> usagesById.putIfAbsent(usage.getId(), usage));
        vehicles.stream()
                .map(Vehicule::getUsage)
                .filter(java.util.Objects::nonNull)
                .forEach(usage -> usagesById.putIfAbsent(usage.getId(), usage));
        return usagesById.values().stream()
                .sorted(Comparator.comparing(Usage::getCode, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<String> generalWorkbookSubclasses(List<Vehicule> vehicles) {
        Set<String> codes = new HashSet<>();
        sousClasseRepository.findAll().stream()
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .map(SousClasse::getCode)
                .filter(code -> !blank(code))
                .forEach(codes::add);
        vehicles.stream()
                .map(Vehicule::getSousClasse)
                .filter(code -> !blank(code))
                .forEach(codes::add);
        return codes.stream()
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
        validation.createPromptBox("Liste de valeurs", errorMessage);
        validation.setShowErrorBox(true);
        validation.setShowPromptBox(true);
        // For XSSF, true writes showDropDown="false"; Excel uses that value to display the arrow.
        validation.setSuppressDropDownArrow(true);
        sheet.addValidationData(validation);
    }

    private VehiculeImportPreviewResponse.Ligne parseRow(
            Long agenceId,
            Contrat contrat,
            Row row,
            int rowNumber,
            Map<String, Integer> columns,
            DataFormatter formatter,
            Set<String> existingRegistrations,
            Set<String> fileRegistrations,
            Set<String> existingAttestations,
            Set<String> fileAttestations
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
        String attestation = optionalText(row, columns, "nattestation", formatter);
        input.setNumeroAttestation(attestation != null
                ? attestation
                : optionalText(row, columns, "numeroattestation", formatter));
        input.setPuissanceFiscale(optionalText(row, columns, "puissancefiscale", formatter));
        input.setCylindree(optionalText(row, columns, "cylindree", formatter));
        input.setPtc(optionalText(row, columns, "ptc", formatter));
        input.setValeurNeuf(decimal(row, columns, "valeuraneuf", "Valeur à neuf", errors));
        input.setValeurVenale(decimal(row, columns, "valeurvenale", "Valeur vénale", errors));
        input.setValeurGlace(decimal(row, columns, "valeurglace", "Valeur glace", errors));
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
        validateAttestationStock(agenceId, contrat, usage, input, existingAttestations, fileAttestations, errors);
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
                .numeroAttestation(input.getNumeroAttestation())
                .usage(usage == null ? usageValue : usage.getCode() + " - " + usage.getLibelle())
                .marque(brandValue)
                .vehicule(errors.isEmpty() ? input : null)
                .erreurs(errors)
                .avertissements(warnings)
                .build();
    }

    private void validateAttestationStock(
            Long agenceId,
            Contrat contrat,
            Usage usage,
            CreateContratRequest.VehiculeInput input,
            Set<String> existingAttestations,
            Set<String> fileAttestations,
            List<String> errors
    ) {
        if (usage == null
                || Boolean.TRUE.equals(contrat.getProspection())
                || contrat.getModeTermeRenouvellement() == ModeTermeRenouvellement.COMPAGNIE) {
            return;
        }
        Long compagnieId = contrat.getCompagnieAssurance() == null
                ? null
                : contrat.getCompagnieAssurance().getId();
        Long categorieClientId = contrat.getCategorieClient() == null
                ? null
                : contrat.getCategorieClient().getId();
        try {
            AttestationNumeroValidationResponse validation = attestationStockService.validerNumero(
                    agenceId,
                    compagnieId,
                    usage.getId(),
                    categorieClientId,
                    input.getNumeroAttestation(),
                    null
            );
            if (!blank(validation.getNumeroNormalise())) {
                input.setNumeroAttestation(validation.getNumeroNormalise());
            }
            if (!Boolean.TRUE.equals(validation.getValidationRequise())) {
                return;
            }
            if (!Boolean.TRUE.equals(validation.getDisponible())) {
                errors.add(blank(validation.getMessage())
                        ? "Numéro d'attestation indisponible en stock"
                        : validation.getMessage());
            }
            String normalized = normalize(validation.getNumeroNormalise());
            if (!normalized.isBlank() && existingAttestations.contains(normalized)) {
                errors.add("Numéro d'attestation déjà utilisé par un véhicule du brouillon");
            } else if (!normalized.isBlank() && !fileAttestations.add(normalized)) {
                errors.add("Numéro d'attestation en double dans le fichier");
            }
        } catch (BadRequestException exception) {
            errors.add(exception.getMessage());
        }
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
        if (contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
            return;
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

    private BigDecimal decimal(Row row, Map<String, Integer> columns, String key,
                               String label, List<String> errors) {
        Integer index = columns.get(key);
        if (index == null) return null;
        Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        try {
            return parseDecimalCell(cell);
        } catch (NumberFormatException exception) {
            errors.add(label + " invalide");
            return null;
        }
    }

    static BigDecimal parseDecimalCell(Cell cell) {
        CellType type = cell.getCellType() == CellType.FORMULA
                ? cell.getCachedFormulaResultType()
                : cell.getCellType();
        if (type == CellType.BLANK) return null;
        if (type == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(cell)) {
                throw new NumberFormatException("Date cell is not a monetary amount");
            }
            double value = cell.getNumericCellValue();
            if (!Double.isFinite(value)) {
                throw new NumberFormatException("Non-finite monetary amount");
            }
            return BigDecimal.valueOf(value);
        }
        if (type != CellType.STRING) {
            throw new NumberFormatException("Unsupported monetary cell type");
        }
        return parseDecimalText(cell.getStringCellValue());
    }

    static BigDecimal parseDecimalText(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) return null;
        String value = rawValue.trim()
                .replaceAll("[\\s\\p{Zs}]", "")
                .replace("'", "");
        if (value.isBlank()) return null;

        int comma = value.lastIndexOf(',');
        int dot = value.lastIndexOf('.');
        if (comma >= 0 && dot >= 0) {
            char decimalSeparator = comma > dot ? ',' : '.';
            char groupingSeparator = decimalSeparator == ',' ? '.' : ',';
            value = value.replace(String.valueOf(groupingSeparator), "")
                    .replace(decimalSeparator, '.');
        } else if (comma >= 0) {
            value = normalizeSingleSeparator(value, ',');
        } else if (dot >= 0) {
            value = normalizeSingleSeparator(value, '.');
        }
        return new BigDecimal(value);
    }

    private static String normalizeSingleSeparator(String value, char separator) {
        int first = value.indexOf(separator);
        int last = value.lastIndexOf(separator);
        int fractionDigits = value.length() - last - 1;
        int integerDigits = first;
        if (value.startsWith("+") || value.startsWith("-")) {
            integerDigits--;
        }
        if (first == last && fractionDigits == 3 && integerDigits > 0 && integerDigits <= 3) {
            return value.replace(String.valueOf(separator), "");
        }
        if (first != last && hasOnlyThreeDigitGroups(value, separator)) {
            return value.replace(String.valueOf(separator), "");
        }
        String integerPart = value.substring(0, last).replace(String.valueOf(separator), "");
        return integerPart + "." + value.substring(last + 1);
    }

    private static boolean hasOnlyThreeDigitGroups(String value, char separator) {
        String unsigned = value.startsWith("+") || value.startsWith("-") ? value.substring(1) : value;
        String[] groups = unsigned.split(java.util.regex.Pattern.quote(String.valueOf(separator)), -1);
        if (groups.length < 2 || groups[0].isEmpty() || groups[0].length() > 3) return false;
        for (int index = 1; index < groups.length; index++) {
            if (groups[index].length() != 3) return false;
        }
        return true;
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

    private record VehicleMatch(int index, CreateContratRequest.VehiculeInput input) {
    }

    private record GuaranteePreview(
            List<CreateContratRequest.GarantieInput> guarantees,
            List<VehiculeImportPreviewResponse.LigneGaranties> rows,
            int validRows
    ) {
    }
}
