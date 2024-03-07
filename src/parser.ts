import path from "path";
import fs from "fs";
import matter from "gray-matter";
import { APIMessage, APIMessages, FileResult, MessageConfig, MessageFileConfig, MessageIncludeConfig, MessageTextConfig } from "./types";

export async function extractMessagesFromFile(filePath: string, roleOverride?, isSubfile: boolean = false): Promise<FileResult> {
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
    result.messages = [] as APIMessages;

    if (data.messages) {
        const messageConfigs = data.messages as MessageConfig[];

        for (let config of messageConfigs) {
            if (config.hasOwnProperty('file')) {
                const fullPath = path.join(path.dirname(filePath), (config as MessageFileConfig).file);
                if (!fs.existsSync(fullPath)) {
                    throw `Error: Subfile ${ fullPath } does not exist.`;
                }
                const includeContent = await extractMessagesFromFile(fullPath, config.role, true);
                result.messages = result.messages.concat(includeContent.messages);
            }

            if (config.hasOwnProperty('text') || config.hasOwnProperty('include')) {
                let textContent = await processTextAndInclude(filePath, config as MessageTextConfig | MessageIncludeConfig);
                if (textContent.trim()) {
                    result.messages.push({role: config.role || roleOverride || "user", content: textContent} as APIMessage);
                }
            }
        }
    }

    let textContent = await processTextAndInclude(filePath, data as MessageTextConfig | MessageIncludeConfig, content);
    if (textContent.trim()) {
        result.messages.push({role: data.role || roleOverride || "user", content: textContent} as APIMessage);
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