// GENERATED — do not edit. Source: vnext-schema@ac42026 schemas/workflow-definition.schema.json
// Unreleased at the time of vendoring (after v0.0.53). Delete once a release carries it.
// Regenerate: see docs/superpowers/plans/2026-09-24-vnext-runtime-sync-phase-a.md Task 3.
const schema: Record<string, unknown> = 
{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "$id": "https://unpkg.com/@burgan-tech/vnext-schema@__SCHEMA_VERSION__/schemas/workflow-definition.schema.json",
  "title": "vNext Workflow Definition",
  "description": "Schema for vNext Workflow Component Definition JSON files (sys-flows flow)",
  "type": "object",
  "required": [
    "key",
    "flow",
    "flowVersion",
    "domain",
    "version",
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
      "description": "Workflow key identifier",
      "pattern": "^[a-z0-9-]+$"
    },
    "flow": {
      "type": "string",
      "description": "Flow identifier",
      "pattern": "^[a-z0-9-]+$"
    },
    "flowVersion": {
      "type": "string",
      "description": "Flow version",
      "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z]+\\.\\d+)?$"
    },
    "domain": {
      "type": "string",
      "description": "Domain identifier",
      "pattern": "^[a-z0-9-]+$"
    },
    "version": {
      "type": "string",
      "description": "Version in Major.Minor.Patch format",
      "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z]+\\.\\d+)?$"
    },
    "tags": {
      "type": "array",
      "description": "Workflow tags",
      "items": {
        "type": "string"
      }
    },
    "_comment": {
      "type": "string",
      "description": "Comment about the workflow"
    },
    "attributes": {
      "type": "object",
      "required": [
        "type",
        "states",
        "startTransition",
        "labels"
      ],
      "properties": {
        "type": {
          "type": "string",
          "description": "Workflow type",
          "enum": [
            "C",
            "F",
            "S",
            "P"
          ],
          "enumDescriptions": [
            "Core",
            "Flow",
            "SubFlow",
            "Sub Process"
          ]
        },
        "scripts": {
          "$ref": "#/definitions/scripts"
        },
        "timeout": {
          "anyOf": [
            {
              "$ref": "#/definitions/workflowTimeout"
            },
            {
              "type": "null"
            }
          ]
        },
        "labels": {
          "type": "array",
          "description": "Multi-language labels",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        },
        "functions": {
          "type": "array",
          "description": "Functions used in the workflow",
          "items": {
            "$ref": "#/definitions/reference"
          }
        },
        "features": {
          "type": "array",
          "description": "Features (extensions) used in the workflow",
          "items": {
            "$ref": "#/definitions/reference"
          }
        },
        "sharedTransitions": {
          "type": "array",
          "description": "Shared transitions available across multiple states",
          "items": {
            "$ref": "#/definitions/sharedTransition"
          }
        },
        "extensions": {
          "type": "array",
          "description": "Extensions used in the workflow",
          "items": {
            "$ref": "#/definitions/reference"
          }
        },
        "errorBoundary": {
          "anyOf": [
            {
              "$ref": "#/definitions/errorBoundary"
            },
            {
              "type": "null"
            }
          ],
          "description": "Global error boundary for the workflow. Applied when no task or state-level boundary handles the error."
        },
        "startTransition": {
          "$ref": "#/definitions/startTransition"
        },
        "cancel": {
          "anyOf": [
            {
              "$ref": "#/definitions/cancelTransition"
            },
            {
              "type": "null"
            }
          ],
          "description": "Cancel transition definition. Only manual trigger (triggerType: 0) is allowed."
        },
        "exit": {
          "anyOf": [
            {
              "$ref": "#/definitions/exitTransition"
            },
            {
              "type": "null"
            }
          ],
          "description": "Exit transition definition. Only manual trigger (triggerType: 0) is allowed."
        },
        "updateData": {
          "anyOf": [
            {
              "$ref": "#/definitions/updateDataTransition"
            },
            {
              "type": "null"
            }
          ],
          "description": "Update  data transition definition. Only manual trigger (triggerType: 0) is allowed."
        },
        "states": {
          "type": "array",
          "description": "States in the workflow. Only one initial state (stateType: 1) is allowed.",
          "items": {
            "$ref": "#/definitions/state"
          },
          "contains": {
            "properties": {
              "stateType": {
                "const": 1
              }
            },
            "required": [
              "stateType"
            ]
          },
          "minContains": 1,
          "maxContains": 1
        },
        "schema": {
          "description": "Master schema definition for the workflow to validate the data",
          "anyOf": [
            {
              "$ref": "#/definitions/reference"
            },
            {
              "type": "null"
            }
          ]
        },
        "queryRoles": {
          "type": "array",
          "description": "Root-level query roles for instance access. Used when state has no queryRoles. DENY overrides ALLOW.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "output": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional output mapping for the workflow. Based on ScriptCode definition."
        },
        "event": {
          "anyOf": [
            {
              "$ref": "#/definitions/event"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional workflow-level event definition. When present, an external event may start a new instance of this workflow (action=start). Independent of any transition-level event."
        },
        "config": {
          "anyOf": [
            {
              "$ref": "#/definitions/workflowConfig"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional flow-level configuration container (currently function cache tuning). Null means host defaults apply."
        }
      }
    }
  },
  "definitions": {
    "resourceLockDefinition": {
      "type": "object",
      "description": "Defines a distributed resource-lock operation to be executed during a transition. The keyExpression is compiled as an ITransitionMapping and evaluated at runtime to produce the lock key.",
      "required": [
        "keyExpression",
        "action"
      ],
      "properties": {
        "keyExpression": {
          "$ref": "#/definitions/scriptCode",
          "description": "Script compiled as ITransitionMapping whose handler returns the lock key string."
        },
        "action": {
          "type": "string",
          "enum": [
            "Acquire",
            "Release",
            "Extend"
          ],
          "enumDescriptions": [
            "Acquires a distributed lock on the resource. Fails the transition if the resource is already locked by another owner.",
            "Releases a previously acquired distributed lock on the resource.",
            "Extends the TTL of an existing lock held by the same owner."
          ],
          "description": "The lock operation to perform."
        },
        "ttlSeconds": {
          "type": "integer",
          "default": 300,
          "description": "Time-to-live in seconds for Acquire and Extend operations. Acts as a safety net so abandoned locks expire automatically."
        },
        "onConflict": {
          "type": "string",
          "enum": [
            "Abort"
          ],
          "enumDescriptions": [
            "Abort the transition immediately when the lock cannot be acquired."
          ],
          "default": "Abort",
          "description": "Policy applied when the lock cannot be acquired (e.g., resource already locked)."
        }
      },
      "additionalProperties": false
    },
    "workflowConfig": {
      "type": "object",
      "description": "Flow-level configuration container. Consolidates author-controlled, workflow-scoped settings under a single config object. Null means host defaults apply.",
      "properties": {
        "functionCache": {
          "anyOf": [
            {
              "$ref": "#/definitions/functionCacheDefinition"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional author-controlled cache tuning for the built-in instance functions (data, view, schema, ...). Null means host defaults apply."
        }
      },
      "additionalProperties": false
    },
    "functionCacheDefinition": {
      "type": "object",
      "description": "Workflow-author-controlled cache tuning for the built-in instance functions (data, view, schema, ...). A single TTL covers all of them.",
      "properties": {
        "ttlSeconds": {
          "type": "integer",
          "description": "Cache TTL in seconds for this workflow's built-in function responses. Null or non-positive falls back to the host default (InstanceFunctionCache:DefaultTtlSeconds)."
        }
      },
      "additionalProperties": false
    },
    "roleGrant": {
      "type": "object",
      "required": [
        "role",
        "grant"
      ],
      "properties": {
        "role": {
          "type": "string",
          "description": "Role name (current: Amorphie roles; future: domain.rolename)"
        },
        "grant": {
          "type": "string",
          "enum": [
            "allow",
            "deny"
          ],
          "description": "DENY always overrides ALLOW"
        }
      },
      "additionalProperties": false
    },
    "availableInEntry": {
      "type": "object",
      "required": [
        "state"
      ],
      "properties": {
        "state": {
          "type": "string",
          "description": "State key this entry applies to",
          "pattern": "^[a-z0-9-]+$"
        },
        "roles": {
          "type": "array",
          "description": "Role grants that apply only while the instance is in this state. Composed with the transition's own roles as an AND: both must allow. Omit or leave empty for no additional narrowing (identical to the bare string form).",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        }
      },
      "additionalProperties": false
    },
    "availableIn": {
      "type": [
        "array",
        "null"
      ],
      "description": "States where this transition is available, independent of trigger type. Null, empty or absent means every state. Each array item is either a bare state key or an object narrowing that state to a set of role grants; the two forms may be mixed.",
      "items": {
        "oneOf": [
          {
            "type": "string",
            "pattern": "^[a-z0-9-]+$"
          },
          {
            "$ref": "#/definitions/availableInEntry"
          }
        ]
      }
    },
    "viewDefinition": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "extensions": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "loadData": {
              "type": "boolean"
            },
            "view": {
              "$ref": "#/definitions/reference"
            }
          },
          "required": [
            "view"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "rules": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/viewRule"
              },
              "minItems": 1
            },
            "default": {
              "type": "object",
              "properties": {
                "view": {
                  "$ref": "#/definitions/reference"
                },
                "extensions": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "loadData": {
                  "type": "boolean"
                }
              },
              "required": [
                "view"
              ],
              "additionalProperties": false
            }
          },
          "required": [
            "rules"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "viewRule": {
      "type": "object",
      "properties": {
        "rule": {
          "$ref": "#/definitions/scriptCode"
        },
        "view": {
          "$ref": "#/definitions/reference"
        },
        "extensions": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "loadData": {
          "type": "boolean"
        }
      },
      "required": [
        "rule",
        "view"
      ],
      "additionalProperties": false
    },
    "versionStrategy": {
      "type": "string",
      "enum": [
        "None",
        "Patch",
        "Minor",
        "Major"
      ],
      "enumDescriptions": [
        "No version update",
        "Patch version update",
        "Minor version update",
        "Major version update"
      ],
      "description": "Version strategy for updates"
    },
    "triggerType": {
      "type": "integer",
      "enum": [
        0,
        1,
        2,
        3
      ],
      "enumDescriptions": [
        "Manual trigger",
        "Automatic trigger",
        "Scheduled trigger",
        "Event trigger"
      ],
      "description": "Type of trigger for the transition"
    },
    "triggerKind": {
      "type": "integer",
      "enum": [
        0,
        10
      ],
      "enumDescriptions": [
        "Not applicable",
        "Default auto transition"
      ],
      "default": 0,
      "description": "Kind of trigger for automatic transitions"
    },
    "stateType": {
      "type": "integer",
      "enum": [
        1,
        2,
        3,
        4,
        5
      ],
      "enumDescriptions": [
        "Initial state",
        "Intermediate state",
        "Final state",
        "SubFlow state",
        "Wizard state"
      ],
      "description": "Type of workflow state"
    },
    "stateSubType": {
      "type": "integer",
      "enum": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8
      ],
      "enumDescriptions": [
        "No specific subtype",
        "Successful completion",
        "Error condition",
        "Manually terminated",
        "Temporarily suspended",
        "Busy",
        "Human",
        "Cancelled",
        "Timeout"
      ],
      "description": "Subtype of workflow state",
      "default": 0
    },
    "languageLabel": {
      "type": "object",
      "required": [
        "label",
        "language"
      ],
      "properties": {
        "label": {
          "type": "string",
          "description": "Label text"
        },
        "language": {
          "type": "string",
          "description": "Language code (ISO 639-1 with optional region code: en, en-US, tr, tr-TR)",
          "pattern": "^[a-z]{2}(-[A-Z]{2})?$"
        }
      }
    },
    "timerConfig": {
      "type": "object",
      "required": [
        "reset",
        "duration"
      ],
      "properties": {
        "reset": {
          "type": "string",
          "description": "Timer reset strategy"
        },
        "duration": {
          "type": "string",
          "description": "Duration in ISO 8601 format",
          "pattern": "^P(?=\\d|T\\d)(\\d+Y)?(\\d+M)?(\\d+D)?(T(\\d+H)?(\\d+M)?(\\d+S)?)?$"
        }
      }
    },
    "reference": {
      "description": "Generic reference - can be either explicit reference or ref",
      "oneOf": [
        {
          "type": "object",
          "description": "Explicit reference",
          "required": [
            "key",
            "domain",
            "flow",
            "version"
          ],
          "properties": {
            "key": {
              "type": "string"
            },
            "id": {
              "type": "string"
            },
            "domain": {
              "type": "string"
            },
            "flow": {
              "type": "string"
            },
            "version": {
              "type": "string"
            }
          },
          "anyOf": [
            {
              "required": [
                "key"
              ]
            },
            {
              "required": [
                "id"
              ]
            }
          ]
        },
        {
          "type": "object",
          "description": "Reference using ref",
          "required": [
            "ref"
          ],
          "properties": {
            "ref": {
              "type": "string",
              "description": "Reference to component file"
            }
          },
          "additionalProperties": false
        }
      ]
    },
    "event": {
      "type": "object",
      "description": "Event mapping for the event-workflow feature. The referenced mapping script (implements IEventMapping) turns the raw external event payload into an InstanceKey + Body.",
      "required": [
        "mapping"
      ],
      "properties": {
        "mapping": {
          "$ref": "#/definitions/scriptCode"
        }
      },
      "additionalProperties": false
    },
    "scriptCode": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "G",
            "L"
          ],
          "enumDescriptions": [
            "Global",
            "Local"
          ],
          "default": "L",
          "description": "Script type - Global or Local"
        },
        "code": {
          "description": "Script code content (string), or a sys-mappings reference when encoding is REF.",
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/definitions/mappingRef"
            }
          ]
        },
        "location": {
          "type": "string",
          "description": "Location of the script file"
        },
        "encoding": {
          "type": "string",
          "description": "Code encoding format",
          "enum": [
            "B64",
            "NAT",
            "REF"
          ],
          "default": "B64"
        },
        "scripts": {
          "$ref": "#/definitions/scripts"
        }
      },
      "additionalProperties": false,
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "G"
              }
            },
            "required": [
              "type"
            ]
          },
          "then": {
            "required": []
          },
          "else": {
            "required": [
              "code"
            ]
          }
        },
        {
          "if": {
            "properties": {
              "encoding": {
                "const": "REF"
              }
            },
            "required": [
              "encoding"
            ]
          },
          "then": {
            "required": [
              "code"
            ],
            "properties": {
              "code": {
                "$ref": "#/definitions/mappingRef"
              }
            }
          },
          "else": {
            "properties": {
              "code": {
                "type": "string"
              }
            }
          }
        }
      ]
    },
    "mappingRef": {
      "type": "object",
      "description": "Reference to a sys-mappings component.",
      "required": [
        "key",
        "version",
        "domain",
        "flow"
      ],
      "properties": {
        "key": {
          "type": "string"
        },
        "version": {
          "type": "string"
        },
        "domain": {
          "type": "string"
        },
        "flow": {
          "type": "string",
          "const": "sys-mappings"
        }
      },
      "additionalProperties": false
    },
    "scripts": {
      "type": "object",
      "description": "Helper script references and allowed assemblies for mapping execution.",
      "properties": {
        "helpers": {
          "type": "array",
          "description": "References to sys-mappings helper components.",
          "items": {
            "$ref": "#/definitions/mappingRef"
          }
        },
        "allowedAssemblies": {
          "type": "array",
          "description": "Allowed .NET assemblies for the script execution context.",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },
    "subFlow": {
      "anyOf": [
        {
          "type": "object",
          "required": [
            "type",
            "process",
            "mapping"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "S",
                "P"
              ],
              "description": "SubFlow type. S=SubFlow, P=SubProcess",
              "maxLength": 10
            },
            "process": {
              "$ref": "#/definitions/reference",
              "description": "SubFlow process reference"
            },
            "mapping": {
              "$ref": "#/definitions/scriptCode"
            },
            "viewOverrides": {
              "type": "object",
              "description": "Dictionary of view overrides for subflow views. Key is the original view key, value is the reference to the new view definition. Deprecated: use overrides.states.<state>.views / overrides.transitions.<transition>.views.",
              "patternProperties": {
                "^[a-z0-9\\-]+$": {
                  "$ref": "#/definitions/reference"
                }
              },
              "additionalProperties": false
            },
            "overrides": {
              "anyOf": [
                {
                  "$ref": "#/definitions/subFlowOverrides"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Unified override configuration (views, transition roles, state query roles, timeout). Use instead of or alongside legacy viewOverrides."
            }
          },
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ],
      "description": "Information about the sub-workflow to be called for SubFlow state type. Can be null if developer does not have a subflow definition."
    },
    "onExecuteTask": {
      "type": "object",
      "required": [
        "order",
        "task",
        "mapping"
      ],
      "properties": {
        "_comment": {
          "type": "string",
          "description": "Comment about the task"
        },
        "order": {
          "type": "integer",
          "description": "Execution order",
          "minimum": 1
        },
        "task": {
          "$ref": "#/definitions/reference"
        },
        "mapping": {
          "$ref": "#/definitions/scriptCode"
        },
        "errorBoundary": {
          "anyOf": [
            {
              "$ref": "#/definitions/errorBoundary"
            },
            {
              "type": "null"
            }
          ],
          "description": "Task-level error boundary. Provides the most specific error handling for this task."
        }
      }
    },
    "transition": {
      "type": "object",
      "required": [
        "key",
        "target",
        "versionStrategy",
        "triggerType",
        "labels"
      ],
      "allOf": [
        {
          "properties": {
            "_comment": {
              "type": "string",
              "description": "Comment about the transition"
            },
            "key": {
              "type": "string",
              "description": "Transition key",
              "pattern": "^[a-z0-9-]+$"
            },
            "target": {
              "type": "string",
              "description": "Target state key. Can be a state key or special keyword like $self",
              "pattern": "^(\\$self|[a-z0-9-]+)$"
            },
            "from": {
              "type": "string",
              "description": "Source state key (optional for shared transitions)",
              "pattern": "^[a-z0-9-]+$"
            },
            "versionStrategy": {
              "$ref": "#/definitions/versionStrategy"
            },
            "triggerType": {
              "$ref": "#/definitions/triggerType"
            },
            "triggerKind": {
              "$ref": "#/definitions/triggerKind"
            },
            "schema": {
              "anyOf": [
                {
                  "$ref": "#/definitions/reference"
                },
                {
                  "type": "null"
                }
              ]
            },
            "rule": {
              "anyOf": [
                {
                  "$ref": "#/definitions/scriptCode"
                },
                {
                  "type": "null"
                }
              ]
            },
            "timer": {
              "anyOf": [
                {
                  "$ref": "#/definitions/scriptCode"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Timer information if the transition should execute automatically"
            },
            "labels": {
              "type": "array",
              "description": "Multi-language labels",
              "minItems": 1,
              "items": {
                "$ref": "#/definitions/languageLabel"
              }
            },
            "view": {
              "$ref": "#/definitions/viewDefinition"
            },
            "onExecutionTasks": {
              "type": "array",
              "description": "Tasks to execute during transition",
              "items": {
                "$ref": "#/definitions/onExecuteTask"
              }
            },
            "mapping": {
              "anyOf": [
                {
                  "$ref": "#/definitions/scriptCode"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Input mapping for the transition"
            },
            "roles": {
              "type": "array",
              "description": "Transition roles for authorization. DENY overrides ALLOW; default DENY when no match.",
              "items": {
                "$ref": "#/definitions/roleGrant"
              }
            },
            "annotations": {
              "anyOf": [
                {
                  "$ref": "#/definitions/annotations"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Key-value annotations for the transition"
            },
            "event": {
              "anyOf": [
                {
                  "$ref": "#/definitions/event"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Optional transition-level event definition. When present, this transition can also be triggered by an external event (action=transition). Required when triggerType is Event (3)."
            },
            "resourceLock": {
              "anyOf": [
                {
                  "$ref": "#/definitions/resourceLockDefinition"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Optional distributed resource-lock operation executed during this transition. Valid only for start, state-level, and shared transitions."
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 1
              },
              "triggerKind": {
                "const": 10
              }
            }
          },
          "then": {
            "properties": {
              "rule": {
                "anyOf": [
                  {
                    "$ref": "#/definitions/scriptCode"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "timer": {
                "type": "null"
              },
              "schema": {
                "type": "null"
              },
              "view": {
                "type": "null"
              },
              "mapping": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 1
              }
            },
            "not": {
              "properties": {
                "triggerKind": {
                  "const": 10
                }
              }
            }
          },
          "then": {
            "required": [
              "rule"
            ],
            "properties": {
              "rule": {
                "$ref": "#/definitions/scriptCode"
              },
              "timer": {
                "type": "null"
              },
              "schema": {
                "type": "null"
              },
              "view": {
                "type": "null"
              },
              "mapping": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 2
              }
            }
          },
          "then": {
            "required": [
              "timer"
            ],
            "properties": {
              "timer": {
                "$ref": "#/definitions/scriptCode"
              },
              "rule": {
                "type": "null"
              },
              "schema": {
                "type": "null"
              },
              "view": {
                "type": "null"
              },
              "mapping": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "anyOf": [
                  {
                    "const": 0
                  },
                  {
                    "const": 3
                  }
                ]
              }
            }
          },
          "then": {
            "properties": {
              "timer": {
                "type": "null"
              },
              "rule": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 0
              }
            }
          },
          "then": {
            "properties": {
              "view": {
                "anyOf": [
                  {
                    "$ref": "#/definitions/viewDefinition"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            }
          },
          "else": {
            "properties": {
              "view": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 3
              }
            },
            "required": [
              "triggerType"
            ]
          },
          "then": {
            "required": [
              "event"
            ]
          }
        }
      ]
    },
    "sharedTransition": {
      "type": "object",
      "required": [
        "key",
        "target",
        "versionStrategy",
        "triggerType",
        "labels"
      ],
      "allOf": [
        {
          "properties": {
            "_comment": {
              "type": "string",
              "description": "Comment about the shared transition"
            },
            "key": {
              "type": "string",
              "description": "Transition key",
              "pattern": "^[a-z0-9-]+$"
            },
            "target": {
              "type": "string",
              "description": "Target state key. Can be a state key or special keyword like $self",
              "pattern": "^(\\$self|[a-z0-9-]+)$"
            },
            "from": {
              "type": "string",
              "description": "Source state key (optional for shared transitions)",
              "pattern": "^[a-z0-9-]+$"
            },
            "versionStrategy": {
              "$ref": "#/definitions/versionStrategy"
            },
            "triggerType": {
              "type": "integer",
              "enum": [
                0,
                2,
                3
              ],
              "description": "Trigger type for shared transitions: Manual (0), Scheduled (2), Event (3)"
            },
            "availableIn": {
              "$ref": "#/definitions/availableIn"
            },
            "roles": {
              "type": "array",
              "description": "Transition roles for authorization. DENY overrides ALLOW; default DENY when no match.",
              "items": {
                "$ref": "#/definitions/roleGrant"
              }
            },
            "schema": {
              "anyOf": [
                {
                  "$ref": "#/definitions/reference"
                },
                {
                  "type": "null"
                }
              ]
            },
            "rule": {
              "anyOf": [
                {
                  "$ref": "#/definitions/scriptCode"
                },
                {
                  "type": "null"
                }
              ]
            },
            "timer": {
              "anyOf": [
                {
                  "$ref": "#/definitions/scriptCode"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Timer information if the transition should execute automatically"
            },
            "labels": {
              "type": "array",
              "description": "Multi-language labels",
              "minItems": 1,
              "items": {
                "$ref": "#/definitions/languageLabel"
              }
            },
            "view": {
              "$ref": "#/definitions/viewDefinition"
            },
            "onExecutionTasks": {
              "type": "array",
              "description": "Tasks to execute during transition",
              "items": {
                "$ref": "#/definitions/onExecuteTask"
              }
            },
            "mapping": {
              "anyOf": [
                {
                  "$ref": "#/definitions/scriptCode"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Input mapping for the transition"
            },
            "annotations": {
              "anyOf": [
                {
                  "$ref": "#/definitions/annotations"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Key-value annotations for the transition"
            },
            "event": {
              "anyOf": [
                {
                  "$ref": "#/definitions/event"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Optional transition-level event definition. When present, this shared transition can also be triggered by an external event (action=transition). Required when triggerType is Event (3)."
            },
            "resourceLock": {
              "anyOf": [
                {
                  "$ref": "#/definitions/resourceLockDefinition"
                },
                {
                  "type": "null"
                }
              ],
              "description": "Optional distributed resource-lock operation executed during this transition. Valid only for start, state-level, and shared transitions."
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 2
              }
            }
          },
          "then": {
            "required": [
              "timer"
            ],
            "properties": {
              "timer": {
                "$ref": "#/definitions/scriptCode"
              },
              "rule": {
                "type": "null"
              },
              "schema": {
                "type": "null"
              },
              "view": {
                "type": "null"
              },
              "mapping": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "anyOf": [
                  {
                    "const": 0
                  },
                  {
                    "const": 3
                  }
                ]
              }
            }
          },
          "then": {
            "properties": {
              "timer": {
                "type": "null"
              },
              "rule": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 0
              }
            }
          },
          "then": {
            "properties": {
              "view": {
                "$ref": "#/definitions/viewDefinition"
              }
            }
          },
          "else": {
            "properties": {
              "view": {
                "type": "null"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "triggerType": {
                "const": 3
              }
            },
            "required": [
              "triggerType"
            ]
          },
          "then": {
            "required": [
              "event"
            ]
          }
        }
      ]
    },
    "startTransition": {
      "type": "object",
      "required": [
        "key",
        "target",
        "triggerType",
        "versionStrategy",
        "labels"
      ],
      "properties": {
        "key": {
          "type": "string",
          "description": "Transition key",
          "pattern": "^[a-z0-9-]+$"
        },
        "target": {
          "type": "string",
          "description": "Target state key (must be an Initial state)",
          "pattern": "^[a-z0-9-]+$"
        },
        "triggerType": {
          "type": "integer",
          "const": 0,
          "description": "Start transition must be manual trigger only"
        },
        "versionStrategy": {
          "$ref": "#/definitions/versionStrategy"
        },
        "labels": {
          "type": "array",
          "description": "Multi-language labels",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        },
        "onExecutionTasks": {
          "type": "array",
          "description": "Tasks to execute during transition",
          "items": {
            "$ref": "#/definitions/onExecuteTask"
          }
        },
        "mapping": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ],
          "description": "Input mapping for the transition"
        },
        "roles": {
          "type": "array",
          "description": "Transition roles for authorization. DENY overrides ALLOW; default DENY when no match.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/reference"
            },
            {
              "type": "null"
            }
          ]
        },
        "resourceLock": {
          "anyOf": [
            {
              "$ref": "#/definitions/resourceLockDefinition"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional distributed resource-lock operation executed during this transition. Valid only for start, state-level, and shared transitions."
        }
      },
      "additionalProperties": false
    },
    "cancelTransition": {
      "type": "object",
      "required": [
        "key",
        "target",
        "versionStrategy",
        "triggerType",
        "labels"
      ],
      "properties": {
        "_comment": {
          "type": "string",
          "description": "Comment about the cancel transition"
        },
        "key": {
          "type": "string",
          "description": "Cancel transition key",
          "pattern": "^[a-z0-9-]+$"
        },
        "target": {
          "type": "string",
          "description": "Target state key when cancel is executed",
          "pattern": "^(\\$self|[a-z0-9-]+)$"
        },
        "from": {
          "type": "string",
          "description": "Source state key",
          "pattern": "^[a-z0-9-]+$"
        },
        "versionStrategy": {
          "$ref": "#/definitions/versionStrategy"
        },
        "triggerType": {
          "type": "integer",
          "const": 0,
          "description": "Cancel transition must be manual trigger only"
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/reference"
            },
            {
              "type": "null"
            }
          ],
          "description": "Data schema reference that must be sent to execute the cancel transition"
        },
        "labels": {
          "type": "array",
          "description": "Multi-language cancel transition labels",
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        },
        "view": {
          "$ref": "#/definitions/viewDefinition"
        },
        "onExecutionTasks": {
          "type": "array",
          "description": "Tasks to execute during cancel transition",
          "items": {
            "$ref": "#/definitions/onExecuteTask"
          }
        },
        "mapping": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional mapping definition for cancel transition input data transformation"
        },
        "availableIn": {
          "$ref": "#/definitions/availableIn"
        },
        "roles": {
          "type": "array",
          "description": "Transition roles for authorization. DENY overrides ALLOW; default DENY when no match.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "annotations": {
          "anyOf": [
            {
              "$ref": "#/definitions/annotations"
            },
            {
              "type": "null"
            }
          ],
          "description": "Key-value annotations for the cancel transition"
        }
      },
      "additionalProperties": false
    },
    "exitTransition": {
      "type": "object",
      "required": [
        "key",
        "target",
        "versionStrategy",
        "triggerType",
        "labels"
      ],
      "properties": {
        "_comment": {
          "type": "string",
          "description": "Comment about the exit transition"
        },
        "key": {
          "type": "string",
          "description": "Exit transition key",
          "pattern": "^[a-z0-9-]+$"
        },
        "target": {
          "type": "string",
          "description": "Target state key when exit is executed",
          "pattern": "^(\\$self|[a-z0-9-]+)$"
        },
        "from": {
          "type": "string",
          "description": "Source state key",
          "pattern": "^[a-z0-9-]+$"
        },
        "versionStrategy": {
          "$ref": "#/definitions/versionStrategy"
        },
        "triggerType": {
          "type": "integer",
          "const": 0,
          "description": "Exit transition must be manual trigger only"
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/reference"
            },
            {
              "type": "null"
            }
          ],
          "description": "Data schema reference that must be sent to execute the exit transition"
        },
        "labels": {
          "type": "array",
          "description": "Multi-language exit transition labels",
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        },
        "view": {
          "$ref": "#/definitions/viewDefinition"
        },
        "onExecutionTasks": {
          "type": "array",
          "description": "Tasks to execute during exit transition",
          "items": {
            "$ref": "#/definitions/onExecuteTask"
          }
        },
        "mapping": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional mapping definition for exit transition input data transformation"
        },
        "availableIn": {
          "$ref": "#/definitions/availableIn"
        },
        "roles": {
          "type": "array",
          "description": "Transition roles for authorization. DENY overrides ALLOW; default DENY when no match.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "annotations": {
          "anyOf": [
            {
              "$ref": "#/definitions/annotations"
            },
            {
              "type": "null"
            }
          ],
          "description": "Key-value annotations for the exit transition"
        }
      },
      "additionalProperties": false
    },
    "updateDataTransition": {
      "type": "object",
      "required": [
        "key",
        "target",
        "versionStrategy",
        "triggerType",
        "labels"
      ],
      "properties": {
        "_comment": {
          "type": "string",
          "description": "Comment about the update data transition"
        },
        "key": {
          "type": "string",
          "description": "Update data transition key",
          "pattern": "^[a-z0-9-]+$"
        },
        "target": {
          "type": "string",
          "const": "$self",
          "description": "Target state key when update data is executed (must be $self)"
        },
        "from": {
          "type": "string",
          "description": "Source state key",
          "pattern": "^[a-z0-9-]+$"
        },
        "versionStrategy": {
          "$ref": "#/definitions/versionStrategy"
        },
        "triggerType": {
          "type": "integer",
          "const": 0,
          "description": "update data transition must be manual trigger only"
        },
        "schema": {
          "anyOf": [
            {
              "$ref": "#/definitions/reference"
            },
            {
              "type": "null"
            }
          ],
          "description": "Data schema reference that must be sent to execute the update data transition"
        },
        "labels": {
          "type": "array",
          "description": "Multi-language update data transition labels",
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        },
        "view": {
          "$ref": "#/definitions/viewDefinition"
        },
        "onExecutionTasks": {
          "type": "array",
          "description": "Tasks to execute during update data transition",
          "items": {
            "$ref": "#/definitions/onExecuteTask"
          }
        },
        "mapping": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional mapping definition for update data transition input data transformation"
        },
        "availableIn": {
          "$ref": "#/definitions/availableIn"
        },
        "roles": {
          "type": "array",
          "description": "Transition roles for authorization. DENY overrides ALLOW; default DENY when no match.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "annotations": {
          "anyOf": [
            {
              "$ref": "#/definitions/annotations"
            },
            {
              "type": "null"
            }
          ],
          "description": "Key-value annotations for the update data transition"
        }
      },
      "additionalProperties": false
    },
    "state": {
      "type": "object",
      "required": [
        "key",
        "stateType",
        "versionStrategy",
        "labels"
      ],
      "if": {
        "properties": {
          "stateType": {
            "const": 5
          }
        }
      },
      "then": {
        "properties": {
          "transitions": {
            "type": "array",
            "maxItems": 1
          }
        }
      },
      "properties": {
        "_comment": {
          "type": "string",
          "description": "Comment about the state"
        },
        "key": {
          "type": "string",
          "description": "State key",
          "pattern": "^[a-z0-9-]+$"
        },
        "stateType": {
          "$ref": "#/definitions/stateType"
        },
        "subType": {
          "$ref": "#/definitions/stateSubType"
        },
        "versionStrategy": {
          "$ref": "#/definitions/versionStrategy"
        },
        "labels": {
          "type": "array",
          "description": "Multi-language labels",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        },
        "view": {
          "$ref": "#/definitions/viewDefinition"
        },
        "subFlow": {
          "anyOf": [
            {
              "$ref": "#/definitions/subFlow"
            },
            {
              "type": "null"
            }
          ]
        },
        "transitions": {
          "type": "array",
          "description": "Transitions from this state",
          "items": {
            "$ref": "#/definitions/transition"
          }
        },
        "onEntries": {
          "type": "array",
          "description": "Tasks to execute when entering the state",
          "items": {
            "$ref": "#/definitions/onExecuteTask"
          }
        },
        "onExits": {
          "type": "array",
          "description": "Tasks to execute when exiting the state",
          "items": {
            "$ref": "#/definitions/onExecuteTask"
          }
        },
        "errorBoundary": {
          "anyOf": [
            {
              "$ref": "#/definitions/errorBoundary"
            },
            {
              "type": "null"
            }
          ],
          "description": "State-level error boundary. Applied when no task-level boundary handles the error."
        },
        "queryRoles": {
          "type": "array",
          "description": "State-level query roles for instance access. Overrides root queryRoles when present. DENY overrides ALLOW.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "alias": {
          "type": "array",
          "description": "Optional role-scoped aliases for the state. Each alias provides alternative multi-language labels for a state, shown to users matching the alias roles.",
          "items": {
            "$ref": "#/definitions/stateAlias"
          }
        },
        "interaction": {
          "anyOf": [
            {
              "$ref": "#/definitions/interaction"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional state interaction configuration (e.g. long polling)."
        },
        "notifications": {
          "type": "array",
          "description": "Notification definitions attached to this state.",
          "items": {
            "$ref": "#/definitions/stateNotification"
          }
        }
      }
    },
    "stateAlias": {
      "type": "object",
      "description": "Role-scoped alias for a state, providing alternative multi-language labels for users matching the given roles.",
      "required": [
        "name",
        "roles",
        "labels"
      ],
      "properties": {
        "name": {
          "type": "string",
          "description": "Alias name"
        },
        "roles": {
          "type": "array",
          "description": "Roles for which this alias applies. DENY overrides ALLOW.",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "labels": {
          "type": "array",
          "description": "Multi-language labels for the alias",
          "minItems": 1,
          "items": {
            "$ref": "#/definitions/languageLabel"
          }
        }
      },
      "additionalProperties": false
    },
    "errorAction": {
      "type": "integer",
      "enum": [
        0,
        1,
        2,
        3,
        4,
        5
      ],
      "enumDescriptions": [
        "Abort (0) - Abort execution. Transition must not be set.",
        "Retry (1) - Retry with configured retry policy. RetryPolicy is required.",
        "Rollback (2) - Rollback to compensation state. Transition is required (transition key).",
        "Ignore (3) - Ignore error and continue",
        "Notify (4) - Send notification and transition. Transition is required (transition key).",
        "Log (5) - Log only, does not affect flow"
      ],
      "description": "Action to take when an error is caught by an error boundary. Constraint: Abort → no transition; Retry → retryPolicy required; Rollback/Notify → transition required."
    },
    "backoffType": {
      "type": "integer",
      "enum": [
        0,
        1
      ],
      "enumDescriptions": [
        "Fixed - Fixed delay between retries",
        "Exponential - Exponential backoff between retries"
      ],
      "default": 1,
      "description": "Backoff strategy for retry operations"
    },
    "retryPolicy": {
      "type": "object",
      "description": "Configures retry behavior for error handling. Required when error action is Retry. InitialDelay must be a positive duration; MaxDelay must be greater than or equal to InitialDelay. For BackoffType Exponential, backoffMultiplier must be greater than 0.",
      "required": [
        "initialDelay"
      ],
      "properties": {
        "maxRetries": {
          "type": "integer",
          "description": "Maximum number of retry attempts (0 or greater; values above 100 are discouraged)",
          "minimum": 0,
          "default": 3
        },
        "initialDelay": {
          "type": "string",
          "description": "Initial delay before first retry (ISO 8601 duration). Must be greater than zero.",
          "pattern": "^P(?=\\d|T\\d)(\\d+Y)?(\\d+M)?(\\d+D)?(T(\\d+H)?(\\d+M)?(\\d+(\\.\\d+)?S)?)?$"
        },
        "backoffType": {
          "$ref": "#/definitions/backoffType"
        },
        "backoffMultiplier": {
          "type": "number",
          "description": "Multiplier for exponential backoff",
          "minimum": 1,
          "default": 2.0
        },
        "maxDelay": {
          "type": "string",
          "description": "Maximum delay between retries (ISO 8601 duration). Must be greater than or equal to initialDelay.",
          "pattern": "^P(?=\\d|T\\d)(\\d+Y)?(\\d+M)?(\\d+D)?(T(\\d+H)?(\\d+M)?(\\d+(\\.\\d+)?S)?)?$"
        },
        "useJitter": {
          "type": "boolean",
          "description": "Whether to add random jitter to retry delays",
          "default": true
        }
      }
    },
    "errorHandlerRule": {
      "type": "object",
      "description": "A single error handling rule within an error boundary",
      "required": [
        "action"
      ],
      "if": {
        "properties": {
          "action": {
            "const": 0
          }
        },
        "required": [
          "action"
        ]
      },
      "then": {
        "properties": {
          "transition": {
            "maxLength": 0
          }
        },
        "description": "When action is Abort (0), transition must not be set (backend will reject non-empty transition)."
      },
      "properties": {
        "action": {
          "$ref": "#/definitions/errorAction"
        },
        "errorTypes": {
          "type": "array",
          "description": "Exception type names to match (e.g., ValidationException). Omit or use '*' to match all. Items must not be empty or whitespace.",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "errorCodes": {
          "type": "array",
          "description": "Error codes to match (e.g., 'Task:400007', '500'). Omit or use '*' to match all. Items must not be empty or whitespace.",
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "transition": {
          "type": "string",
          "description": "Workflow transition key to trigger when this rule matches. Required when action is Notify or Rollback. Must not be set when action is Abort. Must reference a valid transition key (StartTransition, Cancel, SharedTransitions, or state transition key)."
        },
        "priority": {
          "type": "integer",
          "description": "Rule priority. Lower values evaluated first. Must be greater than 0. Default 100; use higher values (e.g. 999) for wildcard/fallback rules. Duplicate priorities are allowed but unique values are recommended for deterministic matching.",
          "minimum": 1,
          "default": 100
        },
        "retryPolicy": {
          "$ref": "#/definitions/retryPolicy"
        },
        "logOnly": {
          "type": "boolean",
          "description": "If true, only logs the error without affecting execution flow",
          "default": false
        }
      }
    },
    "timeoutPolicy": {
      "type": "object",
      "description": "Timeout-specific error handling policy. When action is Retry, defaultRetryPolicy is required. Transition must not be set when action is Abort. Transition must reference a valid workflow state key.",
      "if": {
        "properties": {
          "action": {
            "const": 0
          }
        },
        "required": [
          "action"
        ]
      },
      "then": {
        "properties": {
          "transition": {
            "maxLength": 0
          }
        },
        "description": "When action is Abort (0), transition must not be set (backend will reject non-empty transition)."
      },
      "properties": {
        "action": {
          "$ref": "#/definitions/errorAction"
        },
        "defaultRetryPolicy": {
          "$ref": "#/definitions/retryPolicy"
        },
        "transition": {
          "type": "string",
          "description": "State key to transition to on timeout. Must match a workflow state key. Must not be set when action is Abort."
        }
      }
    },
    "errorBoundary": {
      "type": "object",
      "description": "Container for error handling policies. Used at workflow level (global), state level, and on task execution (OnExecuteTask, OnEntry, OnExit). OnError rules are evaluated by effective priority (lower first); duplicate priorities are discouraged. OnTimeout applies when the operation times out.",
      "properties": {
        "onError": {
          "type": "array",
          "description": "Error handling rules evaluated in priority order (lower value first). Rule transition references workflow transition keys. Empty array is valid (no error rules).",
          "items": {
            "$ref": "#/definitions/errorHandlerRule"
          }
        },
        "onTimeout": {
          "$ref": "#/definitions/timeoutPolicy"
        }
      }
    },
    "workflowTimeout": {
      "type": "object",
      "description": "Timeout configuration for the workflow",
      "required": [
        "key",
        "target",
        "versionStrategy",
        "timer"
      ],
      "properties": {
        "_comment": {
          "type": "string",
          "description": "Comment about the timeout"
        },
        "key": {
          "type": "string",
          "description": "Timeout key identifier",
          "pattern": "^[a-z0-9-]+$"
        },
        "target": {
          "type": "string",
          "description": "Target state for timeout",
          "pattern": "^(\\$self|[a-z0-9-]+)$"
        },
        "versionStrategy": {
          "$ref": "#/definitions/versionStrategy"
        },
        "timer": {
          "$ref": "#/definitions/timerConfig"
        },
        "mapping": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional mapping script for dynamic timeout duration calculation. When provided, the script is executed at runtime to determine the timeout schedule. If the mapping fails, the static timer duration is used as fallback."
        },
        "annotations": {
          "anyOf": [
            {
              "$ref": "#/definitions/annotations"
            },
            {
              "type": "null"
            }
          ],
          "description": "Key-value annotations for the timeout, surfaced on the state function's timeout block for client UI context. A subFlow.overrides.timeout replaces the child's timeout as a whole, annotations included."
        }
      }
    },
    "subFlowLongPollOverride": {
      "type": "object",
      "description": "Parent override of a child state's interaction.longPoll. Field-level: omitted fields keep the child's value. terminate and rule are not overridable.",
      "properties": {
        "fallbackTimeoutSeconds": {
          "type": "integer",
          "minimum": 1,
          "description": "Acknowledge fallback window in seconds."
        },
        "roles": {
          "type": "array",
          "description": "Replaces the child's long-poll role grants as a whole list. Empty admits every caller. Ignored when the child uses a rule.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        }
      },
      "additionalProperties": false
    },
    "subFlowTransitionOverride": {
      "type": "object",
      "description": "Per-transition override configuration for a subflow. Replaces transition roles, view swaps.",
      "properties": {
        "roles": {
          "type": "array",
          "description": "Transition role overrides. DENY always overrides ALLOW.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "views": {
          "type": "object",
          "description": "View swap for this child transition. Key is the view key the child's rules selected; value is the replacement view.",
          "patternProperties": {
            "^[a-z0-9\\-]+$": {
              "$ref": "#/definitions/reference"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "subFlowStateOverride": {
      "type": "object",
      "description": "Per-state override configuration for a subflow: query roles (replace), long-poll (field-level), view swaps.",
      "properties": {
        "queryRoles": {
          "type": "array",
          "description": "State query role overrides. DENY always overrides ALLOW.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "interaction": {
          "type": "object",
          "description": "Field-level override of the child state's interaction.",
          "properties": {
            "longPoll": {
              "$ref": "#/definitions/subFlowLongPollOverride"
            }
          },
          "additionalProperties": false
        },
        "views": {
          "type": "object",
          "description": "View swap for this child state. Key is the view key the child's rules selected; value is the replacement view.",
          "patternProperties": {
            "^[a-z0-9\\-]+$": {
              "$ref": "#/definitions/reference"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "subFlowOverrides": {
      "type": "object",
      "description": "Unified override configuration for a subflow. All overrides use replace mode.",
      "properties": {
        "views": {
          "type": "object",
          "description": "Dictionary of view overrides. Key is the original view key, value is the new view reference. Deprecated: use overrides.states.<state>.views / overrides.transitions.<transition>.views.",
          "patternProperties": {
            "^[a-z0-9\\-]+$": {
              "$ref": "#/definitions/reference"
            }
          },
          "additionalProperties": false
        },
        "transitions": {
          "type": "object",
          "description": "Dictionary of transition overrides. Key is the transition key.",
          "patternProperties": {
            "^[a-z0-9\\-]+$": {
              "$ref": "#/definitions/subFlowTransitionOverride"
            }
          },
          "additionalProperties": false
        },
        "states": {
          "type": "object",
          "description": "Dictionary of state overrides. Key is the state key.",
          "patternProperties": {
            "^[a-z0-9\\-]+$": {
              "$ref": "#/definitions/subFlowStateOverride"
            }
          },
          "additionalProperties": false
        },
        "timeout": {
          "anyOf": [
            {
              "$ref": "#/definitions/workflowTimeout"
            },
            {
              "type": "null"
            }
          ],
          "description": "Timeout override for the subflow."
        }
      },
      "additionalProperties": false
    },
    "annotations": {
      "type": "object",
      "description": "Key-value annotations (transitions and the workflow timeout). Pure passthrough metadata for client UI context; the runtime does not interpret values. Use namespaced keys, e.g. ui/priority.",
      "additionalProperties": {
        "type": "string"
      }
    },
    "interaction": {
      "type": "object",
      "description": "State interaction configuration.",
      "properties": {
        "longPoll": {
          "$ref": "#/definitions/longPoll"
        }
      },
      "additionalProperties": false
    },
    "longPoll": {
      "type": "object",
      "description": "Long polling configuration for the state. The runtime keeps the request open until a transition occurs or the fallback timeout elapses. Authorization is exactly one of two mutually exclusive arms: role grants ('roles') or a condition rule ('rule') — never both.",
      "required": [
        "terminate"
      ],
      "properties": {
        "terminate": {
          "type": "boolean",
          "description": "Whether the long poll terminates the open request when the state is left."
        },
        "fallbackTimeoutSeconds": {
          "type": "integer",
          "minimum": 1,
          "description": "Maximum number of seconds to hold the request open before falling back."
        },
        "roles": {
          "type": "array",
          "description": "Roles allowed to use the long poll interaction. DENY overrides ALLOW. Mutually exclusive with 'rule'.",
          "items": {
            "$ref": "#/definitions/roleGrant"
          }
        },
        "rule": {
          "$ref": "#/definitions/scriptCode",
          "description": "Condition script (IConditionMapping, true/false) deciding per caller whether the interaction applies — the rule-based alternative to 'roles'. At most one rule per interaction. A false, throwing, or non-compiling rule denies (fail-closed) on both the state signal and the acknowledge endpoint."
        }
      },
      "oneOf": [
        {
          "required": ["roles"],
          "not": { "required": ["rule"] }
        },
        {
          "required": ["rule"],
          "not": { "required": ["roles"] }
        }
      ],
      "additionalProperties": false
    },
    "stateNotification": {
      "type": "object",
      "description": "Notification configuration attached to a state.",
      "required": [
        "type",
        "mapping"
      ],
      "properties": {
        "type": {
          "type": "integer",
          "enum": [
            0
          ],
          "enumDescriptions": [
            "State"
          ],
          "description": "Notification type. Currently only State (0) is supported."
        },
        "mapping": {
          "$ref": "#/definitions/scriptCode"
        },
        "rule": {
          "anyOf": [
            {
              "$ref": "#/definitions/scriptCode"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "additionalProperties": false
    }
  }
}

export default schema
