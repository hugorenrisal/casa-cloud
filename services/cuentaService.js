// ============================================================================
//  Borrado de cuenta.
//
//  Google Play lo exige a toda app que permita registrarse, pero además es de
//  sentido común: si un hijo se va de casa, tiene que poder llevarse sus datos
//  con él (o borrarlos).
//
//  Lo que NO es trivial aquí:
//
//  1. `families.created_by_user_id` y `family_invitations.created_by_user_id`
//     NO tienen ON DELETE CASCADE. Borrar sin más al creador de la familia
//     reventaría con un error de clave foránea.
//
//  2. Si el que se va es el ÚNICO padre, la familia se queda sin nadie que
//     pueda administrarla: hijos sin poder crear tareas, validar ni invitar.
//     Dejarla así sería peor que borrarla. Por eso, en ese caso, se borra la
//     familia entera — avisando antes, claro.
// ============================================================================
const { query, tx } = require("../db");

// Qué va a pasar si esta persona borra su cuenta. Sirve para avisar ANTES,
// en la pantalla de confirmación, en vez de sorprender después.
async function consecuenciasDeBorrar(userId) {
  const r = await query(
    `SELECT fm.family_id, fm.role_in_family, f.name
     FROM family_members fm JOIN families f ON f.id = fm.family_id
     WHERE fm.user_id = $1 AND fm.status = 'active'`,
    [userId]
  );
  const pertenencia = r.rows[0];
  if (!pertenencia) {
    return { enFamilia: false, arrastraFamilia: false, familyName: null, otrosMiembros: 0 };
  }

  const padres = await query(
    `SELECT COUNT(*)::int AS n FROM family_members
     WHERE family_id = $1 AND role_in_family = 'parent' AND status = 'active'`,
    [pertenencia.family_id]
  );
  const miembros = await query(
    `SELECT COUNT(*)::int AS n FROM family_members
     WHERE family_id = $1 AND status = 'active'`,
    [pertenencia.family_id]
  );

  const esUltimoPadre = pertenencia.role_in_family === "parent" && padres.rows[0].n <= 1;
  return {
    enFamilia: true,
    familyId: pertenencia.family_id,
    familyName: pertenencia.name,
    rol: pertenencia.role_in_family,
    otrosMiembros: miembros.rows[0].n - 1,
    // Si es el único padre, la familia entera se va con él.
    arrastraFamilia: esUltimoPadre,
  };
}

async function borrarCuenta(userId) {
  return tx(async (c) => {
    const info = await consecuenciasDeBorrar(userId);

    if (info.enFamilia && info.arrastraFamilia) {
      // Se va el único padre: la familia no puede seguir sin administrador.
      // El ON DELETE CASCADE de families se lleva por delante miembros,
      // estado, invitaciones... todo lo de esa familia.
      await c.query("DELETE FROM families WHERE id = $1", [info.familyId]);
    } else if (info.enFamilia) {
      // Quedan otros padres: solo sale él, la familia sigue.
      await c.query("DELETE FROM family_members WHERE user_id = $1", [userId]);
      // Estas dos columnas no tienen cascade: hay que dejarlas sin apuntar a
      // un usuario que va a desaparecer.
      const otroPadre = await c.query(
        `SELECT user_id FROM family_members
         WHERE family_id = $1 AND role_in_family = 'parent' AND status = 'active'
         ORDER BY joined_at ASC LIMIT 1`,
        [info.familyId]
      );
      const releva = otroPadre.rows[0]?.user_id;
      if (releva) {
        await c.query(
          "UPDATE families SET created_by_user_id = $1 WHERE created_by_user_id = $2",
          [releva, userId]
        );
      }
      // Las invitaciones que dejó pendientes se retiran: quien invitaba ya no está.
      await c.query("DELETE FROM family_invitations WHERE created_by_user_id = $1", [userId]);
    }

    // Por si quedara alguna familia creada por él sin miembros activos
    // (caso raro: familia creada y abandonada antes de invitar a nadie).
    await c.query("DELETE FROM families WHERE created_by_user_id = $1", [userId]);
    await c.query("DELETE FROM family_invitations WHERE created_by_user_id = $1", [userId]);

    // El resto (perfil, tokens de verificación y de reseteo) cae por cascade.
    await c.query("DELETE FROM users WHERE id = $1", [userId]);

    return { ok: true, familiaBorrada: !!(info.enFamilia && info.arrastraFamilia) };
  });
}

module.exports = { consecuenciasDeBorrar, borrarCuenta };
