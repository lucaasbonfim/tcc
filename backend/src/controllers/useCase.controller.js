import {
  createUseCase,
  deleteUseCaseById,
  findAllUseCases,
  findUseCaseById,
  updateUseCaseById,
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

export async function deleteUseCaseController(request, response, next) {
  try {
    const deletedUseCase = await deleteUseCaseById(request.params.id);

    if (!deletedUseCase) {
      return response.status(404).json({
        error: "Caso de uso não encontrado.",
      });
    }

    return response.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      return response.status(409).json({
        error: "Caso de uso não pode ser excluído pois possui vínculos.",
      });
    }

    return next(error);
  }
}

export async function updateUseCaseController(request, response, next) {
  try {
    const { code, title, content } = request.body;

    if (!code || !title || content === undefined) {
      return response.status(400).json({
        error: "Os campos code, title e content são obrigatórios.",
      });
    }

    const useCase = await updateUseCaseById(request.params.id, {
      code,
      title,
      content,
    });

    if (!useCase) {
      return response.status(404).json({
        error: "Caso de uso não encontrado.",
      });
    }

    return response.status(200).json({ data: useCase });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        error: "Já existe um caso de uso com este código.",
      });
    }

    return next(error);
  }
}

export async function createUseCaseController(request, response, next) {
  try {
    const { code, title, content } = request.body;

    if (!code || !title || content === undefined) {
      return response.status(400).json({
        error: "Os campos code, title e content são obrigatórios.",
      });
    }

    const useCase = await createUseCase({ code, title, content });

    return response.status(201).json({ data: useCase });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        error: "Já existe um caso de uso com este código.",
      });
    }

    return next(error);
  }
}
