import colors from 'colors/safe';
import { extractMessagesFromTaskFile, extractMessagesFromTaskFileAndIncludeFile } from "./parser";
import { handleArgs } from "./args";
import { initializeApi } from "./api";
import { getOutputDir, prepareOutputDir, printAndSaveResult, printPrompt, writePrompt } from "./misc";
import { AIJob } from "./types";

function processAIJob(job: AIJob, api, model, silent, dryRun) {
    let outputDir, outputPromptFile;
    const result = getOutputDir(job.outputDir, job.outputVersioned, model);
    outputDir = result?.outputDir || job.outputDir;
    outputPromptFile = result?.outputPromptFile;
    const expectedOutputPath = job.outputFile ?? outputDir;

    printPrompt(job.messages, outputPromptFile, silent, dryRun);

    if (dryRun) {
        console.log(colors.bgGreen(`\n# Dry run. No API calls will be made.\nExpect results in: ${ expectedOutputPath }` + "\n--------------------"));
        return [[], [], []];
    }

    prepareOutputDir(outputDir, outputPromptFile);

    writePrompt(job.messages, outputPromptFile, silent, dryRun)

    console.log(colors.bgGreen(`\n# Connecting to API using model: ${ model }\nExpect results in: ${ expectedOutputPath }` + "\n--------------------"));

    const apiPromises = api.call(job.messages, model, job.times);
    const otherPromises = [] as Promise<any>[];
    const apiErrors = [];
    apiPromises.forEach((promise, index) => {
        promise.then((result) => {
            otherPromises.push(printAndSaveResult(result, index, job.times, outputDir, job.outputVersioned, job.outputAsFiles, job.editInPlace, silent));
        }, (e) => {
            apiErrors.push(e.message);
        });
    });

    return [apiPromises, apiErrors, otherPromises];
}

export async function main() {
    let {task, targetFiles, model, serial, silent, dryRun} = handleArgs();

    const api = initializeApi(model);

    const jobs = [] as AIJob[];

    if (targetFiles && targetFiles.length) {
        const promises = [];
        targetFiles.forEach((filename) => {
            promises.push(extractMessagesFromTaskFileAndIncludeFile(task, filename));
        });
        await Promise.allSettled(promises).then((results) => {
            results.forEach((promise) => {
                if (promise.status === "rejected") {
                    console.error(colors.bgRed(promise.reason));
                    return;
                }
                const result = promise.value;
                jobs.push({
                    messages: result.messages,
                    times: 1,
                    outputFile: result.outputFile,
                    outputDir: result.outputDir,
                    outputVersioned: result.outputVersioned,
                    outputAsFiles: result.outputAsFiles,
                    editInPlace: result.editInPlace
                });
            });
        });
    } else {
        let {messages, outputDir, outputVersioned, outputAsFiles, editInPlace, times} = await extractMessagesFromTaskFile(task);
        jobs.push({
            messages,
            times,
            outputDir,
            outputVersioned,
            outputAsFiles,
            editInPlace
        });
    }

    const apiPromises = [] as Promise<any>[];
    const otherPromises = [] as Promise<any>[];
    const apiErrors = [] as string[];

    for (let job of jobs) {
        const [someApiPromises, someApiErrors, someOtherPromises] = processAIJob(job, api, model, silent, dryRun);
        apiPromises.push(...someApiPromises);
        apiErrors.push(...someApiErrors);
        otherPromises.push(...someOtherPromises);

        if (serial) {
            await Promise.allSettled(apiPromises);
        }
    }

    await Promise.allSettled(apiPromises).then(() => {
        if (!silent) {
            const successes = jobs.length - apiErrors.length;

            if (successes) {
                console.log((colors.bgGreen(`\nDone! (${ successes } of ${ jobs.length })`)));
            }

            if (apiErrors.length) {
                console.error(colors.bgRed(`\nFailed to complete ${ apiErrors.length } of ${ jobs.length } requests:`));
                console.error(colors.bgRed(apiErrors.join("\n")));
            }
        }
    });

    await Promise.allSettled(otherPromises);
}