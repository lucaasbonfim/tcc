import {
  authenticateAdmin,
  clearSessionCookie,
  getCurrentSession,
  setSessionCookie,
} from "../services/auth.service.js";

export async function adminLogin(request, response, next) {
  try {
    const session = await authenticateAdmin(request.body);

    setSessionCookie(response, session);

    return response.status(200).json({
      data: {
        role: "admin",
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAuthenticatedSession(request, response, next) {
  try {
    const session = await getCurrentSession(request);

    return response.status(200).json({ data: session });
  } catch (error) {
    return next(error);
  }
}

export async function logout(request, response, next) {
  try {
    clearSessionCookie(response);

    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
}
