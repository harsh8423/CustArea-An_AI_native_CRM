-- =====================================================
-- Node Improvements Migration
-- Multi-Variable Set Variable + Enhanced Switch Cases
-- =====================================================

-- 1. UPDATE SET_VARIABLE NODE
-- Change from single name/value to array of variables

UPDATE workflow_node_definitions 
SET 
  input_schema = '{
    "type": "object",
    "properties": {
      "variables": {
        "type": "array",
        "title": "Variables",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string", "title": "Variable name"},
            "value": {"type": "string", "title": "Value"}
          },
          "required": ["name", "value"]
        },
        "default": []
      }
    }
  }',
  output_schema = '{
    "type": "object",
    "description": "All set variables as key-value pairs"
  }',
  default_config = '{"variables": [{"name": "", "value": ""}]}',
  description = 'Set one or more workflow variables',
  updated_at = now()
WHERE type = 'set_variable';

-- 2. UPDATE SWITCH NODE
-- Enhanced cases with IDs, labels, and proper routing

UPDATE workflow_node_definitions 
SET 
  input_schema = '{
    "type": "object",
    "properties": {
      "variable": {
        "type": "string",
        "title": "Variable to match",
        "description": "Select the variable to evaluate"
      },
      "cases": {
        "type": "array",
        "title": "Cases",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "label": {"type": "string", "title": "Case label"},
            "value": {"type": "string", "title": "Value to match"}
          },
          "required": ["id", "label", "value"]
        }
      },
      "includeDefault": {
        "type": "boolean",
        "title": "Include default case",
        "description": "Add a default route for unmatched values",
        "default": true
      }
    },
    "required": ["variable", "cases"]
  }',
  output_schema = '{
    "type": "object",
    "properties": {
      "matched_case": {"type": "string"},
      "matched_value": {},
      "handle": {"type": "string"}
    }
  }',
  default_config = '{"variable": "", "cases": [{"id": "case_0", "label": "Case 1", "value": ""}], "includeDefault": true}',
  description = 'Multi-way branch based on a value with visual routing',
  updated_at = now()
WHERE type = 'switch';

-- Add comment
COMMENT ON TABLE workflow_node_definitions IS 'Global registry - v2 with multi-variable and enhanced switch';
