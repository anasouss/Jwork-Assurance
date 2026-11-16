import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, FileText, ShieldCheck, Users, Wrench, CalendarClock, type LucideIcon } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { useData } from '../api/queries';
import * as s from '../api/schemas';
import { queryString } from '../api/transport';
import { businessDate, canRead, dateRange, money } from '../lib/domain';
import { Choices, Collection, Detail, Notice, Row, Screen, Section, State, Status, Txt } from '../components/ui';
import { useTheme } from '../theme';
import { RecordHeading } from '../components/headers';

export function DashboardScreen() {
  const { session } = useSession();
  return session?.space === 'client' ? <ClientDashboard /> : session?.space === 'platform' ? <PlatformDashboard /> : <StaffDashboard />;
}
function Metrics({ entries }: { entries: { label: string; value: string | number; icon: LucideIcon; attention?: boolean }[] }) {
  const { colors } = useTheme();
  return <View style={local.metrics}>{entries.map((entry, index) => {
    const Icon = entry.icon;
    const attention = entry.attention && Number(entry.value) > 0;
    return <View key={entry.label} style={[local.metricRow, { borderBottomColor: colors.border, borderBottomWidth: index < entries.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
      <View style={[local.metricIcon, { backgroundColor: attention ? colors.accentTint : colors.surface }]}>
        <Icon size={20} color={attention ? colors.warning : colors.blue} />
      </View>
      <Txt style={local.metricName}>{entry.label}</Txt>
      <Txt style={[local.metricValue, { color: attention ? colors.warning : colors.text }]}>{entry.value}</Txt>
    </View>;
  })}</View>;
}
function Production({ total, net, taxes, from, to }: { total?: number | null; net?: number | null; taxes?: number | null; from?: string | null; to?: string | null }) {
  const { colors } = useTheme();
  return <View style={[local.production, { backgroundColor: colors.surface }]}>
    <Txt muted style={local.totalCaption}>Production TTC · MAD</Txt>
    <Txt style={[local.total, { color: colors.text }]}>{money(total)}</Txt>
    <Txt muted style={local.period}>{businessDate(from)} au {businessDate(to)}</Txt>
    <View style={[local.secondaryAmounts, { borderColor: colors.border }]}>
      <View style={local.metric}><Txt muted style={local.metricLabel}>Prime nette</Txt><Txt style={local.amount}>{money(net)}</Txt></View>
      <View style={[local.metric, { borderLeftWidth: 1, borderColor: colors.border }]}><Txt muted style={local.metricLabel}>Taxes</Txt><Txt style={local.amount}>{money(taxes)}</Txt></View>
    </View>
  </View>;
}
function ClientDashboard() {
  const result = useData('/client-portal/dashboard', s.clientDashboard);
  const data = result.data;
  return <Screen refresh={() => void result.refetch()} refreshing={result.isRefetching}>
    {!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      {result.error && <Notice error message={result.error.message} />}
      <Section title="Mes dossiers"><Metrics entries={[
        { label: 'Contrats actifs', value: data.contratsActifs, icon: ShieldCheck }, { label: 'Sinistres en cours', value: data.sinistresEnCours, icon: Wrench },
        { label: 'Expiration sous 30 jours', value: data.expirationsProches, icon: CalendarClock, attention: true },
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
    {allowed && <Choices value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Ce mois' }, { value: 'year', label: 'Cette année' }]} />}
    {allowed && (!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : <>
      {result.error && <Notice error message={result.error.message} />}
      <Production total={data.kpis.primeTotale} net={data.kpis.primeNette} taxes={data.kpis.taxes} from={data.dateDu} to={data.dateAu} />
      <Section title="Portefeuille"><Metrics entries={[
        { label: 'Contrats actifs', value: data.kpis.contratsActifs, icon: ShieldCheck }, { label: 'Clients actifs', value: data.kpis.clientsActifs, icon: Users },
        { label: 'Assistances actives', value: data.kpis.assistancesActives, icon: Wrench }, { label: 'Échéances sous 30 jours', value: data.workload.echeances30Jours, icon: CalendarClock, attention: true },
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
    {agencyId && <RecordHeading title={agency?.nom ?? 'Agence'} category="Agence" icon={Building2} />}
    <Choices value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Ce mois' }, { value: 'year', label: 'Cette année' }]} />
    {!data ? <State loading={result.isPending} error={result.error} retry={() => void result.refetch()} /> : agencyId && !agency
      ? <State empty="Agence introuvable ou inaccessible." /> : <>
        {result.error && <Notice error message={result.error.message} />}
        {agency && <><Status value={agency.statut} /><Detail label="Code" value={agency.code} /><Detail label="Ville" value={agency.ville} /></>}
        <Production total={data.summary.primeTotale} net={data.summary.primeNette} taxes={data.summary.taxes} from={data.dateDu} to={data.dateAu} />
        <Section title="Portefeuille"><Metrics entries={[
          ...(!agencyId ? [{ label: 'Agences actives', value: data.summary.activeAgencies, icon: Building2 }, { label: 'Agences', value: data.summary.totalAgencies, icon: Building2 }] : []),
          { label: 'Contrats actifs', value: data.summary.activeContracts, icon: ShieldCheck }, { label: 'Utilisateurs actifs', value: data.summary.activeUsers, icon: Users },
          { label: 'Brouillons', value: data.summary.draftContracts, icon: FileText }, { label: 'Échéances proches', value: data.summary.upcomingExpiries, icon: CalendarClock, attention: true },
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
  production: { paddingVertical: 24, paddingHorizontal: 22, marginHorizontal: -22, gap: 8, alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  totalCaption: { fontSize: 13, lineHeight: 20 }, period: { fontSize: 12, lineHeight: 18 },
  secondaryAmounts: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
  total: { fontSize: 38, lineHeight: 52, fontWeight: '700', fontVariant: ['tabular-nums'] },
  amount: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  metrics: { gap: 0 },
  metricRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingVertical: 14, gap: 14 },
  metricName: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  metricIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  metric: { width: '50%', paddingHorizontal: 10, gap: 6, alignItems: 'center' }, metricLabel: { fontSize: 12, lineHeight: 18 }, metricValue: { fontSize: 24, lineHeight: 32, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
});
