'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Save, Users, Settings2, BarChart3, Key } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dados do banco
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Seleção dos Dropdowns (Muitos dados)
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Formulários de Criação
  const [newUnit, setNewUnit] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'RECRUITER', unit_id: '' });

  // Estados de Edição
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Configurações do Dashboard (Metas salvas no LocalStorage para persistência simples)
  const [dashTargets, setDashTargets] = useState({ targetLeadtime: '15', targetApprovalRate: '60' });

  // Lista oficial de Perfis de Acesso (ENUM do Banco)
  const availableRoles = ['ADMIN', 'RECRUITER', 'RECRUITER_ANALYST', 'MANAGER', 'SUPERINTENDENT', 'GP2', 'DP', 'PSYCHOLOGIST'];

  useEffect(() => {
    checkAccessAndFetchData();
    // Carrega metas salvas do dashboard
    const savedTargets = localStorage.getItem('portal_rh_targets');
    if (savedTargets) setDashTargets(JSON.parse(savedTargets));
  }, []);

  async function checkAccessAndFetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        return;
      }

      const { data: user } = await supabase.from('users').select('role').eq('id', session.user.id).single();

      if (user?.role === 'ADMIN') {
        setIsAdmin(true);
        await fetchAllData();
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error(error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

const [permissions, setPermissions] = useState([]);
  const menusAcessiveis = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/agendamentos', label: 'Agendamentos' },
    { path: '/pre-admissao', label: 'Pipeline de Admissão' },
    { path: '/promocoes', label: 'Promoções' },
    { path: '/concluidos', label: 'Concluídos' },
    { path: '/configuracoes', label: 'Configurações' }
  ];

  async function fetchAllData() {
    const [unitsRes, rolesRes, usersRes, permsRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('job_roles').select('*').order('name'),
      supabase.from('users').select(`*, units(name)`).order('name'),
      supabase.from('role_permissions').select('*')
    ]);
    if (unitsRes.data) setUnits(unitsRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (usersRes.data) setUsersList(usersRes.data);
    if (permsRes.data) setPermissions(permsRes.data);
  }

  // Função para marcar/desmarcar o acesso
  async function togglePermission(role, menu_path, hasPermission) {
    if (hasPermission) {
      // Se tinha, remove a permissão
      await supabase.from('role_permissions').delete().match({ role, menu_path });
    } else {
      // Se não tinha, adiciona a permissão
      await supabase.from('role_permissions').insert([{ role, menu_path }]);
    }
    fetchAllData(); // Atualiza a tela
  }

  // --- CONTROLE DE DADOS BASE: UNIDADES (DROPDOWN) ---
  async function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnit) return;
    const { error } = await supabase.from('units').insert([{ name: newUnit.toUpperCase() }]);
    if (error) return alert('Erro: ' + error.message);
    setNewUnit('');
    await fetchAllData();
  }

  async function handleUpdateUnit() {
    if (!editingUnit.name) return;
    const { error } = await supabase.from('units').update({ name: editingUnit.name.toUpperCase() }).eq('id', editingUnit.id);
    if (error) return alert('Erro: ' + error.message);
    setEditingUnit(null);
    await fetchAllData();
  }

  async function handleDeleteUnit(id) {
    if (!confirm('Deseja excluir permanentemente esta unidade?')) return;
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) alert('Bloqueado: Existem candidatos vinculados a esta unidade.');
    else { setSelectedUnitId(''); await fetchAllData(); }
  }

  // --- CONTROLE DE DADOS BASE: FUNÇÕES (DROPDOWN) ---
  async function handleAddRole(e) {
    e.preventDefault();
    if (!newRole) return;
    const { error } = await supabase.from('job_roles').insert([{ name: newRole.toUpperCase() }]);
    if (error) return alert('Erro: ' + error.message);
    setNewRole('');
    await fetchAllData();
  }

  async function handleUpdateRole() {
    if (!editingRole.name) return;
    const { error } = await supabase.from('job_roles').update({ name: editingRole.name.toUpperCase() }).eq('id', editingRole.id);
    if (error) return alert('Erro: ' + error.message);
    setEditingRole(null);
    await fetchAllData();
  }

  async function handleDeleteRole(id) {
    if (!confirm('Deseja excluir permanentemente esta função?')) return;
    const { error } = await supabase.from('job_roles').delete().eq('id', id);
    if (error) alert('Bloqueado: Existem candidatos vinculados a esta função.');
    else { setSelectedRoleId(''); await fetchAllData(); }
  }

  // --- GESTÃO E CRIAÇÃO DE USUÁRIOS (CONTROLE DE ACESSO) ---
  async function handleCreateUser(e) {
    e.preventDefault();
    // Criação manual/Pré-cadastro: Vincula pelo e-mail institucional quando o funcionário acessar via Google
    const { error } = await supabase.from('users').insert([
      { 
        id: supabase.auth.uid ? undefined : crypto.randomUUID(), // ID temporário caso não use o Auth da API corporativa
        email: newUser.email.toLowerCase(), 
        name: newUser.name, 
        role: newUser.role, 
        unit_id: newUser.unit_id || null 
      }
    ]);
    if (error) return alert('Erro ao cadastrar usuário: ' + error.message);
    setNewUser({ email: '', name: '', role: 'RECRUITER', unit_id: '' });
    await fetchAllData();
    alert('Usuário pré-cadastrado com sucesso! Ele herdará as permissões ao efetuar o primeiro login.');
  }

  async function handleUpdateUserRoleAndUnit(userId, updatedRole, updatedUnitId) {
    const { error } = await supabase.from('users').update({
      role: updatedRole,
      unit_id: updatedUnitId || null
    }).eq('id', userId);
    if (error) alert('Erro ao atualizar acessos: ' + error.message);
    else fetchAllData();
  }

  async function handleDeleteUser(id) {
    if (!confirm('Remover este usuário do sistema? Ele perderá todo o controle de acesso.')) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) alert('Erro ao remover: ' + error.message);
    else fetchAllData();
  }
{/* NOVO BLOCO: MATRIZ DE ACESSO (PERMISSÕES POR PERFIL) */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} color="var(--saritur-orange)" /> Matriz de Permissões (Acesso a Menus)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Marque quais telas cada perfil de usuário tem permissão para acessar no menu lateral.</p>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Perfil / Telas</th>
                {menusAcessiveis.map(menu => (
                  <th key={menu.path} style={{ padding: '0.75rem', fontWeight: '600' }}>{menu.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availableRoles.map(role => (
                <tr key={role} style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600', textAlign: 'left' }}>{role}</td>
                  {menusAcessiveis.map(menu => {
                    const hasPerm = permissions.some(p => p.role === role && p.menu_path === menu.path);
                    return (
                      <td key={`${role}-${menu.path}`} style={{ padding: '0.75rem' }}>
                        <input 
                          type="checkbox" 
                          checked={hasPerm}
                          onChange={() => togglePermission(role, menu.path, hasPerm)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--saritur-orange)' }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  // --- CONFIGURAÇÃO DE INDICADORES DO DASHBOARD ---
  function handleSaveTargets(e) {
    e.preventDefault();
    localStorage.setItem('portal_rh_targets', JSON.stringify(dashTargets));
    alert('Metas e Indicadores do Dashboard atualizados com sucesso corporativo!');
  }

  if (loading) return <p style={{ padding: '2rem' }}>Validando credenciais de Administrador...</p>;

  if (isAdmin === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <ShieldAlert size={64} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Restrito</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Esta seção contém chaves de segurança e governança de dados acessíveis apenas ao perfil ADMIN.</p>
      </div>
    );
  }

  const currentUnitObj = units.find(u => u.id === selectedUnitId);
  const currentRoleObj = roles.find(r => r.id === selectedRoleId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Painel de Governança Integrada</h1>
        <p style={{ color: 'var(--text-muted)' }}>Controle de acessos, tabelas institucionais e chaves do sistema.</p>
      </div>

      {/* BLOCO 1: DADOS BASE DO SISTEMA (FORMATO LISTA SUSPENSA) */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings2 size={20} color="var(--saritur-orange)" /> Tabelas de Dados Estruturais (Dropdowns)
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* SEÇÃO UNIDADES */}
          <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Selecionar Unidade para Gestão</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedUnitId} onChange={e => { setSelectedUnitId(e.target.value); setEditingUnit(null); }}>
              <option value="">-- {units.length} Unidades Cadastradas --</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            {selectedUnitId && currentUnitObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {editingUnit ? (
                  <input style={{ flex: 1, marginRight: '0.5rem' }} value={editingUnit.name} onChange={e => setEditingUnit({...editingUnit, name: e.target.value})} />
                ) : (
                  <strong style={{ fontSize: '0.9rem' }}>{currentUnitObj.name}</strong>
                )}
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {editingUnit ? (
                    <>
                      <button onClick={handleUpdateUnit} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem' }}><Check size={14} /></button>
                      <button onClick={() => setEditingUnit(null)} className="btn-secondary" style={{ padding: '0.3rem' }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditingUnit(currentUnitObj)} className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteUnit(selectedUnitId)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Adicionar nova unidade..." style={{ flex: 1 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button>
            </form>
          </div>

          {/* SEÇÃO FUNÇÕES / CARGOS */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Selecionar Função para Gestão</label>
            <select style={{ width: '100%', marginBottom: '1rem' }} value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setEditingRole(null); }}>
              <option value="">-- {roles.length} Funções Cadastradas --</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            {selectedRoleId && currentRoleObj && (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                {editingRole ? (
                  <input style={{ flex: 1, marginRight: '0.5rem' }} value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} />
                ) : (
                  <strong style={{ fontSize: '0.9rem' }}>{currentRoleObj.name}</strong>
                )}
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {editingRole ? (
                    <>
                      <button onClick={handleUpdateRole} className="btn-secondary" style={{ color: 'var(--success-color)', padding: '0.3rem' }}><Check size={14} /></button>
                      <button onClick={() => setEditingRole(null)} className="btn-secondary" style={{ padding: '0.3rem' }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditingRole(currentRoleObj)} className="btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteRole(selectedRoleId)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Adicionar nova função..." style={{ flex: 1 }} value={newRole} onChange={e => setNewRole(e.target.value)} />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem' }}><Plus size={16} /></button>
            </form>
          </div>
        </div>
      </div>

      {/* BLOCO 2: GESTÃO DE USUÁRIOS, NÍVEL DE PERMISSÃO E CONTROLE DE ACESSO */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="var(--saritur-orange)" /> Controle de Acesso e Perfis de Usuários
        </h2>

        {/* Formulário de cadastro prévio */}
        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '2rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div><label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Nome do Colaborador</label><input required type="text" placeholder="Nome completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} /></div>
          <div><label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>E-mail Google Corporativo</label><input required type="email" placeholder="usuario@empresa.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Perfil de Acesso</label>
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
              {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Unidade Alocada</label>
            <select value={newUser.unit_id} onChange={e => setNewUser({...newUser, unit_id: e.target.value})}>
              <option value="">Todas</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem' }}>Pré-Cadastrar</button>
        </form>

        {/* Tabela de listagem e controle em tempo real */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem' }}>Colaborador</th>
                <th style={{ padding: '0.75rem' }}>E-mail</th>
                <th style={{ padding: '0.75rem' }}>Perfil de Acesso (Nível)</th>
                <th style={{ padding: '0.75rem' }}>Restrição de Unidade</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600' }}>{user.name || 'Aguardando Login'}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <select 
                      style={{ padding: '0.25rem', fontSize: '0.85rem' }} 
                      value={user.role} 
                      onChange={e => handleUpdateUserRoleAndUnit(user.id, e.target.value, user.unit_id)}
                    >
                      {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <select 
                      style={{ padding: '0.25rem', fontSize: '0.85rem', width: '140px' }} 
                      value={user.unit_id || ''} 
                      onChange={e => handleUpdateUserRoleAndUnit(user.id, user.role, e.target.value)}
                    >
                      <option value="">Acesso Geral (Todas)</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <button onClick={() => handleDeleteUser(user.id)} className="btn-secondary" style={{ color: 'var(--danger-color)', padding: '0.3rem' }} title="Excluir Usuário"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 3: CRIAÇÃO E CONFIGURAÇÃO DE INDICADORES DO DASHBOARD */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={20} color="var(--saritur-orange)" /> Parâmetros e Indicadores Estratégicos (Dashboard)
        </h2>
        
        <form onSubmit={handleSaveTargets} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta de SLA de Admissão (Leadtime em Dias)</label>
            <input type="number" placeholder="Ex: 15" value={dashTargets.targetLeadtime} onChange={e => setDashTargets({...dashTargets, targetLeadtime: e.target.value})} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Tempo máximo aceitável entre o agendamento e a contratação final.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Meta Cláusula de Eficiência (Taxa de Aprovação Mínima %)</label>
            <input type="number" placeholder="Ex: 60" value={dashTargets.targetApprovalRate} onChange={e => setDashTargets({...dashTargets, targetApprovalRate: e.target.value})} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Percentual esperado de candidatos que atingem a contratação.</p>
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
            <Save size={16} /> Salvar Parâmetros
          </button>
        </form>
      </div>

      {/* BLOCO 4: SEGURANÇA ADICIONAL RECOMENDADA - TOKENS DE SISTEMA */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'var(--surface-color)', borderLeft: '4px solid var(--saritur-orange)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={20} color="var(--saritur-orange)" /> Chaves de Integração (Recomendado para Produção)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Configurações de chaves de API externas utilizadas pelos módulos automáticos.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong>Módulo WhatsApp API:</strong> <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>Ativo (Link Direto Habilitado)</span>
          </div>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong>Módulo Google Agenda:</strong> <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>Ativo (OAuth Integrado)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
