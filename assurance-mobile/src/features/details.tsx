import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';
import { useSession } from '../auth/session';
import { useData, usePages } from '../api/queries';
import * as s from '../api/schemas';
import { Button, Choices, Collection, Detail, Notice, Row, Screen, Section, State, Status, Txt } from '../components/ui';
import { businessDate, canRead, label, money } from '../lib/domain';
import { DocumentList } from './documents';

const paramsSchema = z.object({ resource: z.enum(['contracts', 'claims', 'clients']), id: s.id });
export function DetailScreen() {
  const params = paramsSchema.safeParse(useLocalSearchParams());
  const { session } = useSession();
  if (!params.success || !session) return <Screen><State empty="Dossier introuvable." /></Screen>;
  const { resource, id } = params.data;
  if (!canRead(session.space, session.user?.permissions ?? [], resource)) return <Screen><Notice error message="Vous n’avez pas accès à ce dossier." /></Screen>;
  if (session.space === 'client') return resource === 'contracts' ? <ClientContract id={id} /> : <ClientClaim id={id} />;
  return resource === 'contracts' ? <StaffContract id={id} /> : resource === 'claims' ? <StaffClaim id={id} /> : <StaffClient id={id} />;
}
function ContractHeading({ item }: { item: s.Contract }) {
  return <>
    <Txt title>{`Police ${item.numeroPolice ?? '-'}`}</Txt><Status value={item.statut} />
    <Detail label="Dossier" value={item.numeroDossier} /><Detail label="Compagnie" value={item.compagnie} />
    <Detail label="Type" value={label(item.type)} /><Detail label="Date d’effet" value={businessDate(item.dateEffet)} />
    <Detail label="Date d’expiration" value={businessDate(item.dateExpiration)} />
  </>;
}
function ClientContract({ id }: { id: string }) {
  const [tab, setTab] = useState<'summary' | 'coverages' | 'assistances' | 'documents'>('summary');
  if (tab === 'coverages') return <ClientCoverages id={id} back={() => setTab('summary')} />;
  if (tab === 'assistances') return <ClientAssistances id={id} back={() => setTab('summary')} />;
  if (tab === 'documents') return <><Button title="Revenir au contrat" secondary onPress={() => setTab('summary')} /><DocumentList contractId={id} /></>;
  return <ClientContractSummary id={id} select={setTab} />;
}
function ClientContractSummary({ id, select }: { id: string; select: (tab: 'coverages' | 'assistances' | 'documents') => void }) {
  const [page, setPage] = useState(0);
  const vehiclePage = useData(`/client-portal/contracts/${id}?page=${page}&size=25`, z.object({ contrat: s.contract, vehicules: s.paged(s.vehicle) }));
  const data = vehiclePage.data;
  if (!data) return <Screen><State loading={vehiclePage.isPending} error={vehiclePage.error} retry={() => void vehiclePage.refetch()} /></Screen>;
  return <Screen refresh={() => void vehiclePage.refetch()} refreshing={vehiclePage.isRefetching}>
    <ContractHeading item={data.contrat} />
    <Button title="Garanties" secondary onPress={() => select('coverages')} />
    <Button title="Assistance" secondary onPress={() => select('assistances')} />
    <Button title="Documents" secondary onPress={() => select('documents')} />
    <Section title="Véhicules">
      {vehiclePage.isPending ? <State loading /> : vehiclePage.error ? <State error={vehiclePage.error} retry={() => void vehiclePage.refetch()} />
        : !vehiclePage.data?.vehicules.items.length ? <Txt muted>Aucun véhicule actif.</Txt>
          : vehiclePage.data.vehicules.items.map((item) => <Row key={item.id} title={item.immatriculation ?? '-'} subtitle={item.marque ?? '-'}
            meta={`Du ${businessDate(item.dateEffet)} au ${businessDate(item.dateExpiration)}`} />)}
      {page > 0 && <Button title="Véhicules précédents" secondary onPress={() => setPage(page - 1)} />}
      {vehiclePage.data && !vehiclePage.data.vehicules.page.last && <Button title="Véhicules suivants" secondary onPress={() => setPage(page + 1)} />}
    </Section>
  </Screen>;
}
function ClientCoverages({ id, back }: { id: string; back: () => void }) {
  const result = usePages(`/client-portal/contracts/${id}/coverages`, s.coverage);
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    header={<Button title="Revenir au contrat" secondary onPress={back} />}
    render={(item) => <Section title={`${item.code} · ${item.libelle}`}>
      {(item.vehiculeId || item.remorqueId) && <Detail label={item.remorqueId ? 'Remorque' : 'Véhicule'} value={item.immatriculation} />}
      <Detail label="Capital (MAD)" value={money(item.capital)} />
      <Detail label="Taux de franchise" value={item.tauxFranchise == null ? '-' : `${item.tauxFranchise} %`} />
      <Detail label="Franchise minimale (MAD)" value={money(item.franchiseMinimale)} />
    </Section>} />;
}
function ClientAssistances({ id, back }: { id: string; back: () => void }) {
  const result = usePages(`/client-portal/contracts/${id}/assistances`, s.assistance);
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    header={<Button title="Revenir au contrat" secondary onPress={back} />}
    render={(item) => <Section title={item.produit ?? 'Assistance'}>
      <Detail label="Référence" value={item.numero} /><Detail label="Compagnie" value={item.compagnie} />
      <Detail label="Date d’effet" value={businessDate(item.dateEffet)} /><Detail label="Expiration" value={businessDate(item.dateExpiration)} />
    </Section>} />;
}
function ClientClaim({ id }: { id: string }) {
  const [tab, setTab] = useState<'summary' | 'updates' | 'documents'>('summary');
  if (tab === 'updates') return <ClaimUpdates id={id} back={() => setTab('summary')} />;
  if (tab === 'documents') return <><Button title="Revenir au sinistre" secondary onPress={() => setTab('summary')} /><DocumentList claimId={id} /></>;
  return <ClientClaimSummary id={id} select={setTab} />;
}
function ClientClaimSummary({ id, select }: { id: string; select: (tab: 'updates' | 'documents') => void }) {
  const result = useData(`/client-portal/claims/${id}`, s.claim);
  const item = result.data;
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    {!item ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      <Txt title>{item.numero}</Txt><Status value={item.statut} />
      <Detail label="N° de police" value={item.numeroPolice} /><Detail label="Date du sinistre" value={businessDate(item.dateSinistre)} />
      <Detail label="Date de déclaration" value={businessDate(item.dateDeclaration)} /><Detail label="Date de clôture" value={businessDate(item.dateCloture)} />
      <Button title="Suivi de l’agence" secondary onPress={() => select('updates')} />
      <Button title="Documents" secondary onPress={() => select('documents')} />
    </>}
  </Screen>;
}
function ClaimUpdates({ id, back }: { id: string; back: () => void }) {
  const result = usePages(`/client-portal/claims/${id}/updates`, s.publication);
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    header={<Button title="Revenir au sinistre" secondary onPress={back} />}
    empty="Votre agence n’a pas encore publié de message."
    render={(item) => <Section title={item.titre}><Txt muted>{businessDate(item.publishedAt)}</Txt><Txt>{item.message}</Txt></Section>} />;
}
function StaffContract({ id }: { id: string }) {
  const result = useData(`/contrats/${id}`, s.staffContractDetail);
  const [tab, setTab] = useState<'summary' | 'vehicles' | 'movements' | 'coverages'>('summary');
  const item = result.data;
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    {!item ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      <Txt title>{item.numeroDossier ?? 'Contrat'}</Txt><Status value={item.statut} />
      <Choices value={tab} onChange={setTab} options={[{ value: 'summary', label: 'Contrat' }, { value: 'vehicles', label: 'Véhicules' },
        { value: 'coverages', label: 'Garanties' }, { value: 'movements', label: 'Mouvements' }]} />
      {tab === 'summary' && <>
        <Detail label="Police" value={item.numeroPolice} /><Detail label="Compagnie" value={item.compagnieAssuranceNom} />
        <Detail label="Branche" value={item.brancheAssuranceLibelle} /><Detail label="Type" value={label(item.typeContrat)} />
        <Detail label="Date d’effet" value={businessDate(item.dateEffet)} /><Detail label="Expiration" value={businessDate(item.dateEcheance)} />
        <Section title="Clients">{item.clients?.map((entry, index) => <Row key={`${entry.clientId}-${index}`} title={entry.nomAffichage ?? '-'} subtitle={label(entry.role)} />)}</Section>
        <Section title="Assistance">{item.assistances?.length ? item.assistances.map((entry) => <Row key={entry.id}
          title={entry.produit ?? 'Assistance'} subtitle={entry.compagnieAssistanceLibelle ?? '-'} meta={`Référence : ${entry.numeroContratOuQuittance ?? '-'}`} />) : <Txt muted>Aucune assistance.</Txt>}</Section>
      </>}
      {tab === 'vehicles' && (item.vehicules?.length ? item.vehicules.map((entry) => <Row key={entry.vehiculeId}
        title={entry.immatriculation ?? '-'} subtitle={[entry.marque, entry.usageLibelle].filter(Boolean).join(' · ')}
        meta={`Du ${businessDate(entry.dateEffet)} au ${businessDate(entry.dateEcheance)}`} />) : <State empty="Aucun véhicule." />)}
      {tab === 'movements' && (item.mouvements?.length ? item.mouvements.map((entry) => <Section key={entry.id} title={`${entry.numeroMouvement ?? '-'} · ${entry.libelle ?? '-'}`}>
        <Status value={entry.statut} /><Detail label="Date d’effet" value={businessDate(entry.dateEffet)} />
        <Detail label="Quittance TTC (MAD)" value={money(entry.primeTotale)} /></Section>) : <State empty="Aucun mouvement." />)}
      {tab === 'coverages' && (item.garanties?.length ? item.garanties.map((entry, index) => <Section key={entry.contratGarantieId ?? `${entry.garantieId}-${index}`} title={entry.libelle ?? entry.code ?? '-'}>
        {entry.vehiculeId && <Detail label="Véhicule" value={item.vehicules?.find((vehicle) => vehicle.vehiculeId === entry.vehiculeId)?.immatriculation} />}
        <Detail label="Capital (MAD)" value={money(entry.capital)} /><Detail label="Franchise minimale (MAD)" value={money(entry.franchiseMinimale)} />
      </Section>) : <State empty="Aucune garantie." />)}
    </>}
  </Screen>;
}
function StaffClaim({ id }: { id: string }) {
  const result = useData(`/sinistres/${id}`, s.staffClaimDetail);
  const item = result.data;
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    {!item ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      <Txt title>{item.numeroSinistre}</Txt><Status value={item.statut} />
      <Detail label="Étape de suivi" value={label(item.etapeSuivi)} /><Detail label="Police" value={item.couverture?.numeroPolice} />
      <Detail label="Assuré" value={item.couverture?.assure} /><Detail label="Compagnie" value={item.couverture?.compagnie} />
      <Detail label="Véhicule" value={item.couverture?.immatriculation} /><Detail label="Date du sinistre" value={businessDate(item.dateSinistre)} />
      <Detail label="Déclaration" value={businessDate(item.dateDeclaration)} /><Detail label="Gestionnaire" value={item.gestionnaire} />
      <Detail label="Garage" value={item.garage} /><Detail label="Expert" value={item.premierExpert} />
      <Section title="Prochaine action"><Txt>{item.prochaineAction ?? '-'}</Txt><Detail label="Échéance" value={businessDate(item.dateEcheanceAction)} /></Section>
      <Section title="Garanties impliquées">{item.garanties?.filter((entry) => entry.impliquee).map((entry) => <Row key={entry.id} title={entry.libelle ?? entry.code ?? '-'} />)}</Section>
    </>}
  </Screen>;
}
function StaffClient({ id }: { id: string }) {
  const { session } = useSession();
  const result = useData(`/clients/${id}`, s.crm);
  const data = result.data;
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    {!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      <Txt title>{data.client.nomAffichage ?? data.client.raisonSociale ?? '-'}</Txt>
      <Detail label="Code client" value={data.client.codeClient} /><Detail label="Téléphone" value={data.client.telephone} />
      <Detail label="E-mail" value={data.client.email} /><Detail label="Adresse" value={data.client.adresse} /><Detail label="Ville" value={data.client.ville} />
      {canRead(session?.space ?? '', session?.user?.permissions ?? [], 'contracts') && <Section title="Contrats">
        {data.contrats?.length ? data.contrats.map((entry) => <Row key={entry.id} title={entry.numeroDossier ?? '-'} subtitle={`Police ${entry.numeroPolice ?? '-'}`} status={entry.statut}
          onPress={() => router.push({ pathname: '/detail/[resource]/[id]', params: { resource: 'contracts', id: entry.id } })} />) : <Txt muted>Aucun contrat.</Txt>}
      </Section>}
    </>}
  </Screen>;
}
