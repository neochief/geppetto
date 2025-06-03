import colors from 'colors/safe';
import {extractMessagesFromTaskFile, extractMessagesFromTaskFileAndIncludeFile} from "./parser";
import {handleArgs} from "./args";
import {APIClient, initializeApi} from "./api";
import {getOutputDir, prepareOutputDir, printAndSaveResult, printPrompt, writePrompt} from "./misc";
import {AIJob} from "./types";

async function processAIJob(job: AIJob, api: APIClient, model, silent, dryRun) {
    let outputDir, outputPromptFile;
    const result = getOutputDir(job.outputDir, job.outputVersioned, model);
    outputDir = result?.outputDir || job.outputDir;
    outputPromptFile = result?.outputPromptFile;
    const expectedOutputPath = job.outputFile ?? outputDir;

    printPrompt(job.messages, outputPromptFile, silent, dryRun);

    if (dryRun) {
        console.log(colors.bgGreen(`\n# Dry run. No API calls will be made.\nExpect results in: ${expectedOutputPath}` + "\n--------------------"));
        return {apiErrors: [], otherPromises: []};
    }

    prepareOutputDir(outputDir, outputPromptFile);

    writePrompt(job.messages, outputPromptFile, silent, dryRun)

    console.log(colors.bgGreen(`\n# Connecting to API using model: ${model}\nExpect results in: ${expectedOutputPath}` + "\n--------------------"));

    const apiPromises = api.call(job.messages, model, job.times);

    const results = await Promise.allSettled(apiPromises);

    const apiErrors = [], otherPromises = [];

    for (let index = 0; index < results.length; index++) {
        const result = results[index];
        if (result.status === "fulfilled") {
            otherPromises.push(printAndSaveResult(result.value, index, job.times, outputDir, job.outputVersioned, job.outputAsFiles, job.editInPlace, silent));
        } else {
            apiErrors.push(result.reason.message || result.reason);
        }
    }

    return {apiErrors, otherPromises};
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
        let {
            messages,
            outputDir,
            outputVersioned,
            outputAsFiles,
            editInPlace,
            times
        } = await extractMessagesFromTaskFile(task);
        jobs.push({
            messages,
            times,
            outputDir,
            outputVersioned,
            outputAsFiles,
            editInPlace
        });
    }

    const allApiPromises = [] as Promise<{ apiErrors: any, otherPromises: any }>[];
    const allOtherPromises = [] as Promise<any>[];
    const allApiErrors = [] as string[];

    for (let index = 0; index < jobs.length; index++) {
        const job = jobs[index];
        allApiPromises.push(processAIJob(job, api, model, silent, dryRun));
        if (serial) {
            await Promise.allSettled(allApiPromises);
        }
    }

    await Promise.allSettled(allApiPromises).then((results) => {
        results.forEach((result) => {
            if (result.status === "fulfilled") {
                const {apiErrors, otherPromises} = result.value;
                allApiErrors.push(...apiErrors);
                allOtherPromises.push(...otherPromises);
            }
        });
    });

    await Promise.allSettled(allApiPromises).then(() => {
        if (!silent) {
            const successes = jobs.length - allApiErrors.length;

            if (successes) {
                console.log((colors.bgGreen(`\nDone! (${successes} of ${jobs.length})`)));
            }

            if (allApiErrors.length) {
                console.error(colors.bgRed(`\nFailed to complete ${allApiErrors.length} of ${jobs.length} requests:`));
                console.error(colors.bgRed(allApiErrors.join("\n")));
            }
        }
    });

    await Promise.allSettled(allOtherPromises);
}