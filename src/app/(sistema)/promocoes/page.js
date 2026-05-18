'use client';
import { Plus, Check, X, FileText, AlertCircle } from 'lucide-react';

export default function PromocoesPage() {
  const mockPromotions = [
    { id: 1, name: 'João Batista', type: 'Horizontal', from: 'Motorista', to: 'Motorista Nível 2', status: 'Aguardando GP2', unit: 'Garagem Contagem' },
    { id: 2, name: 'Maria Souza', type: 'Vertical', from: 'Aux. Administrativo', to: 'Analista Jr', status: 'Aguardando Superintendência', unit: 'Adm Central' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Fluxo de Promoções</h1>
          <p style={{ color: 'var(--text-muted)' }}>Acompanhe e inicie solicitações de promoção Vertical e Horizontal.</p>
        </div>
        <button className="btn-primary">
          <Plus size={20} />
          Nova Solicitação
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <AlertCircle size={24} color="var(--saritur-orange)" style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Promoções Verticais</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Lembre-se: Para iniciar uma promoção Vertical, o colaborador deve ter passado por entrevista psicológica nos últimos 6 meses e ter sido aprovado na triagem inicial.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {mockPromotions.map((p) => (
          <div key={p.id} style={{ 
            backgroundColor: 'var(--surface-color)', 
            padding: '1.5rem', 
            borderRadius: 'var(--radius-lg)', 
            boxShadow: 'var(--shadow-sm)', 
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ backgroundColor: p.type === 'Vertical' ? 'var(--saritur-orange)' : 'var(--saritur-brown)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {p.type}
                </span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{p.name}</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{p.from} ➔ {p.to} • {p.unit}</p>
              <p style={{ color: 'var(--saritur-orange)', fontSize: '0.875rem', fontWeight: '600', marginTop: '0.5rem' }}>Status: {p.status}</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" title="Ver Documento/PDF"><FileText size={16} /></button>
              <button className="btn-secondary" style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }} title="Aprovar (GP2)"><Check size={16} /></button>
              <button className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} title="Reprovar"><X size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
