/**
 * Zod to JSON Schema Conversion Module
 *
 * This module provides functions to convert Zod schema definitions to JSON Schema format.
 * It supports multiple output targets: JSON Schema Draft-07, JSON Schema 2019-09, OpenAPI 3, and OpenAI.
 *
 * - o2 -> zodToJsonSchema (main converter)
 * - Qo5 -> processSchemaWithCustomRefs
 * - $W2 -> processNumberConstraints
 * - uW2 -> processObjectSchema
 * - yW2 -> processUnionType
 * - PW2 -> processNullableType
 * - UW2 -> convertRegexFlags
 * - KR -> generateJsonSchema (top-level entry point)
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Symbol used to let zodToJsonSchema decide which parser to use.
 * When an override function returns this, the default processing continues.
 */
export const IGNORE_OVERRIDE = Symbol('Let zodToJsonSchema decide on which parser to use');

/**
 * Mapping of Zod primitive types to JSON Schema types
 */
export const ZOD_TO_JSON_TYPE_MAP = {
  ZodString: 'string',
  ZodNumber: 'number',
  ZodBigInt: 'integer',
  ZodBoolean: 'boolean',
  ZodNull: 'null'
};

/**
 * Default configuration options for JSON Schema generation
 */
export const DEFAULT_OPTIONS = {
  name: undefined,
  $refStrategy: 'root',
  basePath: ['#'],
  effectStrategy: 'input',
  pipeStrategy: 'all',
  dateStrategy: 'format:date-time',
  mapStrategy: 'entries',
  removeAdditionalStrategy: 'passthrough',
  definitionPath: 'definitions',
  target: 'jsonSchema7',
  strictUnions: false,
  definitions: {},
  errorMessages: false,
  markdownDescription: false,
  patternStrategy: 'escape',
  applyRegexFlags: false,
  emailStrategy: 'format:email',
  base64Strategy: 'contentEncoding:base64',
  nameStrategy: 'ref'
};

/**
 * Common regex patterns for string validation
 */
export const STRING_PATTERNS = {
  cuid: /^[cC][^\s-]{8,}$/,
  cuid2: /^[0-9a-z]+$/,
  ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
  email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
  emoji: () => {
    // Lazy initialization for emoji pattern
    return RegExp('^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$', 'u');
  },
  uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
  ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
  ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
  base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  nanoid: /^[a-zA-Z0-9_-]{21}$/,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
};

/**
 * Set of safe characters that don't need escaping in regex patterns
 */
const SAFE_REGEX_CHARS = new Set('ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sets a property on a JSON Schema object with optional error message handling.
 *
 * @param {object} schema - The JSON Schema object to modify
 * @param {string} propertyName - The property name to set
 * @param {*} value - The value to set
 * @param {string} message - Optional error message
 * @param {object} config - Configuration options
 */
export function setSchemaProperty(schema, propertyName, value, message, config) {
  schema[propertyName] = value;
  addErrorMessage(schema, propertyName, message, config);
}

/**
 * Adds an error message to a schema property if error messages are enabled.
 *
 * @param {object} schema - The JSON Schema object
 * @param {string} propertyName - The property name
 * @param {string} message - The error message
 * @param {object} config - Configuration options
 */
export function addErrorMessage(schema, propertyName, message, config) {
  if (!config?.errorMessages) return;
  if (message) {
    schema.errorMessage = {
      ...schema.errorMessage,
      [propertyName]: message
    };
  }
}

/**
 * Escapes special regex characters in a string based on pattern strategy.
 *
 * @param {string} value - The string to escape
 * @param {object} config - Configuration with patternStrategy
 * @returns {string} The escaped string
 */
export function escapePatternString(value, config) {
  return config.patternStrategy === 'escape' ? escapeRegexChars(value) : value;
}

/**
 * Escapes non-alphanumeric characters in a string for regex use.
 *
 * @param {string} input - The string to escape
 * @returns {string} The escaped string
 */
export function escapeRegexChars(input) {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    if (!SAFE_REGEX_CHARS.has(input[i])) {
      result += '\\';
    }
    result += input[i];
  }
  return result;
}

/**
 * Normalizes configuration options by merging with defaults.
 *
 * @param {string|object} options - Schema name string or configuration object
 * @returns {object} Normalized configuration object
 */
export function normalizeOptions(options) {
  return typeof options === 'string'
    ? { ...DEFAULT_OPTIONS, name: options }
    : { ...DEFAULT_OPTIONS, ...options };
}

/**
 * Initializes conversion options with path tracking and definition map.
 *
 * @param {string|object} options - Input options
 * @returns {object} Fully initialized conversion options
 */
export function initializeConversionOptions(options) {
  const normalized = normalizeOptions(options);
  const currentPath = normalized.name !== undefined
    ? [...normalized.basePath, normalized.definitionPath, normalized.name]
    : normalized.basePath;

  return {
    ...normalized,
    currentPath,
    propertyPath: undefined,
    seen: new Map(
      Object.entries(normalized.definitions).map(([key, zodSchema]) => [
        zodSchema._def,
        {
          def: zodSchema._def,
          path: [...normalized.basePath, normalized.definitionPath, key],
          jsonSchema: undefined
        }
      ])
    )
  };
}

/**
 * Calculates a relative $ref path between two paths.
 *
 * @param {string[]} fromPath - Current path
 * @param {string[]} toPath - Target path
 * @returns {string} Relative $ref path
 */
export function calculateRelativeRef(fromPath, toPath) {
  let commonPrefixLength = 0;

  // Find common prefix
  while (commonPrefixLength < fromPath.length && commonPrefixLength < toPath.length) {
    if (fromPath[commonPrefixLength] !== toPath[commonPrefixLength]) break;
    commonPrefixLength++;
  }

  // Build relative path: number of levels up + remaining path down
  return [
    (fromPath.length - commonPrefixLength).toString(),
    ...toPath.slice(commonPrefixLength)
  ].join('/');
}

// ============================================================================
// Regex Flag Conversion
// ============================================================================

