package com.assurance.service;

import com.assurance.dto.request.EnregistrerAffectationQuittanceRequest;
import com.assurance.dto.request.EnregistrerLotAffectationQuittanceRequest;
import com.assurance.dto.request.UpsertRegleAffectationQuittanceRequest;
import com.assurance.dto.response.AffectationQuittancePageResponse;
import com.assurance.dto.response.AffectationQuittanceResponse;
import com.assurance.dto.response.ImportAffectationQuittancePreviewResponse;
import com.assurance.dto.response.LotAffectationQuittanceResponse;
import com.assurance.dto.response.RegleAffectationQuittancePageResponse;
import com.assurance.dto.response.RegleAffectationQuittanceResponse;
import com.assurance.entity.AffectationQuittanceCompagnie;
import com.assurance.entity.Agence;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.LigneQuittance;
import com.assurance.entity.Quittance;
import com.assurance.entity.RegleAffectationQuittance;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeAffectationQuittance;
import com.assurance.enums.ModeCalculCommission;
import com.assurance.enums.ModeVentilationQuittance;
import com.assurance.enums.NatureAffectationQuittance;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.NiveauEcartAffectation;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.SourceAffectationQuittance;
import com.assurance.enums.StatutAffectationQuittance;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AffectationQuittanceCompagnieRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.RegleAffectationQuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AffectationQuittanceService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final LocalDate OPEN_ENDED_DATE = LocalDate.of(9999, 12, 31);
    private static final DateTimeFormatter EXPORT_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final ContratClientRepository contratClientRepository;
    private final AffectationQuittanceCompagnieRepository affectationRepository;
    private final RegleAffectationQuittanceRepository regleRepository;
    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieRepository;

    @Transactional(readOnly = true)
    public AffectationQuittancePageResponse search(
            Long agenceId,
            Long compagnieId,
            TypeContrat typeContrat,
            Boolean avecQuittance,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validateTenant(agenceId);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100));
        String normalizedSearch = normalizeSearch(search);
        Page<Quittance> result = quittanceRepository.searchForAffectation(
                agenceId,
                compagnieId,
                typeContrat,
                avecQuittance,
                dateDu,
                dateAu,
                normalizedSearch,
                pageable
        );

        List<Quittance> quittances = result.getContent();
        Set<Long> quittanceIds = ids(quittances, Quittance::getId);
        Set<Long> contratIds = ids(quittances, quittance -> quittance.getContrat().getId());
        Map<Long, List<AffectationQuittanceCompagnie>> affectations = quittanceIds.isEmpty()
                ? Map.of()
                : affectationRepository.findByQuittanceIdIn(quittanceIds)
                        .stream()
                        .collect(Collectors.groupingBy(item -> item.getQuittance().getId()));
        Map<Long, String> souscripteurs = resolveSouscripteurs(contratIds);
        List<RegleAffectationQuittance> regles = regleRepository
                .findAllByAgenceIdOrderByCompagnieAssuranceNomAscTypeContratAscDateDebutDesc(agenceId);

        List<AffectationQuittanceResponse> rows = quittances.stream()
                .map(quittance -> {
                    RegleAffectationQuittance regle = findEffectiveRuleOrNull(regles, quittance);
                    return toResponse(
                            quittance,
                            affectations.getOrDefault(quittance.getId(), List.of()),
                            souscripteurs.get(quittance.getContrat().getId()),
                            regle,
                            true
                    );
                })
                .toList();

        BigDecimal montantTtc = rows.stream()
                .map(AffectationQuittanceResponse::getMontantTtc)
                .reduce(ZERO, BigDecimal::add);
        BigDecimal montantAffecte = rows.stream()
                .map(AffectationQuittanceResponse::getMontantAffecte)
                .reduce(ZERO, BigDecimal::add);

        return AffectationQuittancePageResponse.builder()
                .summary(AffectationQuittancePageResponse.Summary.builder()
                        .total(result.getTotalElements())
                        .nonAffectees(countStatus(rows, StatutAffectationQuittance.NON_AFFECTEE))
                        .partiellementAffectees(countStatus(rows, StatutAffectationQuittance.PARTIELLEMENT_AFFECTEE))
                        .affectees(countStatus(rows, StatutAffectationQuittance.AFFECTEE))
                        .avecEcart(countStatus(rows, StatutAffectationQuittance.AVEC_ECART))
                        .montantTtc(money(montantTtc))
                        .montantAffecte(money(montantAffecte))
                        .build())
                .page(AffectationQuittancePageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(rows)
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] export(
            Long agenceId,
            Long compagnieId,
            TypeContrat typeContrat,
            Boolean avecQuittance,
            LocalDate dateDu,
            LocalDate dateAu,
            String search
    ) {
        validateTenant(agenceId);
        if (compagnieId == null
                && typeContrat == null
                && avecQuittance == null
                && dateDu == null
                && dateAu == null
                && trimToNull(search) == null) {
            throw new BadRequestException("Renseignez au moins un critère avant d'exporter");
        }
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date effet du doit être antérieure ou égale à la date effet au");
        }

        List<AffectationQuittanceResponse> rows = new ArrayList<>();
        int page = 0;
        AffectationQuittancePageResponse result;
        do {
            result = search(
                    agenceId,
                    compagnieId,
                    typeContrat,
                    avecQuittance,
                    dateDu,
                    dateAu,
                    search,
                    page,
                    100
            );
            rows.addAll(result.getRows());
            page++;
        } while (page < result.getPage().getTotalPages());

        return createExportWorkbook(rows);
    }

    private byte[] createExportWorkbook(List<AffectationQuittanceResponse> rows) {
        String[] headers = {
                "Produit", "Mouvement", "Souscripteur", "Police", "Date effet", "Date échéance",
                "Prime nette", "Taxes", "Accessoires", "Montant TTC", "Commission nette", "Retenue",
                "Net compagnie", "N° quittance compagnie", "Statut"
        };

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Affectation quittances");
            CellStyle headerStyle = createExportHeaderStyle(workbook);
            CellStyle textStyle = createExportTextStyle(workbook);
            CellStyle moneyStyle = createExportMoneyStyle(workbook);

            Row header = sheet.createRow(0);
            for (int column = 0; column < headers.length; column++) {
                Cell cell = header.createCell(column);
                cell.setCellValue(headers[column]);
                cell.setCellStyle(headerStyle);
            }

            int rowIndex = 1;
            for (AffectationQuittanceResponse item : rows) {
                List<AffectationQuittanceResponse.Ligne> lines = item.getLignes();
                if (lines == null || lines.isEmpty()) {
                    writeExportRow(sheet.createRow(rowIndex++), item, null, textStyle, moneyStyle);
                    continue;
                }
                for (AffectationQuittanceResponse.Ligne line : lines) {
                    writeExportRow(sheet.createRow(rowIndex++), item, line, textStyle, moneyStyle);
                }
            }

            int[] widths = {28, 28, 26, 18, 16, 16, 17, 17, 17, 17, 18, 17, 18, 28, 28};
            for (int column = 0; column < widths.length; column++) {
                sheet.setColumnWidth(column, widths[column] * 256);
            }
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(
                    0,
                    Math.max(0, sheet.getLastRowNum()),
                    0,
                    headers.length - 1
            ));

            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new BadRequestException("Génération du fichier Excel impossible");
        }
    }

    private void writeExportRow(
            Row row,
            AffectationQuittanceResponse item,
            AffectationQuittanceResponse.Ligne line,
            CellStyle textStyle,
            CellStyle moneyStyle
    ) {
        row.setHeightInPoints(30);
        int column = 0;
        setExportText(row, column++, joinExportLines(productLabel(item), item.getDossier()), textStyle);
        setExportText(row, column++, joinExportLines(item.getMouvement(), natureLabel(item.getNature())), textStyle);
        setExportText(row, column++, item.getSouscripteur(), textStyle);
        setExportText(row, column++, item.getPolice(), textStyle);
        setExportText(row, column++, formatExportDate(line != null ? line.getDateEffet() : item.getDateEffet()), textStyle);
        setExportText(row, column++, formatExportDate(line != null ? line.getDateEcheance() : item.getDateEcheance()), textStyle);
        setExportMoney(row, column++, line != null ? line.getPrimeNette() : item.getPrimeNette(), moneyStyle);
        setExportMoney(row, column++, line != null ? line.getMontantTaxes() : item.getMontantTaxes(), moneyStyle);
        setExportMoney(row, column++, line != null ? line.getAccessoires() : item.getAccessoires(), moneyStyle);
        setExportMoney(row, column++, line != null ? line.getMontantTtc() : item.getMontantTtc(), moneyStyle);
        setExportMoney(row, column++, line != null ? line.getCommissionNette() : item.getCommissionCalculee(), moneyStyle);
        setExportMoney(row, column++, line != null ? line.getMontantRetenue() : item.getRetenueCalculee(), moneyStyle);
        setExportMoney(row, column++, line != null ? line.getNetCompagnie() : item.getNetCompagnieCalcule(), moneyStyle);
        setExportText(row, column++, line != null ? line.getNumeroQuittanceCompagnie() : null, textStyle);
        setExportText(row, column, exportStatusLabel(item, line), textStyle);
    }

    private String exportStatusLabel(
            AffectationQuittanceResponse item,
            AffectationQuittanceResponse.Ligne line
    ) {
        if (line == null) {
            return statusLabel(item.getStatutAffectation());
        }
        return switch (item.getStatutAffectation()) {
            case PARTIELLEMENT_AFFECTEE -> "Affectée - Affectation partielle";
            case AVEC_ECART -> "Affectée - Écart " + money(item.getEcart()) + " MAD";
            default -> "Affectée";
        };
    }

    private CellStyle createExportHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyExportBorders(style);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle createExportTextStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        applyExportBorders(style);
        return style;
    }

    private CellStyle createExportMoneyStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00 \"MAD\""));
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyExportBorders(style);
        return style;
    }

    private void applyExportBorders(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
    }

    private void setExportText(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private void setExportMoney(Row row, int column, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value != null) {
            cell.setCellValue(value.doubleValue());
        }
        cell.setCellStyle(style);
    }

    private String formatExportDate(LocalDate value) {
        return value == null ? "" : value.format(EXPORT_DATE_FORMAT);
    }

    private String productLabel(AffectationQuittanceResponse item) {
        if (item.getTypeContrat() == null) return "";
        return switch (item.getTypeContrat()) {
            case PARTICULIER -> "Mono";
            case CONVENTION -> firstNonBlank(item.getProduit(), "Convention");
            case FLOTTE -> "Flotte";
        };
    }

    private String joinExportLines(String primary, String secondary) {
        String first = trimToNull(primary);
        String second = trimToNull(secondary);
        if (first == null) return second == null ? "" : second;
        return second == null ? first : first + "\n" + second;
    }

    private String natureLabel(NatureAffectationQuittance value) {
        if (value == null) return "";
        return switch (value) {
            case AFFAIRE_NOUVELLE -> "Affaire nouvelle";
            case AVENANT -> "Avenant";
            case RENOUVELLEMENT -> "Renouvellement";
            case CARTE_VERTE -> "Carte verte";
        };
    }

    private String statusLabel(StatutAffectationQuittance value) {
        if (value == null) return "";
        return switch (value) {
            case NON_AFFECTEE -> "Non affectée";
            case PARTIELLEMENT_AFFECTEE -> "Partiellement affectée";
            case AFFECTEE -> "Affectée";
            case AVEC_ECART -> "Avec écart";
        };
    }

    @Transactional(readOnly = true)
    public AffectationQuittanceResponse detail(Long agenceId, Long quittanceId, Boolean avecRetenue) {
        Quittance quittance = requireQuittance(agenceId, quittanceId);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
        List<AffectationQuittanceCompagnie> affectations = affectationRepository
                .findByQuittanceIdOrderByDateEffetAscNumeroQuittanceCompagnieAsc(quittanceId);
        String souscripteur = resolveSouscripteurs(Set.of(quittance.getContrat().getId()))
                .get(quittance.getContrat().getId());
        AffectationQuittanceResponse response = toResponse(
                quittance,
                affectations,
                souscripteur,
                regle,
                true
        );
        boolean retentionEnabled = avecRetenue != null
                ? avecRetenue
                : affectations.stream().findFirst()
                        .map(AffectationQuittanceCompagnie::getAvecRetenue)
                        .orElse(Boolean.TRUE.equals(regle.getRetenueParDefaut()));
        response.setAvecRetenue(retentionEnabled);
        if (quittance.getContrat().getTypeContrat() != TypeContrat.FLOTTE) {
            if (regle.getModeVentilation() == ModeVentilationQuittance.PAR_CATEGORIE && response.getLignes().isEmpty()) {
                List<AffectationQuittanceResponse.Ligne> previewLines = buildAutomaticCategoryPreviewLines(quittance, regle, retentionEnabled);
                response.setLignes(previewLines);
                response.setCommissionCalculee(sum(previewLines, AffectationQuittanceResponse.Ligne::getCommissionNette));
                response.setRetenueCalculee(sum(previewLines, AffectationQuittanceResponse.Ligne::getMontantRetenue));
                response.setNetCompagnieCalcule(sum(previewLines, AffectationQuittanceResponse.Ligne::getNetCompagnie));
            } else {
                BigDecimal commission = calculateCommission(quittance, regle);
                Retention retention = calculateRetention(commission, retentionEnabled, regle);
                response.setCommissionCalculee(commission);
                response.setRetenueCalculee(retention.amount());
                response.setNetCompagnieCalcule(money(
                        requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance")
                                .subtract(commission)
                                .add(retention.amount())
                ));
            }
        }
        return response;
    }

    @Transactional
    public AffectationQuittanceResponse save(
            Long agenceId,
            Long userId,
            Long quittanceId,
            EnregistrerAffectationQuittanceRequest request
    ) {
        Quittance quittance = requireQuittance(agenceId, quittanceId);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
        validateMode(quittance.getContrat().getTypeContrat(), regle, request.getSource());

        List<AffectationQuittanceCompagnie> entities = quittance.getContrat().getTypeContrat() == TypeContrat.FLOTTE
                ? buildFleetAffectations(agenceId, userId, quittance, regle, request)
                : buildAutomaticAffectations(agenceId, userId, quittance, regle, request);

        validateRequestNumbers(agenceId, quittance, entities);
        BigDecimal expected = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal affected = entities.stream()
                .map(AffectationQuittanceCompagnie::getMontantTtc)
                .reduce(ZERO, BigDecimal::add);
        requireAllowedDifference(regle, affected.subtract(expected));
        affectationRepository.deleteByQuittanceId(quittanceId);
        affectationRepository.flush();
        affectationRepository.saveAll(entities);

        String souscripteur = resolveSouscripteurs(Set.of(quittance.getContrat().getId()))
                .get(quittance.getContrat().getId());
        return toResponse(quittance, entities, souscripteur, regle, true);
    }

    @Transactional
    public LotAffectationQuittanceResponse saveBatch(
            Long agenceId,
            Long userId,
            EnregistrerLotAffectationQuittanceRequest request
    ) {
        List<Quittance> quittances = requireCompatibleFleetBatch(agenceId, request.getQuittanceIds());
        Map<Long, Quittance> byId = quittances.stream()
                .collect(Collectors.toMap(Quittance::getId, Function.identity()));
        Map<Long, List<EnregistrerAffectationQuittanceRequest.Ligne>> linesByQuittance = request.getLignes().stream()
                .peek(line -> {
                    if (line.getQuittanceId() == null || !byId.containsKey(line.getQuittanceId())) {
                        throw new BadRequestException("Chaque ligne compagnie doit être rattachée à un mouvement sélectionné");
                    }
                })
                .collect(Collectors.groupingBy(
                        EnregistrerAffectationQuittanceRequest.Ligne::getQuittanceId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        if (!linesByQuittance.keySet().containsAll(byId.keySet())) {
            throw new BadRequestException("Chaque quittance sélectionnée doit recevoir au moins une ligne compagnie");
        }

        List<AffectationQuittanceCompagnie> entities = new ArrayList<>();
        for (Quittance quittance : quittances) {
            RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
            validateMode(TypeContrat.FLOTTE, regle, request.getSource());
            EnregistrerAffectationQuittanceRequest itemRequest = new EnregistrerAffectationQuittanceRequest();
            itemRequest.setSource(request.getSource());
            itemRequest.setAvecRetenue(request.getAvecRetenue());
            itemRequest.setFichierSource(request.getFichierSource());
            itemRequest.setLignes(linesByQuittance.get(quittance.getId()));
            entities.addAll(buildFleetAffectations(agenceId, userId, quittance, regle, itemRequest));
        }

        validateBatchRequestNumbers(agenceId, byId.keySet(), entities);
        BigDecimal expected = quittances.stream()
                .map(quittance -> requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance"))
                .reduce(ZERO, BigDecimal::add);
        BigDecimal affected = entities.stream()
                .map(AffectationQuittanceCompagnie::getMontantTtc)
                .reduce(ZERO, BigDecimal::add);
        RegleAffectationQuittance batchRule = requireEffectiveRule(agenceId, quittances.get(0));
        requireAllowedDifference(batchRule, affected.subtract(expected));
        byId.keySet().forEach(affectationRepository::deleteByQuittanceId);
        affectationRepository.flush();
        affectationRepository.saveAll(entities);
        return buildBatchResponse(quittances, entities, expected, batchRule);
    }

    @Transactional
    public void clear(Long agenceId, Long quittanceId) {
        requireQuittance(agenceId, quittanceId);
        affectationRepository.deleteByQuittanceId(quittanceId);
    }

    @Transactional(readOnly = true)
    public ImportAffectationQuittancePreviewResponse previewImport(
            Long agenceId,
            Long quittanceId,
            boolean avecRetenue,
            MultipartFile file
    ) {
        Quittance quittance = requireQuittance(agenceId, quittanceId);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
        if (quittance.getContrat().getTypeContrat() != TypeContrat.FLOTTE
                || regle.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT) {
            throw new BadRequestException("L'import est disponible uniquement pour une quittance flotte configurée en mode manuel/import");
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Sélectionnez un fichier Excel");
        }

        ParsedImport parsed = parseImport(file, List.of(quittance), regle, avecRetenue);
        BigDecimal montantTtc = sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getMontantTtc);
        BigDecimal expected = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal ecart = money(montantTtc.subtract(expected));
        EcartPolicy policy = evaluateDifference(regle, ecart);

        return ImportAffectationQuittancePreviewResponse.builder()
                .fichier(cleanFileName(file.getOriginalFilename()))
                .lignesLues(parsed.lines().size())
                .lignes(parsed.lines())
                .erreurs(parsed.errors())
                .primeNette(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getPrimeNette))
                .montantTaxes(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getMontantTaxes))
                .accessoires(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getAccessoires))
                .montantTtc(money(montantTtc))
                .commissionNette(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getCommissionNette))
                .netCompagnie(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getNetCompagnie))
                .ecart(ecart)
                .equilibre(policy.level() == NiveauEcartAffectation.EQUILIBRE)
                .seuilAvertissementEcart(policy.warningThreshold())
                .margeManquanteMaximale(policy.shortageLimit())
                .margeDepassementMaximale(policy.excessLimit())
                .niveauEcart(policy.level())
                .validationAutorisee(policy.allowed())
                .build();
    }

    @Transactional(readOnly = true)
    public ImportAffectationQuittancePreviewResponse previewBatchImport(
            Long agenceId,
            List<Long> quittanceIds,
            boolean avecRetenue,
            MultipartFile file
    ) {
        List<Quittance> quittances = requireCompatibleFleetBatch(agenceId, quittanceIds);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittances.get(0));
        if (regle.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT) {
            throw new BadRequestException("L'import groupé requiert une règle flotte en mode manuel/import");
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Sélectionnez un fichier Excel");
        }
        ParsedImport parsed = parseBatchImport(file, quittances, regle, avecRetenue);
        BigDecimal montantTtc = sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getMontantTtc);
        BigDecimal expected = quittances.stream()
                .map(quittance -> requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance"))
                .reduce(ZERO, BigDecimal::add);
        BigDecimal ecart = money(montantTtc.subtract(expected));
        EcartPolicy policy = evaluateDifference(regle, ecart);
        return ImportAffectationQuittancePreviewResponse.builder()
                .fichier(cleanFileName(file.getOriginalFilename()))
                .lignesLues(parsed.lines().size())
                .lignes(parsed.lines())
                .erreurs(parsed.errors())
                .primeNette(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getPrimeNette))
                .montantTaxes(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getMontantTaxes))
                .accessoires(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getAccessoires))
                .montantTtc(money(montantTtc))
                .commissionNette(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getCommissionNette))
                .netCompagnie(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getNetCompagnie))
                .ecart(ecart)
                .equilibre(policy.level() == NiveauEcartAffectation.EQUILIBRE)
                .seuilAvertissementEcart(policy.warningThreshold())
                .margeManquanteMaximale(policy.shortageLimit())
                .margeDepassementMaximale(policy.excessLimit())
                .niveauEcart(policy.level())
                .validationAutorisee(policy.allowed())
                .build();
    }

    @Transactional(readOnly = true)
    public RegleAffectationQuittancePageResponse listRules(
            Long agenceId,
            int page,
            int size
    ) {
        validateTenant(agenceId);
        Page<RegleAffectationQuittance> result =
                regleRepository.findByAgenceIdOrderByCompagnieAssuranceNomAscTypeContratAscDateDebutDesc(
                        agenceId,
                        PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100))
                );
        return RegleAffectationQuittancePageResponse.builder()
                .rows(result.getContent().stream().map(this::toRuleResponse).toList())
                .page(RegleAffectationQuittancePageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalPages(result.getTotalPages())
                        .totalElements(result.getTotalElements())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .build();
    }

    @Transactional
    public RegleAffectationQuittanceResponse createRule(
            Long agenceId,
            UpsertRegleAffectationQuittanceRequest request
    ) {
        Agence agence = requireAgence(agenceId);
        CompagnieAssurance compagnie = requireCompagnie(request.getCompagnieAssuranceId());
        validateRule(request, agenceId, 0L);
        RegleAffectationQuittance entity = new RegleAffectationQuittance();
        entity.setAgence(agence);
        entity.setCompagnieAssurance(compagnie);
        applyRule(entity, request);
        return toRuleResponse(regleRepository.save(entity));
    }

    @Transactional
    public RegleAffectationQuittanceResponse updateRule(
            Long agenceId,
            Long ruleId,
            UpsertRegleAffectationQuittanceRequest request
    ) {
        RegleAffectationQuittance entity = regleRepository.findByAgenceIdAndId(agenceId, ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("Règle d'affectation", ruleId));
        requireUnusedRule(entity);
        CompagnieAssurance compagnie = requireCompagnie(request.getCompagnieAssuranceId());
        validateRule(request, agenceId, ruleId);
        entity.setCompagnieAssurance(compagnie);
        applyRule(entity, request);
        return toRuleResponse(regleRepository.save(entity));
    }

    @Transactional
    public void deleteRule(Long agenceId, Long ruleId) {
        RegleAffectationQuittance entity = regleRepository.findByAgenceIdAndId(agenceId, ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("Règle d'affectation", ruleId));
        requireUnusedRule(entity);
        regleRepository.delete(entity);
    }

    private void requireUnusedRule(RegleAffectationQuittance rule) {
        long allocations = regleRepository.countAllocationsUsingRule(
                rule.getAgence().getId(),
                rule.getCompagnieAssurance().getId(),
                rule.getTypeContrat(),
                rule.getDateDebut(),
                rule.getDateFin() != null ? rule.getDateFin() : OPEN_ENDED_DATE
        );
        if (allocations > 0) {
            throw new BadRequestException(
                    "Cette règle a déjà produit des affectations. Créez une nouvelle règle datée pour modifier le calcul"
            );
        }
    }

    private List<AffectationQuittanceCompagnie> buildAutomaticAffectations(
            Long agenceId,
            Long userId,
            Quittance quittance,
            RegleAffectationQuittance regle,
            EnregistrerAffectationQuittanceRequest request
    ) {
        if (request.getSource() != SourceAffectationQuittance.AUTOMATIQUE) {
            throw new BadRequestException("Une quittance Mono ou Convention doit être affectée en mode automatique");
        }

        if (regle.getModeVentilation() == ModeVentilationQuittance.PAR_CATEGORIE) {
            return buildAutomaticCategoryAffectations(agenceId, userId, quittance, regle, request);
        }

        String numero = trimToNull(request.getNumeroQuittanceCompagnie());
        if (numero == null) {
            throw new BadRequestException("Le numéro de quittance compagnie est obligatoire");
        }

        BigDecimal commissionNette = calculateCommission(quittance, regle);
        Retention retention = calculateRetention(commissionNette, request.getAvecRetenue(), regle);
        BigDecimal montantTtc = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal accessoires = requiredAmount(quittance.getAccessoire(), "Accessoires de la quittance")
                .add(requiredAmount(quittance.getCnpac(), "CNPAC de la quittance"));

        AffectationQuittanceCompagnie entity = AffectationQuittanceCompagnie.builder()
                .agence(requireAgence(agenceId))
                .quittance(quittance)
                .compagnieAssurance(requireQuittanceCompagnie(quittance))
                .numeroQuittanceCompagnie(numero)
                .source(SourceAffectationQuittance.AUTOMATIQUE)
                .dateEffet(resolveDateEffet(quittance))
                .dateEcheance(resolveDateEcheance(quittance))
                .primeNette(requiredAmount(quittance.getPrimeNette(), "Prime nette de la quittance"))
                .montantTaxes(requiredAmount(quittance.getTaxe(), "Taxes de la quittance")
                        .add(requiredAmount(quittance.getTaxeParafiscale(), "Taxe parafiscale de la quittance")))
                .accessoires(money(accessoires))
                .montantTtc(montantTtc)
                .commissionNette(commissionNette)
                .avecRetenue(Boolean.TRUE.equals(request.getAvecRetenue()))
                .tauxRetenue(retention.rate())
                .montantRetenue(retention.amount())
                .netCompagnie(money(montantTtc.subtract(commissionNette).add(retention.amount())))
                .creePar(userId)
                .modifiePar(userId)
                .build();
        return List.of(entity);
    }

    private List<AffectationQuittanceCompagnie> buildAutomaticCategoryAffectations(
            Long agenceId,
            Long userId,
            Quittance quittance,
            RegleAffectationQuittance regle,
            EnregistrerAffectationQuittanceRequest request
    ) {
        List<LigneQuittance> categoryLines = accountingCategoryLines(quittance).stream()
                .filter(line -> isAffectableCategory(line.getCategorie()))
                .filter(line -> money(line.getPrimeTotale()).compareTo(ZERO) != 0 || money(line.getPrimeNette()).compareTo(ZERO) != 0)
                .toList();
        if (categoryLines.isEmpty()) {
            throw new BadRequestException("Les lignes comptables de la quittance sont requises pour ventiler par catégorie");
        }
        if (request.getLignes() == null || request.getLignes().size() != categoryLines.size()) {
            throw new BadRequestException("Renseignez un numéro de quittance compagnie pour chaque catégorie");
        }
        request.getLignes().forEach(line -> {
            if (line.getCategorieQuittance() == null) {
                throw new BadRequestException("Chaque ligne ventilée doit préciser sa catégorie");
            }
        });

        Map<CategorieQuittance, EnregistrerAffectationQuittanceRequest.Ligne> requestLines = request.getLignes().stream()
                .collect(Collectors.toMap(
                        EnregistrerAffectationQuittanceRequest.Ligne::getCategorieQuittance,
                        Function.identity(),
                        (left, right) -> {
                            throw new BadRequestException("La catégorie " + left.getCategorieQuittance() + " est dupliquée");
                        },
                        LinkedHashMap::new
                ));

        Agence agence = requireAgence(agenceId);
        CompagnieAssurance compagnie = requireQuittanceCompagnie(quittance);
        List<AffectationQuittanceCompagnie> result = new ArrayList<>();
        for (LigneQuittance categoryLine : categoryLines) {
            CategorieQuittance categorie = categoryLine.getCategorie();
            EnregistrerAffectationQuittanceRequest.Ligne requestLine = requestLines.get(categorie);
            if (requestLine == null || trimToNull(requestLine.getNumeroQuittanceCompagnie()) == null) {
                throw new BadRequestException("Le numéro de quittance compagnie est obligatoire pour " + categorie.name());
            }
            BigDecimal commissionNette = calculateCommissionForCategory(categoryLine, regle);
            Retention retention = calculateRetention(commissionNette, request.getAvecRetenue(), regle);
            BigDecimal montantTtc = requiredAmount(categoryLine.getPrimeTotale(), "Montant TTC de " + categorie.name());
            BigDecimal accessoires = requiredAmount(categoryLine.getAccessoire(), "Accessoires de " + categorie.name())
                    .add(requiredAmount(categoryLine.getCnpac(), "CNPAC de " + categorie.name()));
            result.add(AffectationQuittanceCompagnie.builder()
                    .agence(agence)
                    .quittance(quittance)
                    .compagnieAssurance(compagnie)
                    .numeroQuittanceCompagnie(requestLine.getNumeroQuittanceCompagnie().trim())
                    .source(SourceAffectationQuittance.AUTOMATIQUE)
                    .dateEffet(resolveDateEffet(quittance))
                    .dateEcheance(resolveDateEcheance(quittance))
                    .categorieSource(categoryLabel(categorie))
                    .categorieQuittance(categorie)
                    .primeNette(requiredAmount(categoryLine.getPrimeNette(), "Prime nette de " + categorie.name()))
                    .montantTaxes(requiredAmount(categoryLine.getTaxe(), "Taxes de " + categorie.name())
                            .add(requiredAmount(categoryLine.getTaxeParafiscale(), "Taxe parafiscale de " + categorie.name())))
                    .accessoires(money(accessoires))
                    .montantTtc(montantTtc)
                    .commissionNette(commissionNette)
                    .avecRetenue(Boolean.TRUE.equals(request.getAvecRetenue()))
                    .tauxRetenue(retention.rate())
                    .montantRetenue(retention.amount())
                    .netCompagnie(money(montantTtc.subtract(commissionNette).add(retention.amount())))
                    .creePar(userId)
                    .modifiePar(userId)
                    .build());
        }
        return result;
    }

    private List<AffectationQuittanceCompagnie> buildFleetAffectations(
            Long agenceId,
            Long userId,
            Quittance quittance,
            RegleAffectationQuittance regle,
            EnregistrerAffectationQuittanceRequest request
    ) {
        if (request.getSource() == SourceAffectationQuittance.AUTOMATIQUE) {
            throw new BadRequestException("Une quittance flotte doit être saisie manuellement ou importée");
        }
        if (request.getLignes() == null || request.getLignes().isEmpty()) {
            throw new BadRequestException("Ajoutez au moins une ligne de quittance compagnie");
        }
        Agence agence = requireAgence(agenceId);
        CompagnieAssurance compagnie = requireQuittanceCompagnie(quittance);
        String fichierSource = request.getSource() == SourceAffectationQuittance.IMPORT
                ? trimToNull(request.getFichierSource())
                : null;
        if (request.getSource() == SourceAffectationQuittance.IMPORT && fichierSource == null) {
            throw new BadRequestException("Le fichier source de l'import est obligatoire");
        }

        List<AffectationQuittanceCompagnie> result = new ArrayList<>();
        for (EnregistrerAffectationQuittanceRequest.Ligne line : request.getLignes()) {
            validateFleetLine(line, quittance);
            BigDecimal commission = money(line.getCommissionNette());
            Retention retention = calculateRetention(commission, request.getAvecRetenue(), regle);
            result.add(AffectationQuittanceCompagnie.builder()
                    .agence(agence)
                    .quittance(quittance)
                    .compagnieAssurance(compagnie)
                    .numeroQuittanceCompagnie(line.getNumeroQuittanceCompagnie().trim())
                    .source(request.getSource())
                    .dateEffet(line.getDateEffet())
                    .dateEcheance(line.getDateEcheance())
                    .acteSource(trimToNull(line.getActeSource()))
                    .categorieSource(trimToNull(line.getCategorieSource()))
                    .categorieQuittance(line.getCategorieQuittance())
                    .statutSource(trimToNull(line.getStatutSource()))
                    .fichierSource(fichierSource)
                    .primeNette(money(line.getPrimeNette()))
                    .montantTaxes(money(line.getMontantTaxes()))
                    .accessoires(money(line.getAccessoires()))
                    .montantTtc(money(line.getMontantTtc()))
                    .commissionNette(commission)
                    .avecRetenue(Boolean.TRUE.equals(request.getAvecRetenue()))
                    .tauxRetenue(retention.rate())
                    .montantRetenue(retention.amount())
                    .netCompagnie(money(line.getMontantTtc().subtract(commission).add(retention.amount())))
                    .creePar(userId)
                    .modifiePar(userId)
                    .build());
        }
        return result;
    }

    private void validateFleetLine(
            EnregistrerAffectationQuittanceRequest.Ligne line,
            Quittance quittance
    ) {
        if (trimToNull(line.getNumeroQuittanceCompagnie()) == null) {
            throw new BadRequestException("Chaque ligne doit avoir un numéro de quittance compagnie");
        }
        requireAmount(line.getPrimeNette(), "Prime nette");
        requireAmount(line.getMontantTaxes(), "Montant taxes");
        requireAmount(line.getAccessoires(), "Accessoires");
        requireAmount(line.getMontantTtc(), "Montant TTC");
        requireAmount(line.getCommissionNette(), "Commission nette");
        validateAllocationPeriod(
                line.getDateEffet(),
                line.getDateEcheance(),
                quittance,
                line.getNumeroQuittanceCompagnie()
        );

        BigDecimal calculatedTtc = line.getPrimeNette()
                .add(line.getMontantTaxes())
                .add(line.getAccessoires());
        if (money(calculatedTtc).compareTo(money(line.getMontantTtc())) != 0) {
            throw new BadRequestException(
                    "Le montant TTC de la quittance " + line.getNumeroQuittanceCompagnie()
                            + " ne correspond pas à prime nette + taxes + accessoires"
            );
        }
    }

    private void validateRequestNumbers(
            Long agenceId,
            Quittance quittance,
            List<AffectationQuittanceCompagnie> entities
    ) {
        Set<String> requestNumbers = new HashSet<>();
        for (AffectationQuittanceCompagnie entity : entities) {
            String normalized = entity.getNumeroQuittanceCompagnie().trim().toUpperCase(Locale.ROOT);
            if (!requestNumbers.add(normalized)) {
                throw new BadRequestException("Le numéro de quittance " + entity.getNumeroQuittanceCompagnie() + " est dupliqué");
            }
            if (affectationRepository
                    .existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNot(
                            agenceId,
                            entity.getCompagnieAssurance().getId(),
                            entity.getNumeroQuittanceCompagnie(),
                            quittance.getId()
                    )) {
                throw new BadRequestException(
                        "Le numéro de quittance " + entity.getNumeroQuittanceCompagnie() + " est déjà affecté"
                );
            }
        }
    }

    private void validateBatchRequestNumbers(
            Long agenceId,
            Collection<Long> quittanceIds,
            List<AffectationQuittanceCompagnie> entities
    ) {
        Set<String> requestNumbers = new HashSet<>();
        for (AffectationQuittanceCompagnie entity : entities) {
            String normalized = entity.getNumeroQuittanceCompagnie().trim().toUpperCase(Locale.ROOT);
            if (!requestNumbers.add(normalized)) {
                throw new BadRequestException("Le numéro de quittance " + entity.getNumeroQuittanceCompagnie() + " est dupliqué");
            }
            if (affectationRepository
                    .existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNotIn(
                            agenceId,
                            entity.getCompagnieAssurance().getId(),
                            entity.getNumeroQuittanceCompagnie(),
                            quittanceIds
                    )) {
                throw new BadRequestException("Le numéro de quittance " + entity.getNumeroQuittanceCompagnie() + " est déjà affecté");
            }
        }
    }

    private List<Quittance> requireCompatibleFleetBatch(Long agenceId, Collection<Long> requestedIds) {
        if (requestedIds == null || requestedIds.size() < 2) {
            throw new BadRequestException("Sélectionnez au moins deux quittances pour une affectation groupée");
        }
        List<Long> ids = requestedIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.size() != requestedIds.size()) {
            throw new BadRequestException("La sélection contient des quittances dupliquées ou invalides");
        }
        List<Quittance> quittances = ids.stream().map(id -> requireQuittance(agenceId, id)).toList();
        Quittance reference = quittances.get(0);
        Long contractId = reference.getContrat().getId();
        Long companyId = requireQuittanceCompagnie(reference).getId();
        if (reference.getContrat().getTypeContrat() != TypeContrat.FLOTTE
                || quittances.stream().anyMatch(item -> item.getContrat().getTypeContrat() != TypeContrat.FLOTTE)
                || quittances.stream().anyMatch(item -> !item.getContrat().getId().equals(contractId))
                || quittances.stream().anyMatch(item -> !requireQuittanceCompagnie(item).getId().equals(companyId))) {
            throw new BadRequestException("Les quittances groupées doivent appartenir à la même flotte, police et compagnie");
        }
        Long ruleId = requireEffectiveRule(agenceId, reference).getId();
        if (quittances.stream().anyMatch(item -> !requireEffectiveRule(agenceId, item).getId().equals(ruleId))) {
            throw new BadRequestException("Les quittances sélectionnées n'utilisent pas la même règle d'affectation");
        }
        return quittances.stream().sorted(Comparator.comparing(this::resolveDateEffet)).toList();
    }

    private LotAffectationQuittanceResponse buildBatchResponse(
            List<Quittance> quittances,
            List<AffectationQuittanceCompagnie> entities,
            BigDecimal expected,
            RegleAffectationQuittance regle
    ) {
        Map<Long, List<AffectationQuittanceCompagnie>> byQuittance = entities.stream()
                .collect(Collectors.groupingBy(item -> item.getQuittance().getId()));
        Map<Long, String> subscribers = resolveSouscripteurs(
                quittances.stream().map(item -> item.getContrat().getId()).collect(Collectors.toSet())
        );
        List<AffectationQuittanceResponse> responses = quittances.stream()
                .map(item -> toResponse(
                        item,
                        byQuittance.getOrDefault(item.getId(), List.of()),
                        subscribers.get(item.getContrat().getId()),
                        requireEffectiveRule(item.getContrat().getAgence().getId(), item),
                        true
                ))
                .toList();
        BigDecimal affected = entities.stream().map(AffectationQuittanceCompagnie::getMontantTtc).reduce(ZERO, BigDecimal::add);
        BigDecimal difference = money(affected.subtract(expected));
        EcartPolicy policy = evaluateDifference(regle, difference);
        return LotAffectationQuittanceResponse.builder()
                .quittances(responses)
                .lignes(entities.stream().map(this::toLineResponse).toList())
                .montantTtcAttendu(money(expected))
                .montantTtcAffecte(money(affected))
                .ecart(difference)
                .equilibre(policy.level() == NiveauEcartAffectation.EQUILIBRE)
                .seuilAvertissementEcart(policy.warningThreshold())
                .margeManquanteMaximale(policy.shortageLimit())
                .margeDepassementMaximale(policy.excessLimit())
                .niveauEcart(policy.level())
                .validationAutorisee(policy.allowed())
                .build();
    }

    private BigDecimal calculateCommission(Quittance quittance, RegleAffectationQuittance regle) {
        List<LigneQuittance> categoryLines = accountingCategoryLines(quittance);
        if (categoryLines.isEmpty()) {
            throw new BadRequestException(
                    "Les lignes comptables de la quittance sont requises pour calculer la commission"
            );
        }

        Map<CategorieQuittance, BigDecimal> primes = categoryLines.stream()
                .collect(Collectors.toMap(
                        LigneQuittance::getCategorie,
                        line -> requiredAmount(line.getPrimeNette(), "Prime nette d'une ligne de quittance"),
                        BigDecimal::add
                ));
        BigDecimal categoryNetTotal = primes.values().stream().reduce(ZERO, BigDecimal::add);
        BigDecimal quittanceNetTotal = requiredAmount(quittance.getPrimeNette(), "Prime nette de la quittance");
        if (money(categoryNetTotal).compareTo(money(quittanceNetTotal)) != 0) {
            throw new BadRequestException(
                    "Le total net des lignes comptables ne correspond pas à la prime nette de la quittance"
            );
        }

        BigDecimal base = percent(primes.getOrDefault(CategorieQuittance.AUTOMOBILE, ZERO), regle.getTauxCommissionAutomobile())
                .add(percent(primes.getOrDefault(CategorieQuittance.EVCAT, ZERO), regle.getTauxCommissionEvcat()))
                .add(percent(primes.getOrDefault(CategorieQuittance.CORPOREL, ZERO), regle.getTauxCommissionCorporel()));
        if (regle.getModeCalculCommission() == ModeCalculCommission.TAUX_BRUT_TVA_INCLUSE) {
            base = base.subtract(percent(base, regle.getTauxTvaIncluseCommission()));
        }
        return money(base);
    }

    private BigDecimal calculateCommissionForCategory(LigneQuittance line, RegleAffectationQuittance regle) {
        BigDecimal base = switch (line.getCategorie()) {
            case AUTOMOBILE -> percent(requiredAmount(line.getPrimeNette(), "Prime nette automobile"), regle.getTauxCommissionAutomobile());
            case EVCAT -> percent(requiredAmount(line.getPrimeNette(), "Prime nette EVCAT"), regle.getTauxCommissionEvcat());
            case CORPOREL -> percent(requiredAmount(line.getPrimeNette(), "Prime nette corporel"), regle.getTauxCommissionCorporel());
            case ASSISTANCE, TOTAL -> ZERO;
        };
        if (regle.getModeCalculCommission() == ModeCalculCommission.TAUX_BRUT_TVA_INCLUSE) {
            base = base.subtract(percent(base, regle.getTauxTvaIncluseCommission()));
        }
        return money(base);
    }

    private List<AffectationQuittanceResponse.Ligne> buildAutomaticCategoryPreviewLines(
            Quittance quittance,
            RegleAffectationQuittance regle,
            boolean avecRetenue
    ) {
        return accountingCategoryLines(quittance).stream()
                .filter(line -> isAffectableCategory(line.getCategorie()))
                .filter(line -> money(line.getPrimeTotale()).compareTo(ZERO) != 0 || money(line.getPrimeNette()).compareTo(ZERO) != 0)
                .map(line -> {
                    BigDecimal commission = calculateCommissionForCategory(line, regle);
                    Retention retention = calculateRetention(commission, avecRetenue, regle);
                    BigDecimal montantTtc = requiredAmount(line.getPrimeTotale(), "Montant TTC de " + line.getCategorie().name());
                    BigDecimal accessoires = requiredAmount(line.getAccessoire(), "Accessoires de " + line.getCategorie().name())
                            .add(requiredAmount(line.getCnpac(), "CNPAC de " + line.getCategorie().name()));
                    return AffectationQuittanceResponse.Ligne.builder()
                            .numeroQuittanceCompagnie("")
                            .source(SourceAffectationQuittance.AUTOMATIQUE)
                            .dateEffet(resolveDateEffet(quittance))
                            .dateEcheance(resolveDateEcheance(quittance))
                            .categorieSource(categoryLabel(line.getCategorie()))
                            .categorieQuittance(line.getCategorie())
                            .primeNette(requiredAmount(line.getPrimeNette(), "Prime nette de " + line.getCategorie().name()))
                            .montantTaxes(requiredAmount(line.getTaxe(), "Taxes de " + line.getCategorie().name())
                                    .add(requiredAmount(line.getTaxeParafiscale(), "Taxe parafiscale de " + line.getCategorie().name())))
                            .accessoires(money(accessoires))
                            .montantTtc(montantTtc)
                            .commissionNette(commission)
                            .avecRetenue(avecRetenue)
                            .tauxRetenue(retention.rate())
                            .montantRetenue(retention.amount())
                            .netCompagnie(money(montantTtc.subtract(commission).add(retention.amount())))
                            .build();
                })
                .toList();
    }

    private List<LigneQuittance> accountingCategoryLines(Quittance quittance) {
        return ligneQuittanceRepository
                .findByQuittanceIdOrderByOrdreAsc(quittance.getId())
                .stream()
                .filter(line -> !Boolean.TRUE.equals(line.getGlobale()))
                .toList();
    }

    private boolean isAffectableCategory(CategorieQuittance categorie) {
        return categorie == CategorieQuittance.AUTOMOBILE
                || categorie == CategorieQuittance.EVCAT
                || categorie == CategorieQuittance.CORPOREL;
    }

    private Retention calculateRetention(
            BigDecimal commissionNette,
            Boolean avecRetenue,
            RegleAffectationQuittance regle
    ) {
        if (!Boolean.TRUE.equals(avecRetenue)) {
            return new Retention(rate(regle.getTauxRetenue()), ZERO);
        }
        return new Retention(
                rate(regle.getTauxRetenue()),
                money(percent(commissionNette, regle.getTauxRetenue()))
        );
    }

    private AffectationQuittanceResponse toResponse(
            Quittance quittance,
            List<AffectationQuittanceCompagnie> affectations,
            String souscripteur,
            RegleAffectationQuittance regle,
            boolean includeLines
    ) {
        BigDecimal expected = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal allocated = affectations.stream()
                .map(AffectationQuittanceCompagnie::getMontantTtc)
                .map(value -> requiredAmount(value, "Montant TTC d'une affectation"))
                .reduce(ZERO, BigDecimal::add);
        if (regle == null && !affectations.isEmpty()) {
            throw new BadRequestException(
                    "La règle ayant produit cette affectation n'est plus disponible"
            );
        }
        StatutAffectationQuittance statut = affectations.isEmpty()
                ? StatutAffectationQuittance.NON_AFFECTEE
                : resolveStatus(expected, allocated);
        boolean avecRetenue = affectations.stream()
                .findFirst()
                .map(AffectationQuittanceCompagnie::getAvecRetenue)
                .map(Boolean.TRUE::equals)
                .orElse(regle != null && Boolean.TRUE.equals(regle.getRetenueParDefaut()));
        Contrat contrat = quittance.getContrat();

        return AffectationQuittanceResponse.builder()
                .quittanceId(quittance.getId())
                .contratId(contrat.getId())
                .mouvementId(quittance.getMouvementContrat() != null ? quittance.getMouvementContrat().getId() : null)
                .dossier(firstNonBlank(contrat.getNumeroDossier(), contrat.getNumeroContrat(), "#" + contrat.getId()))
                .produit(productLabel(contrat))
                .typeContrat(contrat.getTypeContrat())
                .mouvement(movementLabel(quittance))
                .nature(resolveNature(quittance))
                .souscripteur(firstNonBlank(souscripteur, "-"))
                .police(firstNonBlank(contrat.getNumeroPolice(), contrat.getNumeroContrat(), "-"))
                .compagnieId(resolveCompagnieId(quittance))
                .compagnie(resolveCompagnieName(quittance))
                .dateEffet(resolveDateEffet(quittance))
                .dateEcheance(resolveDateEcheance(quittance))
                .primeNette(requiredAmount(quittance.getPrimeNette(), "Prime nette de la quittance"))
                .montantTaxes(money(
                        requiredAmount(quittance.getTaxe(), "Taxes de la quittance")
                                .add(requiredAmount(quittance.getTaxeParafiscale(), "Taxe parafiscale de la quittance"))
                ))
                .accessoires(money(
                        requiredAmount(quittance.getAccessoire(), "Accessoires de la quittance")
                                .add(requiredAmount(quittance.getCnpac(), "CNPAC de la quittance"))
                ))
                .montantTtc(expected)
                .montantAffecte(money(allocated))
                .ecart(money(allocated.subtract(expected)))
                .avecRetenue(avecRetenue)
                .statutAffectation(statut)
                .regle(regle != null ? toRuleResponse(regle) : null)
                .lignes(includeLines
                        ? affectations.stream()
                                .sorted(Comparator
                                        .comparing(
                                                AffectationQuittanceCompagnie::getDateEffet,
                                                Comparator.nullsLast(Comparator.naturalOrder())
                                        )
                                        .thenComparing(
                                                AffectationQuittanceCompagnie::getNumeroQuittanceCompagnie,
                                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                                        ))
                                .map(this::toLineResponse)
                                .toList()
                        : List.of())
                .build();
    }

    private NatureAffectationQuittance resolveNature(Quittance quittance) {
        if (quittance.getElementFacturable() != null
                && quittance.getElementFacturable().getNature() == NatureElementFacturable.CARTE_VERTE) {
            return NatureAffectationQuittance.CARTE_VERTE;
        }
        if (quittance.getMouvementContrat() == null
                || quittance.getMouvementContrat().getTypeMouvement() == null) {
            return null;
        }
        return switch (quittance.getMouvementContrat().getTypeMouvement().getCategorie()) {
            case AFFAIRE_NOUVELLE -> NatureAffectationQuittance.AFFAIRE_NOUVELLE;
            case AVENANT -> NatureAffectationQuittance.AVENANT;
            case RENOUVELLEMENT -> NatureAffectationQuittance.RENOUVELLEMENT;
            case DOCUMENT, SERVICE -> null;
        };
    }

    private AffectationQuittanceResponse.Ligne toLineResponse(AffectationQuittanceCompagnie entity) {
        return AffectationQuittanceResponse.Ligne.builder()
                .id(entity.getId())
                .quittanceId(entity.getQuittance().getId())
                .numeroQuittanceCompagnie(entity.getNumeroQuittanceCompagnie())
                .source(entity.getSource())
                .dateEffet(entity.getDateEffet())
                .dateEcheance(entity.getDateEcheance())
                .acteSource(entity.getActeSource())
                .categorieSource(entity.getCategorieSource())
                .categorieQuittance(entity.getCategorieQuittance())
                .statutSource(entity.getStatutSource())
                .fichierSource(entity.getFichierSource())
                .primeNette(entity.getPrimeNette())
                .montantTaxes(entity.getMontantTaxes())
                .accessoires(entity.getAccessoires())
                .montantTtc(entity.getMontantTtc())
                .commissionNette(entity.getCommissionNette())
                .avecRetenue(entity.getAvecRetenue())
                .tauxRetenue(entity.getTauxRetenue())
                .montantRetenue(entity.getMontantRetenue())
                .netCompagnie(entity.getNetCompagnie())
                .build();
    }

    private ParsedImport parseImport(
            MultipartFile file,
            List<Quittance> quittances,
            RegleAffectationQuittance regle,
            boolean avecRetenue
    ) {
        Quittance referenceQuittance = quittances.get(0);
        Set<Long> selectedIds = quittances.stream().map(Quittance::getId).collect(Collectors.toSet());
        List<AffectationQuittanceResponse.Ligne> lines = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> numbers = new HashSet<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new BadRequestException("Le fichier Excel ne contient aucune feuille");
            }
            Sheet sheet = resolveImportSheet(workbook, regle);
            int headerRowIndex = regle.getExcelLigneEntete() - 1;
            Row headerRow = sheet.getRow(headerRowIndex);
            if (headerRow == null) {
                throw new BadRequestException(
                        "L'en-tête Excel est manquant à la ligne " + regle.getExcelLigneEntete()
                );
            }
            Map<String, Integer> columns = resolveImportColumns(readHeaders(headerRow), regle);
            String expectedPolicy = normalizeIdentifier(referenceQuittance.getContrat().getNumeroPolice());

            for (int rowIndex = headerRow.getRowNum() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isEmptyRow(row)) {
                    continue;
                }
                try {
                    String number = requiredText(row, columns, "noquittance", rowIndex);
                    String policy = text(row, columns, "nopolice");
                    if (columns.containsKey("nopolice")
                            && expectedPolicy != null
                            && !expectedPolicy.equals(normalizeIdentifier(policy))) {
                        throw new BadRequestException("la police " + policy + " ne correspond pas à " + referenceQuittance.getContrat().getNumeroPolice());
                    }
                    if (!numbers.add(number.trim().toUpperCase(Locale.ROOT))) {
                        throw new BadRequestException("le numéro " + number + " est dupliqué dans le fichier");
                    }
                    if (affectationRepository
                            .existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNotIn(
                                    referenceQuittance.getContrat().getAgence().getId(),
                                    requireQuittanceCompagnie(referenceQuittance).getId(),
                                    number,
                                    selectedIds
                            )) {
                        throw new BadRequestException("le numéro " + number + " est déjà affecté");
                    }
                    BigDecimal primeNette = decimal(row, columns, "primenette");
                    BigDecimal taxes = decimal(row, columns, "taxe");
                    BigDecimal accessoires = decimal(row, columns, "accessoires");
                    BigDecimal montantTtc = decimal(row, columns, "montantttc");
                    BigDecimal commission = decimal(row, columns, "commissionnette");
                    BigDecimal netCompagnie = decimal(row, columns, "netcompagnie");
                    LocalDate lineEffectDate = date(row, columns, "dateeffet");
                    LocalDate lineEndDate = optionalDate(row, columns, "datefin");
                    String act = text(row, columns, "acte");
                    Quittance target = matchImportTarget(quittances, act, lineEffectDate);
                    if (target != null) {
                        validateAllocationPeriod(lineEffectDate, lineEndDate, target, number);
                    }
                    BigDecimal calculatedTtc = primeNette.add(taxes).add(accessoires);
                    if (money(calculatedTtc).compareTo(money(montantTtc)) != 0) {
                        throw new BadRequestException("le montant TTC ne correspond pas à prime nette + taxes + accessoires");
                    }
                    Retention retention = calculateRetention(commission, avecRetenue, regle);
                    lines.add(AffectationQuittanceResponse.Ligne.builder()
                            .quittanceId(target == null ? null : target.getId())
                            .numeroQuittanceCompagnie(number)
                            .source(SourceAffectationQuittance.IMPORT)
                            .dateEffet(lineEffectDate)
                            .dateEcheance(lineEndDate)
                            .acteSource(act)
                            .categorieSource(text(row, columns, "categorie"))
                            .statutSource(text(row, columns, "statut"))
                            .fichierSource(cleanFileName(file.getOriginalFilename()))
                            .primeNette(money(primeNette))
                            .montantTaxes(money(taxes))
                            .accessoires(money(accessoires))
                            .montantTtc(money(montantTtc))
                            .commissionNette(money(commission))
                            .avecRetenue(avecRetenue)
                            .tauxRetenue(retention.rate())
                            .montantRetenue(retention.amount())
                            .netCompagnie(money(netCompagnie))
                            .build());
                } catch (RuntimeException exception) {
                    errors.add("Ligne " + (rowIndex + 1) + " : " + exception.getMessage());
                }
            }
        } catch (IOException exception) {
            throw new BadRequestException("Lecture du fichier Excel impossible");
        }
        if (lines.isEmpty() && errors.isEmpty()) {
            errors.add("Le fichier ne contient aucune ligne exploitable");
        }
        propagateImportTargetsByQuittanceFamily(lines, quittances);
        return new ParsedImport(lines, errors);
    }

    private ParsedImport parseBatchImport(
            MultipartFile file,
            List<Quittance> quittances,
            RegleAffectationQuittance regle,
            boolean avecRetenue
    ) {
        return parseImport(file, quittances, regle, avecRetenue);
    }

    private Quittance matchImportTarget(
            List<Quittance> candidates,
            String act,
            LocalDate dateEffet
    ) {
        if (candidates.size() == 1) return candidates.get(0);
        String normalizedAct = normalizeHeader(act == null ? "" : act);
        List<Quittance> actMatches = normalizedAct.isBlank() ? List.of() : candidates.stream()
                .filter(candidate -> {
                    String movement = candidate.getMouvementContrat() == null
                            ? "affaire nouvelle"
                            : candidate.getMouvementContrat().getTypeMouvement().getLibelle();
                    String normalizedMovement = normalizeHeader(movement);
                    return normalizedAct.contains(normalizedMovement) || normalizedMovement.contains(normalizedAct);
                })
                .toList();
        if (actMatches.size() == 1) return actMatches.get(0);
        List<Quittance> exactDateMatches = candidates.stream()
                .filter(candidate -> resolveDateEffet(candidate).equals(dateEffet))
                .toList();
        return exactDateMatches.size() == 1 ? exactDateMatches.get(0) : null;
    }

    private void propagateImportTargetsByQuittanceFamily(
            List<AffectationQuittanceResponse.Ligne> lines,
            List<Quittance> candidates
    ) {
        if (candidates.size() < 2) {
            return;
        }

        Map<String, Set<Long>> matchedTargetsByFamily = new HashMap<>();
        for (AffectationQuittanceResponse.Ligne line : lines) {
            String family = quittanceNumberFamily(line.getNumeroQuittanceCompagnie());
            if (family != null && line.getQuittanceId() != null) {
                matchedTargetsByFamily
                        .computeIfAbsent(family, ignored -> new HashSet<>())
                        .add(line.getQuittanceId());
            }
        }

        Map<Long, Quittance> candidatesById = candidates.stream()
                .collect(Collectors.toMap(Quittance::getId, Function.identity()));
        for (AffectationQuittanceResponse.Ligne line : lines) {
            if (line.getQuittanceId() != null) {
                continue;
            }
            String family = quittanceNumberFamily(line.getNumeroQuittanceCompagnie());
            Set<Long> matchedTargets = family == null ? null : matchedTargetsByFamily.get(family);
            if (matchedTargets == null || matchedTargets.size() != 1) {
                continue;
            }
            Quittance target = candidatesById.get(matchedTargets.iterator().next());
            if (target != null && isWithinAllocationPeriod(line, target)) {
                line.setQuittanceId(target.getId());
            }
        }
    }

    private String quittanceNumberFamily(String number) {
        String normalized = trimToNull(number);
        if (normalized == null) {
            return null;
        }
        String family = normalized.toUpperCase(Locale.ROOT)
                .replaceFirst("[\\s._/-]+\\d+$", "")
                .trim();
        return family.equals(normalized.toUpperCase(Locale.ROOT).trim()) || family.isBlank()
                ? null
                : family;
    }

    private boolean isWithinAllocationPeriod(
            AffectationQuittanceResponse.Ligne line,
            Quittance target
    ) {
        LocalDate dateEffet = line.getDateEffet();
        LocalDate dateEcheance = line.getDateEcheance();
        LocalDate periodStart = resolveDateEffet(target);
        LocalDate periodEnd = resolveDateEcheance(target);
        return dateEffet != null
                && periodStart != null
                && periodEnd != null
                && !dateEffet.isBefore(periodStart)
                && !dateEffet.isAfter(periodEnd)
                && (dateEcheance == null
                || (!dateEcheance.isBefore(dateEffet) && !dateEcheance.isAfter(periodEnd)));
    }

    private Sheet resolveImportSheet(Workbook workbook, RegleAffectationQuittance regle) {
        String configuredSheet = trimToNull(regle.getExcelFeuille());
        if (configuredSheet == null) {
            return workbook.getSheetAt(0);
        }
        Sheet sheet = workbook.getSheet(configuredSheet);
        if (sheet == null) {
            throw new BadRequestException("La feuille Excel « " + configuredSheet + " » est introuvable");
        }
        return sheet;
    }

    private Map<String, Integer> readHeaders(Row row) {
        Map<String, Integer> columns = new HashMap<>();
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        for (Cell cell : row) {
            String key = normalizeHeader(formatter.formatCellValue(cell));
            if (!key.isBlank()) {
                columns.put(key, cell.getColumnIndex());
            }
        }
        return columns;
    }

    private Map<String, Integer> resolveImportColumns(
            Map<String, Integer> sourceColumns,
            RegleAffectationQuittance regle
    ) {
        Map<String, Integer> columns = new HashMap<>();
        List<String> missing = new ArrayList<>();
        resolveImportColumn(sourceColumns, columns, missing, "nopolice", regle.getExcelColonneNumeroPolice(), false);
        resolveImportColumn(sourceColumns, columns, missing, "noquittance", regle.getExcelColonneNumeroQuittance(), true);
        resolveImportColumn(sourceColumns, columns, missing, "dateeffet", regle.getExcelColonneDateEffet(), true);
        resolveImportColumn(sourceColumns, columns, missing, "datefin", regle.getExcelColonneDateEcheance(), false);
        resolveImportColumn(sourceColumns, columns, missing, "primenette", regle.getExcelColonnePrimeNette(), true);
        resolveImportColumn(sourceColumns, columns, missing, "taxe", regle.getExcelColonneTaxes(), true);
        resolveImportColumn(sourceColumns, columns, missing, "accessoires", regle.getExcelColonneAccessoires(), true);
        resolveImportColumn(sourceColumns, columns, missing, "montantttc", regle.getExcelColonneMontantTtc(), true);
        resolveImportColumn(sourceColumns, columns, missing, "commissionnette", regle.getExcelColonneCommissionNette(), true);
        resolveImportColumn(sourceColumns, columns, missing, "netcompagnie", regle.getExcelColonneNetCompagnie(), true);
        resolveImportColumn(sourceColumns, columns, missing, "acte", regle.getExcelColonneActe(), false);
        resolveImportColumn(sourceColumns, columns, missing, "categorie", regle.getExcelColonneCategorie(), false);
        resolveImportColumn(sourceColumns, columns, missing, "statut", regle.getExcelColonneStatut(), false);
        if (!missing.isEmpty()) {
            throw new BadRequestException("Colonnes Excel manquantes : " + String.join(", ", missing));
        }
        return columns;
    }

    private void resolveImportColumn(
            Map<String, Integer> sourceColumns,
            Map<String, Integer> resolvedColumns,
            List<String> missing,
            String key,
            String configuredTitles,
            boolean required
    ) {
        String titles = trimToNull(configuredTitles);
        if (titles == null) {
            if (required) {
                missing.add(key);
            }
            return;
        }
        for (String title : titles.split("\\|")) {
            String normalized = normalizeHeader(title);
            Integer index = sourceColumns.get(normalized);
            if (!normalized.isBlank() && index != null) {
                resolvedColumns.put(key, index);
                return;
            }
        }
        if (required) {
            missing.add(titles.replace("|", " / "));
        }
    }

    private BigDecimal decimal(Row row, Map<String, Integer> columns, String key) {
        Cell cell = cell(row, columns, key);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            throw new BadRequestException("montant manquant pour " + key);
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            return money(BigDecimal.valueOf(cell.getNumericCellValue()));
        }
        String raw = new DataFormatter(Locale.FRANCE).formatCellValue(cell);
        String normalized = raw.replace("\u00A0", "").replace(" ", "");
        if (normalized.contains(",")) {
            normalized = normalized.replace(".", "").replace(",", ".");
        }
        try {
            return money(new BigDecimal(normalized));
        } catch (NumberFormatException exception) {
            throw new BadRequestException("montant invalide pour " + key);
        }
    }

    private LocalDate date(Row row, Map<String, Integer> columns, String key) {
        LocalDate result = optionalDate(row, columns, key);
        if (result == null) {
            throw new BadRequestException("date manquante pour " + key);
        }
        return result;
    }

    private LocalDate optionalDate(Row row, Map<String, Integer> columns, String key) {
        Cell cell = cell(row, columns, key);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return null;
        }
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        String raw = new DataFormatter(Locale.FRANCE).formatCellValue(cell).trim();
        for (DateTimeFormatter formatter : List.of(
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ISO_LOCAL_DATE
        )) {
            try {
                return LocalDate.parse(raw, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next supported format.
            }
        }
        throw new BadRequestException("date invalide pour " + key);
    }

    private String requiredText(Row row, Map<String, Integer> columns, String key, int rowIndex) {
        String value = text(row, columns, key);
        if (trimToNull(value) == null) {
            throw new BadRequestException(key + " manquant à la ligne " + (rowIndex + 1));
        }
        return value.trim();
    }

    private String text(Row row, Map<String, Integer> columns, String key) {
        Cell cell = cell(row, columns, key);
        return cell == null ? null : trimToNull(new DataFormatter(Locale.FRANCE).formatCellValue(cell));
    }

    private Cell cell(Row row, Map<String, Integer> columns, String key) {
        Integer index = columns.get(key);
        return index == null ? null : row.getCell(index);
    }

    private boolean isEmptyRow(Row row) {
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        for (Cell cell : row) {
            if (!formatter.formatCellValue(cell).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private void validateRule(UpsertRegleAffectationQuittanceRequest request, Long agenceId, Long excludedId) {
        if (request.getDateFin() != null && request.getDateFin().isBefore(request.getDateDebut())) {
            throw new BadRequestException("La date de fin doit être postérieure ou égale à la date de début");
        }
        validatePercentage(request.getTauxCommissionAutomobile(), "Taux commission automobile");
        validatePercentage(request.getTauxCommissionEvcat(), "Taux commission EVCAT");
        validatePercentage(request.getTauxCommissionCorporel(), "Taux commission corporel");
        validatePercentage(request.getTauxTvaIncluseCommission(), "Taux TVA incluse");
        validatePercentage(request.getTauxRetenue(), "Taux retenue");
        BigDecimal warningThreshold = requiredAmount(
                request.getSeuilAvertissementEcart(),
                "Seuil d'avertissement d'écart"
        );
        BigDecimal shortageLimit = requiredAmount(
                request.getMargeManquanteMaximale(),
                "Marge manquante maximale"
        );
        BigDecimal excessLimit = requiredAmount(
                request.getMargeDepassementMaximale(),
                "Marge de dépassement maximale"
        );
        if (warningThreshold.signum() < 0 || shortageLimit.signum() < 0 || excessLimit.signum() < 0) {
            throw new BadRequestException("Les marges d'écart doivent être positives ou nulles");
        }
        if (warningThreshold.compareTo(shortageLimit) > 0
                || warningThreshold.compareTo(excessLimit) > 0) {
            throw new BadRequestException(
                    "La marge sans alerte doit être inférieure ou égale aux marges maximales"
            );
        }
        if (request.getTypeContrat() == TypeContrat.FLOTTE
                && request.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT) {
            throw new BadRequestException("Une règle flotte doit utiliser le mode manuel/import");
        }
        if (request.getTypeContrat() == TypeContrat.FLOTTE
                && request.getModeVentilation() != ModeVentilationQuittance.GLOBALE) {
            throw new BadRequestException("Une règle flotte doit utiliser une ventilation globale");
        }
        if (request.getTypeContrat() == TypeContrat.FLOTTE
                && (request.getModeCalculCommission() != ModeCalculCommission.TAUX_NET
                || request.getTauxCommissionAutomobile().signum() != 0
                || request.getTauxCommissionEvcat().signum() != 0
                || request.getTauxCommissionCorporel().signum() != 0
                || request.getTauxTvaIncluseCommission().signum() != 0)) {
            throw new BadRequestException(
                    "Les taux de commission par catégorie ne s'appliquent pas aux quittances flotte"
            );
        }
        if (request.getTypeContrat() == TypeContrat.FLOTTE) {
            validateExcelImportConfiguration(request);
        }
        if (request.getTypeContrat() != TypeContrat.FLOTTE
                && request.getModeAffectation() != ModeAffectationQuittance.AUTOMATIQUE) {
            throw new BadRequestException("Une règle Mono ou Convention doit utiliser le mode automatique");
        }
        if (request.getTypeContrat() != TypeContrat.FLOTTE
                && request.getModeCalculCommission() == ModeCalculCommission.TAUX_NET
                && request.getTauxTvaIncluseCommission().signum() != 0) {
            throw new BadRequestException(
                    "Le taux de TVA sur commission doit être nul en mode commission nette"
            );
        }
        long overlaps = regleRepository.countOverlappingRules(
                agenceId,
                request.getCompagnieAssuranceId(),
                request.getTypeContrat(),
                request.getDateDebut(),
                request.getDateFin() != null ? request.getDateFin() : OPEN_ENDED_DATE,
                excludedId
        );
        if (Boolean.TRUE.equals(request.getActif()) && overlaps > 0) {
            throw new BadRequestException("Une règle active existe déjà sur cette période");
        }
    }

    private void validateExcelImportConfiguration(UpsertRegleAffectationQuittanceRequest request) {
        if (request.getExcelLigneEntete() == null || request.getExcelLigneEntete() < 1) {
            throw new BadRequestException("La ligne d'en-tête Excel doit être supérieure ou égale à 1");
        }
        Map<String, String> required = new LinkedHashMap<>();
        required.put("N° quittance", request.getExcelColonneNumeroQuittance());
        required.put("Date effet", request.getExcelColonneDateEffet());
        required.put("Prime nette", request.getExcelColonnePrimeNette());
        required.put("Taxes", request.getExcelColonneTaxes());
        required.put("Accessoires", request.getExcelColonneAccessoires());
        required.put("Montant TTC", request.getExcelColonneMontantTtc());
        required.put("Commission nette", request.getExcelColonneCommissionNette());
        required.put("Net compagnie", request.getExcelColonneNetCompagnie());
        List<String> missing = required.entrySet().stream()
                .filter(entry -> trimToNull(entry.getValue()) == null)
                .map(Map.Entry::getKey)
                .toList();
        if (!missing.isEmpty()) {
            throw new BadRequestException(
                    "Titres Excel obligatoires manquants : " + String.join(", ", missing)
            );
        }
        Map<String, String> configuredAliases = new HashMap<>();
        registerExcelAliases(configuredAliases, "N° police", request.getExcelColonneNumeroPolice());
        registerExcelAliases(configuredAliases, "N° quittance", request.getExcelColonneNumeroQuittance());
        registerExcelAliases(configuredAliases, "Date effet", request.getExcelColonneDateEffet());
        registerExcelAliases(configuredAliases, "Date échéance", request.getExcelColonneDateEcheance());
        registerExcelAliases(configuredAliases, "Prime nette", request.getExcelColonnePrimeNette());
        registerExcelAliases(configuredAliases, "Taxes", request.getExcelColonneTaxes());
        registerExcelAliases(configuredAliases, "Accessoires", request.getExcelColonneAccessoires());
        registerExcelAliases(configuredAliases, "Montant TTC", request.getExcelColonneMontantTtc());
        registerExcelAliases(configuredAliases, "Commission nette", request.getExcelColonneCommissionNette());
        registerExcelAliases(configuredAliases, "Net compagnie", request.getExcelColonneNetCompagnie());
        registerExcelAliases(configuredAliases, "Acte", request.getExcelColonneActe());
        registerExcelAliases(configuredAliases, "Catégorie", request.getExcelColonneCategorie());
        registerExcelAliases(configuredAliases, "Statut", request.getExcelColonneStatut());
    }

    private void registerExcelAliases(Map<String, String> aliases, String field, String configuredTitles) {
        String titles = trimToNull(configuredTitles);
        if (titles == null) {
            return;
        }
        for (String title : titles.split("\\|")) {
            String normalized = normalizeHeader(title);
            if (normalized.isBlank()) {
                continue;
            }
            String existingField = aliases.putIfAbsent(normalized, field);
            if (existingField != null && !existingField.equals(field)) {
                throw new BadRequestException(
                        "Le titre Excel « " + title.trim() + " » est affecté à "
                                + existingField + " et " + field
                );
            }
        }
    }

    private void validateAllocationPeriod(
            LocalDate dateEffet,
            LocalDate dateEcheance,
            Quittance quittance,
            String numeroQuittance
    ) {
        if (dateEffet == null) {
            throw new BadRequestException("La date d'effet de la quittance " + numeroQuittance + " est obligatoire");
        }
        LocalDate periodStart = resolveDateEffet(quittance);
        LocalDate periodEnd = resolveDateEcheance(quittance);
        if (periodStart == null || periodEnd == null) {
            throw new BadRequestException("La période de la quittance de production est incomplète");
        }
        if (dateEffet.isBefore(periodStart) || dateEffet.isAfter(periodEnd)) {
            throw new BadRequestException(
                    "La date d'effet de la quittance " + numeroQuittance + " est hors de la période de production"
            );
        }
        if (dateEcheance != null
                && (dateEcheance.isBefore(dateEffet) || dateEcheance.isAfter(periodEnd))) {
            throw new BadRequestException(
                    "La date d'échéance de la quittance " + numeroQuittance + " est invalide"
            );
        }
    }

    private void applyRule(
            RegleAffectationQuittance entity,
            UpsertRegleAffectationQuittanceRequest request
    ) {
        entity.setTypeContrat(request.getTypeContrat());
        entity.setModeAffectation(request.getModeAffectation());
        entity.setModeVentilation(request.getModeVentilation() != null ? request.getModeVentilation() : ModeVentilationQuittance.GLOBALE);
        entity.setModeCalculCommission(request.getModeCalculCommission());
        entity.setTauxCommissionAutomobile(request.getTauxCommissionAutomobile());
        entity.setTauxCommissionEvcat(request.getTauxCommissionEvcat());
        entity.setTauxCommissionCorporel(request.getTauxCommissionCorporel());
        entity.setTauxTvaIncluseCommission(request.getTauxTvaIncluseCommission());
        entity.setRetenueParDefaut(request.getRetenueParDefaut());
        entity.setTauxRetenue(request.getTauxRetenue());
        entity.setSeuilAvertissementEcart(money(request.getSeuilAvertissementEcart()));
        entity.setMargeManquanteMaximale(money(request.getMargeManquanteMaximale()));
        entity.setMargeDepassementMaximale(money(request.getMargeDepassementMaximale()));
        entity.setDateDebut(request.getDateDebut());
        entity.setDateFin(request.getDateFin());
        entity.setExcelFeuille(trimToNull(request.getExcelFeuille()));
        entity.setExcelLigneEntete(request.getExcelLigneEntete() != null ? request.getExcelLigneEntete() : 1);
        entity.setExcelColonneNumeroPolice(trimToNull(request.getExcelColonneNumeroPolice()));
        entity.setExcelColonneNumeroQuittance(trimToNull(request.getExcelColonneNumeroQuittance()));
        entity.setExcelColonneDateEffet(trimToNull(request.getExcelColonneDateEffet()));
        entity.setExcelColonneDateEcheance(trimToNull(request.getExcelColonneDateEcheance()));
        entity.setExcelColonnePrimeNette(trimToNull(request.getExcelColonnePrimeNette()));
        entity.setExcelColonneTaxes(trimToNull(request.getExcelColonneTaxes()));
        entity.setExcelColonneAccessoires(trimToNull(request.getExcelColonneAccessoires()));
        entity.setExcelColonneMontantTtc(trimToNull(request.getExcelColonneMontantTtc()));
        entity.setExcelColonneCommissionNette(trimToNull(request.getExcelColonneCommissionNette()));
        entity.setExcelColonneNetCompagnie(trimToNull(request.getExcelColonneNetCompagnie()));
        entity.setExcelColonneActe(trimToNull(request.getExcelColonneActe()));
        entity.setExcelColonneCategorie(trimToNull(request.getExcelColonneCategorie()));
        entity.setExcelColonneStatut(trimToNull(request.getExcelColonneStatut()));
        entity.setActif(request.getActif());
    }

    private RegleAffectationQuittanceResponse toRuleResponse(RegleAffectationQuittance entity) {
        return RegleAffectationQuittanceResponse.builder()
                .id(entity.getId())
                .compagnieAssuranceId(entity.getCompagnieAssurance().getId())
                .compagnie(entity.getCompagnieAssurance().getNom())
                .typeContrat(entity.getTypeContrat())
                .modeAffectation(entity.getModeAffectation())
                .modeVentilation(entity.getModeVentilation())
                .modeCalculCommission(entity.getModeCalculCommission())
                .tauxCommissionAutomobile(entity.getTauxCommissionAutomobile())
                .tauxCommissionEvcat(entity.getTauxCommissionEvcat())
                .tauxCommissionCorporel(entity.getTauxCommissionCorporel())
                .tauxTvaIncluseCommission(entity.getTauxTvaIncluseCommission())
                .retenueParDefaut(entity.getRetenueParDefaut())
                .tauxRetenue(entity.getTauxRetenue())
                .seuilAvertissementEcart(entity.getSeuilAvertissementEcart())
                .margeManquanteMaximale(entity.getMargeManquanteMaximale())
                .margeDepassementMaximale(entity.getMargeDepassementMaximale())
                .dateDebut(entity.getDateDebut())
                .dateFin(entity.getDateFin())
                .excelFeuille(entity.getExcelFeuille())
                .excelLigneEntete(entity.getExcelLigneEntete())
                .excelColonneNumeroPolice(entity.getExcelColonneNumeroPolice())
                .excelColonneNumeroQuittance(entity.getExcelColonneNumeroQuittance())
                .excelColonneDateEffet(entity.getExcelColonneDateEffet())
                .excelColonneDateEcheance(entity.getExcelColonneDateEcheance())
                .excelColonnePrimeNette(entity.getExcelColonnePrimeNette())
                .excelColonneTaxes(entity.getExcelColonneTaxes())
                .excelColonneAccessoires(entity.getExcelColonneAccessoires())
                .excelColonneMontantTtc(entity.getExcelColonneMontantTtc())
                .excelColonneCommissionNette(entity.getExcelColonneCommissionNette())
                .excelColonneNetCompagnie(entity.getExcelColonneNetCompagnie())
                .excelColonneActe(entity.getExcelColonneActe())
                .excelColonneCategorie(entity.getExcelColonneCategorie())
                .excelColonneStatut(entity.getExcelColonneStatut())
                .actif(entity.getActif())
                .build();
    }

    private RegleAffectationQuittance requireEffectiveRule(Long agenceId, Quittance quittance) {
        Long companyId = resolveCompagnieId(quittance);
        if (companyId == null) {
            throw new BadRequestException("La compagnie du contrat est obligatoire pour affecter la quittance");
        }
        LocalDate effectDate = resolveDateEffet(quittance);
        if (effectDate == null) {
            throw new BadRequestException("La date d'effet de la quittance est obligatoire");
        }
        List<RegleAffectationQuittance> rules = regleRepository.findEffectiveRules(
                agenceId,
                companyId,
                quittance.getContrat().getTypeContrat(),
                effectDate
        );
        if (rules.isEmpty()) {
            throw new BadRequestException(
                    "Aucune règle d'affectation active ne couvre cette compagnie, ce type de contrat et cette date d'effet"
            );
        }
        if (rules.size() > 1) {
            throw new BadRequestException("Plusieurs règles d'affectation couvrent cette quittance");
        }
        return rules.get(0);
    }

    private RegleAffectationQuittance findEffectiveRuleOrNull(
            List<RegleAffectationQuittance> rules,
            Quittance quittance
    ) {
        Long companyId = resolveCompagnieId(quittance);
        LocalDate effectDate = resolveDateEffet(quittance);
        if (companyId == null || effectDate == null) {
            return null;
        }
        return rules.stream()
                .filter(RegleAffectationQuittance::getActif)
                .filter(rule -> rule.getCompagnieAssurance().getId().equals(companyId))
                .filter(rule -> rule.getTypeContrat() == quittance.getContrat().getTypeContrat())
                .filter(rule -> !rule.getDateDebut().isAfter(effectDate))
                .filter(rule -> rule.getDateFin() == null || !rule.getDateFin().isBefore(effectDate))
                .max(Comparator.comparing(RegleAffectationQuittance::getDateDebut))
                .orElse(null);
    }

    private void validateMode(
            TypeContrat typeContrat,
            RegleAffectationQuittance regle,
            SourceAffectationQuittance source
    ) {
        if (typeContrat == TypeContrat.FLOTTE
                && (regle.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT
                || source == SourceAffectationQuittance.AUTOMATIQUE)) {
            throw new BadRequestException("La flotte exige une affectation manuelle ou importée");
        }
        if (typeContrat != TypeContrat.FLOTTE
                && (regle.getModeAffectation() != ModeAffectationQuittance.AUTOMATIQUE
                || source != SourceAffectationQuittance.AUTOMATIQUE)) {
            throw new BadRequestException("Mono et Convention exigent une affectation automatique");
        }
    }

    private Map<Long, String> resolveSouscripteurs(Collection<Long> contratIds) {
        if (contratIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<ContratClient>> grouped = contratClientRepository
                .findByContratIdInAndRole(contratIds, RoleClientContrat.SOUSCRIPTEUR)
                .stream()
                .collect(Collectors.groupingBy(item -> item.getContrat().getId()));
        Map<Long, String> result = new HashMap<>();
        grouped.forEach((contratId, clients) -> clients.stream()
                .sorted(Comparator.comparing(item -> !Boolean.TRUE.equals(item.getPrincipalPourRole())))
                .findFirst()
                .ifPresent(item -> result.put(contratId, item.getClient().getNomAffichage())));
        return result;
    }

    private Quittance requireQuittance(Long agenceId, Long quittanceId) {
        validateTenant(agenceId);
        return quittanceRepository.findByContratAgenceIdAndIdAndGlobaleTrue(agenceId, quittanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Quittance", quittanceId));
    }

    private Agence requireAgence(Long agenceId) {
        validateTenant(agenceId);
        return agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
    }

    private CompagnieAssurance requireCompagnie(Long id) {
        return compagnieRepository.findById(id)
                .filter(company -> Boolean.TRUE.equals(company.getActif()))
                .orElseThrow(() -> new ResourceNotFoundException("Compagnie", id));
    }

    private CompagnieAssurance requireQuittanceCompagnie(Quittance quittance) {
        CompagnieAssurance company = quittance.getCompagnieAssurance();
        if (company == null) {
            throw new BadRequestException("La compagnie enregistrée sur la quittance est obligatoire");
        }
        return company;
    }

    private void validateTenant(Long agenceId) {
        if (agenceId == null) {
            throw new BadRequestException("Agence courante manquante");
        }
    }

    private StatutAffectationQuittance resolveStatus(
            BigDecimal expected,
            BigDecimal allocated
    ) {
        if (money(allocated).compareTo(money(expected)) == 0) {
            return StatutAffectationQuittance.AFFECTEE;
        }
        if (expected.signum() == allocated.signum() && allocated.abs().compareTo(expected.abs()) < 0) {
            return StatutAffectationQuittance.PARTIELLEMENT_AFFECTEE;
        }
        return StatutAffectationQuittance.AVEC_ECART;
    }

    private EcartPolicy evaluateDifference(RegleAffectationQuittance regle, BigDecimal difference) {
        BigDecimal warningThreshold = money(regle.getSeuilAvertissementEcart() != null
                ? regle.getSeuilAvertissementEcart()
                : new BigDecimal("0.01"));
        BigDecimal shortageLimit = money(regle.getMargeManquanteMaximale() != null
                ? regle.getMargeManquanteMaximale()
                : new BigDecimal("20.00"));
        BigDecimal excessLimit = money(regle.getMargeDepassementMaximale() != null
                ? regle.getMargeDepassementMaximale()
                : new BigDecimal("50.00"));
        if (warningThreshold.signum() < 0
                || shortageLimit.compareTo(warningThreshold) < 0
                || excessLimit.compareTo(warningThreshold) < 0) {
            throw new BadRequestException("Les marges d'écart de la règle d'affectation sont invalides");
        }

        BigDecimal roundedDifference = money(difference);
        BigDecimal absoluteDifference = roundedDifference.abs();
        BigDecimal applicableLimit = roundedDifference.signum() < 0 ? shortageLimit : excessLimit;
        NiveauEcartAffectation level;
        if (absoluteDifference.compareTo(warningThreshold) <= 0) {
            level = NiveauEcartAffectation.EQUILIBRE;
        } else if (absoluteDifference.compareTo(applicableLimit) <= 0) {
            level = NiveauEcartAffectation.AVERTISSEMENT;
        } else {
            level = NiveauEcartAffectation.BLOQUANT;
        }
        return new EcartPolicy(warningThreshold, shortageLimit, excessLimit, level);
    }

    private void requireAllowedDifference(RegleAffectationQuittance regle, BigDecimal difference) {
        EcartPolicy policy = evaluateDifference(regle, difference);
        if (!policy.allowed()) {
            boolean shortage = difference.signum() < 0;
            BigDecimal applicableLimit = shortage ? policy.shortageLimit() : policy.excessLimit();
            throw new BadRequestException(
                    (shortage ? "Le montant manquant de " : "Le dépassement de ")
                            + money(difference).abs().toPlainString()
                            + " MAD dépasse la marge autorisée de "
                            + applicableLimit.toPlainString() + " MAD"
            );
        }
    }

    private String movementLabel(Quittance quittance) {
        if (quittance.getMouvementContrat() != null
                && quittance.getMouvementContrat().getTypeMouvement() != null) {
            return quittance.getMouvementContrat().getTypeMouvement().getLibelle();
        }
        return firstNonBlank(quittance.getType(), "Quittance");
    }

    private String productLabel(Contrat contrat) {
        return switch (contrat.getTypeContrat()) {
            case PARTICULIER -> "Mono";
            case CONVENTION -> "Convention";
            case FLOTTE -> "Flotte";
        };
    }

    private String categoryLabel(CategorieQuittance categorie) {
        return switch (categorie) {
            case AUTOMOBILE -> "Automobile";
            case EVCAT -> "EVCAT";
            case CORPOREL -> "Corporel";
            case ASSISTANCE -> "Assistance";
            case TOTAL -> "Total";
        };
    }

    private LocalDate resolveDateEffet(Quittance quittance) {
        return quittance.getDateDebut();
    }

    private LocalDate resolveDateEcheance(Quittance quittance) {
        return quittance.getDateFin();
    }

    private Long resolveCompagnieId(Quittance quittance) {
        return requireQuittanceCompagnie(quittance).getId();
    }

    private String resolveCompagnieName(Quittance quittance) {
        return requireQuittanceCompagnie(quittance).getNom();
    }

    private void validatePercentage(BigDecimal value, String label) {
        if (value == null || value.signum() < 0 || value.compareTo(HUNDRED) > 0) {
            throw new BadRequestException(label + " doit être compris entre 0 et 100");
        }
    }

    private void requireAmount(BigDecimal value, String label) {
        if (value == null) {
            throw new BadRequestException(label + " est obligatoire");
        }
    }

    private BigDecimal percent(BigDecimal base, BigDecimal rate) {
        return requiredAmount(base, "Base de calcul")
                .multiply(requiredAmount(rate, "Taux de calcul"))
                .divide(HUNDRED, 8, RoundingMode.HALF_UP);
    }

    private BigDecimal requiredAmount(BigDecimal value, String label) {
        if (value == null) {
            throw new BadRequestException(label + " est obligatoire");
        }
        return value;
    }

    private BigDecimal money(BigDecimal value) {
        return requiredAmount(value, "Montant").setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal rate(BigDecimal value) {
        return requiredAmount(value, "Taux").setScale(4, RoundingMode.HALF_UP);
    }

    private <T> BigDecimal sum(List<T> values, Function<T, BigDecimal> getter) {
        return money(values.stream()
                .map(getter)
                .map(value -> requiredAmount(value, "Montant d'une ligne"))
                .reduce(ZERO, BigDecimal::add));
    }

    private <T> Set<Long> ids(Collection<T> values, Function<T, Long> getter) {
        return values.stream().map(getter).collect(Collectors.toSet());
    }

    private long countStatus(List<AffectationQuittanceResponse> rows, StatutAffectationQuittance status) {
        return rows.stream().filter(row -> row.getStatutAffectation() == status).count();
    }

    private String normalizeSearch(String value) {
        String normalized = trimToNull(value);
        return normalized != null ? normalized.toLowerCase(Locale.ROOT) : null;
    }

    private String normalizeHeader(String value) {
        String ascii = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        return ascii.replace("°", "o").replaceAll("[^a-z0-9]", "");
    }

    private String normalizeIdentifier(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private String cleanFileName(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new BadRequestException("Le nom du fichier source est obligatoire");
        }
        return normalized.replace("\\", "_").replace("/", "_");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private record Retention(BigDecimal rate, BigDecimal amount) {
    }

    private record EcartPolicy(
            BigDecimal warningThreshold,
            BigDecimal shortageLimit,
            BigDecimal excessLimit,
            NiveauEcartAffectation level
    ) {
        private boolean allowed() {
            return level != NiveauEcartAffectation.BLOQUANT;
        }
    }

    private record ParsedImport(
            List<AffectationQuittanceResponse.Ligne> lines,
            List<String> errors
    ) {
    }
}
