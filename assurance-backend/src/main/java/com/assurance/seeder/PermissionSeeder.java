package com.assurance.seeder;

import com.assurance.entity.Permission;
import com.assurance.repository.PermissionRepository;
import com.assurance.security.PermissionCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(1)
@RequiredArgsConstructor
public class PermissionSeeder implements CommandLineRunner {
    private final PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        for (PermissionCatalog.Definition definition : PermissionCatalog.definitions()) {
            Permission permission = permissionRepository.findByCode(definition.code())
                    .orElseGet(() -> Permission.builder().code(definition.code()).build());
            permission.setNom(definition.name());
            permission.setModule(definition.module());
            permission.setDescription(definition.description());
            permission.setSuperAdminOnly(definition.superAdminOnly());
            permissionRepository.save(permission);
        }
    }
}
