#!/usr/bin/env node
'use strict';
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var meow = require('meow');
var chalk = require('chalk');
var figures = require('figures');
var medic = require('../lib');

var HELP_FILE_PATH = path.join(__dirname, 'help.txt');
var urls = [];
var previousResults = [];
var progress = 1;
var urlsFilePath;
var urlsFileContent;
var compareFilePath;
var compareFileContent;
var saveFilePath;


var cli = meow({
    pkg: require('../package.json'),
    help: fs.readFileSync(HELP_FILE_PATH, {encoding:'utf8'}).trim()
}, {
    alias: {
        compare: 'c',
        help: 'h',
        save: 's',
    }
});


// Require a urls file
if (!_.isString(cli.input[0])) {
    cli.showHelp();
    process.exit(1);
}


// Check that urls file exists
urlsFilePath = path.resolve(cli.input[0]);
if (!fs.existsSync(urlsFilePath) || !fs.statSync(urlsFilePath).isFile()) {
    console.log('File doesn\'t exist:', urlsFilePath);
    process.exit(1);
}

// Parse urls from file
urlsFileContent = fs.readFileSync(urlsFilePath, {encoding:'utf8'});
urls = urlsFileContent.match(/^https?:\/\/(.*?)$/mg);


if (_.isString(cli.flags.compare)) {
    // Check compare file exists
    compareFilePath = path.resolve(cli.flags.compare);
    if (!fs.existsSync(compareFilePath) || !fs.statSync(compareFilePath).isFile()) {
        console.log('File doesn\'t exist:', compareFilePath);
        process.exit(1);
    }

    // Parse results from file
    compareFileContent = fs.readFileSync(compareFilePath, {encoding:'utf8'});
    previousResults = JSON.parse(compareFileContent);
}


if (_.isString(cli.flags.save)) {
    saveFilePath = path.resolve(cli.flags.save);
}


/**
 * Add the terminal color for the given status code to a string.
 * @param {number}  statusCode
 * @param {string}  message
 * @return {string}
 */
function addStatusColor(statusCode, message) {
    if (statusCode === 200) {
        message = chalk.green(message);
    } else if (statusCode === 500) {
        message = chalk.red(message);
    } else {
        message = chalk.yellow(message);
    }

    return message;
}


/**
 * Logs the check progress to the terminal.
 * @param {object} result
 */
function progressLog(result) {
    var icon;

    if (result.statusCode === 200) {
        icon = figures.tick;
    } else if (result.statusCode === 500) {
        icon = figures.cross;
    } else {
        icon = figures.warning;
    }

    console.log(addStatusColor(result.statusCode,
        progress + '/' + urls.length +
        '  ' +
        icon +
        '  ' +
        result.statusCode +
        '  ' +
        result.url
    ));

    progress += 1;
}


medic.check({
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
            var previousStatusCode = result.previous.statusCode;
            var currentStatusCode = result.current.statusCode;

            console.log(
                addStatusColor(previousStatusCode, previousStatusCode),
                figures.arrowRight,
                addStatusColor(currentStatusCode, currentStatusCode),
                '',
                result.previous.url
            );
        });
    }

    // Save results if save path was given
    if (saveFilePath) {
        resultsString = JSON.stringify(results, null, 2);
        fs.writeFileSync(saveFilePath, resultsString);
    }
});
