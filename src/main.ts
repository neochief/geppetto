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

    console.log(colors.bgGreen(`\n# Connecting to AI using model: ${ model }` + "\n--------------------"));

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
            const successes = times - apiErrors.length;

            if (successes) {
                console.log((colors.bgGreen(`\nDone! (${ successes } of ${ times })`)));
            }

            if (apiErrors.length) {
                console.error(colors.bgRed(`\nFailed to complete ${ apiErrors.length } of ${ times } requests:`));
                console.error(colors.bgRed(apiErrors.join("\n")));
            }
        }
    });

    await Promise.allSettled(otherPromises);
}