/**
 * Converts a regex pattern with flags to a flag-independent form.
 * This enables patterns with i/m/s flags to work in JSON Schema where flags aren't supported.
 *
 * Handles:
 * - Case-insensitive flag (i): converts [a-z] to [a-zA-Z]
 * - Multiline flag (m): converts ^ and $ to handle line breaks
 * - Dotall flag (s): converts . to match newlines
 *
 * Original: UW2
 *
 * @param {RegExp} regex - The regular expression to convert
 * @param {object} config - Conversion configuration
 * @returns {string} Flag-independent pattern string
 */
export function convertRegexFlags(regex, config) {
  // If flag conversion is disabled or no flags, return original source
  if (!config.applyRegexFlags || !regex.flags) {
    return regex.source;
  }

  const flags = {
    i: regex.flags.includes('i'),  // case-insensitive
    m: regex.flags.includes('m'),  // multiline
    s: regex.flags.includes('s')   // dotall
  };

  // Start with lowercase source for case-insensitive processing
  let source = flags.i ? regex.source.toLowerCase() : regex.source;
  let result = '';
  let isEscaped = false;
  let inCharClass = false;
  let isRangeMiddle = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    // Handle escape sequences
    if (isEscaped) {
      result += char;
      isEscaped = false;
      continue;
    }

    // Handle case-insensitive flag
    if (flags.i) {
      if (inCharClass) {
        // Inside character class
        if (char.match(/[a-z]/)) {
          if (isRangeMiddle) {
            // Complete the range with both cases: a-z becomes a-zA-Z
            result += char;
            result += `${source[i - 2]}-${char}`.toUpperCase();
            isRangeMiddle = false;
          } else if (source[i + 1] === '-' && source[i + 2]?.match(/[a-z]/)) {
            // Start of a range
            result += char;
            isRangeMiddle = true;
          } else {
            // Single character: a becomes aA
            result += `${char}${char.toUpperCase()}`;
          }
          continue;
        }
      } else if (char.match(/[a-z]/)) {
        // Outside character class: a becomes [aA]
        result += `[${char}${char.toUpperCase()}]`;
        continue;
      }
    }

    // Handle multiline flag
    if (flags.m) {
      if (char === '^') {
        // Start of line: ^ becomes (^|(?<=[\r\n]))
        result += '(^|(?<=[\r\n]))';
        continue;
      } else if (char === '$') {
        // End of line: $ becomes ($|(?=[\r\n]))
        result += '($|(?=[\r\n]))';
        continue;
      }
    }

    // Handle dotall flag
    if (flags.s && char === '.') {
      // Dot matches newlines: . becomes [.\r\n] or .\r\n inside character class
      result += inCharClass ? `${char}\r\n` : `[${char}\r\n]`;
      continue;
    }

    // Normal character processing
    result += char;

    if (char === '\\') {
      isEscaped = true;
    } else if (inCharClass && char === ']') {
      inCharClass = false;
    } else if (!inCharClass && char === '[') {
      inCharClass = true;
    }
  }

  // Validate the transformed regex
  try {
    new RegExp(result);
  } catch {
    console.warn(
      `Could not convert regex pattern at ${config.currentPath.join('/')} ` +
      `to a flag-independent form! Falling back to the flag-ignorant source`
    );
    return regex.source;
  }

  return result;
}

// ============================================================================
// Schema Reference Handling
// ============================================================================

/**
 * Processes a previously seen schema definition and returns appropriate $ref.
 * Handles different $ref strategies: root, relative, none, seen.
 *
 * Original: Qo5
 *
 * @param {object} seenEntry - Previously seen schema entry with path info
 * @param {object} config - Conversion configuration
 * @returns {object|undefined} $ref object or undefined
 */
export function processSchemaWithCustomRefs(seenEntry, config) {
  switch (config.$refStrategy) {
    case 'root':
      // Use absolute path from root
      return { $ref: seenEntry.path.join('/') };

    case 'relative':
      // Use relative path from current location
      return { $ref: calculateRelativeRef(config.currentPath, seenEntry.path) };

    case 'none':
    case 'seen': {
      // Check for recursive reference (path is prefix of current path)
      if (
        seenEntry.path.length < config.currentPath.length &&
        seenEntry.path.every((segment, i) => config.currentPath[i] === segment)
      ) {
        console.warn(
          `Recursive reference detected at ${config.currentPath.join('/')}! ` +
          `Defaulting to any`
        );
        return {};
      }
      // 'seen' returns empty object, 'none' returns undefined (continue processing)
      return config.$refStrategy === 'seen' ? {} : undefined;
    }
  }
}

// ============================================================================
// Type-Specific Processors
// ============================================================================

/**
 * Processes number type constraints (int, min, max, multipleOf).
 *
 * Original: $W2
 *
 * @param {object} zodDef - Zod number definition
 * @param {object} config - Conversion configuration
 * @returns {object} JSON Schema for number type
 */
export function processNumberConstraints(zodDef, config) {
  const schema = { type: 'number' };

  if (!zodDef.checks) return schema;

  for (const check of zodDef.checks) {
    switch (check.kind) {
      case 'int':
        schema.type = 'integer';
        addErrorMessage(schema, 'type', check.message, config);
        break;

      case 'min':
        if (config.target === 'jsonSchema7') {
          // JSON Schema Draft-07 uses separate exclusiveMinimum property
          if (check.inclusive) {
            setSchemaProperty(schema, 'minimum', check.value, check.message, config);
          } else {
            setSchemaProperty(schema, 'exclusiveMinimum', check.value, check.message, config);
          }
        } else {
          // OpenAPI 3 uses exclusiveMinimum as boolean flag
          if (!check.inclusive) {
            schema.exclusiveMinimum = true;
          }
          setSchemaProperty(schema, 'minimum', check.value, check.message, config);
        }
        break;

      case 'max':
        if (config.target === 'jsonSchema7') {
          if (check.inclusive) {
            setSchemaProperty(schema, 'maximum', check.value, check.message, config);
          } else {
            setSchemaProperty(schema, 'exclusiveMaximum', check.value, check.message, config);
          }
        } else {
          if (!check.inclusive) {
            schema.exclusiveMaximum = true;
          }
          setSchemaProperty(schema, 'maximum', check.value, check.message, config);
        }
        break;

      case 'multipleOf':
        setSchemaProperty(schema, 'multipleOf', check.value, check.message, config);
        break;
    }
  }

  return schema;
}

