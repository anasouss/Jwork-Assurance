package com.assurance.activity;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/** Explicitly selected business fields, formatted once on the authoritative side. */
public final class ActivityValues {
    private final Map<String, String> values = new LinkedHashMap<>();

    public ActivityValues put(String label, Object value) {
        values.put(label, format(value));
        return this;
    }

    public Map<String, String> snapshot() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }

    public static List<ActivityChange> changes(Map<String, String> before, Map<String, String> after) {
        Map<String, String> oldValues = before == null ? Map.of() : before;
        Map<String, String> newValues = after == null ? Map.of() : after;
        var labels = new LinkedHashSet<>(oldValues.keySet());
        labels.addAll(newValues.keySet());
        List<ActivityChange> changes = new ArrayList<>();
        for (String label : labels) {
            ActivityChange change = new ActivityChange(label, oldValues.get(label), newValues.get(label));
            if (change.changed()) changes.add(change);
        }
        return List.copyOf(changes);
    }

    private static String format(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean flag) return flag ? "Oui" : "Non";
        if (value instanceof LocalDate date) return date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        if (value instanceof LocalDateTime date) return date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        if (value instanceof BigDecimal decimal) {
            DecimalFormatSymbols symbols = new DecimalFormatSymbols();
            symbols.setGroupingSeparator(' ');
            symbols.setDecimalSeparator(',');
            return new DecimalFormat("#,##0.00############################", symbols).format(decimal);
        }
        return value.toString();
    }
}
