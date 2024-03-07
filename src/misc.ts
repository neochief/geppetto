import fs from "fs";
import path from "path";
import colors from "colors/safe";
import { ApiResult } from "./types";

export function prepareOutputDir(output: string): { outputDir?: string, outputPromptFile?: string } {
    if (output) {
        if (fs.existsSync(output) && fs.lstatSync(output).isFile()) {
            throw "The output option (" + output + ") is a file. A directory expected."
        }
        if (!fs.existsSync(output)) {
            fs.mkdirSync(output, {recursive: true});
        }

        let dirCount = fs.readdirSync(output).length;
        const outputDir = path.join(output, (dirCount + 1).toString());
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        const outputPromptFile = path.join(output, '_prompt.md');

        return {outputDir, outputPromptFile};
    }
}

export function printPrompt(messages, outputPromptFile, silent = false, dryRun = false) {
    if (!silent) {
        console.log(colors.bgBlue("# PROMPT" + (outputPromptFile ? " (" + outputPromptFile + ")" : "") + "\n--------------------"));

        messages.map((message, index) => {
            const colorFunc = index % 2 === 0 ? colors.blue : colors.cyan;
            console.log(colorFunc(message.role.toUpperCase() + ":"));
            console.log(colorFunc((message.content as string).trim() + (index < messages.length - 1 ? "\n" : "")));
        });

        console.log(colors.bgBlue("--------------------\n"));
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

export function printAndSaveResult(result: ApiResult, index: number, times: number, outputDir: string, silent: boolean) {
    const outputResultFile = outputDir ? path.join(outputDir, (index + 1).toString() + '.md') : undefined;

    if (!silent) {
        const destinationText = outputResultFile ? " (" + outputResultFile + ")" : "";
        const colorFunc = index % 2 === 0 ? colors.green : colors.yellow;
        console.log(colorFunc(`RESULT (${ index + 1 } / ${ times })${ destinationText }:\n--------------------\n${ result }\n--------------------`));
    }

    if (outputResultFile) {
        return fs.promises.writeFile(outputResultFile, result);
    }
}