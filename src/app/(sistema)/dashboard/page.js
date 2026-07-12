'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api-client';
import {
  Users, FileText, Activity, CheckCircle, Eye, X,
  AlertTriangle, BarChart3, TrendingUp, BarChart, Award,
  Clock, Target, Timer, Filter, ChevronDown,
} from 'lucide-react';

const TERMINAL = ['Concluído','Cancelado','Reprovado','Reprovado Documentação','Reprovado pelo Médico','Inapto Médico','Desistência','Falta'];
const TERMINAL_REP = ['Reprovado','Cancelado','Reprovado Documentação','Reprovado pelo Médico','Inapto Médico','Desistência','Falta'];

function getEtapa(c) {
  const st = c.status;
  if (['Reprovado', 'Falta', 'Desistência'].includes(st)) return 'Entrevista';
  if (st === 'Reprovado Documentação') return 'Documentação (Bloco 1)';
  if (['Reprovado pelo Médico', 'Inapto Médico'].includes(st)) return 'Pré-Admissão (Bloco 2)';
  if (st === 'Cancelado') {
    const ok = v => v && String(v).trim() !== '' && String(v).trim() !== 'null';
    if (ok(c.medical_result_date)) return 'Pós concluído (Bloco 3)';
    if (ok(c.docs_receive_date))   return 'Pré-Admissão (Bloco 2)';
    if (c.interview_date)          return 'Documentação (Bloco 1)';
    return 'Entrevista';
  }
  return st || 'Outro';
}

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const hasValue = selected.length > 0;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
          border: `1px solid ${hasValue ? 'var(--saritur-orange)' : 'var(--border-color)'}`,
          backgroundColor: hasValue ? 'rgba(255,138,0,0.08)' : 'var(--bg-color)',
          color: hasValue ? 'var(--saritur-orange)' : 'var(--text-muted)',
          fontSize: '0.8rem', fontWeight: hasValue ? '600' : '400', whiteSpace: 'nowrap',
        }}
      >
        {label}{hasValue ? ` (${selected.length})` : ''}
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 45 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000,
            backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: '200px', maxHeight: '240px', overflowY: 'auto',
          }}>
            {options.length === 0 && (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Nenhuma opção disponível
              </div>
            )}
            {options.map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem',
                color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)',
              }}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => onChange(
                    selected.includes(opt.value)
                      ? selected.filter(v => v !== opt.value)
                      : [...selected, opt.value]
                  )}
                  style={{ accentColor: 'var(--saritur-orange)', width: '14px', height: '14px', flexShrink: 0 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [rawCands, setRawCands] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [filterDateFrom,     setFilterDateFrom]     = useState('');
  const [filterDateTo,       setFilterDateTo]       = useState('');
  const [filterUnidades,     setFilterUnidades]     = useState([]);
  const [filterFuncoes,      setFilterFuncoes]      = useState([]);
  const [filterResponsaveis, setFilterResponsaveis] = useState([]);

  const [modalStage,    setModalStage]    = useState(null);
  const [modalParados,  setModalParados]  = useState(false);
  const [hoverCard,     setHoverCard]     = useState(null);
  const [abaReprovados, setAbaReprovados] = useState('psicologo');
  const [viewVolume,    setViewVolume]    = useState('mensal');
  const [viewLeadtime,  setViewLeadtime]  = useState('psicologo');
  const [hoverLeadtime, setHoverLeadtime] = useState(null);

  useEffect(() => { fetchData(); }, []);

  // ── Fetch: busca + enriquece apenas ──────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    try {
      const [candsRes, rolesRes, unitsRes, usersRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }).catch(() => []),
        api.jobRoles.list().catch(() => []),
        api.units.list().catch(() => []),
        api.users.list().catch(() => []),
      ]);
      const cands = Array.isArray(candsRes) ? candsRes : [];
      const roles = Array.isArray(rolesRes) ? rolesRes : [];
      const units = Array.isArray(unitsRes) ? unitsRes : [];
      const users = Array.isArray(usersRes) ? usersRes : [];

      cands.forEach(c => {
        c.roleName = roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || 'N/A';
        c.unitName = units.find(u => u.id === c.unit_id)?.name    || c.unit_name      || 'N/A';
        c.respName = users.find(u => u.id === c.responsible_id)?.name || c.responsible_name || 'Sistema';
      });

      setRawCands(cands);
      setAllUnits([...units].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setAllRoles([...roles].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setAllUsers([...users].filter(u => u.name && u.name !== 'Sistema').sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Erro ao montar dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  const hasFilter = !!(filterDateFrom || filterDateTo || filterUnidades.length || filterFuncoes.length || filterResponsaveis.length);

  const clearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterUnidades([]);
    setFilterFuncoes([]);
    setFilterResponsaveis([]);
  };

  const filteredCands = useMemo(() => {
    if (!hasFilter) return rawCands;
    return rawCands.filter(c => {
      const ref = (c.interview_date || c.created_at || '').slice(0, 10);
      if (filterDateFrom && ref && ref < filterDateFrom) return false;
      if (filterDateTo   && ref && ref > filterDateTo)   return false;
      if (filterUnidades.length     > 0 && !filterUnidades.includes(c.unit_id))            return false;
      if (filterFuncoes.length      > 0 && !filterFuncoes.includes(c.job_role_id))         return false;
      if (filterResponsaveis.length > 0 && !filterResponsaveis.includes(c.responsible_id)) return false;
      return true;
    });
  }, [rawCands, hasFilter, filterDateFrom, filterDateTo, filterUnidades, filterFuncoes, filterResponsaveis]);

  // Histórico reprovados: sem filtro de data, só dimensões
  const todosReprovados = useMemo(() => {
    return rawCands.filter(c =>
      TERMINAL_REP.includes(c.status) &&
      ['Admissão', 'Readmissão'].includes(c.process_type) &&
      (filterUnidades.length     === 0 || filterUnidades.includes(c.unit_id)) &&
      (filterFuncoes.length      === 0 || filterFuncoes.includes(c.job_role_id)) &&
      (filterResponsaveis.length === 0 || filterResponsaveis.includes(c.responsible_id))
    );
  }, [rawCands, filterUnidades, filterFuncoes, filterResponsaveis]);

  // ── Computação principal (render-time, memoizada) ─────────────────────────
  const comp = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const funilData = { entrevistas: [], documentacao: [], exames: [], prontos: [] };
    let totalAtendimentos = 0, totalEntrevistados = 0, totalAprovados = 0;
    const monthlyMap = {}, psychoMap = {}, psicoMesMap = {};
    const leadtimeValues = [], leadtimePorPsicoMap = {}, leadtimeMensalMap = {};
    const leadtimeUnidadeMap = {}, leadtimeFuncaoMap = {};
    const aprovacaoPorPsicoMap = {};

    filteredCands.forEach(c => {
      const st = c.status ? c.status.trim() : '';

      const dataAted = c.interview_date || c.created_at;
      if (dataAted) {
        const d     = new Date(dataAted);
        const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
        if (!monthlyMap[key]) monthlyMap[key] = { key, label, count: 0 };
        monthlyMap[key].count++;
        if (c.respName !== 'Sistema') {
          if (!psychoMap[c.respName]) psychoMap[c.respName] = { name: c.respName, count: 0 };
          psychoMap[c.respName].count++;
          if (c.interview_date) {
            const di = new Date(c.interview_date);
            const mk = `${di.getFullYear()}-${String(di.getMonth()+1).padStart(2,'0')}`;
            if (!psicoMesMap[c.respName]) psicoMesMap[c.respName] = {};
            psicoMesMap[c.respName][mk] = (psicoMesMap[c.respName][mk] || 0) + 1;
          }
        }
        totalAtendimentos++;
      }

      if (['Admissão', 'Readmissão'].includes(c.process_type)) {
        const psico = c.respName;
        if (c.interview_date) {
          totalEntrevistados++;
          if (!aprovacaoPorPsicoMap[psico]) aprovacaoPorPsicoMap[psico] = { name: psico, aprovados: 0, total: 0 };
          aprovacaoPorPsicoMap[psico].total++;
          if (c.analysis_status === 'Aprovado') {
            totalAprovados++;
            aprovacaoPorPsicoMap[psico].aprovados++;
          }
        }
        if (st === 'Concluído' && c.admission_date) {
          const dataAprov = c.analysis_update_date || c.interview_date;
          if (dataAprov) {
            const diff = Math.floor((new Date(c.admission_date) - new Date(dataAprov)) / 86400000);
            if (diff >= 0) {
              leadtimeValues.push(diff);
              if (!leadtimePorPsicoMap[psico]) leadtimePorPsicoMap[psico] = { name: psico, sum: 0, count: 0 };
              leadtimePorPsicoMap[psico].sum   += diff;
              leadtimePorPsicoMap[psico].count += 1;
              const admD   = new Date(c.admission_date);
              const admKey = `${admD.getFullYear()}-${String(admD.getMonth()+1).padStart(2,'0')}`;
              const admLbl = `${String(admD.getMonth()+1).padStart(2,'0')}/${admD.getFullYear()}`;
              if (!leadtimeMensalMap[admKey]) leadtimeMensalMap[admKey] = { key: admKey, label: admLbl, sum: 0, count: 0 };
              leadtimeMensalMap[admKey].sum   += diff;
              leadtimeMensalMap[admKey].count += 1;
              const unidade = c.unitName || 'N/A';
              if (!leadtimeUnidadeMap[unidade]) leadtimeUnidadeMap[unidade] = { name: unidade, sum: 0, count: 0 };
              leadtimeUnidadeMap[unidade].sum   += diff;
              leadtimeUnidadeMap[unidade].count += 1;
              const funcao = c.roleName || 'N/A';
              if (!leadtimeFuncaoMap[funcao]) leadtimeFuncaoMap[funcao] = { name: funcao, sum: 0, count: 0 };
              leadtimeFuncaoMap[funcao].sum   += diff;
              leadtimeFuncaoMap[funcao].count += 1;
            }
          }
        }
      }

      // Funil em andamento
      if (TERMINAL.includes(st)) return;
      if (!['Admissão', 'Readmissão'].includes(c.process_type)) return;

      const isEntrevista  = ['Cadastrado', 'Agendado', 'Reagendado'].includes(st);
      const isPendente    = st === 'Pré-Admissão (Pendente)';
      const isPronto      = st === 'Pré-Admissão (Pronto)';
      const analAprovado  = c.analysis_status === 'Aprovado';
      const docsRecebida  = String(c.docs_status || '').trim() === 'Recebida';
      const docsRecvNull  = !c.docs_receive_date  || String(c.docs_receive_date).trim()  === '' || String(c.docs_receive_date).trim()  === 'null';
      const medResultNull = !c.medical_result_date || String(c.medical_result_date).trim() === '' || String(c.medical_result_date).trim() === 'null';

      let bucket = null;
      if (isEntrevista) bucket = 'entrevistas';
      else if (isPronto) bucket = 'prontos';
      else if (isPendente && !(analAprovado && docsRecebida) && docsRecvNull) bucket = 'documentacao';
      else if (isPendente && analAprovado && docsRecebida && medResultNull)   bucket = 'exames';

      if (bucket) {
        let dataBase;
        if (bucket === 'entrevistas')  dataBase = c.interview_date       || c.created_at;
        else if (bucket === 'documentacao') dataBase = c.docs_request_date    || c.updated_at || c.created_at;
        else if (bucket === 'exames')  dataBase = c.medical_request_date || c.updated_at || c.created_at;
        else                           dataBase = c.updated_at           || c.created_at;
        const d = new Date(dataBase);
        d.setHours(0, 0, 0, 0);
        funilData[bucket].push({ ...c, tempoParado: Math.max(0, Math.floor((hoje - d) / 86400000)) });
      }
    });

    Object.keys(funilData).forEach(k => funilData[k].sort((a, b) => b.tempoParado - a.tempoParado));

    const monthly = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
    const ranking = Object.values(psychoMap).sort((a, b) => b.count - a.count);

    const refDate = new Date();
    const matrizMeses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` };
    });
    const matrizLinhas = Object.entries(psicoMesMap)
      .map(([name, mc]) => ({
        name,
        counts: matrizMeses.map(m => mc[m.key] || 0),
        total:  matrizMeses.reduce((s, m) => s + (mc[m.key] || 0), 0),
      }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);

    const leadtimeMedio = leadtimeValues.length > 0
      ? Math.round(leadtimeValues.reduce((s, v) => s + v, 0) / leadtimeValues.length)
      : 0;

    const aprovacaoPorPsicologo = Object.values(aprovacaoPorPsicoMap)
      .map(p => ({ ...p, pct: p.total > 0 ? Math.round((p.aprovados / p.total) * 100) : 0 }))
      .sort((a, b) => b.aprovados - a.aprovados);

    const leadtimePorPsicologo = Object.values(leadtimePorPsicoMap)
      .map(p => ({ name: p.name, media: Math.round(p.sum / p.count), count: p.count }))
      .sort((a, b) => a.media - b.media);

    const leadtimePorMes = Object.values(leadtimeMensalMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12)
      .map(m => ({ key: m.key, label: m.label, media: Math.round(m.sum / m.count), count: m.count }));

    const leadtimePorUnidade = Object.values(leadtimeUnidadeMap)
      .map(u => ({ name: u.name, media: Math.round(u.sum / u.count), count: u.count }))
      .sort((a, b) => a.media - b.media);

    const leadtimePorFuncao = Object.values(leadtimeFuncaoMap)
      .map(f => ({ name: f.name, media: Math.round(f.sum / f.count), count: f.count }))
      .sort((a, b) => a.media - b.media);

    const todosParados = [
      ...funilData.entrevistas.filter(c => c.tempoParado > 2).map(c => ({ ...c, etapaLabel: '1. Entrevista' })),
      ...funilData.documentacao.filter(c => c.tempoParado > 2).map(c => ({ ...c, etapaLabel: '2. Documentação' })),
      ...funilData.exames.filter(c => c.tempoParado > 2).map(c => ({ ...c, etapaLabel: '3. Exame Médico' })),
    ].sort((a, b) => b.tempoParado - a.tempoParado);

    const admitidos          = filteredCands.filter(c => c.status === 'Concluído' && ['Admissão','Readmissão'].includes(c.process_type));
    const repPeriodo         = filteredCands.filter(c => TERMINAL_REP.includes(c.status) && ['Admissão','Readmissão'].includes(c.process_type));
    const totalFunil         = admitidos.length + repPeriodo.length;
    const aprovadosEntrevista = [...admitidos, ...repPeriodo].filter(c => c.analysis_status === 'Aprovado').length;

    return {
      funil: funilData, totalAtendimentos, monthly, ranking, matrizMeses, matrizLinhas,
      indiceAprovacao: totalEntrevistados > 0 ? Math.round((totalAprovados / totalEntrevistados) * 100) : 0,
      aprovacaoPorPsicologo, leadtimeMedio, leadtimePorPsicologo, leadtimePorMes,
      leadtimePorUnidade, leadtimePorFuncao, todosParados, admitidos, totalFunil, aprovadosEntrevista,
    };
  }, [filteredCands]);

  // ── Destructure ───────────────────────────────────────────────────────────
  const {
    funil, totalAtendimentos, monthly, ranking, matrizMeses, matrizLinhas,
    indiceAprovacao, aprovacaoPorPsicologo, leadtimeMedio, leadtimePorPsicologo,
    leadtimePorMes, leadtimePorUnidade, leadtimePorFuncao, todosParados,
    admitidos, totalFunil, aprovadosEntrevista,
  } = comp;

  // ── Derivações de render ──────────────────────────────────────────────────
  const entrevistasAtrasadas  = funil.entrevistas.filter(c => c.tempoParado > 2);
  const gargaloPorResponsavel = entrevistasAtrasadas.reduce((acc, c) => { acc[c.respName] = (acc[c.respName] || 0) + 1; return acc; }, {});
  const gargaloPorFuncao      = entrevistasAtrasadas.reduce((acc, c) => { acc[c.roleName] = (acc[c.roleName] || 0) + 1; return acc; }, {});

  const rankBy = (arr, key) => Object.entries(
    arr.reduce((acc, c) => { const k = c[key] || 'N/A'; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  const rep_psicologo = rankBy(todosReprovados, 'responsible_name');
  const rep_funcao    = rankBy(todosReprovados, 'job_role_name');
  const rep_unidade   = rankBy(todosReprovados, 'unit_name');
  const rep_motivo    = rankBy(todosReprovados, 'cancellation_reason_name').map(([k, v]) => [k === 'N/A' ? 'Sem motivo informado' : k, v]);
  const rep_etapa     = Object.entries(
    todosReprovados.reduce((acc, c) => { const k = getEtapa(c); acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  const tabDataMap = { psicologo: rep_psicologo, funcao: rep_funcao, unidade: rep_unidade, etapa: rep_etapa, motivo: rep_motivo };
  const tabAtiva   = tabDataMap[abaReprovados] || [];
  const maxTabVal  = tabAtiva.length > 0 ? tabAtiva[0][1] : 1;

  const maxLeadtimeMes  = Math.max(...leadtimePorMes.map(m => m.media), 1);
  const leadtimeRankMap = { psicologo: leadtimePorPsicologo, unidade: leadtimePorUnidade, funcao: leadtimePorFuncao };
  const leadtimeRankAtual = leadtimeRankMap[viewLeadtime] || [];
  const maxLeadtimeRank   = Math.max(...leadtimeRankAtual.map(r => r.media), 1);

  const stages = [
    { id: 'entrevistas',  label: '1. Entrevistas',         count: funil.entrevistas.length,  color: '#3b82f6', icon: <Users size={14} /> },
    { id: 'documentacao', label: '2. Documentação',        count: funil.documentacao.length, color: '#f59e0b', icon: <FileText size={14} /> },
    { id: 'exames',       label: '3. Exames Médicos',      count: funil.exames.length,       color: '#8b5cf6', icon: <Activity size={14} /> },
    { id: 'prontos',      label: '4. Prontos p/ Admitir',  count: funil.prontos.length,      color: '#10b981', icon: <CheckCircle size={14} /> },
  ];
  const maxCount      = Math.max(...stages.map(s => s.count), 1);
  const maxMonthCount = Math.max(...monthly.map(m => m.count), 1);
  const maxRankCount  = Math.max(...ranking.map(r => r.count), 1);

  const unitOptions = allUnits.map(u => ({ value: u.id, label: u.name }));
  const roleOptions = allRoles.map(r => ({ value: r.id, label: r.name }));
  const userOptions = allUsers.map(u => ({ value: u.id, label: u.name }));

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>A compilar os dados gerenciais...</p>
      </div>
    );
  }

  // ── Modal: detalhe de etapa ───────────────────────────────────────────────
  const renderModalDetails = () => {
    if (!modalStage) return null;
    let title = '', list = [], icon = null;
    switch (modalStage) {
      case 'entrevistas':  title = '1. Entrevistas';               list = funil.entrevistas;  icon = <Users color="#3b82f6" />;       break;
      case 'documentacao': title = '2. Documentação Pendente';     list = funil.documentacao; icon = <FileText color="#f59e0b" />;    break;
      case 'exames':       title = '3. Exames Médicos Pendentes';  list = funil.exames;       icon = <Activity color="#8b5cf6" />;    break;
      case 'prontos':      title = '4. Prontos pra Admitir';       list = funil.prontos;      icon = <CheckCircle color="#10b981" />; break;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>{icon} Detalhes: {title}</h2>
            <button onClick={() => setModalStage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={28} color="var(--text-muted)" /></button>
          </div>

          {modalStage === 'entrevistas' && entrevistasAtrasadas.length > 0 && (
            <div style={{ marginBottom: '2rem', border: '1px solid var(--danger-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', backgroundColor: 'rgba(239,68,68,0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertTriangle size={20} /> Alerta: {entrevistasAtrasadas.length} candidato(s) parado(s) há mais de 2 dias
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Por Responsável</h4>
                  {Object.entries(gargaloPorResponsavel).sort((a, b) => b[1] - a[1]).map(([resp, count]) => (
                    <div key={resp} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{resp}</span><strong style={{ color: 'var(--danger-color)' }}>{count}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Por Função</h4>
                  {Object.entries(gargaloPorFuncao).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                    <div key={role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{role}</span><strong style={{ color: 'var(--danger-color)' }}>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {list.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <CheckCircle size={48} color="var(--success-color)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Fila Limpa!</h3>
              <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato nesta fase.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-color)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Candidato</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Função</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Unidade</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Responsável</th>
                    {modalStage !== 'prontos' && <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Tempo Parado</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {c.status}</div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>{c.roleName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.unitName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.respName}</td>
                      {modalStage !== 'prontos' && (
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: modalStage === 'entrevistas' && c.tempoParado > 2 ? 'var(--danger-color)' : (c.tempoParado > 0 ? 'var(--saritur-orange)' : 'var(--success-color)'),
                            color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                          }}>
                            {c.tempoParado} dia(s)
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Modal: parados > 2 dias ───────────────────────────────────────────────
  const renderModalParados = () => {
    if (!modalParados) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)' }}>
              <AlertTriangle size={22} /> Parados há mais de 2 dias — {todosParados.length} candidato(s)
            </h2>
            <button onClick={() => setModalParados(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={28} color="var(--text-muted)" /></button>
          </div>
          {todosParados.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <CheckCircle size={48} color="var(--success-color)" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato parado há mais de 2 dias.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-color)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Candidato</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Função</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Unidade</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Psicólogo</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Etapa</th>
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Tempo Parado</th>
                  </tr>
                </thead>
                <tbody>
                  {todosParados.map(c => (
                    <tr key={c.id + c.etapaLabel} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 0.75rem', fontWeight: '600', color: 'var(--text-main)' }}>{c.name}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>{c.roleName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.unitName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.respName}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{c.etapaLabel}</span>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: 'var(--danger-color)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {c.tempoParado} dia(s)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>

      {/* Cabeçalho */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Inteligência Gerencial</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>Acompanhamento centralizado de Recrutamento &amp; Seleção — todos os indicadores respondem aos filtros.</p>
      </div>

      {/* ── BARRA DE FILTROS (sticky) ─────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        backgroundColor: 'var(--surface-color)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '0.55rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <Filter size={14} color="var(--text-muted)" />

        {/* Datas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>De</span>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            style={{ padding: '0.28rem 0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.8rem' }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>Até</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            style={{ padding: '0.28rem 0.45rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.8rem' }}
          />
        </div>

        <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        <MultiSelect label="Unidade"     options={unitOptions} selected={filterUnidades}     onChange={setFilterUnidades}     placeholder="Todas as unidades" />
        <MultiSelect label="Função"      options={roleOptions} selected={filterFuncoes}      onChange={setFilterFuncoes}      placeholder="Todas as funções" />
        <MultiSelect label="Responsável" options={userOptions} selected={filterResponsaveis} onChange={setFilterResponsaveis} placeholder="Todos" />

        {hasFilter && (
          <>
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.28rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem',
                border: '1px solid var(--danger-color)', backgroundColor: 'transparent',
                color: 'var(--danger-color)', fontWeight: '600',
              }}
            >
              <X size={12} /> Limpar
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
              {filteredCands.length} / {rawCands.length} candidatos
            </span>
          </>
        )}
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

        {/* Card 1: Volume */}
        <div style={{ position: 'relative' }} onMouseEnter={() => setHoverCard('volume')} onMouseLeave={() => setHoverCard(null)}>
          <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              <BarChart size={14} color="var(--saritur-orange)" /> Volume de Atendimentos
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1' }}>{totalAtendimentos}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Total no período · passe o mouse</div>
          </div>
          {hoverCard === 'volume' && ranking.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Ranking por Psicólogo</div>
              {ranking.slice(0, 8).map((r, i) => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ color: i < 3 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 'bold', width: '18px' }}>{i + 1}º</span>
                    <span style={{ color: 'var(--text-main)' }}>{r.name.split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                  <strong style={{ color: 'var(--saritur-orange)' }}>{r.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Índice de Aprovação */}
        <div style={{ position: 'relative' }} onMouseEnter={() => setHoverCard('aprovacao')} onMouseLeave={() => setHoverCard(null)}>
          <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              <Target size={14} color="#10b981" /> Índice de Aprovação
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#10b981', lineHeight: '1' }}>{indiceAprovacao}%</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Aprovados / Entrevistados · passe o mouse</div>
          </div>
          {hoverCard === 'aprovacao' && aprovacaoPorPsicologo.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Por Psicólogo</div>
              {aprovacaoPorPsicologo.slice(0, 8).map(p => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-main)' }}>{p.name.split(' ').slice(0, 2).join(' ')}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{p.aprovados}/{p.total}</span>
                    <strong style={{ color: '#10b981', minWidth: '32px', textAlign: 'right' }}>{p.pct}%</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Parados > 2 dias */}
        <div>
          <div
            className="glass-panel"
            onClick={() => setModalParados(true)}
            style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', cursor: 'pointer', border: `1px solid ${todosParados.length > 0 ? 'var(--danger-color)' : 'var(--border-color)'}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              <Timer size={14} color={todosParados.length > 0 ? 'var(--danger-color)' : 'var(--text-muted)'} /> Parados &gt; 2 dias
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: todosParados.length > 0 ? 'var(--danger-color)' : 'var(--success-color)', lineHeight: '1' }}>{todosParados.length}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Todos os estágios · clique para detalhar</div>
          </div>
        </div>

        {/* Card 4: Leadtime Médio */}
        <div style={{ position: 'relative' }} onMouseEnter={() => setHoverCard('leadtime')} onMouseLeave={() => setHoverCard(null)}>
          <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              <Clock size={14} color="#8b5cf6" /> Leadtime Médio
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#8b5cf6', lineHeight: '1' }}>
              {leadtimeMedio > 0 ? leadtimeMedio : '—'}
              {leadtimeMedio > 0 && <span style={{ fontSize: '0.9rem', fontWeight: '400', marginLeft: '5px' }}>dias</span>}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Aprovação → Admissão · passe o mouse</div>
          </div>
          {hoverCard === 'leadtime' && leadtimePorPsicologo.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Leadtime por Psicólogo</div>
              {leadtimePorPsicologo.slice(0, 8).map(p => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-main)' }}>{p.name.split(' ').slice(0, 2).join(' ')}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{p.count} admissões</span>
                    <strong style={{ color: '#8b5cf6', minWidth: '48px', textAlign: 'right' }}>{p.media} dias</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FUNIL EM ANDAMENTO ─────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
          <BarChart3 size={18} color="var(--saritur-orange)" /> Processos em Andamento
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {stages.map(stage => (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '175px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 }}>
                <span style={{ color: stage.color }}>{stage.icon}</span> {stage.label}
              </div>
              <div
                style={{ flex: 1, backgroundColor: 'var(--bg-color)', borderRadius: '6px', height: '20px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => setModalStage(stage.id)}
                title="Clique para visualizar os candidatos"
              >
                <div style={{ width: `${(stage.count / maxCount) * 100}%`, backgroundColor: stage.color, height: '100%', transition: 'width 0.8s ease-in-out' }} />
              </div>
              <div style={{ width: '32px', textAlign: 'right', fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)', flexShrink: 0 }}>{stage.count}</div>
              <button onClick={() => setModalStage(stage.id)} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                <Eye size={13} /> Ver
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── VOLUME + LEADTIME (side-by-side) ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>

        {/* Volume Global */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={18} color="var(--success-color)" /> Volume Global
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                {[{ id: 'mensal', label: 'Mensal' }, { id: 'matriz', label: 'Psic × Mês' }].map(v => (
                  <button key={v.id} onClick={() => setViewVolume(v.id)} style={{
                    padding: '0.28rem 0.65rem', border: 'none', cursor: 'pointer', fontSize: '0.78rem',
                    backgroundColor: viewVolume === v.id ? 'var(--saritur-orange)' : 'var(--bg-color)',
                    color: viewVolume === v.id ? 'white' : 'var(--text-muted)',
                    fontWeight: viewVolume === v.id ? '700' : '400',
                  }}>{v.label}</button>
                ))}
              </div>
              <span style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1' }}>{totalAtendimentos}</span>
            </div>
          </div>

          {viewVolume === 'mensal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BarChart size={15} color="var(--text-muted)" /> Evolução por Mês/Ano
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
                  {monthly.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum dado registrado.</p>}
                  {monthly.map(m => (
                    <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '36px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 'bold', marginBottom: '3px', color: 'var(--text-main)' }}>{m.count}</span>
                      <div style={{ width: '100%', maxWidth: '28px', backgroundColor: 'var(--saritur-orange)', height: `${(m.count / maxMonthCount) * 120}px`, borderRadius: '4px 4px 0 0' }} />
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: '1' }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Award size={15} color="#f59e0b" /> Ranking por Psicólogo
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {ranking.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum responsável registrado.</p>}
                  {ranking.map((r, index) => (
                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ width: '22px', fontWeight: 'bold', color: index < 3 ? '#f59e0b' : 'var(--text-muted)', fontSize: '0.82rem', flexShrink: 0 }}>{index + 1}º</span>
                      <div style={{ width: '100px', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={r.name}>
                        {r.name.split(' ')[0]} {r.name.split(' ')[1] ? r.name.split(' ')[1][0] + '.' : ''}
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', height: '10px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: `${(r.count / maxRankCount) * 100}%`, backgroundColor: index === 0 ? '#10b981' : '#3b82f6', height: '100%' }} />
                      </div>
                      <div style={{ width: '28px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)', flexShrink: 0 }}>{r.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewVolume === 'matriz' && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Users size={15} color="var(--text-muted)" /> Volume por Psicólogo / Mês (últimos 6 meses)
              </div>
              {matrizLinhas.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum dado registrado.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-color)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700', minWidth: '120px' }}>Psicólogo</th>
                      {matrizMeses.map(m => (
                        <th key={m.key} style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '700', minWidth: '60px' }}>{m.label}</th>
                      ))}
                      <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: '700', borderLeft: '2px solid var(--border-color)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrizLinhas.map((linha, i) => (
                      <tr key={linha.name} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: 'var(--text-main)' }}>{linha.name.split(' ').slice(0, 2).join(' ')}</td>
                        {linha.counts.map((count, ci) => (
                          <td key={ci} style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: count > 0 ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: count > 0 ? '600' : '400' }}>{count > 0 ? count : '—'}</td>
                        ))}
                        <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: '900', color: 'var(--saritur-orange)', borderLeft: '2px solid var(--border-color)' }}>{linha.total}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>Total</td>
                      {matrizMeses.map((m, mi) => {
                        const colTotal = matrizLinhas.reduce((s, l) => s + l.counts[mi], 0);
                        return <td key={m.key} style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)' }}>{colTotal > 0 ? colTotal : '—'}</td>;
                      })}
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: '900', color: 'var(--text-main)', borderLeft: '2px solid var(--border-color)' }}>
                        {matrizLinhas.reduce((s, l) => s + l.total, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Análise de Leadtime */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={18} color="#8b5cf6" /> Análise de Leadtime
            </h2>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Média global</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#8b5cf6', lineHeight: '1' }}>{leadtimeMedio > 0 ? `${leadtimeMedio}d` : '—'}</div>
            </div>
          </div>

          {leadtimePorMes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem admissões concluídas no período.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Gráfico de colunas */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BarChart size={15} color="var(--text-muted)" /> Leadtime Médio por Mês (dias)
                </div>
                <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
                  <div style={{ minWidth: `${leadtimePorMes.length * 48}px` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '150px', overflow: 'visible', position: 'relative', borderBottom: '1px solid var(--border-color)' }}>
                      {[0.33, 0.66].map(f => (
                        <div key={f} style={{ position: 'absolute', bottom: `${f * 130}px`, left: 0, right: 0, height: '1px', backgroundColor: 'var(--border-color)', opacity: 0.5, pointerEvents: 'none' }} />
                      ))}
                      {leadtimePorMes.map(m => {
                        const barH  = Math.max(4, Math.round((m.media / maxLeadtimeMes) * 130));
                        const isHov = hoverLeadtime === m.key;
                        return (
                          <div key={m.key} onMouseEnter={() => setHoverLeadtime(m.key)} onMouseLeave={() => setHoverLeadtime(null)}
                            style={{ flex: 1, minWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', cursor: 'default' }}>
                            {isHov && (
                              <div style={{ position: 'absolute', bottom: `${barH + 32}px`, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.7rem', whiteSpace: 'nowrap', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.18)', pointerEvents: 'none' }}>
                                <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '1px' }}>{m.label}</div>
                                <div style={{ color: 'var(--text-muted)' }}>{m.media} dias · {m.count} adm.</div>
                              </div>
                            )}
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '2px', lineHeight: '1' }}>{m.media}</span>
                            <div style={{ width: '22px', height: `${barH}px`, backgroundColor: isHov ? '#3987e5' : '#2a78d6', borderRadius: '4px 4px 0 0', transition: 'background-color 0.15s' }} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '5px', paddingTop: '5px' }}>
                      {leadtimePorMes.map(m => (
                        <div key={m.key} style={{ flex: 1, minWidth: '40px', fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center' }}>{m.label}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rankings */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Award size={15} color="#f59e0b" /> Ranking (menor = melhor)
                  </div>
                  <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    {[{ id: 'psicologo', label: 'Psicólogo' }, { id: 'unidade', label: 'Unidade' }, { id: 'funcao', label: 'Função' }].map(v => (
                      <button key={v.id} onClick={() => setViewLeadtime(v.id)} style={{
                        padding: '0.25rem 0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                        backgroundColor: viewLeadtime === v.id ? '#2a78d6' : 'var(--bg-color)',
                        color: viewLeadtime === v.id ? 'white' : 'var(--text-muted)',
                        fontWeight: viewLeadtime === v.id ? '700' : '400',
                      }}>{v.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {leadtimeRankAtual.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum dado disponível.</p>
                  ) : leadtimeRankAtual.map((item, idx) => {
                    const pct = Math.round((item.media / maxLeadtimeRank) * 100);
                    return (
                      <div key={item.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: idx === 0 ? '#1baf7a' : 'var(--text-muted)', minWidth: '18px' }}>{idx + 1}º</span>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }} title={item.name}>{item.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{item.media} dias</strong>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({item.count})</span>
                          </div>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: '4px 4px 0 0', height: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2a78d6', borderRadius: '4px 4px 0 0', transition: 'width 0.7s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PROCESSOS CONCLUÍDOS + REPROVADOS ────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={18} color="#10b981" /> Processos Concluídos
          </h2>
          {hasFilter && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-color)', padding: '0.2rem 0.6rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              {admitidos.length} admitidos no período filtrado
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Funil de conversão */}
          {totalFunil === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.4rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: '600' }}>
                {hasFilter ? 'Nenhuma admissão ou reprovação no período filtrado.' : 'Nenhum processo concluído registrado.'}
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>Funil de Conversão</h3>
              {(() => {
                const items = [
                  { label: 'Total de candidatos',     count: totalFunil,           color: '#3b82f6' },
                  { label: 'Aprovados na entrevista', count: aprovadosEntrevista,  color: '#f59e0b' },
                  { label: 'Admitidos',               count: admitidos.length,     color: '#10b981' },
                ];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '700px' }}>
                    {items.map((item, i) => {
                      const pct     = totalFunil > 0 ? Math.round((item.count / totalFunil) * 100) : 0;
                      const convPct = i > 0 && items[i-1].count > 0 ? Math.round((item.count / items[i-1].count) * 100) : null;
                      return (
                        <div key={item.label}>
                          {convPct !== null && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem', paddingLeft: '190px' }}>↓ conversão {convPct}%</div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '180px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 }}>{item.label}</div>
                            <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', borderRadius: '6px', height: '20px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              <div style={{ width: `${pct}%`, backgroundColor: item.color, height: '100%', transition: 'width 0.8s ease-in-out' }} />
                            </div>
                            <div style={{ width: '32px', textAlign: 'right', fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)', flexShrink: 0 }}>{item.count}</div>
                            <div style={{ width: '35px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{pct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Análise de Reprovados / Cancelados */}
          {todosReprovados.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} color="var(--danger-color)" /> Análise dos Reprovados / Cancelados
                <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-muted)' }}>— histórico: {todosReprovados.length}</span>
              </h3>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'psicologo', label: 'Por Psicólogo' },
                  { id: 'funcao',    label: 'Por Função' },
                  { id: 'unidade',   label: 'Por Unidade' },
                  { id: 'etapa',     label: 'Por Etapa' },
                  { id: 'motivo',    label: 'Por Motivo' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setAbaReprovados(tab.id)} style={{
                    padding: '0.3rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: abaReprovados === tab.id ? 'var(--saritur-orange)' : 'var(--bg-color)',
                    color:           abaReprovados === tab.id ? 'white' : 'var(--text-muted)',
                    fontWeight:      abaReprovados === tab.id ? '700' : '400',
                  }}>{tab.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '680px' }}>
                {tabAtiva.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum dado disponível.</p>
                ) : tabAtiva.map(([label, count]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '200px', fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={label}>{label}</div>
                    <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', borderRadius: '5px', height: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div style={{ width: `${(count / maxTabVal) * 100}%`, backgroundColor: 'var(--danger-color)', height: '100%', opacity: 0.75, transition: 'width 0.8s ease-in-out' }} />
                    </div>
                    <div style={{ width: '28px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.88rem', color: 'var(--text-main)', flexShrink: 0 }}>{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {renderModalDetails()}
      {renderModalParados()}
    </div>
  );
}
