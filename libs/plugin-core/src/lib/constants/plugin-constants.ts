/**
 * Constants used throughout the plugin system
 */

export const PLUGIN_CONSTANTS = {
  // File names and directories
  MANIFEST_FILE: 'plugin.manifest.json',
  DIST_DIRECTORY: 'dist',

  PLUGIN_DIRECTORY: './plugins',

  // Default configuration values
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_RETRIES: 3,
  DEFAULT_MAX_CONCURRENT_LOADS: 5,

  // Plugin naming patterns
  PLUGIN_PREFIX_PATTERN: '@plugins/',
  MODULE_SUFFIX: 'Module',
  PLUGIN_SUFFIX: 'Plugin',

  // Component types
  COMPONENT_TYPES: {
    CONTROLLERS: 'controllers',
    PROVIDERS: 'providers',
    EXPORTS: 'exports',
  } as const,

  // Configuration field names
  CONFIG_FIELDS: {
    BOOLEAN: ['autoStart', 'enableMemoryMonitoring', 'parallelLoading', 'enableHotReload', 'cacheEnabled', 'skipRuntimeLoading'],
    NUMERIC: ['defaultTimeout', 'defaultRetries', 'maxConcurrentLoads'],
  } as const,

  // Default permissions
  DEFAULT_PERMISSIONS: {
    FILE_READ: 'file:read',
    NETWORK_HTTP: 'network:http',
  } as const,

  // Validation rules
  MIN_PLUGIN_NAME_LENGTH: 3,
  MAX_PLUGIN_NAME_LENGTH: 64,

  // Error messages
  ERRORS: {
    INVALID_MANIFEST: 'Invalid plugin manifest structure',
    DIST_NOT_FOUND: 'Plugin distribution directory not found',
    COMPONENT_NOT_FOUND: 'Plugin component not found in distribution',
    INVALID_CONFIG: 'Invalid plugin configuration',
    LOADING_FAILED: 'Failed to load plugin',
    VALIDATION_FAILED: 'Plugin validation failed',
    INVALID_PARAMETERS: 'Invalid parameters provided',
    NO_VALID_PLUGINS: 'No valid plugins found in the specified paths',
    INVALID_COMPONENT: 'Invalid component',
  },

  // Log messages - Configuration Validation
  LOG_MESSAGES: {
    CONFIG_VALIDATION: {
      INVALID_ASYNC_CONFIG: 'Invalid async configuration provided',
      SKIP_RUNTIME_LOADING: 'Skipping runtime plugin loading as configured',
      PLUGIN_CONFIG_MUST_BE_OBJECT: 'Plugin config must be an object',
      INVALID_SEARCH_PATH: 'Invalid search path',
      ASYNC_CONFIG_MUST_BE_OBJECT: 'Plugin async config must be an object',
      EXACTLY_ONE_CONFIG_METHOD: 'Plugin async config must have exactly one of: useFactory, useClass, or useExisting',
      USE_FACTORY_MUST_BE_FUNCTION: 'Plugin async config useFactory must be a function',
      INJECT_MUST_BE_ARRAY: 'Plugin async config inject must be an array',
      IMPORTS_MUST_BE_ARRAY: 'Plugin async config imports must be an array',
      FIELD_MUST_BE_BOOLEAN: 'must be a boolean',
      FIELD_MUST_BE_NON_NEGATIVE_INTEGER: 'must be a non-negative integer',
    },
    COMPONENT_LOADING: {
      INVALID_COMPONENT_NAME: 'Invalid component name for',
      COMPONENT_NOT_CONSTRUCTOR: 'Component {0} is not a constructor function',
    },
    DISCOVERY: {
      NO_PLUGIN_DIRS_FOUND: 'No plugin directories found in',
      SEARCH_PATH_NOT_EXIST: 'Search path does not exist',
      FAILED_TO_PROCESS_PLUGIN: 'Failed to process plugin',
      COULD_NOT_PRE_DISCOVER: 'Could not pre-discover plugin modules:',
      CANNOT_PRE_DISCOVER_ASYNC: 'Cannot pre-discover plugin modules for async factory functions',
    },
    LIFECYCLE: {
      CLEARED_ALL_LISTENERS: 'Cleared all lifecycle listeners',
      ERROR_IN_LISTENER: 'Error in lifecycle listener',
    },
    UTILITY: {
      FAILED_TO_CLONE_CONFIG: 'Failed to clone plugin config, returning original',
    },
    GENERAL: {
      PLUGIN_DISCOVERED: 'Plugin discovered',
      PLUGIN_LOADED: 'Plugin loaded successfully',
      PLUGIN_ENABLED: 'Plugin enabled',
      PLUGIN_DISABLED: 'Plugin disabled',
      PLUGIN_FAILED: 'Plugin failed to load',
      PLUGIN_FOUND: 'Found plugin',
      CORE_INITIALIZED: 'Plugin Core Service Initialized',
      CORE_DESTROYED: 'Destroying Plugin Core Service',
      MANAGER_INITIALIZED: 'Plugin Manager initialized successfully',
      MANAGER_SHUTDOWN: 'Plugin Manager shutdown complete',
    },
  },
} as const;

