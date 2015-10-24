#!/usr/bin/env node

/* eslint-disable no-sync, no-process-exit */
'use strict';
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');

var _ = require('lodash');
var chalk = require('chalk');
var figures = require('figures');
var meow = require('meow');
var stdin = require('get-stdin');
var updateNotifier = require('update-notifier');

var medic = require('../');
var pkg = require('../package.json');

var NOT_FOUND = 200;
var INTERNAL_ERROR = 500;
var HELP_FILE_PATH = path.join(__dirname, 'help.txt');
var cli;


updateNotifier({ pkg: pkg }).notify();

cli = meow({
    pkg: pkg,
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
    var coloredMessage = message;

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
    var urls = [];
    var urlsNumLength;
    var previousResults = [];
    var progress = 1;
    var urlsString;
    var urlsFilePath;
    var compareFilePath;
    var compareFileContent;
    var outputFilePath;


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


    // Parse urls from string
    urls = urlsString.match(/^https?:\/\/(.*?)$/mg) || [];
    urlsNumLength = String(urls.length).length;


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
        var icon;
        var progressNumLength = String(progress).length;
        var padding = _.range(0, urlsNumLength - progressNumLength, 0).join('');

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
        urls: urls,
        onProgress: progressLog
    }).then(function processResults(results) {
        var resultsString;
        var compareResults = [];

        // Do compare if compare file was given
        if (previousResults) {
            compareResults = medic.compare({
                currentResults: results,
                previousResults: previousResults
            });
        }

        // Ouput changes if there were any
        if (compareResults.length > 0) {
            console.log();
            console.log(chalk.bold('Changes'));
            console.log();

            compareResults.forEach(function logCompareResult(result) {
                var previousStatusCode = result.previous.error ? 'err' : result.previous.statusCode;
                var currentStatusCode = result.current.error ? 'err' : result.current.statusCode;

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
