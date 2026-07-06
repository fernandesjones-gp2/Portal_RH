'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Users, UserCheck, Clock, TrendingUp, AlertTriangle, FileText, Activity, SearchX, Eye, X, CheckCircle, ChevronRight } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // Estado para armazenar os arrays de candidatos por etapa
  const [funil, setFunil] = useState({
    entrevistas: [],
    documentacao: [],
    exames: [],
    prontos: []
  });

  // Estado para controlar a abertura do modal de detalhes
  const [modalStage, setModalStage] = useState(null); // 'entrevistas', 'documentacao', 'exames', 'prontos'

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // Busca todos os dados necessários em paralelo para popular as tabelas
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
        // Ignora processos finalizados nesta visão de andamento
        if (['Concluído', 'Cancelado', 'Reprovado'].includes(c.status)) return;
        if (c.process_type === 'Promoção' && c.status === 'Aguardando Liderança') return; // Promoções ativas ficam em outro painel se preferir

        // 1. Enriquecimento de Dados (Puxar os nomes amigáveis)
        c.roleName = roles.find(r => r.id === c.job_role_id)?.name || c.job_role_name || 'N/A';
        c.unitName = units.find(u => u.id === c.unit_id)?.name || c.unit_name || 'N/A';
        c.respName = users.find(u => u.id === c.responsible_id)?.name || c.responsible_name || 'Sistema';

        // 2. Cálculo do Tempo Parado
        let dataBase = new Date(c.updated_at || c.created_at);
        dataBase.setHours(0, 0, 0, 0);

        // Se estiver em entrevista, tenta usar a data da entrevista (scheduled_date)
        if (['Agendado', 'Reagendado'].includes(c.status) && c.scheduled_date) {
          dataBase = new Date(c.scheduled_date);
          dataBase.setHours(0, 0, 0, 0);
        }

        let diffDias = Math.floor((hoje - dataBase) / (1000 * 60 * 60 * 24));
        c.tempoParado = diffDias > 0 ? diffDias : 0; // Evita dias negativos se agendado para o futuro

        // 3. Distribuição nas Etapas do Funil
        if (['Cadastrado', 'Agendado', 'Reagendado'].includes(c.status)) {
          novoFunil.entrevistas.push(c);
        } else if (['Aprovado', 'Em Análise', 'Pendente Documentação'].includes(c.status)) {
          novoFunil.documentacao.push(c);
        } else if (['Em Análise do Médico', 'Aprovado com Ressalva', 'Aprovado pelo Médico'].includes(c.status)) {
          novoFunil.exames.push(c);
        } else if (['Pré-Admissão (Pronto)', 'Promoção (Em Análise)'].includes(c.status)) {
          novoFunil.prontos.push(c);
        }
      });

      // Ordena por maior tempo parado
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

  // --- LÓGICA DO "EXTRA" (Gargalos Entrevista > 2 Dias) ---
  const entrevistasAtrasadas = funil.entrevistas.filter(c => c.tempoParado > 2);
  
  const gargaloPorResponsavel = entrevistasAtrasadas.reduce((acc, c) => {
    acc[c.respName] = (acc[c.respName] || 0) + 1;
    return acc;
  }, {});
  
  const gargaloPorFuncao = entrevistasAtrasadas.reduce((acc, c) => {
    acc[c.roleName] = (acc[c.roleName] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>A carregar o funil em tempo real...</p>
      </div>
    );
  }

  const renderModalDetails = () => {
    if (!modalStage) return null;

    let title = '';
    let list = [];
    let icon = null;

    switch(modalStage) {
      case 'entrevistas': title = '1. Triagem e Entrevistas'; list = funil.entrevistas; icon = <Users color="#3b82f6" />; break;
      case 'documentacao': title = '2. Análise de Documentação'; list = funil.documentacao; icon = <FileText color="#f59e0b" />; break;
      case 'exames': title = '3. Exames Médicos'; list = funil.exames; icon = <Activity color="#8b5cf6" />; break;
      case 'prontos': title = '4. Prontos para Admitir'; list = funil.prontos; icon = <CheckCircle color="#10b981" />; break;
    }

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              {icon} Detalhes do Funil: {title}
            </h2>
            <button onClick={() => setModalStage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={28} color="var(--text-muted)" /></button>
          </div>

          {/* PAINEL EXTRA: ALERTAS PARA ENTREVISTAS > 2 DIAS */}
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
                      <span style={{ color: 'var(--text-muted)' }}>{resp}</span>
                      <strong style={{ color: 'var(--danger-color)' }}>{count}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Gargalo por Função</h4>
                  {Object.entries(gargaloPorFuncao).sort((a,b)=>b[1]-a[1]).map(([role, count]) => (
                    <div key={role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{role}</span>
                      <strong style={{ color: 'var(--danger-color)' }}>{count}</strong>
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
                    <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Função / Vaga</th>
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
                          backgroundColor: c.tempoParado > 2 ? 'var(--danger-color)' : (c.tempoParado > 0 ? 'var(--saritur-orange)' : 'var(--success-color)'), 
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
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button className="btn-secondary" onClick={() => setModalStage(null)}>Fechar Visualização</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingBottom: '3rem' }}>
      
      {/* CABEÇALHO GLOBAL */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Inteligência Gerencial (Dashboard)</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhamento em tempo real da esteira de admissões e promoções.</p>
      </div>

      {/* ========================================================= */}
      {/* BLOCO 1: PROCESSOS EM ANDAMENTO (FUNIL DE RECRUTAMENTO) */}
      {/* ========================================================= */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          <Clock size={24} color="var(--saritur-orange)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', textTransform: 'uppercase' }}>Processos em Andamento</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          
          {/* CARD 1: ENTREVISTAS */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderTop: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>1. Entrevistas</h3>
                <p style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.1', marginTop: '0.5rem' }}>{funil.entrevistas.length}</p>
              </div>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '50%' }}>
                <Users size={24} color="#3b82f6" />
              </div>
            </div>
            <button onClick={() => setModalStage('entrevistas')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}>
              <Eye size={16} style={{ marginRight: '6px' }} /> Ver Candidatos
            </button>
          </div>

          {/* CARD 2: DOCUMENTAÇÃO */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>2. Documentação</h3>
                <p style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.1', marginTop: '0.5rem' }}>{funil.documentacao.length}</p>
              </div>
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '50%' }}>
                <FileText size={24} color="#f59e0b" />
              </div>
            </div>
            <button onClick={() => setModalStage('documentacao')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}>
              <Eye size={16} style={{ marginRight: '6px' }} /> Ver Candidatos
            </button>
          </div>

          {/* CARD 3: EXAMES MÉDICOS */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderTop: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>3. Exames Médicos</h3>
                <p style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.1', marginTop: '0.5rem' }}>{funil.exames.length}</p>
              </div>
              <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '50%' }}>
                <Activity size={24} color="#8b5cf6" />
              </div>
            </div>
            <button onClick={() => setModalStage('exames')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}>
              <Eye size={16} style={{ marginRight: '6px' }} /> Ver Candidatos
            </button>
          </div>

          {/* CARD 4: PRONTOS PRA ADMITIR */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderTop: '4px solid #10b981', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>4. Prontos p/ Admitir</h3>
                <p style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: '1.1', marginTop: '0.5rem' }}>{funil.prontos.length}</p>
              </div>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '50%' }}>
                <CheckCircle size={24} color="#10b981" />
              </div>
            </div>
            <button onClick={() => setModalStage('prontos')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}>
              <Eye size={16} style={{ marginRight: '6px' }} /> Ver Candidatos
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* BLOCO 2: PROCESSOS CONCLUÍDOS (EM CONSTRUÇÃO)             */}
      {/* ========================================================= */}
      <div style={{ opacity: '0.5' }}>
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