// Type definitions for type-safe constant access
export type PluginErrorMessage = (typeof PLUGIN_CONSTANTS.ERRORS)[keyof typeof PLUGIN_CONSTANTS.ERRORS];
export type PluginComponentTypeConstants = (typeof PLUGIN_CONSTANTS.COMPONENT_TYPES)[keyof typeof PLUGIN_CONSTANTS.COMPONENT_TYPES];
export type PluginConfigBooleanField = (typeof PLUGIN_CONSTANTS.CONFIG_FIELDS.BOOLEAN)[number];
export type PluginConfigNumericField = (typeof PLUGIN_CONSTANTS.CONFIG_FIELDS.NUMERIC)[number];
export type PluginDefaultPermission = (typeof PLUGIN_CONSTANTS.DEFAULT_PERMISSIONS)[keyof typeof PLUGIN_CONSTANTS.DEFAULT_PERMISSIONS];

// Nested log message types for better categorization
export type PluginConfigValidationMessage = (typeof PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION)[keyof typeof PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION];
export type PluginComponentLoadingMessage = (typeof PLUGIN_CONSTANTS.LOG_MESSAGES.COMPONENT_LOADING)[keyof typeof PLUGIN_CONSTANTS.LOG_MESSAGES.COMPONENT_LOADING];
export type PluginDiscoveryMessage = (typeof PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY)[keyof typeof PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY];
export type PluginLifecycleMessage = (typeof PLUGIN_CONSTANTS.LOG_MESSAGES.LIFECYCLE)[keyof typeof PLUGIN_CONSTANTS.LOG_MESSAGES.LIFECYCLE];
export type PluginUtilityMessage = (typeof PLUGIN_CONSTANTS.LOG_MESSAGES.UTILITY)[keyof typeof PLUGIN_CONSTANTS.LOG_MESSAGES.UTILITY];
export type PluginGeneralMessage = (typeof PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL)[keyof typeof PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL];

// Helper functions for type-safe access
export const PluginConstantsHelper = {
  /**
   * Get component types as array
   */
  getComponentTypes(): PluginComponentTypeConstants[] {
    return Object.values(PLUGIN_CONSTANTS.COMPONENT_TYPES);
  },

  /**
   * Get boolean configuration field names
   */
  getBooleanFields(): PluginConfigBooleanField[] {
    return [...PLUGIN_CONSTANTS.CONFIG_FIELDS.BOOLEAN];
  },

  /**
   * Get numeric configuration field names
   */
  getNumericFields(): PluginConfigNumericField[] {
    return [...PLUGIN_CONSTANTS.CONFIG_FIELDS.NUMERIC];
  },

  /**
   * Get default permissions
   */
  getDefaultPermissions(): PluginDefaultPermission[] {
    return Object.values(PLUGIN_CONSTANTS.DEFAULT_PERMISSIONS);
  },

  /**
   * Check if a string is a valid component type
   */
  isValidComponentType(type: string): type is PluginComponentTypeConstants {
    return Object.values(PLUGIN_CONSTANTS.COMPONENT_TYPES).includes(type as PluginComponentTypeConstants);
  },

  /**
   * Check if a field name is a boolean configuration field
   */
  isBooleanConfigField(field: string): field is PluginConfigBooleanField {
    return PLUGIN_CONSTANTS.CONFIG_FIELDS.BOOLEAN.includes(field as PluginConfigBooleanField);
  },

  /**
   * Check if a field name is a numeric configuration field
   */
  isNumericConfigField(field: string): field is PluginConfigNumericField {
    return PLUGIN_CONSTANTS.CONFIG_FIELDS.NUMERIC.includes(field as PluginConfigNumericField);
  },

  /**
   * Format log message with parameters (simple string replacement)
   */
  formatLogMessage(template: string, ...params: (string | number)[]): string {
    return template.replace(/\{(\d+)\}/g, (match, index) => {
      const paramIndex = parseInt(index, 10);
      return params[paramIndex]?.toString() || match;
    });
  },
} as const;