/**
 * Determines if additionalProperties should be allowed for an object schema.
 *
 * @param {object} zodDef - Zod object definition
 * @param {object} config - Conversion configuration
 * @returns {boolean|object} additionalProperties value
 */
export function processAdditionalProperties(zodDef, config) {
  if (config.removeAdditionalStrategy === 'strict') {
    // Strict mode: disallow additional properties unless explicitly allowed
    if (zodDef.catchall._def.typeName === 'ZodNever') {
      return zodDef.unknownKeys !== 'strict';
    }
    return zodToJsonSchema(zodDef.catchall._def, {
      ...config,
      currentPath: [...config.currentPath, 'additionalProperties']
    }) ?? true;
  } else {
    // Passthrough mode: allow additional properties unless strict
    if (zodDef.catchall._def.typeName === 'ZodNever') {
      return zodDef.unknownKeys === 'passthrough';
    }
    return zodToJsonSchema(zodDef.catchall._def, {
      ...config,
      currentPath: [...config.currentPath, 'additionalProperties']
    }) ?? true;
  }
}

/**
 * Processes object/shape schema with properties.
 * Maps object fields with optional/required tracking.
 *
 * Original: uW2
 *
 * @param {object} zodDef - Zod object definition
 * @param {object} config - Conversion configuration
 * @returns {object} JSON Schema for object type
 */
export function processObjectSchema(zodDef, config) {
  const isOpenAI = config.target === 'openAi';

  // Process all shape properties
  const { properties, required } = Object.entries(zodDef.shape()).reduce(
    (acc, [key, zodField]) => {
      // Skip undefined fields
      if (zodField === undefined || zodField._def === undefined) {
        return acc;
      }

      let isOptional = zodField.isOptional();

      // OpenAI requires all fields to be required (optional -> nullable instead)
      if (isOptional && isOpenAI) {
        // Unwrap optional type
        if (zodField.constructor.name === 'ZodOptional') {
          zodField = zodField._def.innerType;
        }
        // Make it nullable if not already
        if (!zodField.isNullable()) {
          zodField = zodField.nullable();
        }
        isOptional = false;
      }

      // Convert the field schema
      const fieldSchema = zodToJsonSchema(zodField._def, {
        ...config,
        currentPath: [...config.currentPath, 'properties', key],
        propertyPath: [...config.currentPath, 'properties', key]
      });

      if (fieldSchema === undefined) {
        return acc;
      }

      return {
        properties: {
          ...acc.properties,
          [key]: fieldSchema
        },
        required: isOptional ? acc.required : [...acc.required, key]
      };
    },
    { properties: {}, required: [] }
  );

  const schema = {
    type: 'object',
    ...{ properties, required },
    additionalProperties: processAdditionalProperties(zodDef, config)
  };

  // Remove empty required array
  if (!schema.required.length) {
    delete schema.required;
  }

  return schema;
}

/**
 * Processes union type schema.
 * Combines multiple type options into anyOf or type array.
 *
 * Original: yW2
 *
 * @param {object} zodDef - Zod union definition
 * @param {object} config - Conversion configuration
 * @returns {object} JSON Schema for union type
 */
export function processUnionType(zodDef, config) {
  // OpenAPI 3 always uses anyOf for unions
  if (config.target === 'openApi3') {
    return processUnionAsAnyOf(zodDef, config);
  }

  const options = zodDef.options instanceof Map
    ? Array.from(zodDef.options.values())
    : zodDef.options;

  // Optimization: If all options are simple primitives without checks,
  // use compact "type" array notation
  if (options.every(opt =>
    (opt._def.typeName in ZOD_TO_JSON_TYPE_MAP) &&
    (!opt._def.checks || !opt._def.checks.length)
  )) {
    const types = options.reduce((acc, opt) => {
      const jsonType = ZOD_TO_JSON_TYPE_MAP[opt._def.typeName];
      if (jsonType && !acc.includes(jsonType)) {
        return [...acc, jsonType];
      }
      return acc;
    }, []);

    return { type: types.length > 1 ? types : types[0] };
  }

  // Optimization: If all options are literals without descriptions,
  // use enum notation
  if (options.every(opt => opt._def.typeName === 'ZodLiteral' && !opt.description)) {
    const typeToValues = options.reduce((acc, opt) => {
      const jsType = typeof opt._def.value;
      switch (jsType) {
        case 'string':
        case 'number':
        case 'boolean':
          return [...acc, jsType];
        case 'bigint':
          return [...acc, 'integer'];
        case 'object':
          if (opt._def.value === null) return [...acc, 'null'];
          return acc;
        case 'symbol':
        case 'undefined':
        case 'function':
        default:
          return acc;
      }
    }, []);

    if (typeToValues.length === options.length) {
      const uniqueTypes = typeToValues.filter((t, i, arr) => arr.indexOf(t) === i);
      return {
        type: uniqueTypes.length > 1 ? uniqueTypes : uniqueTypes[0],
        enum: options.reduce((acc, opt) => {
          return acc.includes(opt._def.value) ? acc : [...acc, opt._def.value];
        }, [])
      };
    }
  }

  // Check if all options are ZodEnum
  if (options.every(opt => opt._def.typeName === 'ZodEnum')) {
    return {
      type: 'string',
      enum: options.reduce(
        (acc, opt) => [...acc, ...opt._def.values.filter(v => !acc.includes(v))],
        []
      )
    };
  }

  // Fall back to anyOf
  return processUnionAsAnyOf(zodDef, config);
}

/**
 * Processes union type as anyOf array.
 *
 * @param {object} zodDef - Zod union definition
 * @param {object} config - Conversion configuration
 * @returns {object|undefined} JSON Schema with anyOf
 */
function processUnionAsAnyOf(zodDef, config) {
  const options = zodDef.options instanceof Map
    ? Array.from(zodDef.options.values())
    : zodDef.options;

  const anyOf = options
    .map((opt, index) => zodToJsonSchema(opt._def, {
      ...config,
      currentPath: [...config.currentPath, 'anyOf', `${index}`]
    }))
    .filter(schema => {
      if (!schema) return false;
      if (!config.strictUnions) return true;
      return typeof schema === 'object' && Object.keys(schema).length > 0;
    });

  return anyOf.length ? { anyOf } : undefined;
}

