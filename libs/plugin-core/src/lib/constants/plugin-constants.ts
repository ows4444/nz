/**
 * Constants used throughout the plugin system
 */

export const PLUGIN_CONSTANTS = {
  // File names
  MANIFEST_FILE: 'plugin.manifest.json',
  DIST_DIRECTORY: 'dist',

  // Default configuration values
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_RETRIES: 3,
  DEFAULT_MAX_CONCURRENT_LOADS: 5,

  // Plugin naming patterns
  PLUGIN_PREFIX_PATTERN: '@plugins/',
  MODULE_SUFFIX: 'Module',
  PLUGIN_SUFFIX: 'Plugin',

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

  // Log messages
  MESSAGES: {
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
} as const;

export type PluginErrorMessage = (typeof PLUGIN_CONSTANTS.ERRORS)[keyof typeof PLUGIN_CONSTANTS.ERRORS];
export type PluginLogMessage = (typeof PLUGIN_CONSTANTS.MESSAGES)[keyof typeof PLUGIN_CONSTANTS.MESSAGES];
