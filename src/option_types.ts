import { ArgProcessor } from ".";

const string_processor: ArgProcessor = arg => arg;
/**
 * Parse an option value as a string.
 */
export function string() {
    return string_processor;
}

/**
 * Parse an option value as a string
 * that must be one of the specified options.
 */
export function one_of(...options: string[]): ArgProcessor {
    return (arg: string) => {
        if (options.includes(arg)) {
            return arg;
        }
        throw `Must be one of: ${options.join(", ")}`;
    }
}

/**
 * Parse an option value as a string
 * that must *not* be one of the specified options.
 */
export function not_one_of(...options: string[]): ArgProcessor {
    return (arg: string) => {
        if (options.includes(arg)) {
            throw `Must not be one of: ${options.join(", ")}`;
        }
        return arg;
    }
}

const boolean_processor: ArgProcessor<boolean> = arg => {
    if (arg === "false") return false;
    if (arg === "true") return true;
    throw "expected true or false";
}

/**
 * Parse an option as a boolean, that can be
 * explicitly set as `true` or `false` using `=true`/`=false`.
 */
export function boolean() {
    return boolean_processor;
}

/**
 * Parse an option value as an integer,
 * rejecting values outside specified minimum and maximum (if provided).
 */
export function int(min = -Infinity, max = +Infinity): ArgProcessor<number> {
    return arg => {
        let int_arg = Number(arg);
        if (!isFinite(int_arg) || int_arg != Math.round(int_arg) || int_arg < min || int_arg > max) {
            throw `Must be an integer between ${min} and ${max}`;
        }
        return int_arg;
    }
}

/**
 * Parse an option value as a floating-point number,
 * rejecting values outside specified minimum and maximum (if provided).
 */
export function float(min = -Infinity, max = +Infinity): ArgProcessor<number> {
    return arg => {
        let float_arg = Number(arg);
        if (isNaN(float_arg) || float_arg < min || float_arg > max) {
            throw `Must be a number between ${min} and ${max}`;
        }
        return float_arg;
    }
}

/**
 * Parse single string values as lists of values separated by commas,
 * or a custom separator if provided.
 */
export function list(separator: string | RegExp = ","): ArgProcessor<string[]> {
    return arg => arg.split(separator);
}   
