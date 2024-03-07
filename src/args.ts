import { allSupportedModels, defaultModel, supportedModels } from "./api";

export function handleArgs(argv: string[]) {
    const defaultTimes = 1;

    const filePath = argv[2];
    if (!filePath || filePath === '-h' || filePath === '--help' || filePath === 'help' || filePath.startsWith('-')) {
        console.log(`Usage: gep <filename>
[-m <model>]: Available models: ${ supportedModels.join(', ') } (default: ${ defaultModel })
[--gpt]: A shorthand to use the best OpenAI model.
[--claude]: A shorthand to use the best Anthropic model.
[-t <times>]: Number of times to run (default: ${ defaultTimes }).
[-s]: Don't print the prompt and results.
[--dry-run]: Don't print the prompt and results.`);
        process.exit(1);
    }

    const modelIndex = argv.indexOf('-m');
    let model = modelIndex !== -1 && argv?.[modelIndex + 1] ? argv[modelIndex + 1] : null;
    if (model && !supportedModels.includes(model)) {
        throw `Error: Model ${ model } is not supported. Please use one of the following models: ${ supportedModels.join(', ') }`;
    }
    if (!model) {
        if (argv.includes('--gpt')) {
            model = allSupportedModels.openai[0];
        } else if (argv.includes('--claude')) {
            model = allSupportedModels.anthropic[0];
        } else {
            model = defaultModel;
        }
    }

    const timesIndex = argv.indexOf('-t');
    let times = defaultTimes;
    if (timesIndex !== -1) {
        const rawTimes = argv?.[timesIndex + 1];
        if (!rawTimes) {
            throw `Error: Times argument is required.`;
        }
        times = parseInt(rawTimes);
        if (isNaN(times) || times < 1) {
            throw `Error: Invalid times argument. It should be a positive integer.`;
        }
    }

    const silent = argv.includes('-v') || false;

    const dryRun = argv.includes('--dry-run') || false;

    return {filePath, model, times, silent, dryRun};
}