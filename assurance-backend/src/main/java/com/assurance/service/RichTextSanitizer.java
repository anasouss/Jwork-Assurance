package com.assurance.service;

import com.assurance.exception.BadRequestException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

@Component
public class RichTextSanitizer {

    private static final int MAX_LENGTH = 2000;
    private static final Safelist PRESTATIONS_SAFELIST = Safelist.none()
            .addTags("p", "br", "strong", "b", "em", "i", "ul", "ol", "li");

    public String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        Document.OutputSettings outputSettings = new Document.OutputSettings().prettyPrint(false);
        String sanitized = Jsoup.clean(value.trim(), "", PRESTATIONS_SAFELIST, outputSettings).trim();
        if (sanitized.length() > MAX_LENGTH) {
            throw new BadRequestException("Les prestations ne doivent pas depasser 2000 caracteres, formatage inclus");
        }
        return sanitized.isBlank() ? null : sanitized;
    }
}
