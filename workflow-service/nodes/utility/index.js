/**
 * Utility Nodes - Helper operations
 */

const { evaluateExpression } = require('../../engine/context');

/**
 * Sanitize variable names to be valid JavaScript identifiers
 * Converts "first name" to "first_name", "my-var" to "my_var", etc.
 */
function sanitizeName(name) {
    if (!name) return name;
    return name
        .trim()
        .replace(/\s+/g, '_')           // spaces to underscores
        .replace(/[^a-zA-Z0-9_]/g, '_') // special chars to underscores
        .replace(/^(\d)/, '_$1')        // prefix if starts with number
        .replace(/_+/g, '_')            // collapse multiple underscores
        .toLowerCase();
}

// Set Variable Node - Now supports multiple variables
const set_variable = {
    async execute({ config, context, log }) {
        // Support both old format (name/value) and new format (variables array)
        let variablesToSet = [];
        
        if (config.variables && Array.isArray(config.variables)) {
            // New format: array of variables
            variablesToSet = config.variables.filter(v => v.name && v.name.trim());
        } else if (config.name) {
            // Old format: single name/value pair (backwards compatibility)
            variablesToSet = [{ name: config.name, value: config.value }];
        }
        
        if (variablesToSet.length === 0) {
            throw new Error('Set Variable requires at least one variable');
        }

        const result = {};
        
        for (const variable of variablesToSet) {
            const { name, value } = variable;
            
            // Sanitize the variable name for safe expression evaluation
            const sanitizedName = sanitizeName(name);
            
            await log('debug', `Setting variable "${name}" (as ${sanitizedName})`, { value });
            
            // Add to result
            result[sanitizedName] = value;
        }

        // Return all variables as flat object for easy access
        await log('info', `Set ${variablesToSet.length} variable(s)`, { count: variablesToSet.length });
        
        return result;
    }
};

// JSON Parser Node
const json_parser = {
    async execute({ config, context, log }) {
        const { json_string } = config;
        
        if (!json_string) {
            throw new Error('JSON Parser requires json_string');
        }

        try {
            const parsed = JSON.parse(json_string);
            await log('debug', 'JSON parsed successfully');
            return { parsed };
        } catch (error) {
            await log('error', `JSON parse failed: ${error.message}`);
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }
};

// HTTP Request Node
const http_request = {
    async execute({ config, context, log }) {
        const { url, method, headers, body } = config;
        
        if (!url || !method) {
            throw new Error('HTTP Request requires url and method');
        }

        await log('debug', `Making ${method} request to ${url}`);

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(headers || {})
            }
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            const responseBody = await response.text();
            
            let parsedBody;
            try {
                parsedBody = JSON.parse(responseBody);
            } catch {
                parsedBody = responseBody;
            }

            await log('info', `HTTP ${method} ${url} - ${response.status}`);

            return {
                status: response.status,
                body: parsedBody,
                headers: Object.fromEntries(response.headers.entries())
            };
        } catch (error) {
            await log('error', `HTTP request failed: ${error.message}`);
            throw error;
        }
    }
};

// Assert Node - Fail if condition is false
const assert = {
    async execute({ config, context, log }) {
        const { condition, error_message } = config;
        
        if (!condition) {
            throw new Error('Assert requires a condition');
        }

        let result;
        try {
            result = evaluateExpression(condition, context);
        } catch (error) {
            await log('error', `Assertion evaluation failed: ${error.message}`);
            throw error;
        }

        if (!result) {
            const message = error_message || 'Assertion failed';
            await log('error', message, { condition, result });
            throw new Error(message);
        }

        await log('debug', 'Assertion passed', { condition });

        return { passed: true };
    }
};

// Error Handler Node
const error_handler = {
    async execute({ config, context, log }) {
        const { on_error } = config;
        
        // Check if previous node had an error (this would be set by executor)
        const hadError = context._last_error !== undefined;
        const errorMessage = context._last_error || null;

        if (hadError) {
            await log('info', `Caught error: ${errorMessage}`, { on_error });
            
            if (on_error === 'stop') {
                return { action: 'stop', had_error: true, error_message: errorMessage };
            }
            
            // 'continue' or 'retry' - just pass through
        }

        return {
            had_error: hadError,
            error_message: errorMessage
        };
    }
};

module.exports = {
    set_variable,
    json_parser,
    http_request,
    assert,
    error_handler
};
