import colors from 'colors/safe';
import { extractMessagesFromFile } from "./parser";
import { handleArgs } from "./args";
import { initializeApi } from "./api";
import { getOutputDir, prepareOutputDir, printAndSaveResult, printPrompt, writePrompt } from "./misc";

export async function main() {
    let {filename, model, times, silent, dryRun} = handleArgs();

    const api = initializeApi(model);

    let {messages, baseDir, outputDir, outputVersioned, outputAsFiles, editInPlace} = await extractMessagesFromFile(filename);

    let outputPromptFile: string;
    const result = getOutputDir(baseDir, outputDir, outputVersioned, model);
    if (result) {
        outputDir = result.outputDir;
        outputPromptFile = result.outputPromptFile;
    }

    printPrompt(messages, outputPromptFile, silent, dryRun);

    if (!outputVersioned) {
        times = 1;
    }

    if (dryRun) {
        console.log(colors.bgGreen(`\n# Dry run. No API calls will be made.\nExpect results in: ${ outputDir }` + "\n--------------------"));
        return;
    }

    prepareOutputDir(outputDir, outputPromptFile);

    writePrompt(messages, outputPromptFile, silent, dryRun)

    console.log(colors.bgGreen(`\n# Connecting to API using model: ${ model }\nExpect results in: ${ outputDir }` + "\n--------------------"));

    const apiPromises = api.call(messages, model, times);
    const otherPromises = [] as Promise<any>[];
    const apiErrors = [];
    apiPromises.forEach((promise, index) => {
        promise.then((result) => {
            otherPromises.push(printAndSaveResult(result, index, times, outputDir, outputVersioned, outputAsFiles, editInPlace, silent));
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