import fs from "fs";
import path from "path";
import colors from "colors/safe";
import { ApiResult } from "./types";

export function getOutputDir(baseDir: string, outputDir: string, outputVersioned: boolean, model: string): { outputDir: string, outputPromptFile: string } | void {
    if (fs.existsSync(outputDir) && fs.lstatSync(outputDir).isFile()) {
        throw "The output option (" + outputDir + ") is a file. A directory expected."
    }

    // if (!fs.existsSync(outputDir)) {
    //     fs.mkdirSync(outputDir, {recursive: true});
    // }

    if (outputVersioned) {
        let dirCount = fs.existsSync(outputDir) ? fs.readdirSync(outputDir).length : 0;

        outputDir = path.join(outputDir, (dirCount + 1).toString() + '__' + model);

        // if (!fs.existsSync(outputDir)) {
        //     fs.mkdirSync(outputDir, {recursive: true});
        // }

        const outputPromptFile = path.join(outputDir, '_prompt.md');

        return {outputDir, outputPromptFile};
    }
}

export function prepareOutputDir(outputDir: string, outputPromptFile: string) {
    if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
    }
    if (outputPromptFile && !fs.existsSync(path.dirname(outputPromptFile))) {
        fs.mkdirSync(path.dirname(outputPromptFile), {recursive: true});
    }
}

export function printPrompt(messages, outputPromptFile: string, silent = false, dryRun = false) {
    if (!silent) {
        console.log(colors.bgBlue("# PROMPT" + (outputPromptFile ? " " + outputPromptFile + "" : "") + "\n--------------------"));

        messages.map((message, index) => {
            const colorFunc = index % 2 === 0 ? colors.blue : colors.cyan;
            console.log(colorFunc(message.role.toUpperCase() + ":"));
            console.log(colorFunc((message.content as string).trim() + (index < messages.length - 1 ? "\n" : "")));
        });
    }
}

export function writePrompt(messages, outputPromptFile: string, silent = false, dryRun = false) {
    if (outputPromptFile && !dryRun) {
        let prompt = '';
        messages.forEach((message, index) => {
            prompt += message.role.toUpperCase() + ":\n"
            prompt += (message.content as string).trim() + (index < messages.length - 1 ? "\n\n" : "");
        })
        fs.writeFileSync(outputPromptFile, prompt)
    }
}

export function printAndSaveResult(result: ApiResult, index: number, times: number, outputDir: string, outputVersioned:boolean, outputAsFiles: boolean, silent: boolean) {
    const promises = [];
    const resultFiles = [];
    let outputResultFile;

    if (outputAsFiles && result.includes('= File:')) {
        const fileBlockPattern = /= File: (.*?) =+\n([\s\S]*?)\n= End of file: \1 =+/g;
        const matches = result.matchAll(fileBlockPattern);

        for (const match of matches) {
            const filename = match[1];
            const content = match[2];

            const absoluteOutputDir = outputVersioned ? path.resolve(outputDir, (index + 1).toString()) : outputDir;
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
    else {
        outputResultFile = outputDir ? (path.join(outputDir, (outputVersioned ? (index + 1).toString() : 'result') + '.md')) : undefined;
        if (outputResultFile) {
            promises.push(fs.promises.writeFile(outputResultFile, result));
        }
    }

    if (!silent) {
        const destinationText = outputResultFile ? " " + outputResultFile : "";
        const colorFunc = index % 2 === 0 ? colors.green : colors.yellow;
        console.log(colorFunc(`\nRESULT (${ index + 1 } / ${ times })${ destinationText }`));
        if (resultFiles.length) {
            console.log(colorFunc(`Result chunks saved in sub files:\n${ resultFiles.join("\n") }`));
        }
        console.log(colorFunc(`--------------------\n${ result }\n--------------------`));
    }

    return Promise.all(promises);
}