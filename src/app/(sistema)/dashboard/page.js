'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Users, FileText, Activity, CheckCircle, SearchX, Eye, X, AlertTriangle, BarChart3, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  const [funil, setFunil] = useState({
    entrevistas: [],
    documentacao: [],
    exames: [],
    prontos: []
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

      cands.forEach(c => {
        const st = c.status ? c.status.trim() : '';

        // Ignora processos finalizados, reprovados ou cancelados
        if (['Concluído', 'Cancelado', 'Reprovado', 'Reprovado Documentação', 'Reprovado pelo Médico', 'Inapto Médico', 'Desistência', 'Falta'].includes(st)) return;
        
        // Isola apenas os candidatos de Recrutamento e Admissão (Ignora Promoções neste quadro)
        if (c.process_type === 'Promoção') return; 

        // Enriquecimento de Dados para a Tabela de Visualização
        c.roleName = roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || 'N/A';
        c.unitName = units.find(u => u.id === c.unit_id)?.name || c.unit_name || 'N/A';
        c.respName = users.find(u => u.id === c.responsible_id)?.name || c.responsible_name || 'Sistema';

        // ----------------------------------------------------------------------
        // MAPEAMENTO EXATO - IDÊNTICO ÀS TELAS DE PIPELINE
        // ----------------------------------------------------------------------
        let bucket = null;

        if (['Cadastrado', 'Agendado', 'Reagendado'].includes(st)) {
          bucket = 'entrevistas'; // Agendamentos
        } else if (['Aprovado', 'Pendente Documentação', 'Em Análise'].includes(st)) {
          bucket = 'documentacao'; // Bloco 1 da Admissão
        } else if (['Aguardando Exame', 'Pendente Exame', 'Em Análise do Médico'].includes(st)) {
          bucket = 'exames'; // Bloco 2 da Admissão
        } else if (['Aprovado pelo Médico', 'Aprovado com Ressalva', 'Pré-Admissão (Pronto)'].includes(st)) {
          bucket = 'prontos'; // Bloco 3 da Admissão
        } else {
          // Fallback de segurança: se o status for escrito ligeiramente diferente mas estiver ativo
          const lowerSt = st.toLowerCase();
          if (lowerSt.includes('exame') || lowerSt.includes('médico') || lowerSt.includes('medico')) {
             if (lowerSt.includes('aprovado')) bucket = 'prontos';
             else bucket = 'exames';
          } else if (lowerSt.includes('pronto') || lowerSt.includes('admiss')) {
             bucket = 'prontos';
          } else {
             bucket = 'documentacao'; // Default seguro
          }
        }

        // ----------------------------------------------------------------------
        // LÓGICA DE TEMPO PARADO
        // ----------------------------------------------------------------------
        let dataBase = new Date(c.updated_at || c.created_at);
        dataBase.setHours(0, 0, 0, 0);

        // Se for Entrevista, calcula com base na Data da Entrevista
        if (bucket === 'entrevistas' && (c.interview_date || c.scheduled_date)) {
          dataBase = new Date(c.interview_date || c.scheduled_date);
          dataBase.setHours(0, 0, 0, 0);
        }

        let diffDias = Math.floor((hoje - dataBase) / (1000 * 60 * 60 * 24));
        c.tempoParado = diffDias > 0 ? diffDias : 0; 

        // Adiciona ao respectivo quadro
        novoFunil[bucket].push(c);
      });

      // Ordena do mais atrasado (maior tempo parado) para o mais recente
      Object.keys(novoFunil).forEach(key => {
        novoFunil[key].sort((a, b) => b.tempoParado - a.tempoParado);
      });

      setFunil(novoFunil);

    } catch (error) {
      console.error("Erro ao montar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------------------
  // CÁLCULOS DO EXTRA: Gargalos nas Entrevistas (> 2 dias)
  // ----------------------------------------------------------------------
  const entrevistasAtrasadas = funil.entrevistas.filter(c => c.tempoParado > 2);
  const gargaloPorResponsavel = entrevistasAtrasadas.reduce((acc, c) => { acc[c.respName] = (acc[c.respName] || 0) + 1; return acc; }, {});
  const gargaloPorFuncao = entrevistasAtrasadas.reduce((acc, c) => { acc[c.roleName] = (acc[c.roleName] || 0) + 1; return acc; }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>Construindo painel visual...</p>
      </div>
    );
  }

  const renderModalDetails = () => {
    if (!modalStage) return null;

    let title = ''; let list = []; let icon = null;
    switch(modalStage) {
      case 'entrevistas': title = '1. Entrevistas (Agendamentos)'; list = funil.entrevistas; icon = <Users color="#3b82f6" />; break;
      case 'documentacao': title = '2. Documentação (Bloco 1 do Pipeline)'; list = funil.documentacao; icon = <FileText color="#f59e0b" />; break;
      case 'exames': title = '3. Exames Médicos (Bloco 2 do Pipeline)'; list = funil.exames; icon = <Activity color="#8b5cf6" />; break;
      case 'prontos': title = '4. Prontos pra Admitir (Bloco 3 do Pipeline)'; list = funil.prontos; icon = <CheckCircle color="#10b981" />; break;
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

          {/* PAINEL EXTRA: ALERTAS PARA ENTREVISTAS > 2 DIAS */}
          {modalStage === 'entrevistas' && entrevistasAtrasadas.length > 0 && (
            <div style={{ marginBottom: '2rem', border: '1px solid var(--danger-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertTriangle size={20} /> Alerta: {entrevistasAtrasadas.length} Candidato(s) parado(s) há mais de 2 dias na entrevista
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
               <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato aguardando nesta fase.</p>
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
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Tempo Parado</th>
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
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ 
                          backgroundColor: modalStage === 'entrevistas' && c.tempoParado > 2 ? 'var(--danger-color)' : (c.tempoParado > 0 ? 'var(--saritur-orange)' : 'var(--success-color)'), 
                          color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' 
                        }}>
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

  const stages = [
    { id: 'entrevistas', label: '1. Entrevistas', count: funil.entrevistas.length, color: '#3b82f6', icon: <Users size={16} /> },
    { id: 'documentacao', label: '2. Documentação', count: funil.documentacao.length, color: '#f59e0b', icon: <FileText size={16} /> },
    { id: 'exames', label: '3. Exames Médicos', count: funil.exames.length, color: '#8b5cf6', icon: <Activity size={16} /> },
    { id: 'prontos', label: '4. Prontos p/ Admitir', count: funil.prontos.length, color: '#10b981', icon: <CheckCircle size={16} /> }
  ];
  
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingBottom: '3rem' }}>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Inteligência Gerencial (Dashboard)</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhamento centralizado de Recrutamento & Seleção.</p>
      </div>

      {/* BLOCO ÚNICO E COMPACTO: FUNIL DE PROCESSOS EM ANDAMENTO */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', maxWidth: '900px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
          <BarChart3 size={24} color="var(--saritur-orange)" /> Processos em Andamento
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

      {/* BLOCO 2: HISTÓRICO / PROCESSOS CONCLUÍDOS */}
      <div style={{ opacity: '0.5', maxWidth: '900px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          <TrendingUp size={24} color="var(--success-color)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', textTransform: 'uppercase' }}>Processos Concluídos (Histórico)</h2>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Aguardando definição dos indicadores e métricas desta secção...</p>
        </div>
      </div>

      {renderModalDetails()}
    </div>
  );
}
