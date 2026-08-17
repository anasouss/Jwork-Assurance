package com.assurance.service;

import com.assurance.entity.DocumentClient;
import com.assurance.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentClientPdfService {

    private final DocumentClientService documentClientService;
    private final ReleveClientPdfRenderer documentClientPdfRenderer;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long documentId, boolean avecSignature) {
        DocumentClient source = documentClientService.findDocument(agenceId, documentId);
        try {
            return documentClientPdfRenderer.render(source, avecSignature);
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Failed to generate PDF for client document {}", documentId, exception);
            throw new BadRequestException("La génération du PDF a échoué");
        }
    }
}
