import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "tcc_session";

function createAuthError(message = "Sessao nao autenticada.") {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function getAuthSecret() {
  if (!process.env.AUTH_SECRET) {
    const error = new Error("AUTH_SECRET nao configurado.");
    error.statusCode = 500;
    throw error;
  }

  return process.env.AUTH_SECRET;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function setSessionCookie(response, payload) {
  const token = jwt.sign(payload, getAuthSecret(), {
    expiresIn: "8h",
  });

  response.cookie(SESSION_COOKIE_NAME, token, getCookieOptions());
}

export function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE_NAME, getCookieOptions());
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, getAuthSecret());
  } catch {
    throw createAuthError();
  }
}

export function getSessionFromRequest(request) {
  const token = request.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    throw createAuthError();
  }

  return verifySessionToken(token);
}

export async function authenticateAdmin(input = {}) {
  const {email,password} = input;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!adminEmail || !adminPasswordHash) {
    const error = new Error("Credenciais administrativas nao configuradas.");
    error.statusCode = 500;
    throw error;
  }

  if (!normalizedEmail || typeof password !== 'string' || !password || password.length > 1024 || normalizedEmail !== adminEmail) {
    throw createAuthError("E-mail ou senha invalidos.");
  }

  const isValidPassword = await bcrypt.compare(password, adminPasswordHash);

  if (!isValidPassword) {
    throw createAuthError("E-mail ou senha invalidos.");
  }

  return {
    role: "admin",
  };
}

export async function getCurrentSession(request) {
  const session = getSessionFromRequest(request);

  if (session.role === "admin") {
    return {
      role: "admin",
    };
  }

  throw createAuthError();
}
