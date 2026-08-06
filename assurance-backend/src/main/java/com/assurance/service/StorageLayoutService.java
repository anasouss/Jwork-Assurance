package com.assurance.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.function.Function;
import java.util.stream.Stream;

@Slf4j
@Service
public class StorageLayoutService {

    @Value("${app.storage.root-dir:/data/assurance}")
    private String configuredRoot;

    private Path root;

    @PostConstruct
    void initialize() {
        root = Path.of(configuredRoot).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
            if (!Files.isWritable(root)) {
                throw new IllegalStateException("Le stockage applicatif n'est pas accessible en ecriture: " + root);
            }
            migrateLegacyDirectory("agency-logos", this::resolveAgencyLogo);
            migrateLegacyDirectory("agency-signatures", this::resolveAgencySignature);
            migrateLegacyDirectory("pieces-jointes", this::resolveContractAttachment);
            migrateLegacyDirectory("sinistres", this::resolveClaimDocument);
        } catch (IOException error) {
            throw new IllegalStateException("Impossible d'initialiser le stockage applicatif: " + root, error);
        }
    }

    public Path resolveAgencyLogo(Path storageKey) {
        Path key = validateKey(storageKey, 2);
        return agencyRoot(key)
                .resolve("branding")
                .resolve("logo")
                .resolve(key.getName(1).toString())
                .normalize();
    }

    public Path resolveAgencySignature(Path storageKey) {
        Path key = validateKey(storageKey, 2);
        return agencyRoot(key)
                .resolve("branding")
                .resolve("signature")
                .resolve(key.getName(1).toString())
                .normalize();
    }

    public Path resolveContractAttachment(Path storageKey) {
        Path key = validateKey(storageKey, 3, 4);
        Path resolved = agencyRoot(key)
                .resolve("contracts")
                .resolve(key.getName(1).toString())
                .resolve("attachments")
                .resolve(key.getName(2).toString());
        if (key.getNameCount() == 4) {
            resolved = resolved.resolve(key.getName(3).toString());
        }
        return resolved.normalize();
    }

    public Path resolveClaimDocument(Path storageKey) {
        Path key = validateKey(storageKey, 3);
        return agencyRoot(key)
                .resolve("claims")
                .resolve(key.getName(1).toString())
                .resolve("documents")
                .resolve(key.getName(2).toString())
                .normalize();
    }

    public Path resolveClaimDocument(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new IllegalArgumentException("La cle de stockage est obligatoire");
        }
        return resolveClaimDocument(Path.of(storageKey));
    }

    private Path agencyRoot(Path key) {
        Path resolved = root.resolve("agencies").resolve(key.getName(0).toString()).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalStateException("La cle de stockage sort du repertoire autorise");
        }
        return resolved;
    }

    private Path validateKey(Path storageKey, int expectedSegments) {
        return validateKey(storageKey, expectedSegments, expectedSegments);
    }

    private Path validateKey(Path storageKey, int minimumSegments, int maximumSegments) {
        if (storageKey == null || storageKey.isAbsolute()) {
            throw new IllegalArgumentException("Une cle de stockage relative est obligatoire");
        }
        Path key = storageKey.normalize();
        if (key.getNameCount() < minimumSegments
                || key.getNameCount() > maximumSegments
                || !key.getName(0).toString().matches("[1-9][0-9]*")
                || key.startsWith("..")) {
            throw new IllegalArgumentException("Cle de stockage invalide");
        }
        return key;
    }

    private void migrateLegacyDirectory(String directoryName, Function<Path, Path> destinationResolver)
            throws IOException {
        Path legacyRoot = root.resolve(directoryName).normalize();
        if (!Files.isDirectory(legacyRoot)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(legacyRoot)) {
            for (Path source : paths.filter(Files::isRegularFile).toList()) {
                Path relativeKey = legacyRoot.relativize(source);
                Path destination;
                try {
                    destination = destinationResolver.apply(relativeKey);
                } catch (IllegalArgumentException | IllegalStateException error) {
                    log.warn("Fichier de stockage historique ignore car son chemin est invalide: {}", source);
                    continue;
                }
                Files.createDirectories(destination.getParent());
                if (!Files.exists(destination)) {
                    move(source, destination);
                    log.info("Fichier de stockage migre vers la structure agence: {}", relativeKey);
                }
            }
        }
        try {
            removeEmptyDirectories(legacyRoot);
        } catch (IOException error) {
            log.warn("Nettoyage du repertoire de stockage historique ignore: {}", legacyRoot, error);
        }
    }

    private void move(Path source, Path destination) throws IOException {
        try {
            Files.move(source, destination, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(source, destination);
        }
    }

    private void removeEmptyDirectories(Path legacyRoot) throws IOException {
        try (Stream<Path> paths = Files.walk(legacyRoot)) {
            for (Path directory : paths.filter(Files::isDirectory)
                    .filter(directory -> !directory.equals(legacyRoot))
                    .sorted(Comparator.reverseOrder())
                    .toList()) {
                try (Stream<Path> children = Files.list(directory)) {
                    if (children.findAny().isEmpty()) {
                        try {
                            Files.deleteIfExists(directory);
                        } catch (IOException error) {
                            log.warn("Repertoire de stockage historique vide conserve: {}", directory, error);
                        }
                    }
                }
            }
        }
    }
}
