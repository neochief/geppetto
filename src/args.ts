import { program } from '@commander-js/extra-typings';
import { allSupportedModels, defaultModel, supportedModels } from "./api";
import path from "path";
import fs from "fs";
import fg from "fast-glob";

interface Options {
    model?: string;
    gpt?: boolean;
    o3?: boolean;
    claude?: boolean;
    times?: number;
    serial?: boolean;
    silent?: boolean;
    dryRun?: boolean;
}

interface Args {
    task: string;
    targetFiles: string[];
    model: string;
    serial: boolean;
    silent: boolean;
    dryRun: boolean;
}

export function handleArgs(): Args {
    program
        .argument('<filename>', 'File to process')
        .argument('[target...]', 'Target path. You can use file masks like some/path/*.txt')
        .option('-m, --model <type>', 'Specify the model', defaultModel)
        .option('--gpt', 'A shorthand to use the best OpenAI model')
        .option('--o3', 'A shorthand to use the OpenAI O3 model')
        .option('--claude', 'A shorthand to use the best Anthropic model')
        .option('--serial', 'Run the API calls one after another')
        .option('-s, --silent', 'Don\'t print the prompt and results')
        .option('--dry-run', 'Don\'t print the prompt and results');

    program.parse(process.argv);

    const options: Options = program.opts();



    let model;

    if (options.gpt) {
        model = allSupportedModels.openai[0];
    } else if (options.o3) {
        model = allSupportedModels.o3[0];
    } else if (options.claude) {
        model = allSupportedModels.anthropic[0];
    } else {
        model = options.model;
    }
    if (model && !supportedModels.includes(model)) {
        throw `Error: Model ${ model } is not supported. Please use one of the following models: ${ supportedModels.join(', ') }`;
    }

    let serial = options.serial || false;

    if (model && allSupportedModels.anthropic.includes(model)) {
        // Anthropic models effectively run serially because of the rate limit.
        serial = true;
    }

    const silent = options.silent || false;
    const dryRun = options.dryRun || false;

    let task = program.args[0];
    if (!task) {
        throw `Error: File argument is required.`;
    }
    if (!task.startsWith('/')) {
        task = path.resolve(process.cwd(), task);
    }
    if (!fs.existsSync(task)) {
        throw `Error: File ${ task } does not exist.`;
    }

    let targets = program.args.slice(1);
    let targetFiles = [];
    targets.map(target => {
        let absPath = path.resolve(process.cwd(), target);
        if (fs.lstatSync(absPath).isDirectory()) {
            absPath += '/*';
        }
        const expanded = fg.sync([absPath]);
        targetFiles = targetFiles.concat(expanded);
    });

    return {task, targetFiles, model, serial, silent, dryRun};
}