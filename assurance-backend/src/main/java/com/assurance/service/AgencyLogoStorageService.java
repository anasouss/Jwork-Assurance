package com.assurance.service;

import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
public class AgencyLogoStorageService {

    private static final long MAX_LOGO_SIZE = 4L * 1024L * 1024L;
    private static final int MAX_LOGO_WIDTH = 1600;
    private static final int MAX_LOGO_HEIGHT = 800;

    @Value("${app.storage.agency-logos-dir:/data/assurance/agency-logos}")
    private String agencyLogosDir;

    @PostConstruct
    void initializeStorage() {
        Path root = storageRoot();
        try {
            Files.createDirectories(root);
        } catch (IOException error) {
            throw new IllegalStateException("Impossible d'initialiser le stockage des logos d'agence: " + root, error);
        }
        if (!Files.isWritable(root)) {
            throw new IllegalStateException("Le stockage des logos d'agence n'est pas accessible en ecriture: " + root);
        }
    }

    public StoredLogo store(Long agencyId, String agencyCode, MultipartFile file) {
        byte[] content = normalize(file);
        String safeCode = agencyCode == null ? "agence" : agencyCode.toLowerCase().replaceAll("[^a-z0-9-]", "-");
        String fileName = "logo-" + safeCode + "-" + UUID.randomUUID() + ".png";
        Path key = Path.of(String.valueOf(agencyId)).resolve(fileName);
        Path target = resolveStorageKey(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException error) {
            throw new BadRequestException("Stockage du logo impossible");
        }
        deleteOnRollback(target);
        return new StoredLogo(key.toString(), fileName, "image/png");
    }

    public Resource load(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new ResourceNotFoundException("Logo agence introuvable");
        }
        try {
            Path path = resolveStorageKey(Path.of(storageKey));
            if (!Files.isRegularFile(path)) {
                throw new ResourceNotFoundException("Logo agence introuvable");
            }
            return new FileSystemResource(path);
        } catch (IllegalArgumentException | IllegalStateException error) {
            throw new ResourceNotFoundException("Logo agence introuvable");
        }
    }

    public byte[] loadBytes(String storageKey) {
        try {
            return load(storageKey).getContentAsByteArray();
        } catch (IOException error) {
            throw new ResourceNotFoundException("Logo agence introuvable");
        }
    }

    public byte[] loadBytesIfPresent(String storageKey) {
        return storageKey == null || storageKey.isBlank() ? null : loadBytes(storageKey);
    }

    public void deleteAfterCommit(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }
        Path path;
        try {
            path = resolveStorageKey(Path.of(storageKey));
        } catch (IllegalArgumentException | IllegalStateException error) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(path);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(path);
            }
        });
    }

    private byte[] normalize(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Le fichier logo est obligatoire");
        }
        if (file.getSize() > MAX_LOGO_SIZE) {
            throw new BadRequestException("Le logo ne doit pas dépasser 4 Mo");
        }
        if (!"image/png".equals(file.getContentType()) && !"image/jpeg".equals(file.getContentType())) {
            throw new BadRequestException("Le logo doit être au format PNG ou JPEG");
        }
        try {
            BufferedImage source = ImageIO.read(file.getInputStream());
            if (source == null || source.getWidth() < 32 || source.getHeight() < 32) {
                throw new BadRequestException("Le fichier image est invalide ou trop petit");
            }
            double ratio = Math.min(1d, Math.min(
                    (double) MAX_LOGO_WIDTH / source.getWidth(),
                    (double) MAX_LOGO_HEIGHT / source.getHeight()
            ));
            int width = Math.max(1, (int) Math.round(source.getWidth() * ratio));
            int height = Math.max(1, (int) Math.round(source.getHeight() * ratio));
            BufferedImage normalized = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            Graphics2D graphics = normalized.createGraphics();
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, width, height, null);
            graphics.dispose();
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (!ImageIO.write(normalized, "png", output)) {
                    throw new BadRequestException("Impossible de convertir le logo");
                }
                return output.toByteArray();
            }
        } catch (IOException error) {
            throw new BadRequestException("Impossible de lire le fichier logo");
        }
    }

    private Path storageRoot() {
        return Path.of(agencyLogosDir).toAbsolutePath().normalize();
    }

    private Path resolveStorageKey(Path storageKey) {
        if (storageKey.isAbsolute()) {
            throw new IllegalStateException("Une cle de stockage relative est obligatoire");
        }
        Path root = storageRoot();
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalStateException("La cle de stockage sort du repertoire autorise");
        }
        return resolved;
    }

    private void deleteOnRollback(Path path) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    deleteQuietly(path);
                }
            }
        });
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Database metadata remains authoritative; orphan cleanup can retry later.
        }
    }

    public record StoredLogo(String storageKey, String fileName, String contentType) {
    }
}
