import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import boxen from 'boxen';
import gradient from 'gradient-string';

const prefix = chalk.gray('[housekit]');

export function format(message: string) {
    return `${prefix} ${message}`;
}

export function info(message: string) {
    console.log(format(chalk.cyan(message)));
}

export function warn(message: string) {
    console.warn(format(chalk.yellow(message)));
}

export function success(message: string) {
    console.log(format(chalk.green(message)));
}

export function error(message: string) {
    console.error(format(chalk.red(message)));
}

export function bold(message: string) {
    return chalk.bold(message);
}

export function box(message: string, options: any = {}) {
    console.log(boxen(message, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        ...options
    }));
}

export function title(message: string) {
    console.log('\n' + chalk.bold(gradient(['cyan', 'blue'])(message)));
}

export function createSpinner(message: string) {
    return ora({
        text: format(message),
        spinner: 'line'
    });
}

let globalYes = false;

export function setGlobalYesMode(enabled: boolean) {
    globalYes = enabled;
}

// Check if stdin is interactive (TTY)
function isInteractive(): boolean {
    return process.stdin.isTTY === true;
}

export async function confirmPrompt(message: string, defaultYes = true) {
    if (globalYes) return true;
    
    // If not interactive (piped input), use default value
    if (!isInteractive()) {
        info(`${message} (auto-confirmed, non-interactive mode)`);
        return defaultYes;
    }
    
    const { ok } = await inquirer.prompt<{ ok: boolean }>([{
        type: 'confirm',
        name: 'ok',
        message: format(message),
        default: defaultYes
    }]);
    return ok;
}

export interface ListChoice<T = string> {
    name: string;
    value: T;
}

export async function listPrompt<T = string>(
    message: string,
    choices: ListChoice<T>[],
    defaultValue?: T
): Promise<T> {
    if (globalYes && defaultValue !== undefined) {
        return defaultValue;
    }

    if (choices.length === 0) {
        throw new Error('No choices provided to listPrompt');
    }

    // If not interactive, use default or first choice
    if (!isInteractive()) {
        const selected = defaultValue !== undefined ? defaultValue : choices[0].value;
        const selectedName = choices.find(c => c.value === selected)?.name || String(selected);
        info(`${message} → ${selectedName} (auto-selected, non-interactive mode)`);
        return selected;
    }

    // According to inquirer docs: default must be the index or value of one of the entries
    // Using index is more reliable when using objects with name/value
    const defaultIndex = defaultValue !== undefined
        ? choices.findIndex(c => c.value === defaultValue)
        : 0;

    // Use rawlist instead of list - it shows options as numbered list which is more visible
    // rawlist returns the index (1-based) when using objects with name/value
    const result = await inquirer.prompt<{ value: number | T }>([{
        type: 'rawlist',
        name: 'value',
        message: format(message),
        choices: choices,
        default: defaultIndex >= 0 ? defaultIndex + 1 : 1, // rawlist uses 1-based indexing
        pageSize: Math.min(choices.length, 10),
        loop: true
    }]);

    // Handle the result - could be index (number) or value (T) depending on inquirer version
    let finalValue: T;
    if (typeof result.value === 'number') {
        // Convert 1-based index to 0-based and get the value
        const selectedChoice = choices[result.value - 1];
        finalValue = selectedChoice ? selectedChoice.value : choices[0].value;
    } else {
        // Already the value
        finalValue = result.value as T;
    }

    return finalValue;
}

export async function inputPrompt(
    message: string,
    defaultValue?: string,
    validate?: (input: string) => boolean | string
): Promise<string> {
    if (globalYes && defaultValue !== undefined) {
        return defaultValue;
    }
    
    // If not interactive and has default, use it
    if (!isInteractive()) {
        if (defaultValue !== undefined) {
            info(`${message} → ${defaultValue} (auto-selected, non-interactive mode)`);
            return defaultValue;
        }
        throw new Error(`Input required for "${message}" but running in non-interactive mode without default value. Use -y flag with appropriate defaults.`);
    }
    
    const { value } = await inquirer.prompt<{ value: string }>([{
        type: 'input',
        name: 'value',
        message: format(message),
        default: defaultValue,
        validate: validate ? (input: string) => {
            const result = validate(input);
            return result === true ? true : result;
        } : undefined
    }]);
    return value;
}

export async function checkboxPrompt<T = string>(
    message: string,
    choices: ListChoice<T>[],
    defaultSelected?: T[]
): Promise<T[]> {
    if (globalYes && defaultSelected !== undefined) {
        return defaultSelected;
    }

    if (choices.length === 0) {
        throw new Error('No choices provided to checkboxPrompt');
    }

    // If not interactive, use default or empty array
    if (!isInteractive()) {
        const selected = defaultSelected || [];
        info(`${message} → [${selected.length} items] (auto-selected, non-interactive mode)`);
        return selected;
    }

    const defaultValues = defaultSelected || [];

    const result = await inquirer.prompt<{ value: T[] }>([{
        type: 'checkbox',
        name: 'value',
        message: format(message),
        choices: choices,
        default: defaultValues,
        pageSize: Math.min(choices.length, 10),
        loop: true
    }]);

    return result.value;
}

/**
 * Quote a name (table, column, database, etc.) with double quotes
 */
export function quoteName(name: string): string {
    return `"${name}"`;
}

/**
 * Quote a list of names, separated by commas
 */
export function quoteList(items: string[]): string {
    return items.map(quoteName).join(', ');
}

/**
 * Format a default value, detecting if it's a SQL expression or literal
 * SQL expressions (like now(), 'USD') are not quoted, literals are quoted
 */
export function quoteValue(value: string | undefined, defaultType?: string): string {
    if (!value && (!defaultType || defaultType === '')) return '—';
    if (!value && defaultType) return quoteName(defaultType);
    if (!value) return '—';

    const trimmed = value.trim();

    // If already quoted with single quotes (from CREATE TABLE), keep as is but show with double quotes for consistency
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        // Extract the inner value and quote it with double quotes
        const innerValue = trimmed.slice(1, -1);
        return quoteName(innerValue);
    }

    // If already quoted with double quotes, keep as is
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed;
    }

    // If it's a SQL expression (contains parentheses, functions, etc.), don't quote
    const isExpression =
        trimmed.includes('(') && trimmed.includes(')') ||
        trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(/);

    if (isExpression) {
        return trimmed;
    }

    // It's a literal value (number, unquoted string, etc.), quote it
    return quoteName(trimmed);
}

/**
 * Quote a comment value
 */
export function quoteComment(comment: string | undefined): string {
    if (!comment) return '—';
    return quoteName(comment);
}