/**
 * Processes nullable type schema.
 * Supports OpenAPI3 nullable notation and JSON Schema null type.
 *
 * Original: PW2
 *
 * @param {object} zodDef - Zod nullable definition
 * @param {object} config - Conversion configuration
 * @returns {object} JSON Schema for nullable type
 */
export function processNullableType(zodDef, config) {
  const innerTypeName = zodDef.innerType._def.typeName;

  // Simple primitive types without checks can use compact notation
  if (
    ['ZodString', 'ZodNumber', 'ZodBigInt', 'ZodBoolean', 'ZodNull'].includes(innerTypeName) &&
    (!zodDef.innerType._def.checks || !zodDef.innerType._def.checks.length)
  ) {
    if (config.target === 'openApi3') {
      // OpenAPI 3 uses nullable property
      return {
        type: ZOD_TO_JSON_TYPE_MAP[innerTypeName],
        nullable: true
      };
    }
    // JSON Schema uses type array with null
    return {
      type: [ZOD_TO_JSON_TYPE_MAP[innerTypeName], 'null']
    };
  }

  // Complex types need anyOf or allOf
  if (config.target === 'openApi3') {
    const innerSchema = zodToJsonSchema(zodDef.innerType._def, {
      ...config,
      currentPath: [...config.currentPath]
    });

    // $ref needs wrapping in allOf
    if (innerSchema && '$ref' in innerSchema) {
      return {
        allOf: [innerSchema],
        nullable: true
      };
    }

    return innerSchema && { ...innerSchema, nullable: true };
  }

  // JSON Schema uses anyOf with null type
  const innerSchema = zodToJsonSchema(zodDef.innerType._def, {
    ...config,
    currentPath: [...config.currentPath, 'anyOf', '0']
  });

  return innerSchema && {
    anyOf: [innerSchema, { type: 'null' }]
  };
}

/**
 * Processes string type with all its constraints.
 *
 * @param {object} zodDef - Zod string definition
 * @param {object} config - Conversion configuration
 * @returns {object} JSON Schema for string type
 */
export function processStringConstraints(zodDef, config) {
  const schema = { type: 'string' };

  if (!zodDef.checks) return schema;

  for (const check of zodDef.checks) {
    switch (check.kind) {
      case 'min':
        setSchemaProperty(
          schema,
          'minLength',
          typeof schema.minLength === 'number'
            ? Math.max(schema.minLength, check.value)
            : check.value,
          check.message,
          config
        );
        break;

      case 'max':
        setSchemaProperty(
          schema,
          'maxLength',
          typeof schema.maxLength === 'number'
            ? Math.min(schema.maxLength, check.value)
            : check.value,
          check.message,
          config
        );
        break;

      case 'email':
        switch (config.emailStrategy) {
          case 'format:email':
            addFormatConstraint(schema, 'email', check.message, config);
            break;
          case 'format:idn-email':
            addFormatConstraint(schema, 'idn-email', check.message, config);
            break;
          case 'pattern:zod':
            addPatternConstraint(schema, STRING_PATTERNS.email, check.message, config);
            break;
        }
        break;

      case 'url':
        addFormatConstraint(schema, 'uri', check.message, config);
        break;

      case 'uuid':
        addFormatConstraint(schema, 'uuid', check.message, config);
        break;

      case 'regex':
        addPatternConstraint(schema, check.regex, check.message, config);
        break;

      case 'cuid':
        addPatternConstraint(schema, STRING_PATTERNS.cuid, check.message, config);
        break;

      case 'cuid2':
        addPatternConstraint(schema, STRING_PATTERNS.cuid2, check.message, config);
        break;

      case 'startsWith':
        addPatternConstraint(
          schema,
          RegExp(`^${escapePatternString(check.value, config)}`),
          check.message,
          config
        );
        break;

      case 'endsWith':
        addPatternConstraint(
          schema,
          RegExp(`${escapePatternString(check.value, config)}$`),
          check.message,
          config
        );
        break;

      case 'datetime':
        addFormatConstraint(schema, 'date-time', check.message, config);
        break;

      case 'date':
        addFormatConstraint(schema, 'date', check.message, config);
        break;

      case 'time':
        addFormatConstraint(schema, 'time', check.message, config);
        break;

      case 'duration':
        addFormatConstraint(schema, 'duration', check.message, config);
        break;

      case 'length':
        setSchemaProperty(
          schema,
          'minLength',
          typeof schema.minLength === 'number'
            ? Math.max(schema.minLength, check.value)
            : check.value,
          check.message,
          config
        );
        setSchemaProperty(
          schema,
          'maxLength',
          typeof schema.maxLength === 'number'
            ? Math.min(schema.maxLength, check.value)
            : check.value,
          check.message,
          config
        );
        break;

      case 'includes':
        addPatternConstraint(
          schema,
          RegExp(escapePatternString(check.value, config)),
          check.message,
          config
        );
        break;

      case 'ip':
        if (check.version !== 'v6') {
          addFormatConstraint(schema, 'ipv4', check.message, config);
        }
        if (check.version !== 'v4') {
          addFormatConstraint(schema, 'ipv6', check.message, config);
        }
        break;

      case 'base64url':
        addPatternConstraint(schema, STRING_PATTERNS.base64url, check.message, config);
        break;

      case 'jwt':
        addPatternConstraint(schema, STRING_PATTERNS.jwt, check.message, config);
        break;

      case 'cidr':
        if (check.version !== 'v6') {
          addPatternConstraint(schema, STRING_PATTERNS.ipv4Cidr, check.message, config);
        }
        if (check.version !== 'v4') {
          addPatternConstraint(schema, STRING_PATTERNS.ipv6Cidr, check.message, config);
        }
        break;

      case 'emoji':
        addPatternConstraint(schema, STRING_PATTERNS.emoji(), check.message, config);
        break;

      case 'ulid':
        addPatternConstraint(schema, STRING_PATTERNS.ulid, check.message, config);
        break;

      case 'base64':
        switch (config.base64Strategy) {
          case 'format:binary':
            addFormatConstraint(schema, 'binary', check.message, config);
            break;
          case 'contentEncoding:base64':
            setSchemaProperty(schema, 'contentEncoding', 'base64', check.message, config);
            break;
          case 'pattern:zod':
            addPatternConstraint(schema, STRING_PATTERNS.base64, check.message, config);
            break;
        }
        break;

      case 'nanoid':
        addPatternConstraint(schema, STRING_PATTERNS.nanoid, check.message, config);
        break;

      case 'toLowerCase':
      case 'toUpperCase':
      case 'trim':
        // These are transformations, not constraints
        break;

      default:
        // Unknown check kind - ignore
        break;
    }
  }

  return schema;
}

