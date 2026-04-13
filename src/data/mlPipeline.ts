// ML Pipeline & Model Training Utilities
import type { MLModel, NetworkFlow, FeatureVector } from '@/types';
import { extractFeatures, normalizeFeatures } from '@/algorithms/utils';


// Advanced ML Pipeline with versioning, persistence, evaluation, and modular steps
export class MLPipeline {
  private models: MLModel[] = [];

  // Train a clustering or anomaly model
  public async trainModel(flows: NetworkFlow[], algorithm: string, params: any, options?: { version?: string, split?: number }): Promise<MLModel> {
    // Split data for validation
    const split = options?.split ?? 0.8;
    const splitIdx = Math.floor(flows.length * split);
    const trainFlows = flows.slice(0, splitIdx);
    const testFlows = flows.slice(splitIdx);
    const features = trainFlows.map(extractFeatures);
    const normalized = normalizeFeatures(features);
    const now = Date.now();
    // Simulate training and evaluation
    // In a real system, call the actual algorithm implementation here
    const accuracy = Math.random() * 0.2 + 0.8;
    const precision = Math.random() * 0.2 + 0.8;
    const recall = Math.random() * 0.2 + 0.8;
    const f1Score = 2 * (precision * recall) / (precision + recall);
    const model: MLModel = {
      id: `${algorithm}-${now}`,
      name: `${algorithm} Model`,
      type: algorithm,
      version: options?.version || '1.0',
      trainedAt: now,
      accuracy,
      precision,
      recall,
      f1Score,
      features: [],
      parameters: params,
      weights: []
    };
    this.models.push(model);
    this.saveModels();
    return model;
  }

  // Evaluate a model on test data
  public evaluateModel(model: MLModel, flows: NetworkFlow[]): { accuracy: number, precision: number, recall: number, f1Score: number } {
    // Simulate evaluation
    return {
      accuracy: model.accuracy,
      precision: model.precision,
      recall: model.recall,
      f1Score: model.f1Score
    };
  }

  // Save models to localStorage (or backend)
  public saveModels() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ml_models', JSON.stringify(this.models));
    }
  }

  // Load models from localStorage (or backend)
  public loadModels() {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('ml_models');
      if (raw) {
        this.models = JSON.parse(raw);
      }
    }
  }

  // List all trained models
  public listModels(): MLModel[] {
    return this.models;
  }

  // Remove a model by id
  public removeModel(id: string) {
    this.models = this.models.filter(m => m.id !== id);
    this.saveModels();
  }

  // Clear all models
  public clearModels() {
    this.models = [];
    this.saveModels();
  }
}
