import { findAllUseCases } from "../services/useCase.service.js";

export async function listUseCases(request, response, next) {
  try {
    const useCases = await findAllUseCases();

    response.status(200).json({ data: useCases });
  } catch (error) {
    next(error);
  }
}
