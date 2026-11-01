package com.assurance.service;

import com.assurance.entity.ReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ReglementClientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;

@Service
@RequiredArgsConstructor
public class QuittancePrimeClientService {
    private final ReglementClientRepository paymentRepository;
    private final StorageLayoutService storage;
    private final QuittancePrimeSelectionService selections;

    @Transactional
    public Receipt issue(Long agencyId, Long paymentId) {
        ReglementClient payment = paymentRepository.findByIdAndAgenceIdForUpdate(paymentId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        requireValid(payment);
        if (payment.getQuittancePrimeNumero() != null || payment.getQuittancePrimeDateEmission() != null
                || payment.getQuittancePrimeCheminStockage() != null) return stored(payment);
        return selections.issueAll(agencyId, paymentId);
    }

    @Transactional(readOnly = true)
    public Receipt read(Long agencyId, Long paymentId) {
        ReglementClient payment = paymentRepository.findByIdAndAgenceId(paymentId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        requireValid(payment);
        if (payment.getQuittancePrimeNumero() != null || payment.getQuittancePrimeDateEmission() != null
                || payment.getQuittancePrimeCheminStockage() != null) return stored(payment);
        return selections.readAll(agencyId, paymentId);
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

    public record Receipt(String reference, byte[] pdf) {
    }
}
