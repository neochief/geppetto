import path from "path";
import fs from "fs";
import matter from "gray-matter";
import { APIMessage, APIMessages, FileMessageConfig, FileResult, MessageConfig, MessageFileConfig, MessageIncludeConfig, MessageTextConfig } from "./types";

const asFilesPrompt = `
Format results as if they were separate files and each file is formatted in the following way:

= File: %filename% =========================
%result%
= End of file: %filename% ==================
`

export async function extractMessagesFromFile(filename: string, roleOverride?, isSubfile: boolean = false): Promise<FileResult> {
    const fileContent = await fs.promises.readFile(filename, 'utf8');
    let parts = matter(fileContent);
    let data = parts.data as FileMessageConfig;
    let content = parts.content as string;

    let result = {} as FileResult;
    result.messages = [] as APIMessages;

    if (data.messages) {
        const messageConfigs = data.messages;

        for (let config of messageConfigs) {
            if (config.hasOwnProperty('file')) {
                const fullPath = path.join(path.dirname(filename), (config as MessageFileConfig).file);
                if (!fs.existsSync(fullPath)) {
                    throw `Error: Subfile ${ fullPath } does not exist.`;
                }
                const includeContent = await extractMessagesFromFile(fullPath, config.role, true);
                result.messages = result.messages.concat(includeContent.messages);
            }

            if (config.hasOwnProperty('text') || config.hasOwnProperty('include')) {
                let textContent = await processTextAndInclude(filename, config as MessageTextConfig | MessageIncludeConfig);
                if (textContent.trim()) {
                    result.messages.push({role: config.role || roleOverride || "user", content: textContent} as APIMessage);
                }
            }
        }
    }

    if ("text" in data || "include" in data) {
        let textContent = await processTextAndInclude(filename, data as MessageTextConfig | MessageIncludeConfig, content);
        if (textContent.trim()) {
            result.messages.push({role: ("role" in data ? data.role : null) || roleOverride || "user", content: textContent} as APIMessage);
        }
    }

    if (!isSubfile && data?.output) {
        const includePath = data.output;
        if (includePath.startsWith('/')) {
            result.output = includePath;
        } else {
            result.output = path.resolve(path.dirname(filename), includePath);
        }
    }

    if (data.outputAsFiles !== undefined) {
        result.messages = [{role: "system", content: asFilesPrompt} as APIMessage, ...result.messages];
        result.outputAsFiles = data.outputAsFiles;
    }

    return result;
}

async function processTextAndInclude(filePath: string, config: MessageTextConfig | MessageIncludeConfig, extraText?: string): Promise<string> {
    let text = '';

    if ((config as MessageTextConfig)?.text) {
        text = (config as MessageTextConfig)?.text;
    }

    let separator = config.separator === undefined ? "\n\n" : config.separator;

    if (config?.include) {
        const includeResults = await Promise.all(config.include.map(async (includePath) => {
            const fullPath = path.join(path.dirname(filePath), includePath);
            const content = await readIncludeFile(fullPath);

            if (config.asFiles) {
                const header = `= File: ${ includePath } =========================\n`;
                const footer = `\n= End of file: ${ includePath } ==================`;
                return header + content + footer;
            } else {
                return content;
            }
        }));

        const result = includeResults.join(separator);

        if (result) {
            if (text.trim()) {
                text += separator + result;
            } else {
                text = result;
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