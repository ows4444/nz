// Consolidated factory exports
//
// The original 9 factory functions have been consolidated into 4 logical groups
// for better maintainability and reduced complexity:
//
// 1. Core Services - orchestration services + pipelines (8 providers)
// 2. Field Processing - processors + validators + registries (29 providers)
// 3. Infrastructure - caching + monitoring + services (4 providers)
// 4. Validation - strategies + schema validation + error handling (7 providers)

export { createCoreServicesProviders, createFieldProcessingProviders, createInfrastructureProviders, createValidationProviders } from './consolidated';
