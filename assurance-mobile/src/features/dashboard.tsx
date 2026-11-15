import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, FileText, ShieldCheck, Users, Wrench } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { useData } from '../api/queries';
import * as s from '../api/schemas';
import { queryString } from '../api/transport';
import { businessDate, canRead, dateRange, money } from '../lib/domain';
import { Choices, Collection, Detail, Notice, Row, Screen, Section, State, Status, Txt } from '../components/ui';
import { useTheme } from '../theme';

export function DashboardScreen() {
  const { session } = useSession();
  return session?.space === 'client' ? <ClientDashboard /> : session?.space === 'platform' ? <PlatformDashboard /> : <StaffDashboard />;
}
function Metrics({ entries }: { entries: { label: string; value: string | number }[] }) {
  const { colors } = useTheme();
  return <View style={[local.metrics, { borderColor: colors.border }]}>{entries.map((entry) => <View key={entry.label} style={local.metric}>
    <Txt muted style={local.metricLabel}>{entry.label}</Txt><Txt style={local.metricValue}>{entry.value}</Txt>
  </View>)}</View>;
}
function ClientDashboard() {
  const { session } = useSession();
  const result = useData('/client-portal/dashboard', s.clientDashboard);
  const data = result.data;
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    <Txt title>{session?.profile?.nom}</Txt><Txt muted>{session?.profile?.agenceNom}</Txt>
    {!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      {result.error && <Notice error message={result.error.message} />}
      <Section title="Mes dossiers"><Metrics entries={[
        { label: 'Contrats actifs', value: data.contratsActifs }, { label: 'Sinistres en cours', value: data.sinistresEnCours },
        { label: 'Expiration sous 30 jours', value: data.expirationsProches },
      ]} /></Section>
      <Section title="Consulter">
        <Row title="Contrats" subtitle={`${data.contrats} dossier(s) partagé(s)`} icon={ShieldCheck} onPress={() => router.push('/contracts')} />
        <Row title="Sinistres" subtitle={`${data.sinistres} dossier(s) partagé(s)`} icon={Wrench} onPress={() => router.push('/claims')} />
        <Row title="Documents" icon={FileText} onPress={() => router.push('/documents')} />
      </Section>
    </>}
  </Screen>;
}
function StaffDashboard() {
  const { session } = useSession();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const permissions = session?.user?.permissions ?? [];
  const allowed = permissions.includes('contrat:view') || permissions.includes('quittance-affectation:view');
  const result = useData(`/dashboard${queryString(dateRange(period))}`, s.staffDashboard, allowed);
  const data = result.data;
  return <Screen refresh={allowed ? () => void result.refetch() : undefined} refreshing={result.isRefetching}>
    <Txt title>{session?.user?.agenceName ?? 'Mon agence'}</Txt><Txt muted>{session?.user?.fullName}</Txt>
    {allowed && <Choices value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Ce mois' }, { value: 'year', label: 'Cette année' }]} />}
    {allowed && (!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      {result.error && <Notice error message={result.error.message} />}
      <Txt muted>{`${businessDate(data.dateDu)} au ${businessDate(data.dateAu)} · MAD`}</Txt>
      <Section title="Production"><Detail label="TTC" value={money(data.kpis.primeTotale)} /><Detail label="Prime nette" value={money(data.kpis.primeNette)} />
        <Detail label="Taxes" value={money(data.kpis.taxes)} /></Section>
      <Section title="Portefeuille"><Metrics entries={[
        { label: 'Contrats actifs', value: data.kpis.contratsActifs }, { label: 'Clients actifs', value: data.kpis.clientsActifs },
        { label: 'Assistances actives', value: data.kpis.assistancesActives }, { label: 'Échéances sous 30 jours', value: data.workload.echeances30Jours },
      ]} /></Section>
      <Section title="Par branche">{data.portefeuilleParBranche.map((entry, index) => <Detail key={entry.code ?? String(index)} label={entry.libelle ?? '-'} value={money(entry.montant)} />)}</Section>
    </>)}
    <Section title="Consulter">
      {canRead('staff', permissions, 'contracts') && <Row title="Dossiers de production" icon={ShieldCheck} onPress={() => router.push('/contracts')} />}
      {canRead('staff', permissions, 'claims') && <Row title="Sinistres" icon={Wrench} onPress={() => router.push('/claims')} />}
      {canRead('staff', permissions, 'clients') && <Row title="Clients" icon={Users} onPress={() => router.push('/clients')} />}
      {!allowed && !['contracts', 'claims', 'clients'].some((resource) => canRead('staff', permissions, resource)) && <Notice message="Aucune consultation mobile n’est autorisée pour votre rôle. Contactez votre administrateur." />}
    </Section>
  </Screen>;
}
function PlatformDashboard({ agencyId }: { agencyId?: string }) {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const result = useData(`/platform/dashboard${queryString({ ...dateRange(period), agenceId: agencyId })}`, s.platformDashboard);
  const data = result.data;
  const agency = data?.agencies.find((entry) => entry.id === agencyId);
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    <Txt title>{agencyId ? agency?.nom ?? 'Agence' : 'Vue des agences'}</Txt>
    <Choices value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Ce mois' }, { value: 'year', label: 'Cette année' }]} />
    {!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : agencyId && !agency
      ? <State empty="Agence introuvable ou inaccessible." /> : <>
        {result.error && <Notice error message={result.error.message} />}
        {agency && <><Status value={agency.statut} /><Detail label="Code" value={agency.code} /><Detail label="Ville" value={agency.ville} /></>}
        <Txt muted>{`${businessDate(data.dateDu)} au ${businessDate(data.dateAu)} · MAD`}</Txt>
        <Section title="Production"><Detail label="TTC" value={money(data.summary.primeTotale)} /><Detail label="Prime nette" value={money(data.summary.primeNette)} />
          <Detail label="Taxes" value={money(data.summary.taxes)} /></Section>
        <Section title="Portefeuille"><Metrics entries={[
          ...(!agencyId ? [{ label: 'Agences actives', value: data.summary.activeAgencies }, { label: 'Agences', value: data.summary.totalAgencies }] : []),
          { label: 'Contrats actifs', value: data.summary.activeContracts }, { label: 'Utilisateurs actifs', value: data.summary.activeUsers },
          { label: 'Brouillons', value: data.summary.draftContracts }, { label: 'Échéances proches', value: data.summary.upcomingExpiries },
        ]} /></Section>
        {!agencyId && <Row title="Toutes les agences" icon={Building2} onPress={() => router.push('/agencies')} />}
      </>}
  </Screen>;
}
export function AgenciesScreen() {
  const result = useData(`/platform/dashboard${queryString(dateRange('month'))}`, s.platformDashboard);
  return <Collection items={result.data?.agencies ?? []} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching} next={() => {}} more={false} fetchingMore={false}
    render={(item) => <Row title={item.nom} icon={Building2} subtitle={[item.code, item.ville].filter(Boolean).join(' · ')} status={item.statut}
      meta={`${item.activeContracts} contrats actifs · ${item.activeUsers} utilisateurs actifs`}
      onPress={() => router.push({ pathname: '/agency/[id]', params: { id: item.id } })} />} />;
}
export function AgencyScreen() {
  const { id } = useLocalSearchParams();
  const parsed = s.id.safeParse(id);
  return parsed.success ? <PlatformDashboard agencyId={parsed.data} /> : <Screen><State empty="Agence introuvable." /></Screen>;
}
const local = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10 },
  metric: { width: '50%', padding: 10, gap: 6 }, metricLabel: { fontSize: 14, lineHeight: 20 }, metricValue: { fontSize: 22, lineHeight: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
