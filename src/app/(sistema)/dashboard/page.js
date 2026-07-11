'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  Users, FileText, Activity, CheckCircle, Eye, X,
  AlertTriangle, BarChart3, TrendingUp, BarChart, Award,
  Clock, Target, Timer,
} from 'lucide-react';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TERMINAL = ['Concluído','Cancelado','Reprovado','Reprovado Documentação','Reprovado pelo Médico','Inapto Médico','Desistência','Falta'];
const TERMINAL_REP = ['Reprovado','Cancelado','Reprovado Documentação','Reprovado pelo Médico','Inapto Médico','Desistência','Falta'];
const ETAPA_MAP = {
  'Reprovado': 'Entrevista',
  'Cancelado': 'Cancelado',
  'Reprovado Documentação': 'Documentação',
  'Reprovado pelo Médico': 'Exame Médico',
  'Inapto Médico': 'Exame Médico',
  'Desistência': 'Desistência/Falta',
  'Falta': 'Desistência/Falta',
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [funil, setFunil] = useState({ entrevistas: [], documentacao: [], exames: [], prontos: [] });
  const [historyStats, setHistoryStats] = useState({ total: 0, monthly: [], ranking: [] });
  const [kpis, setKpis] = useState({
    indiceAprovacao: 0,
    aprovacaoPorPsicologo: [],
    leadtimeMedio: 0,
    leadtimePorPsicologo: [],
  });
  const [rawCands, setRawCands] = useState([]);

  const [filtroPeriodo, setFiltroPeriodo] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
  });

  const [modalStage, setModalStage] = useState(null);
  const [modalParados, setModalParados] = useState(false);
  const [hoverCard, setHoverCard] = useState(null);
  const [abaReprovados, setAbaReprovados] = useState('psicologo');

  useEffect(() => { fetchDashboardData(); }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [candsRes, rolesRes, unitsRes, usersRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }).catch(() => []),
        api.jobRoles.list().catch(() => []),
        api.units.list().catch(() => []),
        api.users.list().catch(() => []),
      ]);

      const cands  = Array.isArray(candsRes)  ? candsRes  : [];
      const roles  = Array.isArray(rolesRes)  ? rolesRes  : [];
      const units  = Array.isArray(unitsRes)  ? unitsRes  : [];
      const users  = Array.isArray(usersRes)  ? usersRes  : [];

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const novoFunil   = { entrevistas: [], documentacao: [], exames: [], prontos: [] };
      const monthlyMap  = {};
      const psychoMap   = {};
      let totalAtendimentos = 0;

      let totalEntrevistados = 0, totalAprovados = 0;
      const aprovacaoPorPsicoMap  = {};
      const leadtimeValues        = [];
      const leadtimePorPsicoMap   = {};

      cands.forEach(c => {
        const st = c.status ? c.status.trim() : '';

        // Enriquecimento de dados
        c.roleName = roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || 'N/A';
        c.unitName = units.find(u => u.id === c.unit_id)?.name   || c.unit_name      || 'N/A';
        c.respName = users.find(u => u.id === c.responsible_id)?.name || c.responsible_name || 'Sistema';

        // ── HISTÓRICO ──────────────────────────────────────────────────────────
        const dataAted = c.interview_date || c.created_at;
        if (dataAted) {
          const d    = new Date(dataAted);
          const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          if (!monthlyMap[key]) monthlyMap[key] = { key, label, count: 0 };
          monthlyMap[key].count++;
          if (c.respName !== 'Sistema') {
            if (!psychoMap[c.respName]) psychoMap[c.respName] = { name: c.respName, count: 0 };
            psychoMap[c.respName].count++;
          }
          totalAtendimentos++;
        }

        // ── KPIs ────────────────────────────────────────────────────────────────
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
              }
            }
          }
        }

        // ── FUNIL EM ANDAMENTO ──────────────────────────────────────────────────
        if (TERMINAL.includes(st)) return;
        if (!['Admissão', 'Readmissão'].includes(c.process_type)) return;

        const isEntrevista = ['Cadastrado', 'Agendado', 'Reagendado'].includes(st);
        const isBloco1 = ['1. Em Andamento', 'Em Andamento', 'Aprovado', 'Pendente Documentação', 'Em Análise', 'Aguardando Documentação'].includes(st);
        const isBloco2 = ['2. Pré-Admissão', 'Pré-Admissão', 'Aguardando Exame', 'Pendente Exame', 'Em Análise do Médico', 'Aprovado com Ressalva'].includes(st);
        const isBloco3 = ['3. Prontos para Admitir', 'Pronto para Admitir', 'Pré-Admissão (Pronto)', 'Aprovado pelo Médico'].includes(st);

        let bucket = null;
        if (isEntrevista) {
          bucket = 'entrevistas';
        } else if (isBloco3) {
          bucket = 'prontos';
        } else if (isBloco1) {
          const docsNull = !c.docs_receive_date || String(c.docs_receive_date).trim() === '' || String(c.docs_receive_date).trim() === 'null';
          if (docsNull) bucket = 'documentacao';
        } else if (isBloco2) {
          const medNull   = !c.medical_result_date || String(c.medical_result_date).trim() === '' || String(c.medical_result_date).trim() === 'null';
          const analSt    = String(c.analysis_status || '').trim().toLowerCase();
          const docsSt    = String(c.docs_status || c.doc_status || c.document_status || '').trim().toLowerCase();
          if (medNull && analSt === 'aprovado' && (docsSt === 'recebida' || docsSt === 'recebido')) {
            bucket = 'exames';
          }
        }

        if (bucket) {
          let dataBase;
          if (bucket === 'entrevistas') {
            dataBase = c.interview_date || c.created_at;
          } else if (bucket === 'documentacao') {
            dataBase = c.docs_request_date   || c.updated_at || c.created_at;
          } else if (bucket === 'exames') {
            dataBase = c.medical_request_date || c.updated_at || c.created_at;
          } else {
            dataBase = c.updated_at || c.created_at;
          }
          const d = new Date(dataBase);
          d.setHours(0, 0, 0, 0);
          c.tempoParado = Math.max(0, Math.floor((hoje - d) / 86400000));
          novoFunil[bucket].push(c);
        }
      });

      Object.keys(novoFunil).forEach(k => novoFunil[k].sort((a, b) => b.tempoParado - a.tempoParado));

      const monthlyArray = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
      const rankingArray = Object.values(psychoMap).sort((a, b) => b.count - a.count);

      const leadtimeMedio = leadtimeValues.length > 0
        ? Math.round(leadtimeValues.reduce((s, v) => s + v, 0) / leadtimeValues.length)
        : 0;

      const aprovacaoPorPsicologo = Object.values(aprovacaoPorPsicoMap)
        .map(p => ({ ...p, pct: p.total > 0 ? Math.round((p.aprovados / p.total) * 100) : 0 }))
        .sort((a, b) => b.aprovados - a.aprovados);

      const leadtimePorPsicologo = Object.values(leadtimePorPsicoMap)
        .map(p => ({ name: p.name, media: Math.round(p.sum / p.count), count: p.count }))
        .sort((a, b) => a.media - b.media);

      setFunil(novoFunil);
      setHistoryStats({ total: totalAtendimentos, monthly: monthlyArray, ranking: rankingArray });
      setKpis({ indiceAprovacao: totalEntrevistados > 0 ? Math.round((totalAprovados / totalEntrevistados) * 100) : 0, aprovacaoPorPsicologo, leadtimeMedio, leadtimePorPsicologo });
      setRawCands(cands);

    } catch (error) {
      console.error('Erro ao montar dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  // ── Candidatos parados > 2 dias (todos os estágios) ──────────────────────
  const todosParados = [
    ...funil.entrevistas.filter(c => c.tempoParado > 2).map(c => ({ ...c, etapaLabel: '1. Entrevista' })),
    ...funil.documentacao.filter(c => c.tempoParado > 2).map(c => ({ ...c, etapaLabel: '2. Documentação' })),
    ...funil.exames.filter(c => c.tempoParado > 2).map(c => ({ ...c, etapaLabel: '3. Exame Médico' })),
  ].sort((a, b) => b.tempoParado - a.tempoParado);

  const entrevistasAtrasadas     = funil.entrevistas.filter(c => c.tempoParado > 2);
  const gargaloPorResponsavel    = entrevistasAtrasadas.reduce((acc, c) => { acc[c.respName] = (acc[c.respName] || 0) + 1; return acc; }, {});
  const gargaloPorFuncao         = entrevistasAtrasadas.reduce((acc, c) => { acc[c.roleName] = (acc[c.roleName] || 0) + 1; return acc; }, {});

  // ── Bloco 2 — computação dinâmica ────────────────────────────────────────
  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() + 1 === filtroPeriodo.mes && d.getFullYear() === filtroPeriodo.ano;
  };

  const admitidosPeriodo  = rawCands.filter(c => c.status === 'Concluído' && ['Admissão','Readmissão'].includes(c.process_type) && inPeriod(c.admission_date));
  const reprovadosPeriodo = rawCands.filter(c => TERMINAL_REP.includes(c.status) && ['Admissão','Readmissão'].includes(c.process_type) && inPeriod(c.updated_at));
  const totalPeriodo      = admitidosPeriodo.length + reprovadosPeriodo.length;
  const aprovadosIntervistaPeriodo = [...admitidosPeriodo, ...reprovadosPeriodo].filter(c => c.analysis_status === 'Aprovado').length;

  const rankBy = (arr, key) => Object.entries(
    arr.reduce((acc, c) => { const k = c[key] || 'N/A'; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  const rep_psicologo = rankBy(reprovadosPeriodo, 'responsible_name');
  const rep_funcao    = rankBy(reprovadosPeriodo, 'job_role_name');
  const rep_unidade   = rankBy(reprovadosPeriodo, 'unit_name');
  const rep_motivo    = rankBy(reprovadosPeriodo, 'cancellation_reason_name').map(([k, v]) => [k === 'N/A' ? 'Sem motivo informado' : k, v]);
  const rep_etapa     = Object.entries(
    reprovadosPeriodo.reduce((acc, c) => { const k = ETAPA_MAP[c.status] || c.status || 'Outro'; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>A compilar os dados gerenciais...</p>
      </div>
    );
  }

  // ── Modal: detalhe de etapa do funil ─────────────────────────────────────
  const renderModalDetails = () => {
    if (!modalStage) return null;
    let title = '', list = [], icon = null;
    switch (modalStage) {
      case 'entrevistas':  title = '1. Entrevistas';               list = funil.entrevistas; icon = <Users color="#3b82f6" />;       break;
      case 'documentacao': title = '2. Documentação Pendente';     list = funil.documentacao; icon = <FileText color="#f59e0b" />;   break;
      case 'exames':       title = '3. Exames Médicos Pendentes';  list = funil.exames;       icon = <Activity color="#8b5cf6" />;   break;
      case 'prontos':      title = '4. Prontos pra Admitir';       list = funil.prontos;      icon = <CheckCircle color="#10b981" />; break;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
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

  // ── Modal: parados > 2 dias (todos os estágios) ───────────────────────────
  const renderModalParados = () => {
    if (!modalParados) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
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

  // ── Dados do funil em andamento ───────────────────────────────────────────
  const stages = [
    { id: 'entrevistas',  label: '1. Entrevistas',      count: funil.entrevistas.length,  color: '#3b82f6', icon: <Users size={16} /> },
    { id: 'documentacao', label: '2. Documentação',     count: funil.documentacao.length, color: '#f59e0b', icon: <FileText size={16} /> },
    { id: 'exames',       label: '3. Exames Médicos',   count: funil.exames.length,       color: '#8b5cf6', icon: <Activity size={16} /> },
    { id: 'prontos',      label: '4. Prontos p/ Admitir', count: funil.prontos.length,    color: '#10b981', icon: <CheckCircle size={16} /> },
  ];
  const maxCount     = Math.max(...stages.map(s => s.count), 1);
  const maxMonthCount = Math.max(...historyStats.monthly.map(m => m.count), 1);
  const maxRankCount  = Math.max(...historyStats.ranking.map(r => r.count), 1);

  // Dados das tabs de reprovados
  const tabDataMap = { psicologo: rep_psicologo, funcao: rep_funcao, unidade: rep_unidade, etapa: rep_etapa, motivo: rep_motivo };
  const tabAtiva = tabDataMap[abaReprovados] || [];
  const maxTabVal = tabAtiva.length > 0 ? tabAtiva[0][1] : 1;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingBottom: '3rem' }}>

      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Inteligência Gerencial (Dashboard)</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhamento centralizado de Recrutamento & Seleção.</p>
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>

        {/* Card 1: Volume de Atendimentos */}
        <div style={{ position: 'relative' }}
          onMouseEnter={() => setHoverCard('volume')}
          onMouseLeave={() => setHoverCard(null)}
        >
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              <BarChart size={15} color="var(--saritur-orange)" /> Volume de Atendimentos
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1' }}>{historyStats.total}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Total histórico · passe o mouse para ranking</div>
          </div>
          {hoverCard === 'volume' && historyStats.ranking.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Ranking por Psicólogo</div>
              {historyStats.ranking.slice(0, 8).map((r, i) => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
        <div style={{ position: 'relative' }}
          onMouseEnter={() => setHoverCard('aprovacao')}
          onMouseLeave={() => setHoverCard(null)}
        >
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              <Target size={15} color="#10b981" /> Índice de Aprovação
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#10b981', lineHeight: '1' }}>{kpis.indiceAprovacao}%</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Aprovados / Entrevistados · passe o mouse</div>
          </div>
          {hoverCard === 'aprovacao' && kpis.aprovacaoPorPsicologo.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Por Psicólogo</div>
              {kpis.aprovacaoPorPsicologo.slice(0, 8).map(p => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-main)' }}>{p.name.split(' ').slice(0, 2).join(' ')}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{p.aprovados}/{p.total}</span>
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
            style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', cursor: 'pointer', border: `1px solid ${todosParados.length > 0 ? 'var(--danger-color)' : 'var(--border-color)'}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              <Timer size={15} color={todosParados.length > 0 ? 'var(--danger-color)' : 'var(--text-muted)'} /> Parados &gt; 2 dias
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: todosParados.length > 0 ? 'var(--danger-color)' : 'var(--success-color)', lineHeight: '1' }}>{todosParados.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Todos os estágios · clique para detalhar</div>
          </div>
        </div>

        {/* Card 4: Leadtime Médio */}
        <div style={{ position: 'relative' }}
          onMouseEnter={() => setHoverCard('leadtime')}
          onMouseLeave={() => setHoverCard(null)}
        >
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              <Clock size={15} color="#8b5cf6" /> Leadtime Médio
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#8b5cf6', lineHeight: '1' }}>
              {kpis.leadtimeMedio > 0 ? kpis.leadtimeMedio : '—'}
              {kpis.leadtimeMedio > 0 && <span style={{ fontSize: '1rem', fontWeight: '400', marginLeft: '6px' }}>dias</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Aprovação → Admissão · passe o mouse</div>
          </div>
          {hoverCard === 'leadtime' && kpis.leadtimePorPsicologo.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Leadtime por Psicólogo</div>
              {kpis.leadtimePorPsicologo.slice(0, 8).map(p => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-main)' }}>{p.name.split(' ').slice(0, 2).join(' ')}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{p.count} admissões</span>
                    <strong style={{ color: '#8b5cf6', minWidth: '48px', textAlign: 'right' }}>{p.media} dias</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FUNIL EM ANDAMENTO ────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
          <BarChart3 size={24} color="var(--saritur-orange)" /> Processos em Andamento
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
          {stages.map(stage => (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                <span style={{ color: stage.color }}>{stage.icon}</span> {stage.label}
              </div>
              <div
                style={{ flex: 1, backgroundColor: 'var(--bg-color)', borderRadius: '8px', height: '24px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => setModalStage(stage.id)}
                title="Clique para visualizar os candidatos"
              >
                <div style={{ width: `${(stage.count / maxCount) * 100}%`, backgroundColor: stage.color, height: '100%', transition: 'width 1s ease-in-out' }}></div>
              </div>
              <div style={{ width: '40px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{stage.count}</div>
              <button onClick={() => setModalStage(stage.id)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={14} /> Ver
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── VOLUME GLOBAL DE ATENDIMENTOS ─────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={24} color="var(--success-color)" /> Volume Global de Atendimentos
          </h2>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Histórico</span>
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1' }}>{historyStats.total}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '3rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart size={18} color="var(--text-muted)" /> Evolução por Mês/Ano
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '220px', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
              {historyStats.monthly.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum dado registrado.</p>}
              {historyStats.monthly.map(m => (
                <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '40px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-main)' }}>{m.count}</span>
                  <div style={{ width: '100%', maxWidth: '35px', backgroundColor: 'var(--saritur-orange)', height: `${(m.count / maxMonthCount) * 160}px`, borderRadius: '4px 4px 0 0', transition: 'height 1s ease-in-out' }}></div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award size={18} color="#f59e0b" /> Ranking por Psicólogo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {historyStats.ranking.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum responsável registrado.</p>}
              {historyStats.ranking.map((r, index) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '25px', fontWeight: 'bold', color: index < 3 ? '#f59e0b' : 'var(--text-muted)', fontSize: '0.9rem' }}>{index + 1}º</span>
                  <div style={{ width: '120px', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>
                    {r.name.split(' ')[0]} {r.name.split(' ')[1] ? r.name.split(' ')[1][0] + '.' : ''}
                  </div>
                  <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', height: '12px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(r.count / maxRankCount) * 100}%`, backgroundColor: index === 0 ? '#10b981' : '#3b82f6', height: '100%', transition: 'width 1s ease-in-out' }}></div>
                  </div>
                  <div style={{ width: '35px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>{r.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOCO 2: PROCESSOS CONCLUÍDOS ────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>

        {/* Header + seletor de período */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={24} color="#10b981" /> Processos Concluídos
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Período:</span>
            <select
              value={filtroPeriodo.mes}
              onChange={e => setFiltroPeriodo(p => ({ ...p, mes: Number(e.target.value) }))}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem' }}
            >
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={filtroPeriodo.ano}
              onChange={e => setFiltroPeriodo(p => ({ ...p, ano: Number(e.target.value) }))}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {totalPeriodo === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <CheckCircle size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Sem dados para {MESES[filtroPeriodo.mes - 1]} / {filtroPeriodo.ano}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum processo encerrado neste período.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

            {/* Funil de conversão */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Funil de Conversão — {MESES[filtroPeriodo.mes - 1]} {filtroPeriodo.ano}</h3>
              {(() => {
                const items = [
                  { label: 'Total de candidatos',       count: totalPeriodo,                 color: '#3b82f6' },
                  { label: 'Aprovados na entrevista',   count: aprovadosIntervistaPeriodo,   color: '#f59e0b' },
                  { label: 'Admitidos',                 count: admitidosPeriodo.length,       color: '#10b981' },
                ];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '750px' }}>
                    {items.map((item, i) => {
                      const pct     = totalPeriodo > 0 ? Math.round((item.count / totalPeriodo) * 100) : 0;
                      const convPct = i > 0 && items[i - 1].count > 0 ? Math.round((item.count / items[i - 1].count) * 100) : null;
                      return (
                        <div key={item.label}>
                          {convPct !== null && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', paddingLeft: '210px' }}>
                              ↓ conversão {convPct}%
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '200px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>{item.label}</div>
                            <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', borderRadius: '8px', height: '24px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              <div style={{ width: `${pct}%`, backgroundColor: item.color, height: '100%', transition: 'width 1s ease-in-out' }}></div>
                            </div>
                            <div style={{ width: '40px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{item.count}</div>
                            <div style={{ width: '40px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>{pct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Análise dos Reprovados */}
            {reprovadosPeriodo.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} color="var(--danger-color)" /> Análise dos Reprovados / Cancelados ({reprovadosPeriodo.length})
                </h3>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'psicologo', label: 'Por Psicólogo' },
                    { id: 'funcao',    label: 'Por Função' },
                    { id: 'unidade',   label: 'Por Unidade' },
                    { id: 'etapa',     label: 'Por Etapa' },
                    { id: 'motivo',    label: 'Por Motivo' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setAbaReprovados(tab.id)}
                      style={{
                        padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: abaReprovados === tab.id ? 'var(--saritur-orange)' : 'var(--bg-color)',
                        color:           abaReprovados === tab.id ? 'white' : 'var(--text-muted)',
                        fontWeight:      abaReprovados === tab.id ? '700' : '400',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Conteúdo da aba */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '700px' }}>
                  {tabAtiva.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum dado disponível.</p>
                  ) : tabAtiva.map(([label, count]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '180px', fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</div>
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', borderRadius: '6px', height: '18px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: `${(count / maxTabVal) * 100}%`, backgroundColor: 'var(--danger-color)', height: '100%', opacity: 0.75, transition: 'width 0.8s ease-in-out' }}></div>
                      </div>
                      <div style={{ width: '30px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-main)' }}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {renderModalDetails()}
      {renderModalParados()}
    </div>
  );
}
