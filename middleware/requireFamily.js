// ============================================================================
//  requireFamily / requireParent — enforcement de ownership y rol familiar.
// ============================================================================

// Exige que el usuario pertenezca a UNA familia activa.
function requireFamily(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "no_autenticado" });
  if (!req.user.familyId) return res.status(403).json({ error: "sin_familia" });
  next();
}

// Si la ruta tiene :familyId, valida que coincide con la del usuario.
function requireOwnFamily(paramName = "familyId") {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: "no_autenticado" });
    const target = req.params[paramName];
    if (!target) return res.status(400).json({ error: "familia_no_indicada" });
    if (target !== req.user.familyId) return res.status(403).json({ error: "familia_ajena" });
    next();
  };
}

// Exige rol 'parent' en la familia actual.
function requireParent(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "no_autenticado" });
  if (req.user.roleInFamily !== "parent") return res.status(403).json({ error: "solo_padres" });
  next();
}

module.exports = { requireFamily, requireOwnFamily, requireParent };
