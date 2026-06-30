'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useSession, signOut } from 'next-auth/react';
import { LayoutDashboard, Users, UserCheck, CheckCircle, Settings, LogOut, ShieldAlert, Palmtree, Menu } from 'lucide-react';

export default function SistemaLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const [allowedPaths, setAllowedPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Carregando...');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState(''); 
  const [userVacation, setUserVacation] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true); // Controle de visibilidade da barra lateral

  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Agendamentos', icon: <Users size={20} />, path: '/agendamentos' },
    { name: 'Pipeline de Admissão', icon: <UserCheck size={20} />, path: '/pre-admissao' },
    { name: 'Promoções', icon: <UserCheck size={20} />, path: '/promocoes' },
    { name: 'Concluidos', icon: <CheckCircle size={20} />, path: '/concluidos' },
    { name: 'Configurações', icon: <Settings size={20} />, path: '/configuracoes' },
  ];

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    async function loadPermissions() {
      try {
        const me = await api.me();
        if (!me) {
          router.push('/');
          return;
        }

        const user = { 
          name: me.name, 
          role: me.role, 
          status: me.status,
          vacation_start: me.vacation_start,
          vacation_end: me.vacation_end
        };

        if (user) {
          setUserName(user.name || me.email);
          setUserRole(user.role);
          setUserStatus(user.status);
          setUserVacation({ start: user.vacation_start, end: user.vacation_end });

          try {
            const customRoles = await api.customRoles.list();
            const myRoleObj = customRoles.find(r => r.name === user.role);
            
            if (myRoleObj && myRoleObj.permissions) {
              const allowed = Object.keys(myRoleObj.permissions).filter(
                path => myRoleObj.permissions[path].view === true
              );
              setAllowedPaths(allowed);
            } else {
              setAllowedPaths([]); 
            }
          } catch (err) {
            console.error('Erro ao buscar a Matriz de Perfis:', err);
            setAllowedPaths([]);
          }

        } else {
          setUserName(me.email);
          setUserRole('RECRUITER');
          setUserStatus('Pendente');
        }
      } catch (error) {
        console.error('Erro ao carregar permissões:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [router]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'sans-serif' }}>
        <p style={{ fontWeight: '500' }}>Verificando chaves de segurança e matriz de acessos...</p>
      </div>
    );
  }

  let isVacationActive = false;
  if (userVacation?.start && userVacation?.end && userRole !== 'ADMIN') {
    try {
      const tzOffset = (new Date()).getTimezoneOffset() * 60000;
      const todayStr = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
      const startStr = String(userVacation.start).split('T')[0];
      const endStr = String(userVacation.end).split('T')[0];
      
      if (todayStr >= startStr && todayStr <= endStr) {
        isVacationActive = true;
      }
    } catch (e) {
      console.error("Erro ao validar datas de férias", e);
    }
  }

  if (isVacationActive) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'sans-serif', padding: '2rem' }}>
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Palmtree size={64} color="#057a55" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>
            Boas Férias, {userName.split(' ')[0]}! 🌴
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
            Identificamos que você está em seu período de descanso programado.<br/><br/>
            <strong>De {String(userVacation.start).split('T')[0].split('-').reverse().join('/')} até {String(userVacation.end).split('T')[0].split('-').reverse().join('/')}</strong><br/><br/>
            Aproveite bastante! Seu acesso ao sistema ficará bloqueado automaticamente até o seu retorno para garantir a sua tranquilidade e a segurança do portal.
          </p>
          <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={18} /> Sair do Sistema
          </button>
        </div>
      </div>
    );
  }

  if (userStatus === 'Pendente') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'sans-serif', padding: '2rem' }}>
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <ShieldAlert size={64} color="var(--saritur-orange)" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Aguardando Aprovação</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
            Sua conta foi conectada com sucesso! Porém, por medidas de segurança, um <strong>Administrador</strong> precisa aprovar seu acesso antes que você possa visualizar os dados do sistema.
          </p>
          <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={18} /> Sair e tentar novamente depois
          </button>
        </div>
      </div>
    );
  }

  const filteredMenuItems = menuItems.filter(item => allowedPaths.includes(item.path));
  const isAllowed = allowedPaths.includes(pathname);
  
  if (!isAllowed && allowedPaths.length > 0 && pathname !== '/') {
    router.push(allowedPaths[0]);
    return null;
  }

  if (allowedPaths.length === 0 && pathname !== '/') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'sans-serif', padding: '2rem' }}>
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <ShieldAlert size={64} color="var(--danger-color)" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
            O seu perfil de usuário <strong>({userRole})</strong> não possui permissão para visualizar nenhum módulo deste sistema. Solicite a um administrador que configure seus acessos na Matriz.
          </p>
          <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={18} /> Sair do Sistema
          </button>
        </div>
      </div>
    );
  }

  const initials = userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'RH';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
      {/* Sidebar - Controlada pelo estado sidebarVisible */}
      {sidebarVisible && (
        <aside style={{ width: '250px', backgroundColor: 'var(--surface-color)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          
          {/* CABEÇALHO ALTERADO: LOGO EM CIMA E TÍTULO DEBAIXO */}
          <div style={{ padding: '2rem 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }} 
              onError={(e) => e.target.style.display = 'none'}
            />
            <h2 style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              Portal RH
            </h2>
          </div>

          <nav style={{ padding: '1rem', flex: 1 }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: 0, padding: 0 }}>
              {filteredMenuItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link href={item.path} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', backgroundColor: isActive ? 'var(--bg-color)' : 'transparent', fontWeight: isActive ? '500' : '400', fontSize: '0.9rem', transition: 'all 0.1s ease', textDecoration: 'none' }}>
                      {item.icon}
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--danger-color)', padding: '0.75rem 1rem', fontWeight: '500', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', borderRadius: 'var(--radius-md)' }}>
              <LogOut size={20} />
              Sair do Sistema
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header style={{ backgroundColor: 'var(--surface-color)', padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* SEÇÃO DO TÍTULO COM O BOTÃO DE ALTERNÂNCIA (TOGGLE) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setSidebarVisible(!sidebarVisible)} 
              className="btn-secondary" 
              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}
              title={sidebarVisible ? "Ocultar Menu Lateral" : "Mostrar Menu Lateral"}
            >
              <Menu size={20} color="var(--text-main)" />
            </button>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: '600', margin: 0 }}>
              {menuItems.find(i => i.path === pathname)?.name || 'Sistema'}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--saritur-orange)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-main)', margin: 0 }}>{userName}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{userRole}</p>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
