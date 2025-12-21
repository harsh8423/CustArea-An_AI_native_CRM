/**
 * Logic Nodes - Control flow and branching
 */

const { evaluateExpression } = require('../../engine/context');

// If/Else Node - Boolean branching
const if_else = {
    async execute({ config, context, log }) {
        const { condition } = config;
        
        if (!condition) {
            throw new Error('If/Else node requires a condition');
        }

        let result;
        try {
            result = evaluateExpression(condition, context);
        } catch (error) {
            await log('error', `Condition evaluation failed: ${error.message}`, { condition });
            throw error;
        }

        const branch = result ? 'true' : 'false';
        await log('info', `Condition evaluated to ${branch}`, { condition, result });

        return {
            branch,
            result,
            handle: branch // For edge routing
        };
    }
};

// Switch Node - Multi-way branching with visual routing
const switch_node = {
    async execute({ config, context, log }) {
        const { variable, cases, includeDefault = true, value: legacyValue } = config;
        
        // Support both old format (value) and new format (variable)
        const valueToMatch = variable || legacyValue;
        
        if (!valueToMatch) {
            throw new Error('Switch node requires a variable to match');
        }

        // Evaluate the variable expression
        let evaluatedValue;
        try {
            evaluatedValue = evaluateExpression(valueToMatch, context);
        } catch (error) {
            await log('error', `Value evaluation failed: ${error.message}`, { variable: valueToMatch });
            throw error;
        }

        // Find matching case
        let matchedCase = null;
        let matchedHandle = includeDefault ? 'default' : null;
        
        const casesArray = cases || [];
        
        for (let i = 0; i < casesArray.length; i++) {
            const caseItem = casesArray[i];
            // Support both new format (caseItem.value) and old format (direct value)
            const caseValue = typeof caseItem === 'object' ? caseItem.value : caseItem;
            
            if (caseValue == evaluatedValue) { // Use loose equality for type coercion
                matchedCase = typeof caseItem === 'object' 
                    ? caseItem.id || `case_${i}` 
                    : `case_${i}`;
                matchedHandle = matchedCase;
                
                await log('info', `Switch matched case: ${caseItem.label || caseValue}`, { 
                    value: evaluatedValue,
                    case: matchedCase 
                });
                break;
            }
        }

        if (!matchedCase && includeDefault) {
            await log('info', `Switch using default case`, { value: evaluatedValue });
        } else if (!matchedCase && !includeDefault) {
            await log('warn', `Switch: No case matched and no default`, { value: evaluatedValue });
        }

        return {
            branch: matchedHandle,
            handle: matchedHandle, // For edge routing - this determines which output to use
            matched_case: matchedCase,
            matched_value: evaluatedValue
        };
    }
};

// Wait/Delay Node - Pause execution
const wait = {
    async execute({ config, log }) {
        const { duration, unit } = config;
        
        if (!duration || !unit) {
            throw new Error('Wait node requires duration and unit');
        }

        // Calculate resume time
        const multipliers = {
            seconds: 1000,
            minutes: 60 * 1000,
            hours: 60 * 60 * 1000,
            days: 24 * 60 * 60 * 1000
        };

        const ms = duration * (multipliers[unit] || multipliers.minutes);
        const resumeAt = new Date(Date.now() + ms);

        await log('info', `Scheduling resume at ${resumeAt.toISOString()}`, { duration, unit });

        // Return special action to signal delay
        return {
            action: 'wait',
            resumeAt: resumeAt.toISOString(),
            duration,
            unit
        };
    }
};

// Loop Node - Iterate over array (bounded)
const loop = {
    async execute({ config, context, log }) {
        const { array, max_iterations } = config;
        const maxIter = Math.min(max_iterations || 100, 100);

        if (!array) {
            throw new Error('Loop node requires an array');
        }

        // Get the array from context
        let items;
        try {
            items = evaluateExpression(array, context);
        } catch (error) {
            await log('error', `Array evaluation failed: ${error.message}`, { array });
            throw error;
        }

        if (!Array.isArray(items)) {
            throw new Error('Loop value must be an array');
        }

        if (items.length > maxIter) {
            await log('warn', `Array truncated to ${maxIter} items`, { original: items.length });
            items = items.slice(0, maxIter);
        }

        // For now, return first item - full loop implementation needs state management
        // TODO: Implement proper iteration with state persistence
        if (items.length === 0) {
            return {
                handle: 'done',
                items: []
            };
        }

        return {
            handle: 'item',
            current_item: items[0],
            index: 0,
            is_last: items.length === 1,
            items
        };
    }
};

// Stop Node - Terminate workflow
const stop = {
    async execute({ config, log }) {
        const { reason } = config;
        
        await log('info', `Workflow stopped: ${reason || 'No reason provided'}`);

        return {
            action: 'stop',
            reason
        };
    }
};

module.exports = {
    if_else,
    switch: switch_node,
    wait,
    loop,
    stop
};