/**
 * Adds a format constraint to a string schema.
 * Handles multiple formats with anyOf.
 *
 * @param {object} schema - The JSON Schema object
 * @param {string} format - The format to add
 * @param {string} message - Error message
 * @param {object} config - Configuration
 */
function addFormatConstraint(schema, format, message, config) {
  if (schema.format || schema.anyOf?.some(s => s.format)) {
    // Already has format(s), need to use anyOf
    if (!schema.anyOf) {
      schema.anyOf = [];
    }

    // Move existing format to anyOf
    if (schema.format) {
      schema.anyOf.push({
        format: schema.format,
        ...(schema.errorMessage && config.errorMessages && {
          errorMessage: { format: schema.errorMessage.format }
        })
      });
      delete schema.format;
      if (schema.errorMessage) {
        delete schema.errorMessage.format;
        if (Object.keys(schema.errorMessage).length === 0) {
          delete schema.errorMessage;
        }
      }
    }

    // Add new format
    schema.anyOf.push({
      format,
      ...(message && config.errorMessages && {
        errorMessage: { format: message }
      })
    });
  } else {
    setSchemaProperty(schema, 'format', format, message, config);
  }
}

/**
 * Adds a pattern constraint to a string schema.
 * Handles multiple patterns with allOf.
 *
 * @param {object} schema - The JSON Schema object
 * @param {RegExp} regex - The regex pattern
 * @param {string} message - Error message
 * @param {object} config - Configuration
 */
function addPatternConstraint(schema, regex, message, config) {
  if (schema.pattern || schema.allOf?.some(s => s.pattern)) {
    // Already has pattern(s), need to use allOf
    if (!schema.allOf) {
      schema.allOf = [];
    }

    // Move existing pattern to allOf
    if (schema.pattern) {
      schema.allOf.push({
        pattern: schema.pattern,
        ...(schema.errorMessage && config.errorMessages && {
          errorMessage: { pattern: schema.errorMessage.pattern }
        })
      });
      delete schema.pattern;
      if (schema.errorMessage) {
        delete schema.errorMessage.pattern;
        if (Object.keys(schema.errorMessage).length === 0) {
          delete schema.errorMessage;
        }
      }
    }

    // Add new pattern
    schema.allOf.push({
      pattern: convertRegexFlags(regex, config),
      ...(message && config.errorMessages && {
        errorMessage: { pattern: message }
      })
    });
  } else {
    setSchemaProperty(schema, 'pattern', convertRegexFlags(regex, config), message, config);
  }
}

// ============================================================================
// Additional Type Processors
// ============================================================================

/**
 * Processes array type schema.
 */
export function processArraySchema(zodDef, config) {
  const schema = { type: 'array' };

  if (zodDef.type?._def && zodDef.type?._def?.typeName !== 'ZodAny') {
    schema.items = zodToJsonSchema(zodDef.type._def, {
      ...config,
      currentPath: [...config.currentPath, 'items']
    });
  }

  if (zodDef.minLength) {
    setSchemaProperty(schema, 'minItems', zodDef.minLength.value, zodDef.minLength.message, config);
  }
  if (zodDef.maxLength) {
    setSchemaProperty(schema, 'maxItems', zodDef.maxLength.value, zodDef.maxLength.message, config);
  }
  if (zodDef.exactLength) {
    setSchemaProperty(schema, 'minItems', zodDef.exactLength.value, zodDef.exactLength.message, config);
    setSchemaProperty(schema, 'maxItems', zodDef.exactLength.value, zodDef.exactLength.message, config);
  }

  return schema;
}

/**
 * Processes bigint type schema.
 */
export function processBigIntConstraints(zodDef, config) {
  const schema = {
    type: 'integer',
    format: 'int64'
  };

  if (!zodDef.checks) return schema;

  for (const check of zodDef.checks) {
    switch (check.kind) {
      case 'min':
        if (config.target === 'jsonSchema7') {
          if (check.inclusive) {
            setSchemaProperty(schema, 'minimum', check.value, check.message, config);
          } else {
            setSchemaProperty(schema, 'exclusiveMinimum', check.value, check.message, config);
          }
        } else {
          if (!check.inclusive) schema.exclusiveMinimum = true;
          setSchemaProperty(schema, 'minimum', check.value, check.message, config);
        }
        break;

      case 'max':
        if (config.target === 'jsonSchema7') {
          if (check.inclusive) {
            setSchemaProperty(schema, 'maximum', check.value, check.message, config);
          } else {
            setSchemaProperty(schema, 'exclusiveMaximum', check.value, check.message, config);
          }
        } else {
          if (!check.inclusive) schema.exclusiveMaximum = true;
          setSchemaProperty(schema, 'maximum', check.value, check.message, config);
        }
        break;

      case 'multipleOf':
        setSchemaProperty(schema, 'multipleOf', check.value, check.message, config);
        break;
    }
  }

  return schema;
}

/**
 * Processes boolean type schema.
 */
export function processBooleanSchema() {
  return { type: 'boolean' };
}

/**
 * Processes null type schema.
 */
export function processNullSchema(config) {
  if (config.target === 'openApi3') {
    return { enum: ['null'], nullable: true };
  }
  return { type: 'null' };
}

/**
 * Processes never type schema (no valid values).
 */
