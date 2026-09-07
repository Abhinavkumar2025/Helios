import { AIModelStatus } from "../types";
import { apiRequest } from "./api";

export async function fetchAIModels(): Promise<AIModelStatus[]> {
  return apiRequest<AIModelStatus[]>("/models");
}

export async function fetchAIModelById(modelId: string): Promise<AIModelStatus> {
  return apiRequest<AIModelStatus>(`/models/${modelId}`);
}
