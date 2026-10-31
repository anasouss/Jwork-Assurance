package com.assurance.service;

import com.assurance.entity.QuittancePrimeSelection;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.QuittancePrimeSelectionRepository;
import com.assurance.repository.ReglementClientRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.TreeSet;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuittancePrimeSelectionService {
    private final ReglementClientRepository payments;
    private final QuittancePrimeSelectionRepository receipts;
    private final QuittancePrimePdfService renderer;
    private final StorageLayoutService storage;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public Options options(Long agencyId, Long paymentId) {
        ReglementClient payment = payment(agencyId, paymentId, false);
        List<Archive> archives = new ArrayList<>();
        if (payment.getQuittancePrimeNumero() != null) {
            archives.add(new Archive("all", payment.getQuittancePrimeNumero(), payment.getQuittancePrimeDateEmission(), null));
        }
        for (QuittancePrimeSelection receipt : receipts.findByAgenceIdAndReglementIdOrderByIdDesc(agencyId, paymentId)) {
            try {
                archives.add(new Archive(receipt.getId().toString(), receipt.getNumero(), receipt.getDateEmission(),
                        mapper.readValue(receipt.getSelectionJson(), new TypeReference<List<String>>() {})));
            } catch (IOException error) {
                throw new BadRequestException("La sélection archivée de la quittance est illisible");
            }
        }
        return new Options(renderer.policies(payment), archives);
    }

    @Transactional
    public QuittancePrimeClientService.Receipt issue(Long agencyId, Long paymentId, List<String> keys) {
        ReglementClient payment = payment(agencyId, paymentId, true);
        if (keys == null || keys.isEmpty() || keys.size() > 500
                || keys.stream().anyMatch(key -> key == null || !key.matches("[CAD]:[0-9]+"))) {
            throw new BadRequestException("Sélectionnez au moins une police du règlement");
        }
        TreeSet<String> selection = new TreeSet<>(keys);
        String hash = hash(selection);
        var existing = receipts.findByAgenceIdAndReglementIdAndSelectionHash(agencyId, paymentId, hash);
        if (existing.isPresent()) return stored(agencyId, existing.get());
        var available = renderer.policies(payment).stream().map(QuittancePrimePdfService.PolicyOption::key).toList();
        if (!available.containsAll(selection)) {
            throw new BadRequestException("Une police sélectionnée n'appartient pas à ce règlement");
        }
        QuittancePrimeSelection receipt = new QuittancePrimeSelection();
        receipt.setAgence(payment.getAgence());
        receipt.setReglement(payment);
        receipt.setSelectionHash(hash);
        receipt.setDateEmission(LocalDate.now());
        try {
            receipt.setSelectionJson(mapper.writeValueAsString(selection));
        } catch (IOException error) {
            throw new BadRequestException("La sélection de polices ne peut pas être enregistrée");
        }
        receipts.saveAndFlush(receipt);
        // A separate numeric namespace prevents collisions with legacy full-payment receipts.
        String number = String.format(Locale.ROOT, "9%04d%010d", receipt.getDateEmission().getYear(), receipt.getId());
        byte[] pdf = renderer.render(payment, number, receipt.getDateEmission(), selection);
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
            receipt.setNumero(number);
            receipt.setCheminStockage(key);
            receipts.saveAndFlush(receipt);
            return new QuittancePrimeClientService.Receipt(number, pdf);
        } catch (IOException | RuntimeException error) {
            removeUncommitted(path);
            if (error instanceof RuntimeException runtime) throw runtime;
            throw new BadRequestException("L'enregistrement de la quittance de prime a échoué");
        }
    }

    @Transactional(readOnly = true)
    public QuittancePrimeClientService.Receipt read(Long agencyId, Long paymentId, Long receiptId) {
        payment(agencyId, paymentId, false);
        return stored(agencyId, receipts.findByIdAndAgenceIdAndReglementId(receiptId, agencyId, paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Quittance de prime", receiptId)));
    }

    private ReglementClient payment(Long agencyId, Long paymentId, boolean lock) {
        ReglementClient payment = (lock ? payments.findByIdAndAgenceIdForUpdate(paymentId, agencyId)
                : payments.findByIdAndAgenceId(paymentId, agencyId))
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        if (payment.getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement est annulé : sa quittance ne peut pas être délivrée");
        }
        return payment;
    }

    private QuittancePrimeClientService.Receipt stored(Long agencyId, QuittancePrimeSelection receipt) {
        if (receipt.getNumero() == null || receipt.getCheminStockage() == null) {
            throw new BadRequestException("L'archive de la quittance est incomplète");
        }
        try {
            return new QuittancePrimeClientService.Receipt(receipt.getNumero(),
                    Files.readAllBytes(storage.resolveClientPremiumReceipt(agencyId, receipt.getCheminStockage())));
        } catch (IOException error) {
            throw new BadRequestException("Le PDF émis est indisponible. Restaurez le fichier archivé ; il ne peut pas être régénéré automatiquement");
        }
    }

    private static String hash(TreeSet<String> selection) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(String.join("\n", selection).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 indisponible", error);
        }
    }

    private void removeUncommitted(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException error) {
            log.warn("Impossible de supprimer la quittance non validée {}", path, error);
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Archive(String id, String numero, LocalDate dateEmission, List<String> policyKeys) {
    }

    public record Options(List<QuittancePrimePdfService.PolicyOption> policies, List<Archive> archives) {
    }
}
