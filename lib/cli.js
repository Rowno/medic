#!/usr/bin/env node

'use strict';
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const _ = require('lodash');
const chalk = require('chalk');
const figures = require('figures');
const frontMatter = require('front-matter');
const meow = require('meow');
const stdin = require('get-stdin');
const updateNotifier = require('update-notifier');

const medic = require('../');
const pkg = require('../package.json');

const NOT_FOUND = 200;
const INTERNAL_ERROR = 500;
const HELP_FILE_PATH = path.join(__dirname, 'help.txt');


updateNotifier({ pkg }).notify();

const cli = meow({
    pkg,
    help: fs.readFileSync(HELP_FILE_PATH, { encoding: 'utf8' }).trim()
}, {
    alias: {
        compare: 'p',
        concurrency: 'c',
        help: 'h',
        output: 'o',
        version: 'v',
    },
    default: {
        concurrency: 5
    }
});

// Always set a concurrency to avoid DOSing sites on Node >=0.12
http.globalAgent.maxSockets = cli.flags.concurrency;
https.globalAgent.maxSockets = cli.flags.concurrency;


/**
 * Add the terminal status color for the given result to a string.
 * @param {number}  result
 * @param {string}  message
 * @return {string}
 */
function addStatusColor(result, message) {
    let coloredMessage = message;

    if (result.statusCode === NOT_FOUND) {
        coloredMessage = chalk.green(message);
    } else if (result.error || result.statusCode === INTERNAL_ERROR) {
        coloredMessage = chalk.red(message);
    } else {
        coloredMessage = chalk.yellow(message);
    }

    return coloredMessage;
}


stdin().then(function (stdinUrls) {
    let compareFileContent;
    let compareFilePath;
    let outputFilePath;
    let previousResults = [];
    let progress = 1;
    let urls = [];
    let urlsFilePath;
    let urlsString;


    // Require stdin or a urls file
    if (!stdinUrls && !_.isString(cli.input[0])) {
        cli.showHelp();
        process.exit(1);
    }

    // Try reading urls file if no stdin
    if (stdinUrls) {
        urlsString = stdinUrls;
    } else {
        urlsFilePath = path.resolve(cli.input[0]);
        if (!fs.existsSync(urlsFilePath) || !fs.statSync(urlsFilePath).isFile()) {
            console.error('File doesn\'t exist:', urlsFilePath);
            process.exit(1);
        }

        urlsString = fs.readFileSync(urlsFilePath, { encoding: 'utf8' });
    }


    const frontMatterData = frontMatter(urlsString);


    // Parse urls from string
    urls = frontMatterData.body.match(/^https?:\/\/(.*?)$/mg) || [];
    const urlsNumLength = String(urls.length).length;


    if (_.isString(cli.flags.compare)) {
        // Check compare file exists
        compareFilePath = path.resolve(cli.flags.compare);
        if (!fs.existsSync(compareFilePath) || !fs.statSync(compareFilePath).isFile()) {
            console.error('File doesn\'t exist:', compareFilePath);
            process.exit(1);
        }

        // Parse results from file
        compareFileContent = fs.readFileSync(compareFilePath, { encoding: 'utf8' });
        previousResults = JSON.parse(compareFileContent);
    }


    if (_.isString(cli.flags.output)) {
        outputFilePath = path.resolve(cli.flags.output);
    }


    /**
     * Logs the check progress to the terminal.
     * @param {object} result
     */
    function progressLog(result) {
        let icon;
        const progressNumLength = String(progress).length;
        const padding = _.range(0, urlsNumLength - progressNumLength, 0).join('');

        if (result.statusCode === NOT_FOUND) {
            icon = figures.tick;
        } else if (result.error || result.statusCode === INTERNAL_ERROR) {
            icon = figures.cross;
        } else {
            icon = figures.warning;
        }

        console.log(addStatusColor(result,
            padding + progress + '/' + urls.length +
            '  ' +
            icon +
            '  ' +
            (result.error ? 'err' : result.statusCode) +
            '  ' +
            result.url
        ));

        progress += 1;
    }

    return medic.check({
        cookies: frontMatterData.attributes.cookies,
        urls,
        onProgress: progressLog
    }).then(function (results) {
        let resultsString;
        let compareResults = [];

        // Do compare if compare file was given
        if (previousResults) {
            compareResults = medic.compare({
                currentResults: results,
                previousResults
            });
        }

        // Ouput changes if there were any
        if (compareResults.length > 0) {
            console.log();
            console.log(chalk.bold('Changes'));
            console.log();

            compareResults.forEach(function (result) {
                const previousStatusCode = result.previous.error ? 'err' : result.previous.statusCode;
                const currentStatusCode = result.current.error ? 'err' : result.current.statusCode;

                console.log(
                    addStatusColor(result.previous, previousStatusCode),
                    figures.arrowRight,
                    '',
                    addStatusColor(result.current, currentStatusCode),
                    '',
                    result.previous.url
                );
            });
        }

        // Output results if output path was given
        if (outputFilePath) {
            resultsString = JSON.stringify(results, null, 2);
            fs.writeFileSync(outputFilePath, resultsString);
        }
    });
}).catch(function (error) {
    console.error(error.stack || error);
    process.exit(1);
});
