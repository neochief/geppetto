import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources";

const openai = new OpenAI();

type FileContent = {
    messages: ChatCompletionMessageParam[];
    output?: string;
};

async function readFileContent(filePath: string): Promise<FileContent> {
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
        const includePaths = Array.isArray(data.include) ? data.include : [data.include];
        for (const includePath of includePaths) {
            const fullPath = path.join(path.dirname(filePath), includePath);
            if (!fs.existsSync(fullPath)) {
                throw `Error: Included file ${ fullPath } does not exist.`;
            }
            const includeContent = await readFileContent(fullPath);
            result.messages = result.messages.concat(includeContent.messages);
        }
    }
    result.messages.push({role: data.role || 'user', content: content} as ChatCompletionMessageParam);

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

async function callChatGPT(messages: ChatCompletionMessageParam[], model: string): Promise<string> {
    const completion = await openai.chat.completions.create({
        messages: messages,
        model: model,
        seed: 0,
    });

    return completion.choices[0].message.content || "";
}

function handleArgs(argv: string[]) {
    const supportedModels = ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'];
    const defaultModel = supportedModels[0];

    const filePath = argv[2];
    if (!filePath) {
        throw `Usage: gep <filename>
[-m <model>]: Available models: ${ supportedModels.join(', ') } (default: ${ defaultModel })
[-v]: Outputs the compiled prompt and result on screen (in addition to output file)`;
    }

    const modelIndex = argv.indexOf('-m');

    let model = modelIndex !== -1 && argv[modelIndex + 1] ? argv[modelIndex + 1] : defaultModel;
    if (!supportedModels.includes(model)) {
        throw `Error: Model ${ model } is not supported. Please use one of the following models: ${ supportedModels.join(', ') }`;
    }

    const silent = argv.includes('-v') || false;

    return {filePath, model, silent};
}

export async function main() {
    let {filePath, model, silent} = handleArgs(process.argv);

    const {messages, output} = await readFileContent(filePath);

    if (output) {
        const outputDir = path.dirname(output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }
    }

    if (!silent) {
        console.log("PROMPT:\n--------------------\n" + messages.map((message) => { return message.role + ": " + (message.content as string).trim() }).join("\n") + "\n--------------------\n");
    }

    const result = await callChatGPT(messages, model);

    if (!silent) {
        console.log("RESULT:\n--------------------\n" + result + "\n--------------------");
    }

    if (output) {
        if (fs.existsSync(output) && !fs.statSync(output).isFile()) {
            let fileCount = fs.readdirSync(output).length;
            let filename = path.basename(filePath);
            let iOutput = path.join(output, filename, (fileCount + 1).toString(), '.md');
            fs.writeFileSync(iOutput, result);
        }
        else {
            fs.writeFileSync(output, result);
        }
    }
}