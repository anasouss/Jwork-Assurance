package com.assurance.repository;

import com.assurance.entity.ClientPortalClaimUpdate;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ClientPortalClaimUpdateRepository extends JpaRepository<ClientPortalClaimUpdate, Long> {
    @Query("select u from ClientPortalClaimUpdate u join u.access a where "
            + ClientPortalAccessRepository.SCOPE + " and " + ClientPortalAccessRepository.CLAIM
            + " and a.sinistre.id = :claim and u.published = true order by u.id desc")
    Page<ClientPortalClaimUpdate> visible(@Param("agency") Long agency, @Param("account") Long account,
                                         @Param("claim") Long claim, Pageable pageable);

    @Query("select u from ClientPortalClaimUpdate u where u.id = :id and u.access.account.agence.id = :agency")
    Optional<ClientPortalClaimUpdate> findForStaff(@Param("agency") Long agency, @Param("id") Long id);

    @Query("select u from ClientPortalClaimUpdate u where u.access.id = :access and u.access.account.agence.id = :agency order by u.id desc")
    Page<ClientPortalClaimUpdate> findForStaff(@Param("agency") Long agency, @Param("access") Long access, Pageable pageable);
}
