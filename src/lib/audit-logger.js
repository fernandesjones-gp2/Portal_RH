import db from '@/lib/db';

export async function logAudit(action, moduleName, description, user, oldData = null, newData = null) {
  try {
    const oldJson = oldData ? JSON.stringify(oldData) : null;
    const newJson = newData ? JSON.stringify(newData) : null;
    const userId = user?.id || null;
    const userName = user?.name || user?.email || 'Sistema';

    await db.query(
      `INSERT INTO audit_logs (action, module, description, old_data, new_data, user_id, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [action, moduleName, description, oldJson, newJson, userId, userName]
    );
  } catch (error) {
    console.error('Falha ao gravar log de auditoria:', error);
  }
}