export function processNeverSchema() {
  return { not: {} };
}

/**
 * Processes any type schema.
 */
export function processAnySchema() {
  return {};
}

/**
 * Processes unknown type schema.
 */
export function processUnknownSchema() {
  return {};
}

/**
 * Processes literal type schema.
 */
export function processLiteralSchema(zodDef, config) {
  const valueType = typeof zodDef.value;

  if (!['bigint', 'number', 'boolean', 'string'].includes(valueType)) {
    return { type: Array.isArray(zodDef.value) ? 'array' : 'object' };
  }

  if (config.target === 'openApi3') {
    return {
      type: valueType === 'bigint' ? 'integer' : valueType,
      enum: [zodDef.value]
    };
  }

  return {
    type: valueType === 'bigint' ? 'integer' : valueType,
    const: zodDef.value
  };
}

/**
 * Processes enum type schema.
 */
export function processEnumSchema(zodDef) {
  return {
    type: 'string',
    enum: Array.from(zodDef.values)
  };
}

/**
 * Processes native enum type schema.
 */
export function processNativeEnumSchema(zodDef) {
  const enumValues = zodDef.values;
  const validValues = Object.keys(enumValues)
    .filter(key => typeof enumValues[enumValues[key]] !== 'number')
    .map(key => enumValues[key]);

  const types = Array.from(new Set(validValues.map(v => typeof v)));

  return {
    type: types.length === 1
      ? (types[0] === 'string' ? 'string' : 'number')
      : ['string', 'number'],
    enum: validValues
  };
}

/**
 * Processes record/map type schema.
 */
export function processRecordSchema(zodDef, config) {
  if (config.target === 'openAi') {
    console.warn('Warning: OpenAI may not support records in schemas! Try an array of key-value pairs instead.');
  }

  // OpenAPI 3 with enum keys
  if (config.target === 'openApi3' && zodDef.keyType?._def.typeName === 'ZodEnum') {
    return {
      type: 'object',
      required: zodDef.keyType._def.values,
      properties: zodDef.keyType._def.values.reduce((acc, key) => ({
        ...acc,
        [key]: zodToJsonSchema(zodDef.valueType._def, {
          ...config,
          currentPath: [...config.currentPath, 'properties', key]
        }) ?? {}
      }), {}),
      additionalProperties: false
    };
  }

  const schema = {
    type: 'object',
    additionalProperties: zodToJsonSchema(zodDef.valueType._def, {
      ...config,
      currentPath: [...config.currentPath, 'additionalProperties']
    }) ?? {}
  };

  if (config.target === 'openApi3') return schema;

  // Handle key constraints for JSON Schema
  if (zodDef.keyType?._def.typeName === 'ZodString' && zodDef.keyType._def.checks?.length) {
    const { type, ...keyConstraints } = processStringConstraints(zodDef.keyType._def, config);
    return { ...schema, propertyNames: keyConstraints };
  }

  if (zodDef.keyType?._def.typeName === 'ZodEnum') {
    return {
      ...schema,
      propertyNames: { enum: zodDef.keyType._def.values }
    };
  }

  if (
    zodDef.keyType?._def.typeName === 'ZodBranded' &&
    zodDef.keyType._def.type._def.typeName === 'ZodString' &&
    zodDef.keyType._def.type._def.checks?.length
  ) {
    const { type, ...keyConstraints } = processBrandedSchema(zodDef.keyType._def, config);
    return { ...schema, propertyNames: keyConstraints };
  }

  return schema;
}

/**
 * Processes map type schema.
 */
export function processMapSchema(zodDef, config) {
  if (config.mapStrategy === 'record') {
    return processRecordSchema(zodDef, config);
  }

  // Array of tuples strategy
  const keySchema = zodToJsonSchema(zodDef.keyType._def, {
    ...config,
    currentPath: [...config.currentPath, 'items', 'items', '0']
  }) || {};

  const valueSchema = zodToJsonSchema(zodDef.valueType._def, {
    ...config,
    currentPath: [...config.currentPath, 'items', 'items', '1']
  }) || {};

  return {
    type: 'array',
    maxItems: 125,
    items: {
      type: 'array',
      items: [keySchema, valueSchema],
      minItems: 2,
      maxItems: 2
    }
  };
}

/**
 * Processes set type schema.
 */
export function processSetSchema(zodDef, config) {
  const schema = {
    type: 'array',
    uniqueItems: true,
    items: zodToJsonSchema(zodDef.valueType._def, {
      ...config,
      currentPath: [...config.currentPath, 'items']
    })
  };

  if (zodDef.minSize) {
    setSchemaProperty(schema, 'minItems', zodDef.minSize.value, zodDef.minSize.message, config);
  }
  if (zodDef.maxSize) {
    setSchemaProperty(schema, 'maxItems', zodDef.maxSize.value, zodDef.maxSize.message, config);
  }

  return schema;
}

/**
 * Processes tuple type schema.
 */
export function processTupleSchema(zodDef, config) {
  const items = zodDef.items
    .map((item, index) => zodToJsonSchema(item._def, {
      ...config,
      currentPath: [...config.currentPath, 'items', `${index}`]
    }))
    .reduce((acc, item) => item === undefined ? acc : [...acc, item], []);

  if (zodDef.rest) {
    return {
      type: 'array',
      minItems: zodDef.items.length,
      items,
      additionalItems: zodToJsonSchema(zodDef.rest._def, {
        ...config,
        currentPath: [...config.currentPath, 'additionalItems']
      })
    };
  }

  return {
    type: 'array',
    minItems: zodDef.items.length,
    maxItems: zodDef.items.length,
    items
  };
}

/**
 * Processes intersection type schema.
 */
