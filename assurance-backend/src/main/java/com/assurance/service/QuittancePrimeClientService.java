package com.assurance.service;

import com.assurance.entity.ReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ReglementClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuittancePrimeClientService {
    private final ReglementClientRepository paymentRepository;
    private final StorageLayoutService storage;
    private final QuittancePrimePdfService renderer;

    @Transactional
    public Receipt issue(Long agencyId, Long paymentId) {
        ReglementClient payment = paymentRepository.findByIdAndAgenceIdForUpdate(paymentId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        requireValid(payment);
        if (payment.getQuittancePrimeNumero() != null || payment.getQuittancePrimeDateEmission() != null
                || payment.getQuittancePrimeCheminStockage() != null) return stored(payment);
        LocalDate date = LocalDate.now();
        String reference = String.format(Locale.ROOT, "%d%06d", date.getYear(), payment.getId());
        byte[] pdf = renderer.render(payment, reference, date);
        String key = agencyId + "/" + paymentId + "/" + UUID.randomUUID() + ".pdf";
        Path path = storage.resolveClientPremiumReceipt(agencyId, key);
        try {
            Files.createDirectories(path.getParent());
            Files.write(path, pdf, StandardOpenOption.CREATE_NEW);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status != STATUS_COMMITTED) removeUncommitted(path);
                    }
                });
            }
            payment.setQuittancePrimeNumero(reference);
            payment.setQuittancePrimeDateEmission(date);
            payment.setQuittancePrimeCheminStockage(key);
            paymentRepository.saveAndFlush(payment);
            return new Receipt(reference, pdf);
        } catch (IOException | RuntimeException error) {
            removeUncommitted(path);
            if (error instanceof RuntimeException runtime) throw runtime;
            throw new BadRequestException("L'enregistrement de la quittance de prime a échoué");
        }
    }

    @Transactional(readOnly = true)
    public Receipt read(Long agencyId, Long paymentId) {
        ReglementClient payment = paymentRepository.findByIdAndAgenceId(paymentId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        requireValid(payment);
        return stored(payment);
    }

    private Receipt stored(ReglementClient payment) {
        if (payment.getQuittancePrimeNumero() == null || payment.getQuittancePrimeDateEmission() == null
                || payment.getQuittancePrimeCheminStockage() == null) {
            throw new BadRequestException("Aucune quittance de prime n'a encore été émise pour ce règlement");
        }
        try {
            return new Receipt(payment.getQuittancePrimeNumero(), Files.readAllBytes(storage.resolveClientPremiumReceipt(
                    payment.getAgence().getId(), payment.getQuittancePrimeCheminStockage())));
        } catch (IOException error) {
            throw new BadRequestException("Le PDF émis est indisponible. Restaurez le fichier archivé ; il ne peut pas être régénéré automatiquement");
        }
    }

    private void requireValid(ReglementClient payment) {
        if (payment.getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement est annulé : sa quittance de prime ne peut pas être délivrée");
        }
    }

    private void removeUncommitted(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException error) {
            log.warn("Impossible de supprimer la quittance de prime non validée {}", path, error);
        }
    }

    public record Receipt(String reference, byte[] pdf) {
    }
}
