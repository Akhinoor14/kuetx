import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, Download, Edit2, X, Check, TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { store, uid } from '../store/store';
import Modal from '../components/Modal';

const EXPENSE_CATS = ['Meal/Food', 'Transport', 'Hall Fee', 'Course Fee', 'Personal', 'Junior Treat', 'Tour', 'Stationery', 'Other'];
const INCOME_CATS = ['Family',  'Tution','Scholarship', 'Part-time', 'Freelance', 'Sell', 'Other'];

const fmtMonth = (y, m) => new Date(y, m, 1).toLocaleDateString('en-BD', { month: 'long', year: 'numeric' });
const parseLocalDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export default function Money() {
  const [entries, setEntries] = useState(() => store.get('money_entries') || []);
  const [cashBalance, setCashBalance] = useState(() => store.get('money_cash') ?? 0);
  const [budget, setBudget] = useState(() => store.get('money_budget') ?? 0);

  const [tab, setTab] = useState('all');
  const [view, setView] = useState('list');
  const [filterCat, setFilterCat] = useState('All');
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ type: 'expense', date: todayStr(), category: 'Meal/Food', amount: '', note: '' });
  const [formError, setFormError] = useState('');
  const [setupForm, setSetupForm] = useState({ cash: '', budget: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const amountRef = useRef(null);

  // Auto-focus amount when modal opens
  useEffect(() => {
    if ((modal === 'add' || modal === 'edit') && amountRef.current) {
      setTimeout(() => amountRef.current?.focus(), 120);
    }
  }, [modal]);

  const setF = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'type') next.category = v === 'income' ? 'Family' : 'Meal/Food';
      return next;
    });
    setFormError('');
  };

  const openAdd = () => {
    setForm({ type: 'expense', date: todayStr(), category: 'Meal/Food', amount: '', note: '' });
    setEditId(null);
    setFormError('');
    setModal('add');
  };

  const openEdit = (entry) => {
    setForm({ type: entry.type, date: entry.date, category: entry.category, amount: String(entry.amount), note: entry.note || '' });
    setEditId(entry.id);
    setFormError('');
    setModal('edit');
  };

  const saveEntry = useCallback(() => {
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) { setFormError('Enter a valid amount'); return; }
    let updated;
    if (modal === 'edit' && editId) {
      updated = entries.map(e => e.id === editId ? { ...e, ...form, amount: amt } : e);
    } else {
      updated = [{ ...form, amount: amt, id: uid() }, ...entries];
    }
    setEntries(updated);
    store.set('money_entries', updated);
    setModal(null);
  }, [form, modal, editId, entries]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') saveEntry(); };

  const del = (id) => {
    const u = entries.filter(e => e.id !== id);
    setEntries(u); store.set('money_entries', u);
    setDeleteConfirm(null);
  };

  const saveSetup = () => {
    const cash = parseFloat(setupForm.cash);
    const bdg = parseFloat(setupForm.budget);
    if (!isNaN(cash) && setupForm.cash !== '') { setCashBalance(cash); store.set('money_cash', cash); }
    if (!isNaN(bdg) && setupForm.budget !== '') { setBudget(bdg); store.set('money_budget', bdg); }
    setModal(null);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setFilterCat('All');
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setFilterCat('All');
  };
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthEntries = useMemo(() => entries.filter(e => e.date?.startsWith(monthStr)), [entries, monthStr]);

  const monthIncome  = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const monthExpense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const monthNet     = monthIncome - monthExpense;

  const prevMonthStr = (() => {
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    return `${py}-${String(pm + 1).padStart(2, '0')}`;
  })();
  const prevMonthExpense = entries.filter(e => e.date?.startsWith(prevMonthStr) && e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const expenseDelta = monthExpense - prevMonthExpense;

  const allIncome  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const allExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const netWorth   = cashBalance + allIncome - allExpense;

  const cats = tab === 'income' ? INCOME_CATS : tab === 'expense' ? EXPENSE_CATS : [...new Set([...INCOME_CATS, ...EXPENSE_CATS])];
  const displayEntries = monthEntries.filter(e => {
    if (tab !== 'all' && e.type !== tab) return false;
    if (filterCat !== 'All' && e.category !== filterCat) return false;
    return true;
  });

  const byDate = useMemo(() => {
    const map = {};
    displayEntries.forEach(e => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); });
    return map;
  }, [displayEntries]);

  const byCat = useMemo(() => {
    const map = {};
    monthEntries.filter(e => e.type === 'expense').forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).map(([cat, total]) => ({ cat: cat.slice(0, 9), total })).sort((a, b) => b.total - a.total);
  }, [monthEntries]);

  const dailyData = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const dateStr = `${monthStr}-${day}`;
      const de = monthEntries.filter(e => e.date === dateStr);
      return { day: i + 1, expense: de.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0), income: de.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0) };
    }).filter(d => d.expense > 0 || d.income > 0);
  }, [monthEntries, monthStr, viewYear, viewMonth]);

  const budgetPct   = budget > 0 ? Math.min((monthExpense / budget) * 100, 100) : 0;
  const budgetColor = budgetPct >= 90 ? 'var(--danger)' : budgetPct >= 70 ? '#f59e0b' : 'var(--accent)';

  // Text Memo Export
  const exportTxt = () => {
    const pad  = (str, len) => String(str).padEnd(len, ' ');
    const lpad = (str, len) => String(str).padStart(len, ' ');
    const divider = '─'.repeat(40);
    const thick   = '━'.repeat(40);
    const monthLabel = fmtMonth(viewYear, viewMonth);
    const generated  = new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const lines = [];
    lines.push(thick);
    lines.push(`  MONEY REPORT — ${monthLabel.toUpperCase()}`);
    lines.push(thick);
    lines.push('');
    lines.push(`  Income   : +৳${monthIncome.toLocaleString()}`);
    lines.push(`  Expense  :  ৳${monthExpense.toLocaleString()}`);
    lines.push(`  Net      : ${monthNet >= 0 ? '+' : ''}৳${monthNet.toLocaleString()}`);
    if (budget > 0) lines.push(`  Budget   :  ৳${budget.toLocaleString()} (${Math.round((monthExpense / budget) * 100)}% used)`);
    lines.push('');
    const catMap = {};
    monthEntries.forEach(e => { if (e.type === 'expense') catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const cats2 = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    if (cats2.length > 0) {
      lines.push('  Top Expenses');
      lines.push('  ' + divider);
      cats2.forEach(([cat, amt]) => lines.push(`  ${pad(cat, 18)}  ৳${lpad(amt.toLocaleString(), 8)}`));
      lines.push('');
    }
    lines.push('  Transactions');
    lines.push('  ' + divider);
    const sorted = [...monthEntries].sort((a, b) => b.date.localeCompare(a.date));
    let lastDate = '';
    sorted.forEach(e => {
      if (e.date !== lastDate) {
        const d = parseLocalDate(e.date);
        lines.push('');
        lines.push('  ' + d.toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' }));
        lastDate = e.date;
      }
      const sign = e.type === 'income' ? '+' : '−';
      const note = e.note ? `  (${e.note})` : '';
      lines.push(`    ${sign}৳${lpad(e.amount.toLocaleString(), 7)}  ${pad(e.category, 14)}${note}`);
    });
    lines.push('');
    lines.push(thick);
    lines.push(`  ${monthEntries.length} entries  |  Generated ${generated}`);
    lines.push(thick);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const slug = monthLabel.toLowerCase().replace(' ', '-');
    a.href = url; a.download = `money-report_${slug}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const currentCats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  return (
    <div className="page-enter page-container content-page-bg">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="content-page-hero" style={{ marginBottom: 0 }}>
          <div className="content-page-hero-icon">
            <Wallet size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">Money</h1>
            <p className="content-page-hero-subtitle">Track income, expenses & balance</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={exportTxt} title="Export Report"><Download size={13} /></button>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => { setSetupForm({ cash: String(cashBalance), budget: String(budget) }); setModal('setup'); }}><Wallet size={13} /></button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={13} /> Add</button>
        </div>
      </div>

      {/* Net Worth Banner */}
      <div className="card" style={{ marginBottom: 12, background: 'var(--accent)', color: 'var(--card)', border: 'none' }}>
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>Net Balance</div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>৳{netWorth.toLocaleString()}</div>
        {cashBalance > 0 && (
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
            Cash ৳{cashBalance.toLocaleString()} + Income ৳{allIncome.toLocaleString()} − Expense ৳{allExpense.toLocaleString()}
          </div>
        )}
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={prevMonth}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtMonth(viewYear, viewMonth)}</span>
        <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={nextMonth} disabled={isCurrentMonth}><ChevronRight size={14} /></button>
      </div>

      {/* Month Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="card" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>Income</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>৳{monthIncome.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>Expense</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)' }}>৳{monthExpense.toLocaleString()}</div>
          {prevMonthExpense > 0 && (
            <div style={{ fontSize: 10, color: expenseDelta > 0 ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
              {expenseDelta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {expenseDelta > 0 ? '+' : ''}৳{Math.abs(expenseDelta).toLocaleString()} vs last
            </div>
          )}
        </div>
        <div className="card" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>Net</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: monthNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {monthNet >= 0 ? '+' : ''}৳{monthNet.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Budget bar */}
      {budget > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: 'var(--muted)' }}>Monthly budget</span>
            <span style={{ fontWeight: 600, color: budgetPct >= 90 ? 'var(--danger)' : 'var(--text)' }}>
              ৳{monthExpense.toLocaleString()} / ৳{budget.toLocaleString()} ({Math.round(budgetPct)}%)
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${budgetPct}%`, background: budgetColor, borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
          {budgetPct >= 90 && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} />Budget almost used up!</div>}
        </div>
      )}

      {/* Chart */}
      {(byCat.length > 0 || dailyData.length > 0) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {['list', 'cat', 'daily'].map(v => (
              <button key={v} className={`btn ${view === v ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setView(v)}>
                {v === 'list' ? 'List' : v === 'cat' ? 'Category' : 'Daily'}
              </button>
            ))}
          </div>
          {view === 'cat' && byCat.length > 0 && (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byCat} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="cat" type="category" tick={{ fontSize: 10, fill: 'var(--muted)' }} width={65} />
                <Tooltip formatter={v => `৳${v.toLocaleString()}`} contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)' }} />
                <Bar dataKey="total" fill="var(--danger)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === 'daily' && dailyData.length > 0 && (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => `৳${v.toLocaleString()}`} contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="expense" stroke="var(--danger)" dot={false} strokeWidth={2} name="Expense" />
                <Line type="monotone" dataKey="income" stroke="var(--success)" dot={false} strokeWidth={2} name="Income" />
              </LineChart>
            </ResponsiveContainer>
          )}
          {view === 'list' && (
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
              Tap Category or Daily view to see the chart
            </div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[['all', 'All'], ['income', '↑ Income'], ['expense', '↓ Expense']].map(([t, label]) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => { setTab(t); setFilterCat('All'); }}>
            {label}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {['All', ...cats].map(c => (
          <button key={c} onClick={() => setFilterCat(c)} style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 99, cursor: 'pointer',
            border: `1px solid ${filterCat === c ? 'var(--accent)' : 'var(--border)'}`,
            background: filterCat === c ? 'var(--accent)' : 'transparent',
            color: filterCat === c ? '#fff' : 'var(--muted)',
          }}>{c}</button>
        ))}
      </div>

      {/* Entry list */}
      {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date} style={{ marginBottom: 12 }}>
          <div className="section-title">{parseLocalDate(date).toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          {byDate[date].map(e => (
            <div key={e.id} className="card" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`tag ${e.type === 'income' ? 'tag-green' : 'tag-gray'}`}>{e.category}</span>
                  {e.note && <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note}</span>}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: e.type === 'income' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                {e.type === 'income' ? '+' : '−'}৳{e.amount.toLocaleString()}
              </span>
              <button className="btn btn-ghost" style={{ padding: '4px 6px', flexShrink: 0 }} onClick={() => openEdit(e)}><Edit2 size={11} /></button>
              {deleteConfirm === e.id ? (
                <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11, flexShrink: 0 }} onClick={() => del(e.id)}>Confirm?</button>
              ) : (
                <button className="btn btn-ghost" style={{ padding: '4px 6px', flexShrink: 0 }} onClick={() => setDeleteConfirm(e.id)}><Trash2 size={11} color="var(--danger)" /></button>
              )}
            </div>
          ))}
        </div>
      ))}

      {displayEntries.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 36 }}>
          <p style={{ fontSize: 13 }}>There are no entries this month.</p>
          <button className="btn btn-primary" style={{ marginTop: 10, fontSize: 12 }} onClick={openAdd}><Plus size={12} /> Add entry</button>
        </div>
      )}

      {/* Click outside to cancel delete confirm */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
      )}

      {/* Modal overlay */}
      {modal && (
        <Modal onClose={() => setModal(null)} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 520, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card, #fff)', width: '100%', borderRadius: 20, paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>

            {(modal === 'add' || modal === 'edit') && (
              <div style={{ padding: '0 20px 4px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{modal === 'edit' ? 'Edit entry' : 'New entry'}</span>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setModal(null)}><X size={14} /></button>
                </div>

                {/* Income / Expense toggle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => setF('type', 'expense')}
                    style={{
                      padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '2px solid',
                      borderColor: form.type === 'expense' ? 'var(--danger)' : 'var(--border)',
                      background: form.type === 'expense' ? '#fff1f1' : 'transparent',
                      color: form.type === 'expense' ? 'var(--danger)' : 'var(--muted)',
                    }}>↓ Expense</button>
                  <button
                    onClick={() => setF('type', 'income')}
                    style={{
                      padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '2px solid',
                      borderColor: form.type === 'income' ? 'var(--success)' : 'var(--border)',
                      background: form.type === 'income' ? '#f0fdf4' : 'transparent',
                      color: form.type === 'income' ? 'var(--success)' : 'var(--muted)',
                    }}>↑ Income</button>
                </div>

                {/* Amount — big, prominent */}
                <div className="form-field" style={{ marginBottom: 14 }}>
                  <label>Amount (৳)</label>
                  <input
                    ref={amountRef}
                    type="number"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={e => setF('amount', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                    style={{ fontSize: 22, fontWeight: 700, height: 52, textAlign: 'center', letterSpacing: '-0.02em' }}
                  />
                </div>

                {/* Category chips */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {currentCats.map(c => (
                      <button
                        key={c}
                        onClick={() => setF('category', c)}
                        style={{
                          padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: `1.5px solid ${form.category === c ? (form.type === 'income' ? 'var(--success)' : 'var(--accent)') : 'var(--border)'}`,
                          background: form.category === c ? (form.type === 'income' ? '#f0fdf4' : 'var(--accentSoft, #dcfce7)') : 'transparent',
                          color: form.category === c ? (form.type === 'income' ? 'var(--success)' : 'var(--accent)') : 'var(--muted)',
                        }}>{c}</button>
                    ))}
                  </div>
                </div>

                {/* Date + Note row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, marginBottom: 14 }}>
                  <div className="form-field">
                    <label>Date</label>
                    <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Note</label>
                    <input value={form.note} onChange={e => setF('note', e.target.value)} onKeyDown={handleKeyDown} placeholder="Optional" />
                  </div>
                </div>

                {formError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{formError}</div>}

                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', minHeight: 46 }} onClick={saveEntry}><Check size={14} /> Save</button>
                  <button className="btn btn-ghost" style={{ minHeight: 46, padding: '0 20px' }} onClick={() => setModal(null)}>Cancel</button>
                </div>
              </div>
            )}

            {modal === 'setup' && (
              <div style={{ padding: '0 20px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Setup</span>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setModal(null)}><X size={14} /></button>
                </div>
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label>Starting cash balance (৳)</label>
                  <input type="number" inputMode="decimal" value={setupForm.cash} onChange={e => setSetupForm(f => ({ ...f, cash: e.target.value }))} placeholder="e.g. 5000" />
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>How much cash you had before tracking started.</p>
                </div>
                <div className="form-field" style={{ marginBottom: 16 }}>
                  <label>Monthly expense budget (৳)</label>
                  <input type="number" inputMode="decimal" value={setupForm.budget} onChange={e => setSetupForm(f => ({ ...f, budget: e.target.value }))} placeholder="e.g. 8000" />
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>You will get a warning as you near the limit.</p>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', minHeight: 46, marginBottom: 4 }} onClick={saveSetup}><Check size={14} /> Save settings</button>
              </div>
            )}

          </div>
        </Modal>
      )}
    </div>
  );
}