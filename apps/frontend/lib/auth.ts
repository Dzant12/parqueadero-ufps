/**
 * @file auth.ts
 * @description Módulo de utilería para la gestión de autenticación, sesiones JWT y cookies.
 * Este archivo implementa el motor de seguridad criptográfica del frontend mediante la firma
 * simétrica (algoritmo HS256) de tokens JSON Web Tokens (JWT) utilizando la biblioteca nativa `jose`.
 * 
 * ### Estrategia de Seguridad:
 * 1. **Cifrado en Servidor**: El token JWT se firma y verifica exclusivamente en la capa del servidor (Edge-runtime y Node).
 * 2. **Persistencia HTTP-Only**: El token se almacena en cookies marcadas como `httpOnly: true`, evitando que
 *    scripts de cliente (XSS) accedan al payload de sesión.
 * 3. **Expiración Deslizable (Sliding Expiration)**: El middleware del frontend intercepta las peticiones
 *    y refresca la expiración del cookie si la sesión sigue activa, previniendo cierres abruptos por inactividad.
 * 
 * @module frontend/lib/auth
 * @requires jose
 * @requires next/headers
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Clave secreta simétrica. Si no se provee en el entorno, recurre a una clave de resguardo
const secretKey = process.env.JWT_SECRET || "fallback-secret-key-123";
const key = new TextEncoder().encode(secretKey);

/**
 * Nombre único asignado a la cookie de sesión cifrada.
 * @type {string}
 */
export const SESSION_COOKIE_NAME = "session";

/**
 * Firma y encripta un objeto de payload en un token JWT válido con vigencia de 24 horas.
 * 
 * @async
 * @function encrypt
 * @param {any} payload - Información de sesión del usuario a encriptar (Ej: { username, role }).
 * @returns {Promise<string>} Token JWT firmado y serializado.
 */
export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" }) // Configura algoritmo de firma simétrica estándar
    .setIssuedAt()
    .setExpirationTime("24h") // Tiempo límite de sesión rígido
    .sign(key);
}

/**
 * Desencripta y verifica la firma criptográfica de un token JWT recibido.
 * 
 * @async
 * @function decrypt
 * @param {string} input - Token JWT serializado obtenido de la cookie.
 * @returns {Promise<any>} Objeto original de payload recuperado tras la validación.
 * @throws {Error} Si el token es inválido, expiró o la firma fue alterada.
 */
export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"], // Restringe la validación estrictamente al algoritmo autorizado
  });
  return payload;
}

/**
 * Recupera y descifra la sesión de usuario activa desde el almacén de cookies de Next.js.
 * Utilizado por Server Components y Server Actions para validar credenciales y roles.
 * 
 * @async
 * @function getSession
 * @returns {Promise<Object|null>} Objeto de sesión del usuario descifrado o null si no existe sesión válida.
 */
export async function getSession() {
  const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;
  
  try {
    return await decrypt(session);
  } catch (error) {
    // Si descifrado falla (ej: expirado o llave alterada), retorna null
    return null;
  }
}

/**
 * Actualiza la expiración de la sesión actual de forma dinámica (sliding expiration).
 * Lee el cookie, incrementa su fecha de expiración en 24 horas y retorna una respuesta con la cookie renovada.
 * Utilizado de manera preventiva en el Middleware de Next.js ante la navegación del cliente.
 * 
 * @async
 * @function updateSession
 * @param {NextRequest} request - Petición HTTP entrante al middleware.
 * @returns {Promise<NextResponse|undefined>} Respuesta modificada con las nuevas cookies o undefined si no hay sesión.
 */
export async function updateSession(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return;

  // Descifra el payload e incrementa el horizonte de expiración
  const parsed = await decrypt(session);
  parsed.expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas a partir de ahora
  
  const res = NextResponse.next();
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: await encrypt(parsed),
    httpOnly: true, // Protección crítica contra ataques Cross-Site Scripting (XSS)
    expires: parsed.expires,
  });
  
  return res;
}
