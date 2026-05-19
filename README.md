# structured-args

A feature-complete, type safe and highly flexible command line argument parsing library for JavaScript.

```ts
import { parse_args, boolean, string } from "structured-args";

const args = parse_args({
    verbose: { alias: "v", type: boolean() },
    name: { alias: "n", type: string(), default: "world" }
});

console.log(`Hello, ${args.name}!`);
if (args.verbose) console.log("Verbose mode enabled.");
```

```bash
$ node index.js -v=false --name CLI
Hello, CLI!
```

## Table of contents

- [Argument parsing features](#argument-parsing-features)
    - [Option configuration](#option-configuration)
    - [Error handling](#error-handling)
    - [Configuration](#configuration)
    - [Custom option types](#custom-option-types)
- [Help menu generation](#help-menu-generation)
    - [Help configuration](#help-configuration)

## Argument parsing features

The library's argument parsing supports:

- Bundling short options with `-` (where all options except for the last one must be boolean)
- `getopt` style short options immediately followed by their value, eg `-O3` or `-ifile.js`
- Assigning values with a `=` sign, eg `--letter=a`
- Using a standalone `--` to delimit options and values
- Treating negative numbers as values rather than flags (including `Infinity` and `-Infinity`)
- Optionally accepting multiple values for an option, which are joined if the flag is passed more than once
- Automatic type conversion and validation via option-type processors
- Collecting positional arguments (standalone values) into the output array

The output object of `parse_args` is an array with the numeric indices corresponding to the standalone positional arguments, and additional fields for options that were passed (or that have a default value).

```ts
const args = parse_args({
    recursive: { alias: "r", type: boolean() },
    depth: { type: int(), default: 1 }
});

console.log(args[0]);
console.log(args.recursive);
```
```bash
$ node index.js -r --depth 3 path/to/dir
'path/to/dir'
true
```

### Option configuration

Specific options can be customised to accept multiple values, have a default when a value is not provided, or given custom types using processor functions.

```ts
import { parse_args, int, list, boolean } from "structured-args";

const options = {
    port: { alias: "p", type: int(1, 65535), default: 8080 },
    tags: { type: string(), multiple: true },
    debug: { alias: "d", type: boolean() }
};

const args = parse_args(options);
console.log(args);
```

```bash
$ node index.js -p 0xBB8 --tags web api prod --debug extra_value
['extra_value', port: 3000, tags: ['web', 'api', 'prod'], debug: true]
```

The library includes several built-in processors for option types:

| Processor                | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| `string()`               | Returns the argument as a string.                                     |
| `boolean()`              | Returns `true` if present. (can explicitly set with `=true`/`false`). |
| `int(min, max)`          | Validates and returns an integer, optionally between `min` and `max`. |
| `float(min, max)`        | Validates and returns a number, optionally between `min` and `max`.   |
| `one_of(...options)`     | Ensures value is one of the provided strings.                         |
| `not_one_of(...options)` | Ensures value is *not* one of the provided strings.                   |
| `list(separator)`        | Splits a string into an array by `separator` (default `,`).           |


### Error handling

By default, `parse_args` prints a descriptive error message to `stderr` and exits the process when it encounters invalid input.

```bash
# Missing value for non-boolean flag
$ node index.js --name
Argument error: Expected a value after option 'name' (Found nothing)

# Unrecognized option
$ node index.js --unknown
Argument error: Unrecognised option 'unknown'

# Alias as option
$ node test --v
Argument error: Unrecognised option 'v'.
Did you mean to use the alias '-v'?

# Type validation failure
$ node index.js --port=99999
Argument error: port: Must be an integer between 1 and 65535 (Received: '99999')
```

Behaviour when encountering an error can be customised by passing a custom `on_error` function in the configuration object (see below). 

### Configuration

`parse_args` accepts an optional configuration object with one or more of these values:

| Option                        | Type                    | Default                 | Description                                      |
| ----------------------------- | ----------------------- | ----------------------- | ------------------------------------------------ |
| `collect_values`              | `boolean`               | `true`                  | Collect standalone values into the output array. |
| `collect_unknown_options`     | `boolean`               | `false`                 | Parse options not defined in the schema.         |
| `allow_double_dash_delimiter` | `boolean`               | `true`                  | Allow passing `--` to stop option parsing.       |
| `argv`                        | `string[]`              | `process.argv.slice(2)` | Array of arguments to parse.                     |
| `on_error`                    | `(msg: string) => void` | `standard_error`        | Custom error handler.                            |

### Custom option types

A flag type is simply a function that takes a `string` and returns a value of any type. If the input is invalid, it should throw an error message as a string.

```ts
const absolutePath = (arg: string) => {
    if (!arg.startsWith("/")) throw "must be an absolute path";
    return arg;
};

const args = parse_args({ path: { type: absolutePath } });
```

If a custom processor throws an error, the library catches it and appends the received value:

```bash
$ node index.js --path=./relative/path
Argument error: path: must be an absolute path (Received: './relative/path')
```

## Help menu generation

This library also includes a generator for a flag table to use in help menus:

```ts
import { help_string, boolean, string } from "structured-args";

const options = {
    verbose: { alias: "v", type: boolean(), description: "Show verbose output" },
    name: { type: string(), arg_label: "<name>", description: "Your name" }
};

console.log("Usage: my-app [options]\nOptions:\n");
console.log(help_string(options));
```

Output:

```text
Usage: my-app [options]
Options:

 -v, --verbose        Show verbose output
     --name <name>    Your name
```

Extra information in the help menu is sourced from options' `arg_label` and `description` fields.

### Help configuration

The behaviour of `help_string` can be customised by passing a second configuration object with one or more of these values:

| Option                 | Type                | Default     | Description                                   |
| ---------------------- | ------------------- | ----------- | --------------------------------------------- |
| `descriptions_only`    | `boolean`           | `false`     | Only include options that have a description. |
| `option_format`        | `util.InspectColor` | `undefined` | Color or style used to format flag strings.   |
| `spaces_before_option` | `number`            | `1`         | Padding before the flags.                     |
| `spaces_after_option`  | `number`            | `4`         | Padding between flags and description.        |
