// Consolidated factory exports
//
// This replaces the 9 separate factory functions with 4 logical groups:
// 1. Core Services - orchestration services + pipelines
// 2. Field Processing - processors + validators + registries
// 3. Infrastructure - caching + monitoring + services
// 4. Validation - strategies + schema validation + error handling

export { createCoreServicesProviders } from './core-services.factory';
export { createFieldProcessingProviders } from './field-processing.factory';
export { createInfrastructureProviders } from './infrastructure.factory';
export { createValidationProviders } from './validation.factory';
