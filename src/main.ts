import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources";
import { ChatCompletion } from "openai/src/resources/chat/completions";
import colors from 'colors/safe';

type FileResult = {
    messages: ChatCompletionMessageParam[];
    output?: string;
};

type MessageConfig = (MessageFileConfig | MessageTextConfig | MessageIncludeConfig) & { messages: MessageConfig[] };

type MessageFileConfig = {
    file: string,
    role?: string,
}

type MessageTextConfig = {
    text: string,
} & Partial<MessageIncludeConfig>;

type MessageIncludeConfig = {
    include: (string | { file: string })[],
    includeSeparator?: string,
    role?: string,
}

function prepareAPI() {
    return new OpenAI();
}

async function processTextAndInclude(filePath: string, config: MessageTextConfig | MessageIncludeConfig, extraText?: string): Promise<string> {
    let text = '';

    if ((config as MessageTextConfig)?.text) {
        text = (config as MessageTextConfig)?.text;
    }

    let separator = "\n\n";

    if (config?.include) {
        const includeResults = await Promise.all(config.include.map(async (includeConfig) => {
            const includePath = typeof includeConfig === 'string' ? includeConfig : includeConfig.file;
            const fullPath = path.join(path.dirname(filePath), includePath);
            return await readIncludeFile(fullPath);
        }));

        separator = config.includeSeparator === undefined ? separator : config.includeSeparator;
        const includes = includeResults.join(separator);

        if (includes) {
            if (text.trim()) {
                text += separator + includes;
            } else {
                text = includes;
            }
        }
    }

    if (extraText && extraText.trim()) {
        if (text.trim()) {
            text += separator + extraText;
        } else {
            text = extraText;
        }
    }

    return text;
}

async function readIncludeFile(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
        throw `Error: Included file ${ filePath } does not exist.`;
    }
    return fs.promises.readFile(filePath, 'utf8');
}

