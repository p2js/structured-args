import process from "node:process";
import util from "node:util";

import { string, one_of, not_one_of, boolean, int, float, list } from "./option_types";
export { string, one_of, not_one_of, boolean, int, float, list };

/**
 * A processing function for option values.
 * See the included argument processors imported from "cl-args/option-types".
 */
export type ArgProcessor<T = string> = (arg: string) => T;

/**
 * Type representing a schema for command-line options.
 * The keys correspond to the option's primary name (which will be the one following `--`).
 */
export type Options = {
    [key: string]: {
        /** Optional one-character alias for the option.  */
        alias?: string,
        /** Option type, passed as a function that will process the option's values. */
        type: ArgProcessor<any>,
        /** 
         * Default value. Will be assigned when a flag is not passed, 
         * or for non-boolean flags passed without a value. 
         */
        default?: any,
        /** 
         * Whether the option accepts multiple values. False by default.
         * 
         * If set to true, the parser will assign every following string,
         * up to the next option or the separator `--`. 
         */
        multiple?: boolean,
        /** Label for the argument that the option can receive. Used to generate the help string. */
        arg_label?: string,
        /** Description for the option. Used to generate the help string. */
        description?: string
    }
}

type ParsedArgs<O extends Options> = {
    [K in keyof O]: ReturnType<O[K]['type']> | undefined
} & string[]

/**
 * Configuration object for the help string generator.
 */
export type HelpConfig = {
    /** Whether to only include options that have a non-empty description. `false` by default. */
    descriptions_only: boolean,
    /** 
     * Color specifier(s) for how the flag strings should be styled.
     * 
     * Use [the modifiers provided by node's `util` module](https://nodejs.org/docs/latest-v22.x/api/util.html#modifiers).
     */
    option_format: util.InspectColor | readonly util.InspectColor[],
    /** How many spaces to have in each line before the flag strings. `1` by default. */
    spaces_before_option: number,
    /** How many spaces to have in each line after the flag strings. `4` by default. */
    spaces_after_option: number
}

/**
 * Generate a string for a command-line option schema to use in a help menu.
 * @param options command-line option schema
 * @param config additional configuration for the help string
 */
export function help_string<O extends Options>(options: O, config: Partial<HelpConfig> = {}): string {
    let exclude_options_without_description = config.descriptions_only ?? false,
        spaces_before_option = " ".repeat(config.spaces_before_option ?? 1),
        spaces_after_option = " ".repeat(config.spaces_after_option ?? 4),
        option_format: ArgProcessor<string> = config.option_format === undefined ? x => x : (flag) => util.styleText(config.option_format!, flag);

    let option_strings = Object.entries(options)
        .filter(([_, { description }]) => !exclude_options_without_description || description)
        .map(([name, { alias, arg_label, description }]) => {
            name = option_format(alias ? `-${alias}, --${name}` : `    --${name}`);
            if (arg_label) name += " " + arg_label;
            return [name, description || ""];
        });

    let max_flag_length = Math.max(...option_strings.map(([name]) => name.length));

    return option_strings.map(([flag_string, description]) =>
        `${spaces_before_option}${flag_string.padEnd(max_flag_length)}${spaces_after_option}${description}`)
        .join("\n");
}

/**
 * Configuration object for the argument parser.
 */
export type ArgsConfig = {
    /** 
     * Whether to collect standalone values (not tied to an option) into the output array.
     *  
     * If set to `false`, the parser will error on any standalone values. 
     * 
     * `true` by default.
     */
    collect_values: boolean,
    /**
     * Whether to consider unknown options (not defined in the schema).
     * Unknown options are booleans if no value is passed, and strings otherwise.
     * 
     * If set to `false`, the parser will error on any unknown options.
     * 
     * `false` by default.
     */
    collect_unknown_options: boolean,
    /**
     * Whether to allow `--` by itself as delimiter between options
     * and values, or error when encountered.
     * 
     * `true` by default.
     */
    allow_double_dash_delimeter: boolean,
    /**
     * Array from which to parse arguments.
     * 
     * Set to `process.argv.slice(2)` by default.
     */
    argv: string[],
    /**
     * Custom error function, which will be called when
     * the parser enters an erroring state.
     * 
     * By default, the parser will print the error to `process.stderr`
     * and exit with a failing code.
     */
    on_error: (msg: string) => void;
}

// Standard error function
function standard_error(msg: string) {
    process.stderr.write(`Argument error: ${msg}\n`);
    process.exit(1);
}

// Helper function to determine whether a string contains a positive number-like string
// Infinity or only digits and ., optionally starting with 0o, 0x, 0b
function is_number(str: string) {
    if (str == "Infinity") return true;
    let i = 0;
    if (str[0] == "0" && (str[1] == "o" || str[1] == "x" || str[1] == "b")) {
        i = 2;
    }
    for (i; i < str.length; i++) {
        if ((str[i] >= "0" && str[i] <= "9") || str[i] == ".") continue;
        return false;
    }
    return true;
}

/**
 * Parse options given a command-line schema.
 * @param options command-line option schema
 * @param config additional configuration for argument parsing
 */
