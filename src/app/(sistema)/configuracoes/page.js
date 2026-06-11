'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save, Users, Settings2, BarChart3, MessageSquareText, PieChart } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]); 
  const [usersList, setUsersList] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [widgets, setWidgets] = useState([]); 

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

  const [dashTargets, setDashTargets] = useState({ targetLeadtime: '15', targetApprovalRate: '60' });

  // ESTADOS DO CONSTRUTOR DE DASHBOARD AVANÇADO
  const [editingWidget, setEditingWidget] = useState(null);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [widgetForm, setWidgetForm] = useState({ 
    title: '', chart_type: 'kpi', metric_type: 'count', status_filter: 'Todos', color: '#F37137', roles_visible: ['ADMIN'],
    advanced_config: { format: 'integer', size: 'half', groupBy: 'all' }
  });

  const availableRoles = ['ADMIN', 'RECRUITER', 'RECRUITER_ANALYST', 'MANAGER', 'SUPERINTENDENT', 'GP2', 'DP', 'PSYCHOLOGIST'];
  const menusAcessiveis = [
    { path: '/dashboard', label: 'Dashboard' }, { path: '/agendamentos', label: 'Agendamentos' },
    { path: '/pre-admissao', label: 'Pipeline' }, { path: '/promocoes', label: 'Promoções' },
    { path: '/concluidos', label: 'Concluídos' }, { path: '/configuracoes', label: 'Configurações' }
  ];

  useEffect(() => { 
    checkAccessAndFetchData(); 
    const savedTargets = localStorage.getItem('portal_rh_targets');
    if (savedTargets) setDashTargets(JSON.parse(savedTargets));
  }, []);

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
        api.dashboardWidgets.list().catch(() => []) 
      ]);
      setUnits(unitsRes || []); setRoles(rolesRes || []); setCancellationReasons(reasonsRes || []);
      setUsersList(usersRes || []); setPermissions(permsRes || []); setTemplates(templatesRes || []); setWidgets(widgetsRes || []);
    } catch (err) {}
  }

  function handleRoleToggle(role) {
    if (widgetForm.roles_visible.includes(role)) setWidgetForm({ ...widgetForm, roles_visible: widgetForm.roles_visible.filter(r => r !== role) });
    else setWidgetForm({ ...widgetForm, roles_visible: [...widgetForm.roles_visible, role] });
  }

  async function handleSaveWidget(e) {
    e.preventDefault();
    if (widgetForm.roles_visible.length === 0) return alert('Selecione ao menos um perfil.');
    try {
      if (editingWidget) await api.dashboardWidgets.update(editingWidget.id, widgetForm);
      else await api.dashboardWidgets.create(widgetForm);
      setIsWidgetModalOpen(false); setEditingWidget(null); fetchAllData();
    } catch (err) { alert('Erro ao salvar Indicador: ' + err.message); }
  }

  async function handleDeleteWidget(id) {
    if (!confirm('Excluir este indicador?')) return;
    try { await api.dashboardWidgets.remove(id); fetchAllData(); } catch (err) { alert('Erro ao excluir.'); }
  }

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

  function handleSaveTargets(e) { e.preventDefault(); localStorage.setItem('portal_rh_targets', JSON.stringify(dashTargets)); alert('Metas atualizadas!'); }

  if (loading) return <p style={{ padding: '2rem' }}>Validando credenciais...</p>;
  if (isAdmin === false) return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><ShieldAlert size={64} color="var(--danger-color)" /><h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Restrito</h2></div>);

  const currentUnitObj = units.find(u => u.id === selectedUnitId);
  const currentRoleObj = roles.find(r => r.id === selectedRoleId);
  const currentReasonObj = cancellationReasons.find(r => r.id === selectedReasonId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '3rem' }}>
      <div><h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Painel de Governança Integrada</h1></div>

      {/* BLOCO NOVO: CONSTRUTOR DE DASHBOARD */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={20} color="var(--saritur-orange)" /> Construtor de Dashboard (Avançado)
          </h2>
          <button onClick={() => { 
            setEditingWidget(null); 
            setWidgetForm({ title: '', chart_type: 'kpi', metric_type: 'count', status_filter: 'Todos', color: '#F37137', roles_visible: ['ADMIN'], advanced_config: { format: 'integer', size: 'half', groupBy: 'all' } }); 
            setIsWidgetModalOpen(true); 
          }} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> Novo Indicador
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {widgets.map(w => (
            <div key={w.id} style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${w.color}`, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>{w.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.chart_type.toUpperCase()} | {w.metric_type}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setEditingWidget(w); setWidgetForm(w); setIsWidgetModalOpen(true); }}><Edit2 size={14} color="var(--text-muted)"/></button>
                  <button onClick={() => handleDeleteWidget(w.id)}><Trash2 size={14} color="var(--danger-color)"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings2 size={20} color="var(--saritur-orange)" /> Tabelas Estruturais</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Unidades</label>
            <select style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} value={selectedUnitId} onChange={e => { setSelectedUnitId(e.target.value); setEditingUnit(null); }}><option value="">-- Selecione --</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            {selectedUnitId && currentUnitObj && (<div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>{editingUnit ? <input style={{width: '70%', padding: '0.2rem'}} value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentUnitObj.name}</strong>}<div style={{ display: 'flex', gap: '0.5rem' }}>{editingUnit ? (<><button onClick={handleUpdateUnit} style={{ color: 'var(--success-color)' }}><Check size={16} /></button><button onClick={() => setEditingUnit(null)}><X size={16} /></button></>) : (<><button onClick={() => setEditingUnit(currentUnitObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteUnit(selectedUnitId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div></div>)}
            <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova Unidade..." style={{ flex: 1, padding: '0.5rem' }} value={newUnit} onChange={e => setNewUnit(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Funções</label>
            <select style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setEditingRole(null); }}><option value="">-- Selecione --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedRoleId && currentRoleObj && (<div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>{editingRole ? <input style={{width: '70%', padding: '0.2rem'}} value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentRoleObj.name}</strong>}<div style={{ display: 'flex', gap: '0.5rem' }}>{editingRole ? (<><button onClick={handleUpdateRole} style={{ color: 'var(--success-color)' }}><Check size={16} /></button><button onClick={() => setEditingRole(null)}><X size={16} /></button></>) : (<><button onClick={() => setEditingRole(currentRoleObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteRole(selectedRoleId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div></div>)}
            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Nova Função..." style={{ flex: 1, padding: '0.5rem' }} value={newRole} onChange={e => setNewRole(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cancelamentos</label>
            <select style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }} value={selectedReasonId} onChange={e => { setSelectedReasonId(e.target.value); setEditingReason(null); }}><option value="">-- Selecione --</option>{cancellationReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            {selectedReasonId && currentReasonObj && (<div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>{editingReason ? <input style={{width: '70%', padding: '0.2rem'}} value={editingReason.name} onChange={e => setEditingReason({...editingReason, name: e.target.value})} /> : <strong style={{ fontSize: '0.85rem' }}>{currentReasonObj.name}</strong>}<div style={{ display: 'flex', gap: '0.5rem' }}>{editingReason ? (<><button onClick={handleUpdateReason} style={{ color: 'var(--success-color)' }}><Check size={16} /></button><button onClick={() => setEditingReason(null)}><X size={16} /></button></>) : (<><button onClick={() => setEditingReason(currentReasonObj)}><Edit2 size={14} /></button><button onClick={() => handleDeleteReason(selectedReasonId)} style={{ color: 'var(--danger-color)' }}><Trash2 size={14} /></button></>)}</div></div>)}
            <form onSubmit={handleAddReason} style={{ display: 'flex', gap: '0.5rem' }}><input type="text" placeholder="Novo Motivo..." style={{ flex: 1, padding: '0.5rem' }} value={newReason} onChange={e => setNewReason(e.target.value)} /><button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button></form>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} color="var(--saritur-orange)" /> Controle de Acesso e Matriz</h2>
        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '0.75rem' }}>Colaborador</th><th style={{ padding: '0.75rem' }}>Status</th><th style={{ padding: '0.75rem' }}>Perfil</th><th style={{ padding: '0.75rem' }}>Unidade</th><th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th></tr></thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}><div style={{ fontWeight: '600' }}>{user.name || 'Sem nome'}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div></td>
                  <td style={{ padding: '0.75rem' }}>{user.status === 'Pendente' ? <span style={{ backgroundColor: 'var(--saritur-yellow)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pendente</span> : <span style={{ backgroundColor: 'var(--success-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Aprovado</span>}</td>
                  <td style={{ padding: '0.75rem' }}><select style={{ padding: '0.25rem', fontSize: '0.85rem' }} value={user.role || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, e.target.value, user.unit_id)}>{availableRoles.map(role => <option key={role} value={role}>{role}</option>)}</select></td>
                  <td style={{ padding: '0.75rem' }}><select style={{ padding: '0.25rem', fontSize: '0.85rem', width: '140px' }} value={user.unit_id || ''} onChange={e => handleUpdateUserRoleAndUnit(user.id, user.role, e.target.value)}><option value="">Acesso Geral</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{user.status === 'Pendente' && <button onClick={() => handleApproveUser(user.id)} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem', marginRight: '0.5rem' }}><Check size={14} /></button>}<button onClick={() => handleDeleteUser(user.id)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Perfil / Telas</th>{menusAcessiveis.map(menu => <th key={menu.path} style={{ padding: '0.75rem', fontWeight: '600' }}>{menu.label}</th>)}</tr></thead>
            <tbody>
              {availableRoles.map(role => (
                <tr key={role} style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'left' }}>{role}</td>
                  {menusAcessiveis.map(menu => { const hasPerm = permissions.some(p => p.role === role && p.menu_path === menu.path); return <td key={`${role}-${menu.path}`} style={{ padding: '0.75rem' }}><input type="checkbox" checked={hasPerm} onChange={() => togglePermission(role, menu.path, hasPerm)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--saritur-orange)' }} /></td>; })}
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

      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} color="var(--saritur-orange)" /> Metas Globais do Dashboard</h2>
        <form onSubmit={handleSaveTargets} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta Leadtime (Dias)</label><input type="number" style={{padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid var(--border-color)'}} placeholder="Ex: 15" value={dashTargets.targetLeadtime} onChange={e => setDashTargets({...dashTargets, targetLeadtime: e.target.value})} /></div>
          <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Taxa de Aprovação (%)</label><input type="number" style={{padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid var(--border-color)'}} placeholder="Ex: 60" value={dashTargets.targetApprovalRate} onChange={e => setDashTargets({...dashTargets, targetApprovalRate: e.target.value})} /></div>
          <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.5rem' }}><Save size={16} /> Salvar Parâmetros</button>
        </form>
      </div>

      {/* --- O SUPER MODAL DO CONSTRUTOR --- */}
      {isWidgetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Construtor de Indicador</h2>
              <button onClick={() => setIsWidgetModalOpen(false)}><X size={24} color="var(--text-muted)" /></button>
            </div>
            
            <form onSubmit={handleSaveWidget} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Título do Indicador</label>
                <input required type="text" style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="Ex: Lead Time de Admissão (SLA)" value={widgetForm.title} onChange={e => setWidgetForm({...widgetForm, title: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Visualização do Gráfico</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.chart_type} onChange={e => setWidgetForm({...widgetForm, chart_type: e.target.value})}>
                    <option value="kpi">Cartão KPI (Número Solto)</option>
                    <option value="bar">Gráfico de Colunas (Vertical)</option>
                    <option value="bar_horizontal">Gráfico de Barras (Horizontal)</option>
                    <option value="line">Gráfico de Linha (Tendência)</option>
                    <option value="area">Gráfico de Área</option>
                    <option value="pie">Gráfico de Pizza (Proporção)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Tamanho na Tela</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.advanced_config?.size || 'half'} onChange={e => setWidgetForm({...widgetForm, advanced_config: { ...widgetForm.advanced_config, size: e.target.value }})}>
                    <option value="third">Pequeno (1/3 da tela)</option>
                    <option value="half">Médio (Metade da tela)</option>
                    <option value="full">Grande (Largura Total)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Agrupamento (Eixo X ou Categorias)</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.advanced_config?.groupBy || 'all'} onChange={e => setWidgetForm({...widgetForm, advanced_config: { ...widgetForm.advanced_config, groupBy: e.target.value }})}>
                    {/* A NOVA OPÇÃO FOI INSERIDA AQUI */}
                    <option value="all">Sem Agrupamento (Total Geral)</option>
                    <option value="month">Por Mês de Admissão/Conclusão</option>
                    <option value="unit">Por Unidade Operacional</option>
                    <option value="role">Por Função (Cargo)</option>
                    <option value="recruiter">Por Responsável/Recrutador</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Cálculo / Fórmula (Eixo Y)</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.metric_type} onChange={e => setWidgetForm({...widgetForm, metric_type: e.target.value})}>
                    <option value="count">Contagem de Processos (Quantidade)</option>
                    <option value="date_diff">Operação Matemática (Data Fim - Data Inicial em Dias)</option>
                  </select>
                </div>
              </div>

              {widgetForm.metric_type === 'date_diff' && (
                <div style={{ backgroundColor: 'rgba(243, 113, 55, 0.05)', border: '1px solid var(--saritur-orange)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--saritur-orange)', marginBottom: '0.75rem' }}>Matemática: Variáveis de Data</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <select required style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.dateEnd || ''} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, dateEnd: e.target.value}})}>
                      <option value="">-- Campo Final --</option>
                      <option value="admission_date">Data de Admissão</option>
                      <option value="medical_result_date">Resultado do Exame</option>
                      <option value="docs_receive_date">Recebimento Docs</option>
                    </select>
                    <span style={{ fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--text-muted)' }}>-</span>
                    <select required style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.dateStart || ''} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, dateStart: e.target.value}})}>
                      <option value="">-- Campo Inicial --</option>
                      <option value="interview_date">Data da Entrevista</option>
                      <option value="created_at">Criação do Processo</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Formato de Saída</label>
                      <select style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.format || 'integer'} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, format: e.target.value}})}>
                        <option value="integer">Número Inteiro</option>
                        <option value="decimal">Decimal (ex: 2.5)</option>
                        <option value="percent">Percentual (%)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Linha de Meta (Opcional)</label>
                      <input type="number" step="0.1" placeholder="Ex: Meta de 15 dias" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={widgetForm.advanced_config?.targetValue || ''} onChange={e => setWidgetForm({...widgetForm, advanced_config: {...widgetForm.advanced_config, targetValue: e.target.value}})} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Base de Dados / Filtro Global</label>
                  <select style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={widgetForm.status_filter} onChange={e => setWidgetForm({...widgetForm, status_filter: e.target.value})}>
                    <option value="Todos">Todo o Histórico (Sem filtro)</option>
                    <option value="Concluído">Somente Concluídos (Admitidos)</option>
                    <option value="Reprovado">Somente Reprovados</option>
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