async function readFileContent(filePath: string, roleOverride?, isSubfile: boolean = false): Promise<FileResult> {
    if (!filePath) {
        throw `Error: File argument is required.`;
    }

    if (!filePath.startsWith('/')) {
        filePath = path.resolve(process.cwd(), filePath);
    }

    if (!fs.existsSync(filePath)) {
        throw `Error: File ${ filePath } does not exist.`;
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    let parts = matter(fileContent);
    let data = parts.data as MessageConfig & { output?: string }
    let content = parts.content as string;

    let result = {} as FileResult;
    result.messages = [] as ChatCompletionMessageParam[];

    if (data.messages) {
        const messageConfigs = data.messages as MessageConfig[];

        for (let config of messageConfigs) {
            if (config.hasOwnProperty('file')) {
                const fullPath = path.join(path.dirname(filePath), (config as MessageFileConfig).file);
                if (!fs.existsSync(fullPath)) {
                    throw `Error: Subfile ${ fullPath } does not exist.`;
                }
                const includeContent = await readFileContent(fullPath, config.role, true);
                result.messages = result.messages.concat(includeContent.messages);
            }

            if (config.hasOwnProperty('text') || config.hasOwnProperty('include')) {
                let textContent = await processTextAndInclude(filePath, config as MessageTextConfig | MessageIncludeConfig);
                if (textContent.trim()) {
                    result.messages.push({role: config.role || roleOverride || "user", content: textContent} as ChatCompletionUserMessageParam);
                }
            }
        }
    }

    let textContent = await processTextAndInclude(filePath, data as MessageTextConfig | MessageIncludeConfig, content);
    if (textContent.trim()) {
        result.messages.push({role: data.role || roleOverride || "user", content: textContent} as ChatCompletionUserMessageParam);
    }

    if (!isSubfile && data?.output) {
        const includePath = data.output;
        if (includePath.startsWith('/')) {
            result.output = includePath;
        } else {
            result.output = path.resolve(path.dirname(filePath), includePath);
        }
    }

    return result;
}

function callChatGPT(openai: OpenAI, messages: ChatCompletionMessageParam[], model: string, times = 1): Promise<ChatCompletion>[] {
    const promises = [];
    for (let i = 0; i < times; i++) {
        promises.push(openai.chat.completions.create({
            messages: messages,
            model: model,
            seed: 0,
        }));
    }

    return promises;
}

function handleArgs(argv: string[]) {
    const supportedModels = ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'];
    const defaultModel = supportedModels[0];
    const defaultTimes = 1;

    const filePath = argv[2];
    if (!filePath || filePath === '-h' || filePath === '--help' || filePath === 'help' || filePath.startsWith('-')) {
        throw `Usage: gep <filename>
[-m <model>]: Available models: ${ supportedModels.join(', ') } (default: ${ defaultModel })
[-t <times>]: Number of times to run (default: ${ defaultTimes })
[-s]: Don't print the prompt and results`;
    }

    const modelIndex = argv.indexOf('-m');
    let model = modelIndex !== -1 && argv?.[modelIndex + 1] ? argv[modelIndex + 1] : defaultModel;
    if (!supportedModels.includes(model)) {
        throw `Error: Model ${ model } is not supported. Please use one of the following models: ${ supportedModels.join(', ') }`;
    }

    const timesIndex = argv.indexOf('-t');
    let times = defaultTimes;
    if (timesIndex !== -1) {
        const rawTimes = argv?.[timesIndex + 1];
        if (!rawTimes) {
            throw `Error: Times argument is required.`;
        }
        times = parseInt(rawTimes);
        if (isNaN(times) || times < 0) {
            throw `Error: Invalid times argument. It should be a positive integer.`;
        }
    }

    const silent = argv.includes('-v') || false;

    return {filePath, model, times, silent};
}

export async function main() {
    const openai = prepareAPI();

    const {filePath, model, times, silent} = handleArgs(process.argv);

    let {messages, output} = await readFileContent(filePath);
    let promptFile;

    if (output) {
        if (fs.existsSync(output) && fs.lstatSync(output).isFile()) {
            throw "The output option (" + output + ") is a file. A directory expected."
        }
        if (!fs.existsSync(output)) {
            fs.mkdirSync(output, {recursive: true});
        }

        let dirCount = fs.readdirSync(output).length;
        output = path.join(output, (dirCount + 1).toString());
        if (!fs.existsSync(output)) {
            fs.mkdirSync(output, {recursive: true});
        }
        promptFile = path.join(output, '_prompt.md');
    }

    if (!silent) {
        console.log(colors.bgBlue("# PROMPT" + (promptFile ? " (" + promptFile + ")" : "") + "\n--------------------"));

        messages.map((message, index) => {
            const colorFunc = index % 2 === 0 ? colors.blue : colors.cyan;
            console.log(colorFunc(message.role.toUpperCase() + ":"));
            console.log(colorFunc((message.content as string).trim() + (index < messages.length - 1 ? "\n" : "")));
        });

        console.log(colors.bgBlue("--------------------\n"));
    }

    let awaitAll = [] as Promise<any>[];

    if (promptFile) {
        let prompt = '';
        messages.forEach((message, index) => {
            prompt += message.role.toUpperCase() + ":\n"
            prompt += (message.content as string).trim() + (index < messages.length - 1 ? "\n\n" : "");
        })
        awaitAll.push(fs.promises.writeFile(promptFile, prompt));
    }

    if (times < 1) {
        await Promise.allSettled(awaitAll);

        return;
    }

    const gptPromises = callChatGPT(openai, messages, model, times);

    awaitAll = awaitAll.concat(gptPromises);

    let gptErrors = [];
    gptPromises.forEach((promise, index) => {
        promise.then((result) => {
            const completion = result.choices[0].message.content;

            let destination;
            if (output) {
                destination = path.join(output, (index + 1).toString() + '.md');
            }

            if (!silent) {
                const destinationText = destination ? " (" + destination + ")" : "";
                const colorFunc = index % 2 === 0 ? colors.green : colors.yellow;
                console.log(colorFunc(`RESULT (${ index + 1 } / ${ times })${ destinationText }:\n--------------------\n${ completion }\n--------------------`));
            }

            if (destination) {
                awaitAll.push(fs.promises.writeFile(destination, completion));
            }
        }, (e) => {
            gptErrors.push(e.message);
        }).catch((error) => {
            console.error(`Fatal exception: ${ error }`);
        });
    });

    await Promise.allSettled(gptPromises).then(() => {
        if (!silent) {
            if (!gptErrors.length) {
                console.log((colors.bgGreen("Done!")));
            } else {
                console.error(colors.bgRed(`Failed to complete ${ gptErrors.length } of ${ times } requests:`));
                console.error(colors.bgRed(gptErrors.join("\n")));
            }
        }
    });

    await Promise.allSettled(awaitAll);
}