export function parse_args<O extends Options>(options: O, config: Partial<ArgsConfig> = {}): ParsedArgs<O> {
    let collect_values = config.collect_values ?? true,
        collect_unknown_options = config.collect_unknown_options ?? false,
        allow_double_dash_delimeter = config.allow_double_dash_delimeter ?? true,
        argv = config.argv ?? process.argv.slice(2),
        error = config.on_error ?? standard_error,
        next_arg_is_value = () =>
            argv[arg_index + 1] !== undefined
            && (argv[arg_index + 1][0] != "-" || (argv[arg_index + 1].length > 1 && is_number(argv[arg_index + 1].substring(1)))),
        // Current index in argv 
        arg_index = 0,
        // Whether a -- has been encountered
        double_dash_delimeter_encountered = false,
        // Output object
        out = [] as Record<string, any> & string[];

    // Populate the output object with default values
    Object.entries(options).forEach(([name, opt]) => {
        if (opt.default !== undefined) out[name] = opt.default;
    });

    while (argv[arg_index] !== undefined) {
        let arg = argv[arg_index];
        if (arg[0] != "-" || double_dash_delimeter_encountered || is_number(arg.slice(1))) {
            // Lone value, either collect or error
            if (collect_values) {
                out.push(arg);
            } else {
                error(`Unrecognised value '${arg}'`);
            }
            arg_index += 1;
            continue;
        }

        let option_name: string = "",
            option: Options[string] | undefined,
            raw_values: string[] = [];

        if (arg[1] != "-") {
            // Short-form option, enable any boolean option seen until the first non-boolean option
            if (arg.length == 1) error("Invalid flag '-'")
            for (let idx_in_arg = 1; idx_in_arg < arg.length; idx_in_arg++) {
                let alias_option = Object.keys(options).find(key => options[key].alias == arg[idx_in_arg]);
                // Always error on unrecognised aliased option
                if (alias_option === undefined) {
                    error(`Unrecognised option alias '${arg[idx_in_arg]}'`);
                    continue;
                };
                // Enable any boolean option encountered (if not explicitly set with =)
                if (options[alias_option].type == boolean() && arg[idx_in_arg + 1] != "=") {
                    out[alias_option] = true;
                    continue;
                }
                // Non-boolean option, treat the rest of the flag as the value
                option_name = alias_option;
                option = options[alias_option];
                if (++idx_in_arg == arg.length) {
                    // End of string, grab the next arg instead (if another value)
                    if (next_arg_is_value()) raw_values[0] = argv[++arg_index];
                    break;
                } else if (arg[idx_in_arg] == "=") idx_in_arg += 1; // Skip the = before a value
                raw_values[0] = arg.substring(idx_in_arg);
                break;
            }
            // If no option to process has been set, continue
            if (!option_name) {
                arg_index += 1;
                continue;
            }
        } else {
            // Check for a -- delimeter
            if (arg == "--") {
                if (allow_double_dash_delimeter) {
                    double_dash_delimeter_encountered = true;
                    arg_index += 1;
                    continue;
                } else {
                    error("-- delimiter is not allowed");
                }
            }
            // Otherwise, treat anything before a = as the name
            let option_name_end = 2;
            while ((option_name_end != arg.length) && (arg[option_name_end] != "=")) option_name_end++;
            option_name = arg.substring(2, option_name_end);
            option = options[option_name];
            if (!option && !collect_unknown_options) {
                let error_message = `Unrecognised option '${option_name}'`;
                if (Object.keys(options).find(key => options[key].alias == option_name)) {
                    error_message += `.\nDid you mean to use the alias '-${option_name}'?`;
                }
                error(error_message);
            }
            if (arg[option_name_end] == "=") {
                //  treat the rest of the string as the sole value if a = is present
                raw_values[0] = arg.substring(option_name_end + 1);
            } else if (option?.type == boolean()) {
                // Do not grab the next value if the option is boolean, just set it to the string true
                raw_values[0] = "true";
            } else if (option?.multiple) {
                // Grab values until the next option or end if specified
                while (next_arg_is_value()) raw_values.push(argv[++arg_index]);
            } else {
                // Otherwise just grab the next value
                if (next_arg_is_value()) raw_values[0] = argv[++arg_index];
            }
        }
        /**
         * If no values have been grabbed for the option (and it is not a multi-value option),
         * set it to the default or error if one was not provided (indicating a value is required)
         * 
         * If the option is unrecognised, treat it as a boolean (ie. set it to true) 
         */
        if (raw_values.length == 0 && !option?.multiple) {
            if (option?.default) {
                out[option_name] = option.default;
                arg_index += 1;
                continue;
            } else if (!option) {
                out[option_name] = true;
                arg_index += 1;
                continue;
            }
            error(`Expected a value after option '${option_name}' (Found ${arg_index + 1 >= argv.length ? "'" + argv[arg_index + 1] + "'" : "nothing"})`);
        }
        // transform options according to the type function (treating an unknown option as a string)
        let transformer = option?.type || string();
        let transformed_values;
        try {
            transformed_values = raw_values.map(v => transformer(v));
        } catch (transform_error) {
            error(`${option_name}: ` + transform_error as string + ` (Received: '${raw_values}')`);
        }
        // Set the option to the value (or values if expecting multiple)
        if (option?.multiple) {
            out[option_name] ??= [];
            out[option_name] = [...out[option_name], ...transformed_values!];
        } else {
            out[option_name] = transformed_values![0];
        }
        // out[option_name] = option?.multiple ? transformed_values : transformed_values![0];
        arg_index += 1;
    }

    return out as ParsedArgs<O>;
}