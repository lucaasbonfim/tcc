import {
  findAllUseCases,
  findUseCaseById,
} from "../services/useCase.service.js";

export async function listUseCases(request, response, next) {
  try {
    const useCases = await findAllUseCases();

    response.status(200).json({ data: useCases });
  } catch (error) {
    next(error);
  }
}

export async function getUseCaseById(request, response, next) {
  try {
    const useCase = await findUseCaseById(request.params.id);

    if (!useCase) {
      return response.status(404).json({
        error: "Caso de uso não encontrado.",
      });
    }

    return response.status(200).json({ data: useCase });
  } catch (error) {
    return next(error);
  }
}