export function processIntersectionSchema(zodDef, config) {
  const allOf = [
    zodToJsonSchema(zodDef.left._def, {
      ...config,
      currentPath: [...config.currentPath, 'allOf', '0']
    }),
    zodToJsonSchema(zodDef.right._def, {
      ...config,
      currentPath: [...config.currentPath, 'allOf', '1']
    })
  ].filter(s => !!s);

  let unevaluatedProperties = config.target === 'jsonSchema2019-09'
    ? { unevaluatedProperties: false }
    : undefined;

  const result = [];

  allOf.forEach(schema => {
    if (hasAllOfProperty(schema)) {
      result.push(...schema.allOf);
      if (schema.unevaluatedProperties === undefined) {
        unevaluatedProperties = undefined;
      }
    } else {
      let processedSchema = schema;

      if ('additionalProperties' in schema && schema.additionalProperties === false) {
        const { additionalProperties, ...rest } = schema;
        processedSchema = rest;
      } else {
        unevaluatedProperties = undefined;
      }

      result.push(processedSchema);
    }
  });

  return result.length
    ? { allOf: result, ...unevaluatedProperties }
    : undefined;
}

/**
 * Checks if schema has allOf property (for intersection processing).
 */
function hasAllOfProperty(schema) {
  if ('type' in schema && schema.type === 'string') return false;
  return 'allOf' in schema;
}

/**
 * Processes optional type schema.
 */
export function processOptionalSchema(zodDef, config) {
  // At property level, just return the inner schema
  if (config.currentPath.toString() === config.propertyPath?.toString()) {
    return zodToJsonSchema(zodDef.innerType._def, config);
  }

  // Otherwise, wrap in anyOf with { not: {} } for optional semantics
  const innerSchema = zodToJsonSchema(zodDef.innerType._def, {
    ...config,
    currentPath: [...config.currentPath, 'anyOf', '1']
  });

  return innerSchema
    ? { anyOf: [{ not: {} }, innerSchema] }
    : {};
}

/**
 * Processes default type schema.
 */
export function processDefaultSchema(zodDef, config) {
  return {
    ...zodToJsonSchema(zodDef.innerType._def, config),
    default: zodDef.defaultValue()
  };
}

/**
 * Processes catch type schema.
 */
export function processCatchSchema(zodDef, config) {
  return zodToJsonSchema(zodDef.innerType._def, config);
}

/**
 * Processes effects/transform type schema.
 */
export function processEffectsSchema(zodDef, config) {
  if (config.effectStrategy === 'input') {
    return zodToJsonSchema(zodDef.schema._def, config);
  }
  return {};
}

/**
 * Processes promise type schema.
 */
export function processPromiseSchema(zodDef, config) {
  return zodToJsonSchema(zodDef.type._def, config);
}

/**
 * Processes branded type schema.
 */
export function processBrandedSchema(zodDef, config) {
  return zodToJsonSchema(zodDef.type._def, config);
}

/**
 * Processes readonly type schema.
 */
export function processReadonlySchema(zodDef, config) {
  return zodToJsonSchema(zodDef.innerType._def, config);
}

/**
 * Processes pipeline type schema.
 */
export function processPipelineSchema(zodDef, config) {
  if (config.pipeStrategy === 'input') {
    return zodToJsonSchema(zodDef.in._def, config);
  }
  if (config.pipeStrategy === 'output') {
    return zodToJsonSchema(zodDef.out._def, config);
  }

  // 'all' strategy: combine both with allOf
  const inSchema = zodToJsonSchema(zodDef.in._def, {
    ...config,
    currentPath: [...config.currentPath, 'allOf', '0']
  });
  const outSchema = zodToJsonSchema(zodDef.out._def, {
    ...config,
    currentPath: [...config.currentPath, 'allOf', inSchema ? '1' : '0']
  });

  return {
    allOf: [inSchema, outSchema].filter(s => s !== undefined)
  };
}

/**
 * Processes date type schema.
 */
export function processDateSchema(zodDef, config, strategy) {
  const dateStrategy = strategy ?? config.dateStrategy;

  if (Array.isArray(dateStrategy)) {
    return {
      anyOf: dateStrategy.map((s, i) => processDateSchema(zodDef, config, s))
    };
  }

  switch (dateStrategy) {
    case 'string':
    case 'format:date-time':
      return { type: 'string', format: 'date-time' };
    case 'format:date':
      return { type: 'string', format: 'date' };
    case 'integer':
      return processDateAsInteger(zodDef, config);
  }
}

/**
 * Processes date type as unix timestamp.
 */
function processDateAsInteger(zodDef, config) {
  const schema = {
    type: 'integer',
    format: 'unix-time'
  };

  if (config.target === 'openApi3') return schema;

  for (const check of zodDef.checks || []) {
    switch (check.kind) {
      case 'min':
        setSchemaProperty(schema, 'minimum', check.value, check.message, config);
        break;
      case 'max':
        setSchemaProperty(schema, 'maximum', check.value, check.message, config);
        break;
    }
  }

  return schema;
}

// ============================================================================
// Main Conversion Functions
// ============================================================================

/**
 * Dispatches to the appropriate type handler based on Zod type name.
 *
 * @param {object} zodDef - Zod definition
 * @param {string} typeName - Zod type name
 * @param {object} config - Conversion configuration
 * @returns {object|undefined} JSON Schema
 */
