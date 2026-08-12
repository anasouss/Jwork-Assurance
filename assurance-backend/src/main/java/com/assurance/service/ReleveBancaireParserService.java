package com.assurance.service;

import com.assurance.dto.request.ConfigurationImportReleveBancaireRequest;
import com.assurance.enums.FormatReleveBancaire;
import com.assurance.exception.BadRequestException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ReleveBancaireParserService {

    private static final int PREVIEW_LIMIT = 10;
    private static final Pattern MT940_BALANCE = Pattern.compile(
            ":[6][02][FM]:[CD]([0-9]{6})[A-Z]{3}([0-9,]+)"
    );
    private static final Pattern MT940_LINE = Pattern.compile(
            ":61:([0-9]{6})(?:[0-9]{4})?([R]?[CD])([0-9,]+)(.*)"
    );

    public ParseResult parse(
            Path file,
            FormatReleveBancaire format,
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        try {
            return switch (format) {
                case CSV -> parseTabular(readCsv(file, configuration), configuration);
                case XLSX -> parseTabular(readWorkbook(file, configuration), configuration);
                case MT940 -> parseMt940(file, configuration);
            };
        } catch (BadRequestException error) {
            throw error;
        } catch (Exception error) {
            throw new BadRequestException("Le relevé bancaire ne peut pas être lu: " + error.getMessage());
        }
    }

    private ParseResult parseTabular(
            TabularData data,
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        ConfigurationImportReleveBancaireRequest effective = copyConfiguration(configuration);
        autoMap(effective.getColonnes(), data.headers());
        boolean complete = hasText(effective.getColonnes().getDateOperation())
                && hasText(effective.getColonnes().getLibelle())
                && (hasText(effective.getColonnes().getCredit())
                || hasText(effective.getColonnes().getMontant()));
        List<NormalizedLine> lines = complete
                ? normalizeRows(data.rows(), effective)
                : List.of();
        return new ParseResult(
                data.headers(),
                data.rows().stream().limit(PREVIEW_LIMIT).toList(),
                lines,
                effective,
                complete,
                null,
                null
        );
    }

    private TabularData readCsv(
            Path file,
            ConfigurationImportReleveBancaireRequest configuration
    ) throws IOException {
        Charset charset = charset(configuration.getEncodage());
        String content = Files.readString(file, charset);
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1);
        }
        char delimiter = delimiter(configuration.getSeparateur(), content);
        configuration.setSeparateur(String.valueOf(delimiter));
        List<List<String>> records = parseCsvRecords(content, delimiter);
        return toTabular(records, configuration.getLigneEntete());
    }

    private TabularData readWorkbook(
            Path file,
            ConfigurationImportReleveBancaireRequest configuration
    ) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(file.toFile())) {
            Sheet sheet = selectSheet(workbook, configuration.getFeuille());
            configuration.setFeuille(sheet.getSheetName());
            DataFormatter formatter = new DataFormatter(Locale.FRANCE);
            List<List<String>> records = new ArrayList<>();
            int lastCell = 0;
            for (Row row : sheet) {
                lastCell = Math.max(lastCell, Math.max(row.getLastCellNum(), 0));
            }
            for (Row row : sheet) {
                List<String> values = new ArrayList<>();
                for (int index = 0; index < lastCell; index++) {
                    Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    values.add(cell == null ? "" : formatter.formatCellValue(cell).trim());
                }
                records.add(values);
            }
            return toTabular(records, configuration.getLigneEntete());
        }
    }

    private ParseResult parseMt940(
            Path file,
            ConfigurationImportReleveBancaireRequest configuration
    ) throws IOException {
        ConfigurationImportReleveBancaireRequest effective = copyConfiguration(configuration);
        effective.setEncodage(effective.getEncodage() == null ? "UTF-8" : effective.getEncodage());
        List<NormalizedLine> lines = new ArrayList<>();
        BigDecimal opening = null;
        BigDecimal closing = null;
        NormalizedLine pending = null;
        int number = 0;
        try (BufferedReader reader = Files.newBufferedReader(file, charset(effective.getEncodage()))) {
            String row;
            while ((row = reader.readLine()) != null) {
                Matcher balance = MT940_BALANCE.matcher(row.trim());
                if (balance.matches()) {
                    BigDecimal amount = parseAmount(balance.group(2), "AUTO");
                    if (row.startsWith(":60")) {
                        opening = amount;
                    } else {
                        closing = amount;
                    }
                    continue;
                }
                Matcher operation = MT940_LINE.matcher(row.trim());
                if (operation.matches()) {
                    if (pending != null) {
                        lines.add(pending);
                    }
                    number++;
                    BigDecimal amount = parseAmount(operation.group(3), "AUTO");
                    boolean debit = operation.group(2).endsWith("D");
                    String tail = operation.group(4).trim();
                    pending = new NormalizedLine(
                            number,
                            parseMt940Date(operation.group(1)),
                            null,
                            tail.isBlank() ? "Opération bancaire" : tail,
                            extractMt940Reference(tail),
                            null,
                            null,
                            debit ? amount : BigDecimal.ZERO.setScale(2),
                            debit ? BigDecimal.ZERO.setScale(2) : amount,
                            null,
                            Map.of("mt940", row)
                    );
                    continue;
                }
                if (row.startsWith(":86:") && pending != null) {
                    String description = row.substring(4).trim();
                    pending = pending.withDescription(description.isBlank()
                            ? pending.description()
                            : description);
                }
            }
        }
        if (pending != null) {
            lines.add(pending);
        }
        List<String> headers = List.of(
                "Date opération", "Libellé", "Référence", "Débit", "Crédit", "Solde"
        );
        List<Map<String, String>> preview = lines.stream()
                .limit(PREVIEW_LIMIT)
                .map(line -> {
                    Map<String, String> row = new LinkedHashMap<>();
                    row.put("Date opération", line.operationDate().toString());
                    row.put("Libellé", line.description());
                    row.put("Référence", value(line.reference()));
                    row.put("Débit", line.debit().toPlainString());
                    row.put("Crédit", line.credit().toPlainString());
                    return row;
                })
                .toList();
        return new ParseResult(headers, preview, lines, effective, true, opening, closing);
    }

    private List<NormalizedLine> normalizeRows(
            List<Map<String, String>> rows,
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        List<NormalizedLine> result = new ArrayList<>();
        int sourceRow = configuration.getLigneEntete() == null
                ? 2 : configuration.getLigneEntete() + 1;
        for (Map<String, String> row : rows) {
            if (row.values().stream().allMatch(value -> value == null || value.isBlank())) {
                sourceRow++;
                continue;
            }
            ConfigurationImportReleveBancaireRequest.Colonnes columns = configuration.getColonnes();
            String dateValue = get(row, columns.getDateOperation());
            String description = get(row, columns.getLibelle());
            if (!hasText(dateValue) && !hasText(description)) {
                sourceRow++;
                continue;
            }
            LocalDate operationDate = parseDate(dateValue, configuration.getFormatDate(), sourceRow);
            LocalDate valueDate = hasText(get(row, columns.getDateValeur()))
                    ? parseDate(get(row, columns.getDateValeur()), configuration.getFormatDate(), sourceRow)
                    : null;
            BigDecimal debit;
            BigDecimal credit;
            if (hasText(columns.getMontant())) {
                BigDecimal amount = parseAmount(
                        get(row, columns.getMontant()),
                        configuration.getSeparateurDecimal()
                );
                String direction = normalize(get(row, columns.getSens()));
                boolean isDebit = amount.signum() < 0
                        || Set.of("d", "debit", "db", "sortie").contains(direction);
                amount = amount.abs();
                debit = isDebit ? amount : zero();
                credit = isDebit ? zero() : amount;
            } else {
                debit = parseAmount(get(row, columns.getDebit()), configuration.getSeparateurDecimal());
                credit = parseAmount(get(row, columns.getCredit()), configuration.getSeparateurDecimal());
            }
            if (debit.signum() == 0 && credit.signum() == 0) {
                sourceRow++;
                continue;
            }
            if (debit.signum() > 0 && credit.signum() > 0) {
                throw new BadRequestException(
                        "La ligne " + sourceRow + " contient à la fois un débit et un crédit"
                );
            }
            result.add(new NormalizedLine(
                    sourceRow,
                    operationDate,
                    valueDate,
                    hasText(description) ? description.trim() : "Opération bancaire",
                    trimToNull(get(row, columns.getReference())),
                    trimToNull(get(row, columns.getContrepartie())),
                    trimToNull(get(row, columns.getCompteContrepartie())),
                    money(debit),
                    money(credit),
                    hasText(get(row, columns.getSolde()))
                            ? money(parseAmount(
                            get(row, columns.getSolde()),
                            configuration.getSeparateurDecimal()
                    )) : null,
                    row
            ));
            sourceRow++;
        }
        return result;
    }

    private TabularData toTabular(List<List<String>> records, Integer headerRow) {
        int headerIndex = Math.max((headerRow == null ? 1 : headerRow) - 1, 0);
        if (records.size() <= headerIndex) {
            throw new BadRequestException("La ligne d’en-tête configurée n’existe pas dans le fichier");
        }
        List<String> headers = uniqueHeaders(records.get(headerIndex));
        if (headers.stream().allMatch(String::isBlank)) {
            throw new BadRequestException("Aucune colonne n’a été trouvée dans le relevé");
        }
        List<Map<String, String>> rows = new ArrayList<>();
        for (int rowIndex = headerIndex + 1; rowIndex < records.size(); rowIndex++) {
            List<String> values = records.get(rowIndex);
            Map<String, String> row = new LinkedHashMap<>();
            for (int column = 0; column < headers.size(); column++) {
                row.put(headers.get(column), column < values.size() ? values.get(column).trim() : "");
            }
            rows.add(row);
        }
        return new TabularData(headers, rows);
    }

    private List<String> uniqueHeaders(List<String> rawHeaders) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        List<String> headers = new ArrayList<>();
        for (int index = 0; index < rawHeaders.size(); index++) {
            String base = rawHeaders.get(index) == null || rawHeaders.get(index).isBlank()
                    ? "Colonne " + (index + 1)
                    : rawHeaders.get(index).trim();
            int count = counts.merge(base, 1, Integer::sum);
            headers.add(count == 1 ? base : base + " (" + count + ")");
        }
        return headers;
    }

    private List<List<String>> parseCsvRecords(String content, char delimiter) {
        List<List<String>> records = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < content.length(); index++) {
            char current = content.charAt(index);
            if (current == '"') {
                if (quoted && index + 1 < content.length() && content.charAt(index + 1) == '"') {
                    value.append('"');
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (current == delimiter && !quoted) {
                row.add(value.toString());
                value.setLength(0);
            } else if ((current == '\n' || current == '\r') && !quoted) {
                if (current == '\r' && index + 1 < content.length() && content.charAt(index + 1) == '\n') {
                    index++;
                }
                row.add(value.toString());
                value.setLength(0);
                records.add(row);
                row = new ArrayList<>();
            } else {
                value.append(current);
            }
        }
        if (!row.isEmpty() || value.length() > 0) {
            row.add(value.toString());
            records.add(row);
        }
        if (quoted) {
            throw new BadRequestException("Le fichier CSV contient une valeur entre guillemets non terminée");
        }
        return records;
    }

    private void autoMap(
            ConfigurationImportReleveBancaireRequest.Colonnes columns,
            List<String> headers
    ) {
        columns.setDateOperation(firstMapped(columns.getDateOperation(), headers,
                "dateoperation", "datecomptable", "date", "operationdate"));
        columns.setDateValeur(firstMapped(columns.getDateValeur(), headers,
                "datevaleur", "valuedate"));
        columns.setLibelle(firstMapped(columns.getLibelle(), headers,
                "libelle", "description", "operation", "intitule", "motif"));
        columns.setReference(firstMapped(columns.getReference(), headers,
                "reference", "ref", "referenceoperation", "numeroperation"));
        columns.setContrepartie(firstMapped(columns.getContrepartie(), headers,
                "contrepartie", "beneficiaire", "donneurordre", "payeur", "tiers"));
        columns.setCompteContrepartie(firstMapped(columns.getCompteContrepartie(), headers,
                "comptecontrepartie", "ribcontrepartie", "iban", "compte"));
        columns.setDebit(firstMapped(columns.getDebit(), headers, "debit", "montantdebit"));
        columns.setCredit(firstMapped(columns.getCredit(), headers, "credit", "montantcredit"));
        columns.setMontant(firstMapped(columns.getMontant(), headers, "montant", "amount"));
        columns.setSens(firstMapped(columns.getSens(), headers, "sens", "debitcredit", "type"));
        columns.setSolde(firstMapped(columns.getSolde(), headers, "solde", "balance"));
    }

    private String firstMapped(String current, List<String> headers, String... aliases) {
        if (hasText(current) && headers.contains(current)) {
            return current;
        }
        for (String alias : aliases) {
            for (String header : headers) {
                if (normalize(header).equals(alias)) {
                    return header;
                }
            }
        }
        return null;
    }

    private ConfigurationImportReleveBancaireRequest copyConfiguration(
            ConfigurationImportReleveBancaireRequest source
    ) {
        ConfigurationImportReleveBancaireRequest copy = new ConfigurationImportReleveBancaireRequest();
        if (source == null) {
            return copy;
        }
        copy.setLigneEntete(source.getLigneEntete());
        copy.setFeuille(source.getFeuille());
        copy.setSeparateur(source.getSeparateur());
        copy.setEncodage(source.getEncodage());
        copy.setFormatDate(source.getFormatDate());
        copy.setSeparateurDecimal(source.getSeparateurDecimal());
        copy.setEnregistrerProfil(source.getEnregistrerProfil());
        copy.setNomProfil(source.getNomProfil());
        ConfigurationImportReleveBancaireRequest.Colonnes target = new ConfigurationImportReleveBancaireRequest.Colonnes();
        ConfigurationImportReleveBancaireRequest.Colonnes columns = source.getColonnes();
        if (columns != null) {
            target.setDateOperation(columns.getDateOperation());
            target.setDateValeur(columns.getDateValeur());
            target.setLibelle(columns.getLibelle());
            target.setReference(columns.getReference());
            target.setContrepartie(columns.getContrepartie());
            target.setCompteContrepartie(columns.getCompteContrepartie());
            target.setDebit(columns.getDebit());
            target.setCredit(columns.getCredit());
            target.setMontant(columns.getMontant());
            target.setSens(columns.getSens());
            target.setSolde(columns.getSolde());
        }
        copy.setColonnes(target);
        return copy;
    }

    private Sheet selectSheet(Workbook workbook, String name) {
        if (hasText(name)) {
            Sheet selected = workbook.getSheet(name);
            if (selected == null) {
                throw new BadRequestException("La feuille Excel « " + name + " » est introuvable");
            }
            return selected;
        }
        if (workbook.getNumberOfSheets() == 0) {
            throw new BadRequestException("Le classeur Excel ne contient aucune feuille");
        }
        return workbook.getSheetAt(0);
    }

    private Charset charset(String value) {
        try {
            return hasText(value) ? Charset.forName(value) : StandardCharsets.UTF_8;
        } catch (Exception error) {
            throw new BadRequestException("L’encodage configuré n’est pas reconnu");
        }
    }

    private char delimiter(String configured, String content) {
        if (hasText(configured)) {
            return configured.charAt(0);
        }
        String firstLine = content.lines().findFirst().orElse("");
        char[] candidates = {';', ',', '\t', '|'};
        char best = ';';
        int bestCount = -1;
        for (char candidate : candidates) {
            int count = 0;
            for (int index = 0; index < firstLine.length(); index++) {
                if (firstLine.charAt(index) == candidate) {
                    count++;
                }
            }
            if (count > bestCount) {
                best = candidate;
                bestCount = count;
            }
        }
        return best;
    }

    private LocalDate parseDate(String raw, String pattern, int rowNumber) {
        String value = raw == null ? "" : raw.trim();
        List<String> patterns = new ArrayList<>();
        if (hasText(pattern)) {
            patterns.add(pattern);
        }
        patterns.addAll(List.of("dd/MM/uuuu", "uuuu-MM-dd", "dd-MM-uuuu", "dd.MM.uuuu"));
        for (String candidate : patterns.stream().distinct().toList()) {
            try {
                String strictPattern = candidate.replace("yyyy", "uuuu");
                return LocalDate.parse(value, DateTimeFormatter.ofPattern(strictPattern)
                        .withResolverStyle(ResolverStyle.STRICT));
            } catch (DateTimeParseException ignored) {
                // Try the next accepted format.
            }
        }
        throw new BadRequestException("Date invalide à la ligne " + rowNumber + ": " + value);
    }

    private LocalDate parseMt940Date(String value) {
        int year = Integer.parseInt(value.substring(0, 2));
        year += year >= 70 ? 1900 : 2000;
        return LocalDate.of(
                year,
                Integer.parseInt(value.substring(2, 4)),
                Integer.parseInt(value.substring(4, 6))
        );
    }

    private BigDecimal parseAmount(String raw, String decimalSeparator) {
        if (!hasText(raw)) {
            return zero();
        }
        String value = raw.trim()
                .replace("\u00A0", "")
                .replace("\u202F", "")
                .replace(" ", "")
                .replace("MAD", "")
                .replace("DH", "")
                .replace("'", "")
                .trim();
        boolean parentheses = value.startsWith("(") && value.endsWith(")");
        if (parentheses) {
            value = value.substring(1, value.length() - 1);
        }
        value = normalizeAmountSeparators(value, decimalSeparator);
        try {
            BigDecimal amount = new BigDecimal(value).setScale(2, RoundingMode.HALF_UP);
            return parentheses ? amount.negate() : amount;
        } catch (NumberFormatException error) {
            throw new BadRequestException("Montant bancaire invalide: " + raw);
        }
    }

    private String normalizeAmountSeparators(String value, String configuredSeparator) {
        if (",".equals(configuredSeparator)) {
            return value.replace(".", "").replace(',', '.');
        }
        if (".".equals(configuredSeparator)) {
            return value.replace(",", "");
        }

        int lastComma = value.lastIndexOf(',');
        int lastPoint = value.lastIndexOf('.');
        if (lastComma >= 0 && lastPoint >= 0) {
            return lastComma > lastPoint
                    ? value.replace(".", "").replace(',', '.')
                    : value.replace(",", "");
        }
        if (lastComma >= 0) {
            return normalizeSingleSeparator(value, ',');
        }
        if (lastPoint >= 0) {
            return normalizeSingleSeparator(value, '.');
        }
        return value;
    }

    private String normalizeSingleSeparator(String value, char separator) {
        int lastSeparator = value.lastIndexOf(separator);
        int fractionalDigits = value.length() - lastSeparator - 1;
        boolean decimal = fractionalDigits > 0
                && fractionalDigits <= 2
                && value.indexOf(separator) == lastSeparator;
        if (!decimal) {
            return value.replace(String.valueOf(separator), "");
        }
        return separator == ',' ? value.replace(',', '.') : value;
    }

    private String extractMt940Reference(String tail) {
        int marker = tail.indexOf("//");
        if (marker >= 0 && marker + 2 < tail.length()) {
            return tail.substring(marker + 2).trim();
        }
        return trimToNull(tail);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }

    private String get(Map<String, String> row, String column) {
        return hasText(column) ? Objects.toString(row.get(column), "") : "";
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private String value(String value) {
        return value == null ? "" : value;
    }

    private record TabularData(List<String> headers, List<Map<String, String>> rows) {
    }

    public record ParseResult(
            List<String> headers,
            List<Map<String, String>> preview,
            List<NormalizedLine> lines,
            ConfigurationImportReleveBancaireRequest configuration,
            boolean complete,
            BigDecimal openingBalance,
            BigDecimal closingBalance
    ) {
    }

    public record NormalizedLine(
            int sourceRow,
            LocalDate operationDate,
            LocalDate valueDate,
            String description,
            String reference,
            String counterparty,
            String counterpartyAccount,
            BigDecimal debit,
            BigDecimal credit,
            BigDecimal balance,
            Map<String, String> rawData
    ) {
        private NormalizedLine withDescription(String value) {
            return new NormalizedLine(
                    sourceRow,
                    operationDate,
                    valueDate,
                    value,
                    reference,
                    counterparty,
                    counterpartyAccount,
                    debit,
                    credit,
                    balance,
                    rawData
            );
        }
    }
}
