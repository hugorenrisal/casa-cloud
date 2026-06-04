// ============================================================================
//  Servicio de autenticación.
//  - bcrypt para hash/compare de contraseñas.
//  - JWT (HS256) firmado con JWT_SECRET. Payload mínimo.
//  - Tokens opacos (verify/reset/invite) con SHA-256 del valor crudo en DB.
// ============================================================================
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const BCRYPT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signJwt(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no configurado o demasiado corto (>=32 caracteres).");
  }
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    algorithm: "HS256",
  });
}

function verifyJwt(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
}

// Genera un token opaco aleatorio (para enlace) y su hash para almacenar en DB.
function generateOpaqueToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function hashOpaqueToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Validaciones simples (sin librerías externas para mantener deps mínimas)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(s) {
  return typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s.trim());
}
function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}
function isValidPassword(s) {
  return typeof s === "string" && s.length >= 8 && s.length <= 200;
}

// Configuración de la cookie de sesión.
function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
  };
}
const AUTH_COOKIE_NAME = "casa_session";

module.exports = {
  hashPassword,
  comparePassword,
  signJwt,
  verifyJwt,
  generateOpaqueToken,
  hashOpaqueToken,
  isValidEmail,
  normalizeEmail,
  isValidPassword,
  authCookieOptions,
  AUTH_COOKIE_NAME,
};
