import { useMemo } from 'react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PDFViewer from '../components/PDFViewer';

function getFileNameFromPath(path) {
  const raw = (path || '').split('?')[0].split('#')[0];
  const last = raw.split('/').filter(Boolean).pop() || '';
  return decodeURIComponent(last) || 'Question paper';
}

export default function QuestionBankViewer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialUrl = searchParams.get('src') || '';
  const initialName = useMemo(() => searchParams.get('title') || getFileNameFromPath(initialUrl), [initialUrl, searchParams]);

  useEffect(() => {
    if (!initialUrl) {
      navigate('/question-bank', { replace: true });
    }
  }, [initialUrl, navigate]);

  if (!initialUrl) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0c0d10)' }}>
      <PDFViewer
        initialUrl={initialUrl}
        initialName={initialName}
        onClose={() => navigate('/question-bank')}
      />
    </div>
  );
}