function dispatchByTypeName(zodDef, typeName, config) {
  switch (typeName) {
    case 'ZodString':
      return processStringConstraints(zodDef, config);
    case 'ZodNumber':
      return processNumberConstraints(zodDef, config);
    case 'ZodObject':
      return processObjectSchema(zodDef, config);
    case 'ZodBigInt':
      return processBigIntConstraints(zodDef, config);
    case 'ZodBoolean':
      return processBooleanSchema();
    case 'ZodDate':
      return processDateSchema(zodDef, config);
    case 'ZodUndefined':
      return processNeverSchema();
    case 'ZodNull':
      return processNullSchema(config);
    case 'ZodArray':
      return processArraySchema(zodDef, config);
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return processUnionType(zodDef, config);
    case 'ZodIntersection':
      return processIntersectionSchema(zodDef, config);
    case 'ZodTuple':
      return processTupleSchema(zodDef, config);
    case 'ZodRecord':
      return processRecordSchema(zodDef, config);
    case 'ZodLiteral':
      return processLiteralSchema(zodDef, config);
    case 'ZodEnum':
      return processEnumSchema(zodDef);
    case 'ZodNativeEnum':
      return processNativeEnumSchema(zodDef);
    case 'ZodNullable':
      return processNullableType(zodDef, config);
    case 'ZodOptional':
      return processOptionalSchema(zodDef, config);
    case 'ZodMap':
      return processMapSchema(zodDef, config);
    case 'ZodSet':
      return processSetSchema(zodDef, config);
    case 'ZodLazy':
      return zodToJsonSchema(zodDef.getter()._def, config);
    case 'ZodPromise':
      return processPromiseSchema(zodDef, config);
    case 'ZodNaN':
    case 'ZodNever':
      return processNeverSchema();
    case 'ZodEffects':
      return processEffectsSchema(zodDef, config);
    case 'ZodAny':
      return processAnySchema();
    case 'ZodUnknown':
      return processUnknownSchema();
    case 'ZodDefault':
      return processDefaultSchema(zodDef, config);
    case 'ZodBranded':
      return processBrandedSchema(zodDef, config);
    case 'ZodReadonly':
      return processReadonlySchema(zodDef, config);
    case 'ZodCatch':
      return processCatchSchema(zodDef, config);
    case 'ZodPipeline':
      return processPipelineSchema(zodDef, config);
    case 'ZodFunction':
    case 'ZodVoid':
    case 'ZodSymbol':
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Adds description to schema if present in Zod definition.
 *
 * @param {object} zodDef - Zod definition
 * @param {object} config - Conversion configuration
 * @param {object} schema - JSON Schema to modify
 * @returns {object} Modified schema
 */
function addDescription(zodDef, config, schema) {
  if (zodDef.description) {
    schema.description = zodDef.description;
    if (config.markdownDescription) {
      schema.markdownDescription = zodDef.description;
    }
  }
  return schema;
}

/**
 * Main converter: Transforms a Zod schema definition to JSON Schema.
 *
 * Original: o2
 *
 * @param {object} zodDef - Zod schema definition (_def property)
 * @param {object} config - Conversion configuration
 * @param {boolean} useCustomRefs - Whether to allow custom $ref handling
 * @returns {object|undefined} JSON Schema representation
 */
export function zodToJsonSchema(zodDef, config, useCustomRefs = false) {
  // Check for previously seen definitions
  const seenEntry = config.seen.get(zodDef);

  // Allow override function to handle special cases
  if (config.override) {
    const overrideResult = config.override?.(zodDef, config, seenEntry, useCustomRefs);
    if (overrideResult !== IGNORE_OVERRIDE) {
      return overrideResult;
    }
  }

  // Handle previously seen schemas (circular references)
  if (seenEntry && !useCustomRefs) {
    const refResult = processSchemaWithCustomRefs(seenEntry, config);
    if (refResult !== undefined) {
      return refResult;
    }
  }

  // Track this definition as seen
  const entry = {
    def: zodDef,
    path: config.currentPath,
    jsonSchema: undefined
  };
  config.seen.set(zodDef, entry);

  // Dispatch to appropriate handler
  const schema = dispatchByTypeName(zodDef, zodDef.typeName, config);

  // Add description if present
  if (schema) {
    addDescription(zodDef, config, schema);
  }

  // Cache and return
  entry.jsonSchema = schema;
  return schema;
}

/**
 * Top-level entry point for generating JSON Schema from Zod schema.
 * Handles definitions, naming strategies, and $schema version.
 *
 * Original: KR
 *
 * @param {object} zodSchema - Zod schema object
 * @param {string|object} options - Schema name or full options object
 * @returns {object} Complete JSON Schema document
 */
export function generateJsonSchema(zodSchema, options) {
  const config = initializeConversionOptions(options);

  // Process named definitions
  const definitions = typeof options === 'object' && options.definitions
    ? Object.entries(options.definitions).reduce((acc, [key, defSchema]) => ({
        ...acc,
        [key]: zodToJsonSchema(defSchema._def, {
          ...config,
          currentPath: [...config.basePath, config.definitionPath, key]
        }, true) ?? {}
      }), {})
    : undefined;

  // Determine schema name from options
  const schemaName = typeof options === 'string'
    ? options
    : options?.nameStrategy === 'title'
      ? undefined
      : options?.name;

  // Convert the main schema
  const mainSchema = zodToJsonSchema(
    zodSchema._def,
    schemaName === undefined
      ? config
      : {
          ...config,
          currentPath: [...config.basePath, config.definitionPath, schemaName]
        },
    false
  ) ?? {};

  // Handle title naming strategy
  const title = typeof options === 'object' &&
                options.name !== undefined &&
                options.nameStrategy === 'title'
    ? options.name
    : undefined;

  if (title !== undefined) {
    mainSchema.title = title;
  }

  // Build final schema with definitions and $ref
  let result;

  if (schemaName === undefined) {
    result = definitions
      ? { ...mainSchema, [config.definitionPath]: definitions }
      : mainSchema;
  } else {
    result = {
      $ref: [
        ...(config.$refStrategy === 'relative' ? [] : config.basePath),
        config.definitionPath,
        schemaName
      ].join('/'),
      [config.definitionPath]: {
        ...definitions,
        [schemaName]: mainSchema
      }
    };
  }

  // Add $schema version
  if (config.target === 'jsonSchema7') {
    result.$schema = 'http://json-schema.org/draft-07/schema#';
  } else if (config.target === 'jsonSchema2019-09' || config.target === 'openAi') {
    result.$schema = 'https://json-schema.org/draft/2019-09/schema#';
  }

  // Warn about OpenAI union limitations
  if (
    config.target === 'openAi' &&
    (('anyOf' in result) || ('oneOf' in result) || ('allOf' in result) ||
     ('type' in result && Array.isArray(result.type)))
  ) {
    console.warn(
      'Warning: OpenAI may not support schemas with unions as roots! ' +
      'Try wrapping it in an object property.'
    );
  }

  return result;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  zodToJsonSchema,
  generateJsonSchema,
  convertRegexFlags,
  processSchemaWithCustomRefs,
  processNumberConstraints,
  processObjectSchema,
  processUnionType,
  processNullableType,
  processStringConstraints,
  IGNORE_OVERRIDE,
  DEFAULT_OPTIONS,
  ZOD_TO_JSON_TYPE_MAP,
  STRING_PATTERNS
};
