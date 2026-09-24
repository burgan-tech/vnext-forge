// GENERATED — do not edit. Source: vnext-schema@ac42026 schemas/schema-definition.schema.json
// Unreleased at the time of vendoring (after v0.0.53). Delete once a release carries it.
// Regenerate: see docs/superpowers/plans/2026-09-24-vnext-runtime-sync-phase-a.md Task 3.
const schema: Record<string, unknown> = 
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://unpkg.com/@burgan-tech/vnext-schema@__SCHEMA_VERSION__/schemas/schema-definition.schema.json",
    "title": "vNext Schema Definition",
    "description": "Schema for vNext Schema Component Definition JSON files (sys-schemas flow)",
    "type": "object",
    "required": [
        "key",
        "version",
        "domain",
        "flow",
        "flowVersion",
        "tags",
        "attributes"
    ],
    "properties": {
        "$schema": {
            "type": "string",
            "description": "JSON Schema reference"
        },
        "key": {
            "type": "string",
            "description": "Schema key identifier",
            "pattern": "^[a-z0-9-]+$"
        },
        "version": {
            "type": "string",
            "description": "Version in Major.Minor.Patch format",
            "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z]+\\.\\d+)?$"
        },
        "domain": {
            "type": "string",
            "description": "Domain identifier",
            "pattern": "^[a-z0-9-]+$"
        },
        "flow": {
            "type": "string",
            "description": "Flow identifier for schemas",
            "const": "sys-schemas"
        },
        "flowVersion": {
            "type": "string",
            "description": "Flow version",
            "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z]+\\.\\d+)?$"
        },
        "tags": {
            "type": "array",
            "description": "Schema tags",
            "items": {
                "type": "string"
            },
            "minItems": 1
        },
        "_comment": {
            "type": "string",
            "description": "Comment about the schema"
        },
        "attributes": {
            "type": "object",
            "description": "Schema definition attributes",
            "required": [
                "type",
                "schema"
            ],
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Free-text schema type. Only the exact value master permits x-indexed metadata."
                },
                "schema": {
                    "type": "object",
                    "description": "JSON Schema definition or vNext vocabulary document (e.g. view-vocabulary). Accepts any standard RFC JSON Schema or vNext-owned vocabulary structure.",
                    "minProperties": 1
                },
                "labels": {
                    "type": "array",
                    "description": "Multi-language labels for schema",
                    "items": {
                        "type": "object",
                        "required": [
                            "label",
                            "language"
                        ],
                        "properties": {
                            "label": {
                                "type": "string",
                                "minLength": 1
                            },
                            "language": {
                                "type": "string",
                                "pattern": "^[a-z]{2}-[A-Z]{2}$",
                                "examples": [
                                    "en-US",
                                    "tr-TR",
                                    "de-DE"
                                ]
                            }
                        }
                    }
                }
            },
            "additionalProperties": false
        }
    },
    "additionalProperties": false,
    "definitions": {
        "nonIndexedSchema": {
            "anyOf": [
                {
                    "type": "boolean"
                },
                {
                    "type": "object",
                    "not": {
                        "required": [
                            "x-indexed"
                        ]
                    },
                    "properties": {
                        "properties": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "patternProperties": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "$defs": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "definitions": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "dependentSchemas": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "additionalProperties": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "not": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "if": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "then": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "else": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "contains": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "propertyNames": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "additionalItems": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "unevaluatedProperties": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "unevaluatedItems": {
                            "$ref": "#/definitions/nonIndexedSchema"
                        },
                        "allOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "anyOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "oneOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "prefixItems": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        },
                        "items": {
                            "anyOf": [
                                {
                                    "type": "array",
                                    "items": {
                                        "$ref": "#/definitions/nonIndexedSchema"
                                    }
                                },
                                {
                                    "$ref": "#/definitions/nonIndexedSchema"
                                }
                            ]
                        }
                    }
                }
            ]
        },
        "unindexableMasterSchema": {
            "anyOf": [
                {
                    "type": "boolean"
                },
                {
                    "type": "object",
                    "properties": {
                        "properties": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "patternProperties": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "$defs": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "definitions": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "dependentSchemas": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "additionalProperties": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "not": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "if": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "then": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "else": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "contains": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "propertyNames": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "additionalItems": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "unevaluatedProperties": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "unevaluatedItems": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "allOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "anyOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "oneOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "prefixItems": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "items": {
                            "anyOf": [
                                {
                                    "type": "array",
                                    "items": {
                                        "$ref": "#/definitions/unindexableMasterSchema"
                                    }
                                },
                                {
                                    "$ref": "#/definitions/unindexableMasterSchema"
                                }
                            ]
                        },
                        "x-indexed": {
                            "type": "boolean",
                            "const": false
                        }
                    }
                }
            ]
        },
        "indexableMasterField": {
            "description": "Validate index metadata along fixed object property paths without interpreting example/default data as schemas.",
            "anyOf": [
                {
                    "type": "boolean"
                },
                {
                    "type": "object",
                    "properties": {
                        "properties": {
                            "type": "object",
                            "patternProperties": {
                                "^[a-zA-Z0-9_]+$": {
                                    "$ref": "#/definitions/indexableMasterField"
                                }
                            },
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "patternProperties": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "$defs": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "definitions": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "dependentSchemas": {
                            "type": "object",
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "additionalProperties": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "not": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "if": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "then": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "else": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "contains": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "propertyNames": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "additionalItems": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "unevaluatedProperties": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "unevaluatedItems": {
                            "$ref": "#/definitions/unindexableMasterSchema"
                        },
                        "allOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "anyOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "oneOf": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "prefixItems": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        "items": {
                            "anyOf": [
                                {
                                    "type": "array",
                                    "items": {
                                        "$ref": "#/definitions/unindexableMasterSchema"
                                    }
                                },
                                {
                                    "$ref": "#/definitions/unindexableMasterSchema"
                                }
                            ]
                        },
                        "x-indexed": {
                            "type": "boolean",
                            "description": "Opt this scalar field into manual index preparation. Supported only in an explicit root type: master schema; omission does not request an index."
                        }
                    },
                    "allOf": [
                        {
                            "if": {
                                "required": [
                                    "x-indexed"
                                ],
                                "properties": {
                                    "x-indexed": {
                                        "const": true
                                    }
                                }
                            },
                            "then": {
                                "required": [
                                    "type"
                                ],
                                "properties": {
                                    "type": {
                                        "enum": [
                                            "string",
                                            "number",
                                            "integer",
                                            "boolean"
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            "if": {
                                "anyOf": [
                                    {
                                        "required": [
                                            "$ref"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "allOf"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "anyOf"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "oneOf"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "not"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "if"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "then"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "else"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "dependentSchemas"
                                        ]
                                    }
                                ]
                            },
                            "then": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        },
                        {
                            "if": {
                                "required": [
                                    "type"
                                ],
                                "properties": {
                                    "type": {
                                        "not": {
                                            "const": "object"
                                        }
                                    }
                                }
                            },
                            "then": {
                                "properties": {
                                    "properties": {
                                        "type": "object",
                                        "additionalProperties": {
                                            "$ref": "#/definitions/unindexableMasterSchema"
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        },
        "masterIndexSchema": {
            "allOf": [
                {
                    "$ref": "#/definitions/indexableMasterField"
                },
                {
                    "properties": {
                        "x-indexed": {
                            "type": "boolean",
                            "const": false
                        },
                        "properties": {
                            "type": "object",
                            "patternProperties": {
                                "^[a-zA-Z][a-zA-Z0-9_]*$": {
                                    "$ref": "#/definitions/indexableMasterField"
                                }
                            },
                            "additionalProperties": {
                                "$ref": "#/definitions/unindexableMasterSchema"
                            }
                        }
                    }
                }
            ]
        }
    },
    "allOf": [
        {
            "if": {
                "required": [
                    "attributes"
                ],
                "properties": {
                    "attributes": {
                        "required": [
                            "type"
                        ],
                        "properties": {
                            "type": {
                                "const": "master"
                            }
                        }
                    }
                }
            },
            "else": {
                "properties": {
                    "attributes": {
                        "properties": {
                            "schema": {
                                "$ref": "#/definitions/nonIndexedSchema"
                            }
                        }
                    }
                }
            },
            "then": {
                "properties": {
                    "attributes": {
                        "properties": {
                            "schema": {
                                "$ref": "#/definitions/masterIndexSchema"
                            }
                        }
                    }
                }
            }
        }
    ]
}

export default schema
