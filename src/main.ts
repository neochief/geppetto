import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';

const openai = new OpenAI();

type FileContent = {
    body: string;
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

    let body = content;
    if (data.include) {
        const includePaths = Array.isArray(data.include) ? data.include : [data.include];
        for (const includePath of includePaths) {
            const fullPath = path.join(path.dirname(filePath), includePath);
            if (!fs.existsSync(fullPath)) {
                throw `Error: Included file ${ fullPath } does not exist.`;
            }
            const includeContent = await readFileContent(fullPath);
            body = includeContent.body.trim() + '\n' + body;
        }
    }
    result.body = body;

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

async function callChatGPT(content: string, model: string): Promise<string> {
    const completion = await openai.chat.completions.create({
        messages: [{role: "system", content: content}],
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

    const {body, output} = await readFileContent(filePath);

    if (output) {
        const outputDir = path.dirname(output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }
    }

    if (!silent) {
        console.log("PROMPT:\n--------------------\n" + body + "\n--------------------\n");
    }

    const result = await callChatGPT(body, model);

    if (!silent) {
        console.log("RESULT:\n--------------------\n" + result + "\n--------------------");
    }

    if (output) {
        fs.writeFileSync(output, result);
    }
}