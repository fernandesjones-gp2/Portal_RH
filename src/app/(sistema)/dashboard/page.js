'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Users, FileText, Activity, CheckCircle, SearchX, Eye, X, AlertTriangle, BarChart3, TrendingUp, BarChart, Award } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  const [funil, setFunil] = useState({
    entrevistas: [],
    documentacao: [],
    exames: [],
    prontos: []
  });

  // Novo estado para armazenar os dados do histórico e ranking
  const [historyStats, setHistoryStats] = useState({
    total: 0,
    monthly: [],
    ranking: []
  });

  const [modalStage, setModalStage] = useState(null); 

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [candsRes, rolesRes, unitsRes, usersRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }).catch(() => []),
        api.jobRoles.list().catch(() => []),
        api.units.list().catch(() => []),
        api.users.list().catch(() => [])
      ]);

      const cands = Array.isArray(candsRes) ? candsRes : [];
      const roles = Array.isArray(rolesRes) ? rolesRes : [];
      const units = Array.isArray(unitsRes) ? unitsRes : [];
      const users = Array.isArray(usersRes) ? usersRes : [];

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const novoFunil = { entrevistas: [], documentacao: [], exames: [], prontos: [] };
      
      // Variáveis para o Histórico e Ranking
      const monthlyMap = {};
      const psychoMap = {};
      let totalAtendimentos = 0;

      cands.forEach(c => {
        const st = c.status ? c.status.trim() : '';

        // ======================================================================
        // 1. PROCESSAMENTO DO HISTÓRICO (Antes de filtrar os concluídos)
        // ======================================================================
        // Considera Admissões, Readmissões e também Promoções para o volume global de trabalho da equipe
        let dataAtendimento = c.interview_date || c.created_at; 
        if (dataAtendimento) {
          const d = new Date(dataAtendimento);
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const key = `${year}-${month}`;
          const label = `${month}/${year}`;

          if (!monthlyMap[key]) monthlyMap[key] = { key, label, count: 0 };
          monthlyMap[key].count++;

          const respName = users.find(u => u.id === c.responsible_id)?.name || c.responsible_name || 'Sem Responsável';
          if (respName !== 'Sistema') {
            if (!psychoMap[respName]) psychoMap[respName] = { name: respName, count: 0 };
            psychoMap[respName].count++;
          }
          
          totalAtendimentos++;
        }

        // ======================================================================
        // 2. FILTRAGEM PARA O FUNIL (Apenas processos ativos)
        // ======================================================================
        if (['Concluído', 'Cancelado', 'Reprovado', 'Reprovado Documentação', 'Reprovado pelo Médico', 'Inapto Médico', 'Desistência', 'Falta'].includes(st)) return;
        if (!['Admissão', 'Readmissão'].includes(c.process_type)) return; 

        // Enriquecimento de Dados para a Tabela de Visualização
        c.roleName = roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || 'N/A';
        c.unitName = units.find(u => u.id === c.unit_id)?.name || c.unit_name || 'N/A';
        c.respName = users.find(u => u.id === c.responsible_id)?.name || c.responsible_name || 'Sistema';

        // Mapeamento dos Blocos 
        const isEntrevista = ['Cadastrado', 'Agendado', 'Reagendado'].includes(st);
        const isBloco1 = ['1. Em Andamento', 'Em Andamento', 'Aprovado', 'Pendente Documentação', 'Em Análise', 'Aguardando Documentação'].includes(st);
        const isBloco2 = ['2. Pré-Admissão', 'Pré-Admissão', 'Aguardando Exame', 'Pendente Exame', 'Em Análise do Médico', 'Aprovado com Ressalva'].includes(st);
        const isBloco3 = ['3. Prontos para Admitir', 'Pronto para Admitir', 'Pré-Admissão (Pronto)', 'Aprovado pelo Médico'].includes(st);
        const isPipelineAdmissao = !isEntrevista; 

        let bucket = null;

        // REGRA 1: Entrevistas (Tela de Agendamentos)
        if (isEntrevista) {
          bucket = 'entrevistas';
        } 
        // REGRA 4: Prontos p/ Admitir (Todos do Bloco 3, independente do status)
        else if (isBloco3) {
          bucket = 'prontos'; 
        } 
        // REGRA 2: Documentação (SOMENTE Bloco 1 E docs_receive_date nulo)
        else if (isBloco1) {
          const isDocsNull = !c.docs_receive_date || String(c.docs_receive_date).trim() === '' || String(c.docs_receive_date).trim() === 'null';
          if (isDocsNull) {
            bucket = 'documentacao';
          }
        } 
        // REGRA 3: Exames Médicos (SOMENTE Bloco 2 E regras específicas)
        else if (isBloco2) {
          const isMedicalResultNull = !c.medical_result_date || String(c.medical_result_date).trim() === '' || String(c.medical_result_date).trim() === 'null';
          const analysisStatus = String(c.analysis_status || '').trim().toLowerCase();
          const isAnalysisAprovado = analysisStatus === 'aprovado';
          const docsStatus = String(c.docs_status || c.doc_status || c.document_status || '').trim().toLowerCase();
          const isDocsRecebida = docsStatus === 'recebida' || docsStatus === 'recebido';

          if (isMedicalResultNull && isAnalysisAprovado && isDocsRecebida) {
            bucket = 'exames';
          }
        }

        // CÁLCULO DE TEMPO PARADO 
        if (bucket) {
          let dataBase = new Date(c.updated_at || c.created_at);
          dataBase.setHours(0, 0, 0, 0);

          if (bucket === 'entrevistas' && (c.interview_date || c.scheduled_date)) {
            dataBase = new Date(c.interview_date || c.scheduled_date);
            dataBase.setHours(0, 0, 0, 0);
          }

          let diffDias = Math.floor((hoje - dataBase) / (1000 * 60 * 60 * 24));
          c.tempoParado = diffDias > 0 ? diffDias : 0; 

          novoFunil[bucket].push(c);
        }
      });

      // Ordena quem está há mais tempo parado no topo da lista
      Object.keys(novoFunil).forEach(key => {
        novoFunil[key].sort((a, b) => b.tempoParado - a.tempoParado);
      });

      // Prepara os Arrays de Histórico (Ordenando e Limitando)
      const monthlyArray = Object.values(monthlyMap)
        .sort((a, b) => a.key.localeCompare(b.key))
        .slice(-12); // Pega os últimos 12 meses para o gráfico de colunas

      const rankingArray = Object.values(psychoMap)
        .sort((a, b) => b.count - a.count); // Do maior para o menor

      setFunil(novoFunil);
      setHistoryStats({ total: totalAtendimentos, monthly: monthlyArray, ranking: rankingArray });

    } catch (error) {
      console.error("Erro ao montar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  // CÁLCULOS DO EXTRA: Gargalos nas Entrevistas (> 2 dias)
  const entrevistasAtrasadas = funil.entrevistas.filter(c => c.tempoParado > 2);
  const gargaloPorResponsavel = entrevistasAtrasadas.reduce((acc, c) => { acc[c.respName] = (acc[c.respName] || 0) + 1; return acc; }, {});
  const gargaloPorFuncao = entrevistasAtrasadas.reduce((acc, c) => { acc[c.roleName] = (acc[c.roleName] || 0) + 1; return acc; }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>A compilar os dados gerenciais...</p>
      </div>
    );
  }

  const renderModalDetails = () => {
    if (!modalStage) return null;

    let title = ''; let list = []; let icon = null;
    switch(modalStage) {
      case 'entrevistas': title = '1. Entrevistas (Agendamentos)'; list = funil.entrevistas; icon = <Users color="#3b82f6" />; break;
      case 'documentacao': title = '2. Documentação Pendente (Bloco 1)'; list = funil.documentacao; icon = <FileText color="#f59e0b" />; break;
      case 'exames': title = '3. Exames Médicos Pendentes (Bloco 2)'; list = funil.exames; icon = <Activity color="#8b5cf6" />; break;
      case 'prontos': title = '4. Prontos pra Admitir (Bloco 3)'; list = funil.prontos; icon = <CheckCircle color="#10b981" />; break;
    }

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              {icon} Detalhes: {title}
            </h2>
            <button onClick={() => setModalStage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={28} color="var(--text-muted)" /></button>
          </div>

          {modalStage === 'entrevistas' && entrevistasAtrasadas.length > 0 && (
            <div style={{ marginBottom: '2rem', border: '1px solid var(--danger-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertTriangle size={20} /> Alerta: {entrevistasAtrasadas.length} Candidato(s) parado(s) há mais de 2 dias
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Gargalo por Responsável</h4>
                  {Object.entries(gargaloPorResponsavel).sort((a,b)=>b[1]-a[1]).map(([resp, count]) => (
                    <div key={resp} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{resp}</span><strong style={{ color: 'var(--danger-color)' }}>{count}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Gargalo por Função</h4>
                  {Object.entries(gargaloPorFuncao).sort((a,b)=>b[1]-a[1]).map(([role, count]) => (
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
               <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato nesta fase cumpre os critérios da regra de banco.</p>
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
                    {modalStage !== 'prontos' && ( <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Tempo Parado</th> )}
                  </tr>
                </thead>
                <tbody>
                  {list.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Kanban: {c.status}</div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>{c.roleName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.unitName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.respName}</td>
                      {modalStage !== 'prontos' && (
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ 
                            backgroundColor: modalStage === 'entrevistas' && c.tempoParado > 2 ? 'var(--danger-color)' : (c.tempoParado > 0 ? 'var(--saritur-orange)' : 'var(--success-color)'), 
                            color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' 
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

  const stages = [
    { id: 'entrevistas', label: '1. Entrevistas', count: funil.entrevistas.length, color: '#3b82f6', icon: <Users size={16} /> },
    { id: 'documentacao', label: '2. Documentação', count: funil.documentacao.length, color: '#f59e0b', icon: <FileText size={16} /> },
    { id: 'exames', label: '3. Exames Médicos', count: funil.exames.length, color: '#8b5cf6', icon: <Activity size={16} /> },
    { id: 'prontos', label: '4. Prontos p/ Admitir', count: funil.prontos.length, color: '#10b981', icon: <CheckCircle size={16} /> }
  ];
  
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  
  // Limites para os gráficos de Histórico
  const maxMonthCount = Math.max(...historyStats.monthly.map(m => m.count), 1);
  const maxRankCount = Math.max(...historyStats.ranking.map(r => r.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingBottom: '3rem' }}>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Inteligência Gerencial (Dashboard)</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhamento centralizado de Recrutamento & Seleção.</p>
      </div>

      {/* BLOCO 1: FUNIL DE PROCESSOS EM ANDAMENTO */}
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
              
              <div style={{ width: '40px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                {stage.count}
              </div>
              
              <button onClick={() => setModalStage(stage.id)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={14} /> Ver
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* BLOCO 2: HISTÓRICO E RANKING DE ATENDIMENTOS */}
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
          
          {/* GRÁFICO 1: COLUNAS (Volume Mensal) */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart size={18} color="var(--text-muted)"/> Evolução por Mês/Ano
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '220px', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
              {historyStats.monthly.length === 0 && <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Nenhum dado mensal registrado.</p>}
              
              {historyStats.monthly.map(m => (
                <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '40px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-main)' }}>{m.count}</span>
                  <div 
                    style={{ 
                      width: '100%', maxWidth: '35px', backgroundColor: 'var(--saritur-orange)', 
                      height: `${(m.count / maxMonthCount) * 160}px`, 
                      borderRadius: '4px 4px 0 0', transition: 'height 1s ease-in-out' 
                    }}
                  ></div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICO 2: BARRAS HORIZONTAIS (Ranking por Psicóloga) */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award size={18} color="var(--saritur-yellow)"/> Ranking por Psicóloga
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {historyStats.ranking.length === 0 && <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Nenhum responsável registrado.</p>}

              {historyStats.ranking.map((r, index) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '25px', fontWeight: 'bold', color: index < 3 ? 'var(--saritur-yellow)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {index + 1}º
                  </span>
                  
                  <div style={{ width: '120px', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>
                    {r.name.split(' ')[0]} {r.name.split(' ')[1] ? r.name.split(' ')[1][0] + '.' : ''}
                  </div>
                  
                  <div style={{ flex: 1, backgroundColor: 'var(--bg-color)', height: '12px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(r.count / maxRankCount) * 100}%`, backgroundColor: index === 0 ? '#10b981' : '#3b82f6', height: '100%', transition: 'width 1s ease-in-out' }}></div>
                  </div>
                  
                  <div style={{ width: '35px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {r.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {renderModalDetails()}
    </div>
  );
}
