import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { usePages } from '../api/queries';
import { document } from '../api/schemas';
import { Button, Collection, Notice, Row, Screen } from '../components/ui';
import { RecordHeading } from '../components/headers';
import { businessDate } from '../lib/domain';

const formats: Record<string, string> = {
  'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg',
  'text/plain': '.txt', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};
export function DocumentPrivacy() {
  const { session } = useSession();
  useEffect(() => {
    try {
      const directory = new Directory(Paths.cache, 'portal-documents');
      if (directory.exists) directory.delete();
    } catch { /* Cache may already have been cleared by the OS. */ }
  }, [session?.profile?.id, session?.user?.id]);
  return null;
}

export function DocumentList({ contractId, claimId, back }: { contractId?: string; claimId?: string; back?: () => void }) {
  const { binary, session } = useSession();
  const result = usePages('/client-portal/documents', document, { contratId: contractId, sinistreId: claimId }, session?.space === 'client');
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const currentAccount = useRef(session?.profile?.id);
  currentAccount.current = session?.profile?.id;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function open(id: string) {
    if (opening) return;
    const account = currentAccount.current;
    setOpening(id); setError('');
    let file: File | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Aucune application ne peut ouvrir ce document sur cet appareil.');
      const data = await binary(`/client-portal/documents/${id}/download`);
      if (!alive.current || currentAccount.current !== account || AppState.currentState !== 'active') return;
      const mime = data.contentType.split(';')[0]?.toLowerCase().trim() ?? '';
      const extension = formats[mime];
      if (!extension) throw new Error('Ce format de document n’est pas pris en charge. Contactez votre agence.');
      const directory = new Directory(Paths.cache, 'portal-documents');
      directory.create({ intermediates: true, idempotent: true });
      file = new File(directory, `document-${Date.now()}${extension}`);
      file.create();
      await file.write(data.bytes);
      if (!alive.current || currentAccount.current !== account || AppState.currentState !== 'active') return;
      await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Ouvrir ou partager le document' });
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Ouverture impossible.');
    } finally {
      try { if (file?.exists) file.delete(); } catch { /* Purged again at the next account transition. */ }
      if (alive.current) setOpening(null);
    }
  }
  if (session?.space !== 'client') return <Screen><Notice error message="Documents réservés à l’espace client." /></Screen>;
  return <Collection items={result.items} loading={result.isPending} error={result.error}
    refresh={() => void result.refetch()} refreshing={result.isRefetching && !result.isFetchingNextPage}
    next={() => void result.fetchNextPage()} more={result.hasNextPage} fetchingMore={result.isFetchingNextPage}
    empty="Aucun document n’a été publié par votre agence."
    header={back || error ? <>
      {back && <><Button title={claimId ? 'Revenir au sinistre' : 'Revenir au contrat'} icon={ArrowLeft} secondary onPress={back} />
        <RecordHeading title="Documents" category={claimId ? 'Sinistre' : 'Contrat'} icon={FileText} /></>}
      {error ? <Notice message={error} error /> : null}
    </> : undefined}
    render={(item) => <Row title={item.titre} icon={FileText} subtitle="Document de l’agence" meta={`Publié le ${businessDate(item.publishedAt)}`}
      busy={opening === item.id} disabled={opening !== null && opening !== item.id}
        onPress={() => Alert.alert(item.titre, 'Le document sera ouvert dans une application de votre appareil.', [
          { text: 'Annuler', style: 'cancel' }, { text: 'Continuer', onPress: () => void open(item.id) },
        ])} />
    } />;
}
