import { useState } from 'react';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, ShieldCheck, UserRound, Wrench } from 'lucide-react-native';
import { useSession } from '../auth/session';
import * as s from '../api/schemas';
import { usePages } from '../api/queries';
import { ApiError, queryString } from '../api/transport';
import { Collection, Notice, Row, SearchBar } from '../components/ui';
import { businessDate, canRead, label } from '../lib/domain';
import { DocumentList } from './documents';

function detail(resource: string, id: string) {
  router.push({ pathname: '/detail/[resource]/[id]', params: { resource, id } });
}
export function ContractsScreen() {
  const { session } = useSession();
  return session?.space === 'client' ? <ClientContracts /> : <StaffContracts />;
}
function ClientContracts() {
  const result = usePages('/client-portal/contracts', s.contract);
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    empty="Aucun contrat n’a été partagé par votre agence."
    render={(item) => <Row title={`Police ${item.numeroPolice ?? '-'}`} icon={ShieldCheck} subtitle={item.compagnie ?? '-'}
      meta={`Expiration : ${businessDate(item.dateExpiration)}`} status={item.statut} onPress={() => detail('contracts', item.id)} />} />;
}
function StaffContracts() {
  const { session, get } = useSession();
  const [search, setSearch] = useState('');
  const allowed = canRead(session?.space ?? '', session?.user?.permissions ?? [], 'contracts');
  const result = useInfiniteQuery({
    queryKey: ['staff', session?.user?.id, session?.user?.agenceId, 'contract-groups', search], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => get(`/contrats${queryString({ search, page: pageParam, size: 25 })}`, s.contractGroups, signal),
    getNextPageParam: (last) => last.page.last ? undefined : last.page.number + 1, enabled: allowed,
  });
  const denied = result.error instanceof ApiError && [401, 403, 404].includes(result.error.status);
  const contracts = denied ? [] : result.data?.pages.flatMap((page) => page.items.flatMap((group) => group.contrats)) ?? [];
  const unique = [...new Map(contracts.map((item) => [item.id, item])).values()];
  if (!allowed) return <Notice error message="Vous n’avez pas accès aux contrats." />;
  return <Collection items={unique} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    header={<SearchBar onSearch={setSearch} placeholder="Assuré, dossier ou référence" />}
    render={(item) => <Row title={item.numeroDossier ?? item.numeroPolice ?? '-'} icon={ShieldCheck}
      subtitle={`Police ${item.numeroPolice ?? '-'} · ${item.compagnieLibelle ?? '-'}`}
      meta={`${label(item.typeContrat)} · Expiration : ${businessDate(item.dateEcheance)}`} status={item.statut}
      onPress={() => detail('contracts', item.id)} />} />;
}
export function ClaimsScreen() {
  const { session } = useSession();
  return session?.space === 'client' ? <ClientClaims /> : <StaffClaims />;
}
function ClientClaims() {
  const result = usePages('/client-portal/claims', s.claim);
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    empty="Aucun sinistre n’a été partagé par votre agence."
    render={(item) => <Row title={item.numero} subtitle={`Police ${item.numeroPolice ?? '-'}`} icon={Wrench}
      meta={`Sinistre du ${businessDate(item.dateSinistre)}`} status={item.statut} onPress={() => detail('claims', item.id)} />} />;
}
function StaffClaims() {
  const { session } = useSession();
  const [search, setSearch] = useState('');
  const allowed = canRead(session?.space ?? '', session?.user?.permissions ?? [], 'claims');
  const result = usePages('/sinistres', s.staffClaim, { query: search }, allowed);
  if (!allowed) return <Notice error message="Vous n’avez pas accès aux sinistres." />;
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    header={<SearchBar onSearch={setSearch} placeholder="Sinistre, police ou assuré" />}
    render={(item) => <Row title={item.numeroSinistre} subtitle={item.assure ?? '-'} icon={Wrench}
      meta={`Police ${item.numeroPolice ?? '-'} · ${businessDate(item.dateSinistre)}`} status={item.statut}
      onPress={() => detail('claims', item.id)} />} />;
}
export function ClientsScreen() {
  const { session } = useSession();
  const [search, setSearch] = useState('');
  const allowed = canRead(session?.space ?? '', session?.user?.permissions ?? [], 'clients');
  const result = usePages('/clients', s.client, { query: search }, allowed);
  if (!allowed) return <Notice error message="Vous n’avez pas accès aux clients." />;
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    header={<SearchBar onSearch={setSearch} placeholder="Nom, code ou identifiant" />}
    render={(item) => <Row title={item.nomAffichage ?? item.raisonSociale ?? ([item.prenom, item.nom].filter(Boolean).join(' ') || '-')}
      icon={UserRound} subtitle={item.codeClient ?? '-'} meta={[item.ville, item.telephone].filter(Boolean).join(' · ')}
      onPress={() => detail('clients', item.id)} />} />;
}
export function DocumentsScreen() {
  return <DocumentList />;
}
export const icons = { contracts: ShieldCheck, claims: Wrench, documents: FileText, clients: UserRound };
