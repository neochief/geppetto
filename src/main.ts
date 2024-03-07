import colors from 'colors/safe';
import { extractMessagesFromFile } from "./parser";
import { handleArgs } from "./args";
import { initializeApi } from "./api";
import { prepareOutputDir, printAndSaveResult, printPrompt } from "./misc";

export async function main() {
    const {filePath, model, times, silent, dryRun} = handleArgs(process.argv);

    const api = initializeApi(model);

    const {messages, output} = await extractMessagesFromFile(filePath);

    const {outputDir, outputPromptFile} = prepareOutputDir(output);

    await printPrompt(messages, outputPromptFile, silent, dryRun)

    if (dryRun) {
        return;
    }

    const apiPromises = api.call(messages, model, times);
    const otherPromises = [] as Promise<any>[];
    const apiErrors = [];
    apiPromises.forEach((promise, index) => {
        promise.then((result) => {
            otherPromises.push(printAndSaveResult(result, index, times, outputDir, silent));
        }, (e) => {
            apiErrors.push(e.message);
        });
    });

    await Promise.allSettled(apiPromises).then(() => {
        if (!silent) {
            if (!apiErrors.length) {
                console.log((colors.bgGreen("Done!")));
            } else {
                console.error(colors.bgRed(`Failed to complete ${ apiErrors.length } of ${ times } requests:`));
                console.error(colors.bgRed(apiErrors.join("\n")));
            }
        }
    });

    await Promise.allSettled(otherPromises);
}