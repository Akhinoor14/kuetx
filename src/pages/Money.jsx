import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { store, uid } from '../store/store';

const CATS = ['Course Fee', 'Hall Fee', 'Meal/Food', 'Transport', 'Junior Treat', 'Tour', 'Personal', 'Stationery', 'Other'];

export default function Money() {
  const [expenses, setExpenses] = useState(() => store.get('expenses') || []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], category: 'Meal/Food', amount: '', note: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = () => {
    if (!form.amount) return;
    const updated = [{ ...form, amount: +form.amount, id: uid() }, ...expenses];
    setExpenses(updated); store.set('expenses', updated); setAdding(false);
    setForm({ date: new Date().toISOString().split('T')[0], category: 'Meal/Food', amount: '', note: '' });
  };

  const del = (id) => { const u = expenses.filter(e => e.id !== id); setExpenses(u); store.set('expenses', u); };

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = expenses.filter(e => e.date?.startsWith(thisMonth));
  const monthTotal = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalAll = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // By category this month
  const byCat = useMemo(() => {
    const map = {};
    monthExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).map(([cat, total]) => ({ cat: cat.slice(0, 8), total })).sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  // By date this month
  const byDate = useMemo(() => {
    const map = {};
    expenses.slice(0, 30).forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [expenses]);

  return (
    <div className="page-enter" style={{ padding: 20, maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Money Tracker</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>All your expenses in one place</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Add Expense</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>This Month</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>৳{monthTotal.toLocaleString()}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Total Recorded</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>৳{totalAll.toLocaleString()}</div>
        </div>
      </div>

      {/* Chart */}
      {byCat.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>This Month by Category</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={byCat} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="cat" type="category" tick={{ fontSize: 10, fill: 'var(--muted)' }} width={60} />
              <Tooltip formatter={(v) => `৳${v}`} contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)' }} />
              <Bar dataKey="total" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div>
              <label>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label>Amount (৳)</label><input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label>Note</label><input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional detail" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Recent list */}
      {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date} style={{ marginBottom: 12 }}>
          <div className="section-title">{new Date(date).toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          {byDate[date].map(e => (
            <div key={e.id} className="card" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="tag tag-gray">{e.category}</span>
                  {e.note && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.note}</span>}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--danger)' }}>৳{e.amount.toLocaleString()}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(e.id)}><Trash2 size={12} color="var(--danger)" /></button>
            </div>
          ))}
        </div>
      ))}

      {expenses.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Start tracking your expenses here.</p>
        </div>
      )}
    </div>
  );
}
