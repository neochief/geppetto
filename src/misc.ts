import fs from "fs";
import path from "path";
import colors from "colors/safe";
import { ApiResult } from "./types";

export function prepareOutputDir(output: string, model: string): { outputDir?: string, outputPromptFile?: string } {
    if (output) {
        if (fs.existsSync(output) && fs.lstatSync(output).isFile()) {
            throw "The output option (" + output + ") is a file. A directory expected."
        }
        if (!fs.existsSync(output)) {
            fs.mkdirSync(output, {recursive: true});
        }

        let dirCount = fs.readdirSync(output).length;
        const outputDir = path.join(output, (dirCount + 1).toString() + '__' + model);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        const outputPromptFile = path.join(outputDir, '_prompt.md');

        return {outputDir, outputPromptFile};
    }
}

export function printPrompt(messages, outputPromptFile, silent = false, dryRun = false) {
    if (!silent) {
        console.log(colors.bgBlue("# PROMPT" + (outputPromptFile ? " " + outputPromptFile + "" : "") + "\n--------------------"));

        messages.map((message, index) => {
            const colorFunc = index % 2 === 0 ? colors.blue : colors.cyan;
            console.log(colorFunc(message.role.toUpperCase() + ":"));
            console.log(colorFunc((message.content as string).trim() + (index < messages.length - 1 ? "\n" : "")));
        });
    }

    if (outputPromptFile && !dryRun) {
        let prompt = '';
        messages.forEach((message, index) => {
            prompt += message.role.toUpperCase() + ":\n"
            prompt += (message.content as string).trim() + (index < messages.length - 1 ? "\n\n" : "");
        })
        return fs.promises.writeFile(outputPromptFile, prompt)
    }
}

export function printAndSaveResult(result: ApiResult, index: number, times: number, outputDir: string, outputAsFiles: boolean, silent: boolean) {
    const promises = [];
    const resultFiles = [];
    if (outputAsFiles && result.includes('= File:')) {
        const fileBlockPattern = /= File: (.*?) =+\n([\s\S]*?)\n= End of file: \1 =+/g;
        const matches = result.matchAll(fileBlockPattern);

        for (const match of matches) {
            const filename = match[1];
            const content = match[2];

            const absoluteOutputDir = path.resolve(outputDir, (index + 1).toString());
            let absoluteFilename = path.resolve(outputDir, filename);
            let relativePath = path.relative(absoluteOutputDir, absoluteFilename);
            if (relativePath.startsWith('..')) {
                relativePath = relativePath.replace(/^(\.\.[/\\])+/, '');
            }
            const outputPath = path.join(absoluteOutputDir, relativePath);

            promises.push(new Promise<void>((resolve, reject) => {
                fs.promises.mkdir(path.dirname(outputPath), {recursive: true})
                    .then(() => {
                        fs.promises.writeFile(outputPath, content)
                            .then(() => {
                                resolve();
                            })
                            .catch(reject);
                    })
                    .catch(reject);
            }));

            resultFiles.push(outputPath);
        }
    }

    const outputResultFile = outputDir ? path.join(outputDir, (index + 1).toString() + '.md') : undefined;

    if (!silent) {
        const destinationText = outputResultFile ? " " + outputResultFile : "";
        const colorFunc = index % 2 === 0 ? colors.green : colors.yellow;
        console.log(colorFunc(`\nRESULT (${ index + 1 } / ${ times })${ destinationText }`));
        if (resultFiles.length) {
            console.log(colorFunc(`Result chunks saved in sub files:\n${ resultFiles.join("\n") }`));
        }
        console.log(colorFunc(`--------------------\n${ result }\n--------------------`));
    }

    if (outputResultFile) {
        promises.push(fs.promises.writeFile(outputResultFile, result));
    }

    return Promise.all(promises);
}