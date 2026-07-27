'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { ShieldAlert, Search, Eye, X, Activity, Clock, User, Database, ArrowRight } from 'lucide-react';

export default function SystemLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    checkAccessAndFetch();
  }, []);

  async function checkAccessAndFetch() {
    setLoading(true);
    try {
      const user = await api.me();
      
      // 1. BARREIRA DE SEGURANÇA: Apenas ADMIN
      if (user?.role !== 'ADMIN') {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      // 2. BUSCA OS LOGS 
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const logsData = await res.json();
        setLogs(Array.isArray(logsData) ? logsData : []);
      } else {
        setLogs([]);
      }

    } catch (error) {
      console.error("Erro ao carregar auditoria:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  // Filtro de pesquisa (pesquisa por nome, módulo ou ação)
  const filteredLogs = logs.filter(log => 
    (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.module && log.module.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Tela de bloqueio para não-admins
  if (!loading && !isAdmin) {
    return (
      <div style={{ padding: '6rem 2rem', textAlign: 'center', color: 'var(--danger-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <ShieldAlert size={80} style={{ marginBottom: '1.5rem', opacity: 0.9 }} />
        <h1 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.5rem' }}>Acesso Negado</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>Esta é uma área de segurança máxima. Apenas usuários com o perfil <strong>ADMIN</strong> possuem permissão para visualizar o log de auditoria.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>A decodificar registos de auditoria...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)', marginBottom: '0.5rem' }}>
            <ShieldAlert size={20} />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Auditoria de Sistema</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Logs do Sistema (Geral)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Rastreabilidade completa de todas as ações executadas na plataforma.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem', width: '300px' }}>
          <Search size={18} color="var(--text-muted)" style={{ marginRight: '0.5rem' }} />
          <input 
            type="text" 
            placeholder="Pesquisar usuário, ação ou módulo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: 'var(--text-main)' }}
          />
        </div>
      </div>

      {/* TABELA DE LOGS */}
      <div className="glass-panel" style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-color)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '600' }}>Data / Hora</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '600' }}>Usuário</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '600' }}>Módulo</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '600' }}>Ação Executada</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'center' }}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum registro encontrado para esta pesquisa.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  // Define cor da tag de ação
                  let actionColor = '#3b82f6'; // Azul padrão
                  if (log.action === 'DELETE') actionColor = 'var(--danger-color)';
                  if (log.action === 'CREATE') actionColor = '#10b981';
                  if (log.action === 'UPDATE') actionColor = 'var(--saritur-orange)';

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-main)', fontWeight: '500' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <User size={14} color="var(--text-muted)" />
                          {log.user_name}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Database size={14} color="var(--text-muted)" />
                          {log.module}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ backgroundColor: `${actionColor}15`, color: actionColor, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', marginRight: '0.5rem', border: `1px solid ${actionColor}30` }}>
                          {log.action}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>{log.description}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', margin: '0 auto' }}
                        >
                          <Eye size={14} style={{ marginRight: '4px' }} /> Inspecionar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE INSPEÇÃO PROFUNDA (JSON DIFF) */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={20} color="var(--danger-color)" /> Raio-X da Ação
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Executado por {selectedLog.user_name} em {new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-muted)" /></button>
            </div>

            <div style={{ marginBottom: '2rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Descrição do Sistema</span>
              <p style={{ fontSize: '1rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>{selectedLog.description}</p>
            </div>

            {/* PAINEL DE ANTES E DEPOIS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'stretch' }}>
              
              {/* ESTADO ANTERIOR */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center' }}>
                  Estado Anterior (Old Data)
                </div>
                <div style={{ backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '1rem', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', flex: 1 }}>
                  <pre style={{ margin: 0 }}>{selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : 'Nenhum dado anterior (Registro Novo ou Não Aplicável)'}</pre>
                </div>
              </div>

              {/* SETA DIVISÓRIA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.5rem', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
                  <ArrowRight size={24} color="var(--text-muted)" />
                </div>
              </div>

              {/* ESTADO NOVO */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center' }}>
                  Estado Novo (New Data)
                </div>
                <div style={{ backgroundColor: '#1e1e1e', color: '#10b981', padding: '1rem', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', flex: 1 }}>
                  <pre style={{ margin: 0 }}>{selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : 'Nenhum dado novo (Registro Excluído ou Não Aplicável)'}</pre>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button className="btn-secondary" onClick={() => setSelectedLog(null)}>Fechar Raio-X</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}