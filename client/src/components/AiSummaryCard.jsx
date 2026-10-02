import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AiSummaryCard({ view, year, month, selectedDate }) {
  const [summary, setSummary] = useState('');
  const [source, setSource] = useState('ai');
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // A summary describes one specific view, so clear it when the chart changes
  useEffect(() => {
    setSummary('');
    setError('');
  }, [view, year, month, selectedDate]);

  if (view === 'day' && !selectedDate) return null;

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ view, year });
      if (view !== 'year') params.set('month', month);
      if (view === 'day') params.set('date', selectedDate);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/trend/summary?${params}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not generate a summary.');

      setSummary(data.summary);
      setSource(data.source);
      setGeneratedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const label = view === 'year' ? `${year}` : view === 'month' ? 'this month' : selectedDate;

  return (
    <div className="mt-4 border rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-orange-500" />
          AI summary
        </p>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          {loading ? 'Summarizing...' : summary ? 'Regenerate' : `Summarize ${label}`}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {summary && (
        <>
          <p className="text-sm mt-2 leading-relaxed">{summary}</p>
          {source !== 'empty' && (
            <p className="text-xs text-muted-foreground mt-2">
              {source === 'auto'
                ? `The AI was busy, so this summary was written automatically from the same numbers (${generatedAt}). Press Regenerate to try the AI again.`
                : `Written by AI from the numbers in this chart at ${generatedAt}. Double-check before sharing.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}