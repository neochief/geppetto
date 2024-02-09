import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources";

type FileContent = {
    messages: ChatCompletionMessageParam[];
    output?: string;
};


function prepareAPI() {
    return new OpenAI();
}

async function readFileContent(filePath: string, defaultRole = 'user'): Promise<FileContent> {
    if (!filePath) {
        throw `Error: File argument is required.`;
    }

    if (!filePath.startsWith('/')) {
        filePath = path.resolve(process.cwd(), filePath);
    }

    if (!fs.existsSync(filePath)) {
        throw `Error: File ${ filePath } does not exist.`;
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const {data, content} = matter(fileContent);

    let result = {} as FileContent;

    result.messages = [] as ChatCompletionMessageParam[];
    if (data.include) {
        const includeStrings = Array.isArray(data.include) ? data.include : [data.include];
        for (const includeString of includeStrings) {
            const [includePath, includeRole] = includeString.split(/ +as +/);

            const fullPath = path.join(path.dirname(filePath), includePath);
            if (!fs.existsSync(fullPath)) {
                throw `Error: Included file ${ fullPath } does not exist.`;
            }
            const includeContent = await readFileContent(fullPath, includeRole);
            result.messages = result.messages.concat(includeContent.messages);
        }
    }
    result.messages.push({role: data.role || defaultRole, content: content} as ChatCompletionMessageParam);

    if (data.output) {
        const includePath = data.output;
        if (includePath.startsWith('/')) {
            result.output = includePath;
        } else {
            result.output = path.resolve(path.dirname(filePath), includePath);
        }
    }

    return result;
}

async function callChatGPT(openai: OpenAI, messages: ChatCompletionMessageParam[], model: string, times = 1): Promise<string[]> {
    const promises = [];
    for (let i = 0; i < times; i++) {
        promises.push(openai.chat.completions.create({
            messages: messages,
            model: model,
            seed: 0,
        }));
    }

    const results = await Promise.allSettled(promises);

    const values = [];
    results.forEach((result) => {
        if (result.status === 'fulfilled') {
            values.push(result.value.choices[0].message.content);
        }
    });

    return values;
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
        if (isNaN(times) || times < 1) {
            throw `Error: Invalid times argument. It should be a positive integer.`;
        }
    }

    const silent = argv.includes('-v') || false;

    return {filePath, model, times, silent};
}

export async function main() {
    const openai = prepareAPI();

    const {filePath, model, times, silent} = handleArgs(process.argv);

    const {messages, output} = await readFileContent(filePath);

    if (output) {
        if (path.extname(output) === '') {
            let filename = path.basename(filePath, path.extname(filePath));
            let outputDir = path.join(output, filename);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {recursive: true});
            }
        } else {
            const outputDir = path.dirname(output);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {recursive: true});
            }
        }
    }

    if (!silent) {
        console.log("PROMPT:\n--------------------\n" + messages.map((message) => {
            return message.role + ": " + (message.content as string).trim()
        }).join("\n") + "\n--------------------");
    }

    if (times < 1) {
        return;
    }

    const results = await callChatGPT(openai, messages, model, times);

    if (!silent) {
        for (let i = 0; i < results.length; i++) {
            console.log(`RESULT (${ i + 1 } / ${ results.length }):\n--------------------\n${ results[i] }\n--------------------`);
        }
    }

    if (output) {
        if (fs.existsSync(output) && !fs.statSync(output).isFile()) {
            let filename = path.basename(filePath, path.extname(filePath));
            let dir = path.join(output, filename);
            let fileCount = fs.readdirSync(dir).length - 1;
            for (let i = 0; i < results.length; i++) {
                let iOutput = path.join(dir, (fileCount + i + 1).toString() + '.md');
                fs.writeFileSync(iOutput, results[i]);
            }
        } else {
            fs.writeFileSync(output, results.join('\n\n--------------------\n\n'));
        }
    }
}