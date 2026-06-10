'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save, Users, Settings2, BarChart3, MessageSquareText, Info, PieChart } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); 
  const [usersList, setUsersList] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [widgets, setWidgets] = useState([]); // NOVO ESTADO: Widgets do Dashboard

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState(''); 

  const [newUnit, setNewUnit] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newReason, setNewReason] = useState(''); 

  const [editingUnit, setEditingUnit] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingReason, setEditingReason] = useState(null); 

  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateContent, setEditingTemplateContent] = useState('');

  // ESTADO DO CONSTRUTOR DE WIDGETS
  const [editingWidget, setEditingWidget] = useState(null);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [widgetForm, setWidgetForm] = useState({ title: '', chart_type: 'kpi', metric_type: 'count', status_filter: 'Todos', color: '#F37137', roles_visible: ['ADMIN'] });

  const availableRoles = ['ADMIN', 'RECRUITER', 'RECRUITER_ANALYST', 'MANAGER', 'SUPERINTENDENT', 'GP2', 'DP', 'PSYCHOLOGIST'];
  const menusAcessiveis = [
    { path: '/dashboard', label: 'Dashboard' }, { path: '/agendamentos', label: 'Agendamentos' },
    { path: '/pre-admissao', label: 'Pipeline' }, { path: '/promocoes', label: 'Promoções' },
    { path: '/concluidos', label: 'Concluídos' }, { path: '/configuracoes', label: 'Configurações' }
  ];

  useEffect(() => { checkAccessAndFetchData(); }, []);

  async function checkAccessAndFetchData() {
    setLoading(true);
    try {
      const sessionUser = await api.me();
      if (!sessionUser) { setIsAdmin(false); return; }
      const role = sessionUser.role || sessionUser.data?.role || sessionUser[0]?.role;
      if (role === 'ADMIN') { setIsAdmin(true); await fetchAllData(); } else { setIsAdmin(false); }
    } catch (error) { setIsAdmin(false); } finally { setLoading(false); }
  }

  async function fetchAllData() {
    try {
      const [unitsRes, rolesRes, reasonsRes, usersRes, permsRes, templatesRes, widgetsRes] = await Promise.all([
        api.units.list().catch(() => []), api.jobRoles.list().catch(() => []), api.cancellationReasons.list().catch(() => []),
        api.users.list().catch(() => []), api.rolePermissions.list().catch(() => []), api.messageTemplates.list().catch(() => []),
        api.dashboardWidgets.list().catch(() => []) // PUXA OS WIDGETS
      ]);
      setUnits(unitsRes || []); setRoles(rolesRes || []); setCancellationReasons(reasonsRes || []);
      setUsersList(usersRes || []); setPermissions(permsRes || []); setTemplates(templatesRes || []);
      setWidgets(widgetsRes || []);
    } catch (err) { console.error(err); }
  }

  // --- FUNÇÕES DOS WIDGETS DINÂMICOS ---
  function handleRoleToggle(role) {
    if (widgetForm.roles_visible.includes(role)) {
      setWidgetForm({ ...widgetForm, roles_visible: widgetForm.roles_visible.filter(r => r !== role) });
    } else {
      setWidgetForm({ ...widgetForm, roles_visible: [...widgetForm.roles_visible, role] });
    }
  }

  async function handleSaveWidget(e) {
    e.preventDefault();
    if (widgetForm.roles_visible.length === 0) return alert('Selecione ao menos um perfil para visualizar.');
    try {
      if (editingWidget) await api.dashboardWidgets.update(editingWidget.id, widgetForm);
      else await api.dashboardWidgets.create(widgetForm);
      setIsWidgetModalOpen(false); setEditingWidget(null);
      fetchAllData();
    } catch (err) { alert('Erro ao salvar Indicador: ' + err.message); }
  }

  async function handleDeleteWidget(id) {
    if (!confirm('Excluir este indicador do Dashboard?')) return;
    try { await api.dashboardWidgets.remove(id); fetchAllData(); } catch (err) { alert('Erro ao excluir.'); }
  }

  // ... (MANTENHA AQUI TODAS AS OUTRAS FUNÇÕES DE SALVAR UNIT, ROLE, TEMPLATES, ETC que já existiam) ...
  async function togglePermission(role, menu_path, hasPermission) { try { if (hasPermission) await api.rolePermissions.remove(role, menu_path); else await api.rolePermissions.add(role, menu_path); fetchAllData(); } catch (e) {} }
  async function handleSaveTemplate(id) { try { await api.messageTemplates.update(id, { content: editingTemplateContent }); alert('Salvo!'); setEditingTemplateId(null); fetchAllData(); } catch (error) {} }
  function startEditingTemplate(template) { setEditingTemplateId(template.id); setEditingTemplateContent(template.content); }
  async function handleAddUnit(e) { e.preventDefault(); if (!newUnit) return; try { await api.units.create({ name: newUnit.toUpperCase() }); setNewUnit(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateUnit() { if (!editingUnit.name) return; try { await api.units.update(editingUnit.id, { name: editingUnit.name.toUpperCase() }); setEditingUnit(null); fetchAllData(); } catch (error) {} }
  async function handleDeleteUnit(id) { if (!confirm('Excluir unidade?')) return; try { await api.units.remove(id); setSelectedUnitId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }
  async function handleAddRole(e) { e.preventDefault(); if (!newRole) return; try { await api.jobRoles.create({ name: newRole.toUpperCase() }); setNewRole(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateRole() { if (!editingRole.name) return; try { await api.jobRoles.update(editingRole.id, { name: editingRole.name.toUpperCase() }); setEditingRole(null); fetchAllData(); } catch (error) {} }
  async function handleDeleteRole(id) { if (!confirm('Excluir função?')) return; try { await api.jobRoles.remove(id); setSelectedRoleId(''); fetchAllData(); } catch (error) { alert('Existem vínculos ativos.'); } }
  async function handleAddReason(e) { e.preventDefault(); if (!newReason) return; try { await api.cancellationReasons.create({ name: newReason.toUpperCase() }); setNewReason(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateReason() { if (!editingReason.name) return; try { await api.cancellationReasons.update(editingReason.id, { name: editingReason.name.toUpperCase() }); setEditingReason(null); fetchAllData(); } catch (error) {} }
  async function handleDeleteReason(id) { if (!confirm('Excluir motivo?')) return; try { await api.cancellationReasons.remove(id); setSelectedReasonId(''); fetchAllData(); } catch (error) {} }
  async function handleUpdateUserRoleAndUnit(userId, updatedRole, updatedUnitId) { try { await api.users.update(userId, { role: updatedRole, unit_id: updatedUnitId || null }); fetchAllData(); } catch (error) {} }
  async function handleApproveUser(id) { try { await api.users.update(id, { status: 'Aprovado' }); fetchAllData(); } catch (error) {} }
  async function handleDeleteUser(id) { if (!confirm('Deseja bloquear este usuário?')) return; try { await api.users.remove(id); fetchAllData(); } catch (error) {} }

  if (loading) return <p style={{ padding: '2rem' }}>Validando credenciais...</p>;
  if (isAdmin === false) return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><ShieldAlert size={64} color="var(--danger-color)" /><h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Restrito</h2></div>);

  const currentUnitObj = units.find(u => u.id === selectedUnitId);
  const currentRoleObj = roles.find(r => r.id === selectedRoleId);
  const currentReasonObj = cancellationReasons.find(r => r.id === selectedReasonId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div><h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Painel de Governança Integrada</h1><p style={{ color: 'var(--text-muted)' }}>Controle de acessos, tabelas institucionais e chaves do sistema.</p></div>

      {/* BLOCO NOVO: CONSTRUTOR DE DASHBOARD */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={20} color="var(--saritur-orange)" /> Construtor de Dashboard (Indicadores)
          </h2>
          <button onClick={() => { setEditingWidget(null); setWidgetForm({ title: '', chart_type: 'kpi', metric_type: 'count', status_filter: 'Todos', color: '#F37137', roles_visible: ['ADMIN'] }); setIsWidgetModalOpen(true); }} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> Criar Indicador
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {widgets.map(w => (
            <div key={w.id} style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${w.color}`, borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>{w.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tipo: <strong>{w.chart_type.toUpperCase()}</strong> | Regra: <strong>{w.metric_type}</strong></p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtro: <strong>{w.status_filter}</strong></p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setEditingWidget(w); setWidgetForm(w); setIsWidgetModalOpen(true); }}><Edit2 size={14} color="var(--text-muted)"/></button>
                  <button onClick={() => handleDeleteWidget(w.id)}><Trash2 size={14} color="var(--danger-color)"/></button>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {w.roles_visible.map(r => <span key={r} style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{r}</span>)}
              </div>
            </div>
          ))}
          {widgets.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum indicador configurado. O Dashboard ficará em branco.</p>}
        </div>
      </div>

      {/* --- O RESTANTE DA PÁGINA (Dropdowns, Usuários, Matriz, Mensagens) PERMANECE EXATAMENTE IGUAL --- */}
      {/* ... CÓDIGOS DE DROPDOWNS, USUARIOS, TEMPLATES ... */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings2 size={20} color="var(--saritur-orange)" /> Tabelas Estruturais (Dropdowns)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Unidades</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedUnitId} onChange={e => { setSelectedUnitId(e.target.value); setEditingUnit(null); }}><option value="">-- {units.length} Unidades --</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            {selectedUnitId && currentUnitObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {editingUnit ? <input value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentUnitObj.name}</strong>}
                <div style={{ display: 'flex', gap: '0.2rem' }}>{editingUnit ? (<><button onClick={handleUpdateUnit} style={{ color: 'var(--success-color)' }}><Check size={14} /></button><button onClick={() => setEditingUnit(null)}><X size={14} /></button></>) : (<><button onClick={() => setEditingUnit(currentUnitObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteUnit(selectedUnitId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div>
              </div>
            )}
            <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova..." style={{ flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Funções (Cargos)</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setEditingRole(null); }}><option value="">-- {roles.length} Funções --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedRoleId && currentRoleObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {editingRole ? <input value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentRoleObj.name}</strong>}
                <div style={{ display: 'flex', gap: '0.2rem' }}>{editingRole ? (<><button onClick={handleUpdateRole} style={{ color: 'var(--success-color)' }}><Check size={14} /></button><button onClick={() => setEditingRole(null)}><X size={14} /></button></>) : (<><button onClick={() => setEditingRole(currentRoleObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteRole(selectedRoleId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div>
              </div>
            )}
            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova..." style={{ flex: 1 }} value={newRole} onChange={e => setNewRole(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Motivos de Cancelamento</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedReasonId} onChange={e => { setSelectedReasonId(e.target.value); setEditingReason(null); }}><option value="">-- {cancellationReasons.length} Motivos --</option>{cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedReasonId && currentReasonObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {editingReason ? <input value={editingReason.name} onChange={e => setEditingReason({...editingReason, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentReasonObj.name}</strong>}
                <div style={{ display: 'flex', gap: '0.2rem' }}>{editingReason ? (<><button onClick={handleUpdateReason} style={{ color: 'var(--success-color)' }}><Check size={14} /></button><button onClick={() => setEditingReason(null)}><X size={14} /></button></>) : (<><button onClick={() => setEditingReason(currentReasonObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteReason(selectedReasonId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div>
              </div>
            )}
            <form onSubmit={handleAddReason} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Novo..." style={{ flex: 1 }} value={newReason} onChange={e => setNewReason(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} color="var(--saritur-orange)" /> Controle de Acesso e Perfis</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '0.75rem' }}>Colaborador</th><th style={{ padding: '0.75rem' }}>Status</th><th style={{ padding: '0.75rem' }}>Perfil</th><th style={{ padding: '0.75rem' }}>Unidade</th><th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th></tr></thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}><div style={{ fontWeight: '600' }}>{user.name || 'Sem nome'}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div></td>
                  <td style={{ padding: '0.75rem' }}>{user.status === 'Pendente' ? <span style={{ backgroundColor: 'var(--saritur-yellow)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pendente</span> : <span style={{ backgroundColor: 'var(--success-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Aprovado</span>}</td>
                  <td style={{ padding: '0.75rem' }}><select style={{ padding: '0.25rem', fontSize: '0.85rem' }} value={user.role || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, e.target.value, user.unit_id)}>{availableRoles.map(role => <option key={role} value={role}>{role}</option>)}</select></td>
                  <td style={{ padding: '0.75rem' }}><select style={{ padding: '0.25rem', fontSize: '0.85rem', width: '140px' }} value={user.unit_id || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, user.role, e.target.value)}><option value="">Geral</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{user.status === 'Pendente' && <button onClick={() => handleApproveUser(user.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem', marginRight: '0.5rem' }}><Check size={14} /></button>}<button onClick={() => handleDeleteUser(user.id)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquareText size={20} color="var(--saritur-orange)" /> Modelos de Mensagens (WhatsApp)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {templates.map(template => (
            <div key={template.id} style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{template.title}</strong>
                {editingTemplateId === template.id ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleSaveTemplate(template.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Check size={14} /> Salvar</button>
                    <button onClick={() => setEditingTemplateId(null)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><X size={14} /> Cancelar</button>
                  </div>
                ) : ( <button onClick={() => startEditingTemplate(template)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Edit2 size={12} /> Editar</button> )}
              </div>
              {editingTemplateId === template.id ? (<textarea style={{ width: '100%', minHeight: '80px', padding: '0.75rem' }} value={editingTemplateContent} onChange={e => setEditingTemplateContent(e.target.value)} />) : (<p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{template.content}"</p>)}
            </div>
          ))}
        </div>
      </div>

      {/* --- MODAL DE CONSTRUÇÃO DO WIDGET --- */}
      {isWidgetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{editingWidget ? 'Editar Indicador' : 'Novo Indicador Dinâmico'}</h2>
              <button onClick={() => setIsWidgetModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            <form onSubmit={handleSaveWidget} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Título do Indicador</label>
                <input required type="text" style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="Ex: Total de Reprovados" value={widgetForm.title} onChange={e => setWidgetForm({...widgetForm, title: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Formato (Visual)</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.chart_type} onChange={e => setWidgetForm({...widgetForm, chart_type: e.target.value})}>
                    <option value="kpi">Cartão Simples (Número)</option>
                    <option value="bar">Gráfico de Barras (Evolução)</option>
                    <option value="line">Gráfico de Linha (Tendência)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Fórmula de Cálculo</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.metric_type} onChange={e => setWidgetForm({...widgetForm, metric_type: e.target.value})}>
                    <option value="count">Contagem Direta (Qtd)</option>
                    <option value="rate">Taxa Percentual (%)</option>
                    <option value="monthly">Somar por Mês (Para Gráficos)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Base de Dados / Filtro</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.status_filter} onChange={e => setWidgetForm({...widgetForm, status_filter: e.target.value})}>
                    <option value="Todos">Todos os Processos (Sem filtro)</option>
                    <option value="Agendado">Somente Agendados (Entrevista)</option>
                    <option value="Banco de Talentos">Banco de Talentos</option>
                    <option value="Pré-Admissão (Pendente)">Pré-Admissão (Pendente/Análise)</option>
                    <option value="Pré-Admissão (Pronto)">Pré-Admissão (Pronto/Aguardando DP)</option>
                    <option value="Concluído">Admissões Concluídas (Efetivados)</option>
                    <option value="Reprovado">Candidatos Reprovados / Cancelados</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cor Primária</label>
                  <input type="color" style={{ width: '100%', height: '40px', padding: '0', border: 'none', cursor: 'pointer' }} value={widgetForm.color} onChange={e => setWidgetForm({...widgetForm, color: e.target.value})} />
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>Visibilidade (Quem pode ver este indicador no Dashboard?)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {availableRoles.map(role => (
                    <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={widgetForm.roles_visible.includes(role)} onChange={() => handleRoleToggle(role)} style={{ cursor: 'pointer', accentColor: 'var(--saritur-orange)' }} />
                      {role}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsWidgetModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar no Painel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
