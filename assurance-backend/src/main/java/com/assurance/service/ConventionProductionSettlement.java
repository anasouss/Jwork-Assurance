package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.EcartReglementClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeDocumentClient;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import java.math.BigDecimal;

/** A production source is collected only after its entire client amount is settled. */
final class ConventionProductionSettlement {
    private ConventionProductionSettlement() {
    }

    static Predicate collected(Root<ElementFacturable> element, CriteriaQuery<?> query, CriteriaBuilder cb, Long agency) {
        var direct = query.subquery(BigDecimal.class);
        var allocation = direct.from(AffectationReglementClient.class);
        var payment = allocation.join("instrument").join("reglement");
        direct.select(cb.coalesce(cb.sum(allocation.<BigDecimal>get("montant")), BigDecimal.ZERO))
                .where(cb.equal(allocation.get("elementFacturable"), element),
                        cb.isNull(allocation.get("documentClient")),
                        cb.equal(payment.get("agence").get("id"), agency),
                        cb.equal(payment.get("statut"), StatutReglementClient.VALIDE),
                        cb.equal(allocation.get("statut"), StatutAffectationReglement.CONFIRMEE));

        var directAdjustments = query.subquery(BigDecimal.class);
        var adjustment = directAdjustments.from(EcartReglementClient.class);
        directAdjustments.select(cb.coalesce(cb.sum(adjustment.<BigDecimal>get("montant")), BigDecimal.ZERO))
                .where(cb.equal(adjustment.get("elementFacturable"), element),
                        cb.isNull(adjustment.get("documentClient")), cb.equal(adjustment.get("agence").get("id"), agency),
                        cb.equal(adjustment.get("reglement").get("agence").get("id"), agency),
                        cb.equal(adjustment.get("reglement").get("statut"), StatutReglementClient.VALIDE));

        // Parent invoice payments cannot be credited in full to every source line.
        // Credit a line's own snapshot amount only once that invoice is fully settled.
        var invoiceAmounts = query.subquery(BigDecimal.class);
        var line = invoiceAmounts.from(LigneDocumentClient.class);
        var invoice = line.join("document");
        var confirmed = invoiceAmounts.subquery(BigDecimal.class);
        var invoiceAllocation = confirmed.from(AffectationReglementClient.class);
        var invoicePayment = invoiceAllocation.join("instrument").join("reglement");
        confirmed.select(cb.coalesce(cb.sum(invoiceAllocation.<BigDecimal>get("montant")), BigDecimal.ZERO))
                .where(cb.equal(invoiceAllocation.get("documentClient"), invoice),
                        cb.equal(invoicePayment.get("agence").get("id"), agency),
                        cb.equal(invoicePayment.get("statut"), StatutReglementClient.VALIDE),
                        cb.equal(invoiceAllocation.get("statut"), StatutAffectationReglement.CONFIRMEE));
        var invoiceAdjustments = invoiceAmounts.subquery(BigDecimal.class);
        var invoiceAdjustment = invoiceAdjustments.from(EcartReglementClient.class);
        invoiceAdjustments.select(cb.coalesce(cb.sum(invoiceAdjustment.<BigDecimal>get("montant")), BigDecimal.ZERO))
                .where(cb.equal(invoiceAdjustment.get("documentClient"), invoice),
                        cb.equal(invoiceAdjustment.get("agence").get("id"), agency),
                        cb.equal(invoiceAdjustment.get("reglement").get("agence").get("id"), agency),
                        cb.equal(invoiceAdjustment.get("reglement").get("statut"), StatutReglementClient.VALIDE));
        invoiceAmounts.select(cb.coalesce(cb.sum(line.<BigDecimal>get("montantTtc")), BigDecimal.ZERO))
                .where(cb.equal(line.get("elementFacturable"), element),
                        cb.equal(invoice.get("agence").get("id"), agency),
                        cb.equal(invoice.get("statut"), StatutDocumentClient.EMIS),
                        cb.equal(invoice.get("typeDocument"), TypeDocumentClient.FACTURE),
                        cb.greaterThan(invoice.<BigDecimal>get("totalDocument"), BigDecimal.ZERO),
                        cb.greaterThan(line.<BigDecimal>get("montantTtc"), BigDecimal.ZERO),
                        cb.greaterThanOrEqualTo(cb.sum(confirmed, invoiceAdjustments), invoice.<BigDecimal>get("totalDocument")));

        // Each quarterly line keeps the complete source bulletin as a snapshot.
        // Comparing to it prevents a single paid quarter from settling the annual source.
        var bulletin = query.subquery(BigDecimal.class);
        var snapshot = bulletin.from(LigneDocumentClient.class);
        bulletin.select(cb.max(snapshot.<BigDecimal>get("montantBulletinConvention")))
                .where(cb.equal(snapshot.get("elementFacturable"), element),
                        cb.equal(snapshot.get("document").get("agence").get("id"), agency),
                        cb.equal(snapshot.get("document").get("statut"), StatutDocumentClient.EMIS),
                        cb.equal(snapshot.get("document").get("typeDocument"), TypeDocumentClient.FACTURE),
                        cb.greaterThan(snapshot.<BigDecimal>get("montantBulletinConvention"), BigDecimal.ZERO));
        var due = cb.coalesce(bulletin, element.<BigDecimal>get("primeTotale"));
        var settled = cb.sum(cb.sum(direct, directAdjustments), invoiceAmounts);
        return cb.and(cb.greaterThan(due, BigDecimal.ZERO), cb.greaterThanOrEqualTo(settled, due));
    }
}
