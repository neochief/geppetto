import { program } from '@commander-js/extra-typings';
import { allSupportedModels, defaultModel, supportedModels } from "./api";
import path from "path";
import fs from "fs";

interface Options {
    model?: string;
    gpt?: boolean;
    claude?: boolean;
    times?: number;
    silent?: boolean;
    dryRun?: boolean;
}

interface Args {
    filename: string;
    model: string;
    times: number;
    silent: boolean;
    dryRun: boolean;
}

export function handleArgs(): Args {
    const defaultTimes = 1;

    program
        .argument('<filename>', 'File to process')
        .option('-m, --model <type>', 'Specify the model', defaultModel)
        .option('--gpt', 'A shorthand to use the best OpenAI model')
        .option('--claude', 'A shorthand to use the best Anthropic model')
        .option('-t, --times <number>', 'Number of times to run', defaultTimes.toString())
        .option('-s, --silent', 'Don\'t print the prompt and results')
        .option('--dry-run', 'Don\'t print the prompt and results');

    program.parse(process.argv);

    const options: Options = program.opts();
    let model = options.model;
    if (model && !supportedModels.includes(model)) {
        throw `Error: Model ${ model } is not supported. Please use one of the following models: ${ supportedModels.join(', ') }`;
    }
    if (!model) {
        if (options.gpt) {
            model = allSupportedModels.openai[0];
        } else if (options.claude) {
            model = allSupportedModels.anthropic[0];
        } else {
            model = defaultModel;
        }
    }

    let times = Number(options.times);
    if (isNaN(times) || times < 1) {
        throw `Error: Invalid times argument. It should be a positive integer.`;
    }

    const silent = options.silent || false;
    const dryRun = options.dryRun || false;

    let filename = program.args[0];
    if (!filename) {
        throw `Error: File argument is required.`;
    }
    if (!filename.startsWith('/')) {
        filename = path.resolve(process.cwd(), filename);
    }
    if (!fs.existsSync(filename)) {
        throw `Error: File ${ filename } does not exist.`;
    }

    return {filename, model, times, silent, dryRun};
}