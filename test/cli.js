/* eslint-disable no-sync */
'use strict';
var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;
var expect = require('chai').expect;
var express = require('express');

var CLI = path.resolve(require('../package.json').bin.medic);
var URLS_FILE = path.join(__dirname, 'fixtures/urls.txt');
var TEMP_OUTPUT_FILE = path.join(__dirname, 'fixtures/temp-results.json');
var COMPARE_FILE = path.join(__dirname, 'fixtures/results-previous.json');
var PORT = 15000;
var COOKIE_STATUS = 400;
var HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head><body></body></html>';
var app = express();
var server;
var fixtureOutput = [
    '1/2  ✔  200  http://localhost:' + PORT + '/1/',
    '2/2  ✔  200  http://localhost:' + PORT + '/2/',
    '',
].join('\n');


app.use(function (req, res) {
    if (req.headers.cookie === 'Location=nz') {
        res.status(COOKIE_STATUS).send(HTML);
    } else {
        res.end(HTML);
    }
});


describe('cli', function () {
    before(function (done) {
        server = app.listen(PORT, 'localhost', done);
    });

    after(function () {
        if (fs.existsSync(TEMP_OUTPUT_FILE)) {
            fs.unlinkSync(TEMP_OUTPUT_FILE);
        }
        server.close();
    });


    it('should get status of urls in file', function (done) {
        var child = exec(
            CLI + ' ' + URLS_FILE,
            { cwd: __dirname },
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                expect(stdout, 'stdout').to.equal(fixtureOutput);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );

        child.stdin.end();
    });


    it('should get status of urls passed through stdin', function (done) {
        var child = exec(
            CLI,
            { cwd: __dirname },
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                expect(stdout, 'stdout').to.equal(fixtureOutput);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );

        fs.createReadStream(URLS_FILE, { encoding: 'utf8' }).pipe(child.stdin);
    });


    it('should output results to file', function (done) {
        var fixture = [{
            url: 'http://localhost:' + PORT + '/1/',
            statusCode: 200
        }, {
            url: 'http://localhost:' + PORT + '/2/',
            statusCode: 200
        }];

        var child = exec(
            CLI + ' ' + URLS_FILE + ' --output ' + TEMP_OUTPUT_FILE,
            { cwd: __dirname },
            function (error, stdout, stderr) {
                var outputFileContent;

                if (error) {
                    return done(error);
                }

                outputFileContent = fs.readFileSync(TEMP_OUTPUT_FILE, { encoding: 'utf8' });
                outputFileContent = JSON.parse(outputFileContent);

                expect(outputFileContent, 'outputted results').to.deep.equal(fixture);
                expect(stdout, 'stdout').to.equal(fixtureOutput);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );

        child.stdin.end();
    });


    it('should log compare results', function (done) {
        var child;
        var fixture = [
            '',
            'Changes',
            '',
            '404 →  200  http://localhost:' + PORT + '/1/',
            '',
        ].join('\n');

        fixture = fixtureOutput + fixture;

        child = exec(
            CLI + ' ' + URLS_FILE + ' --compare ' + COMPARE_FILE,
            { cwd: __dirname },
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                expect(stdout, 'stdout').to.equal(fixture);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );

        child.stdin.end();
    });


    it('should set cookies from yaml front matter', function (done) {
        var child;

        child = exec(
            CLI + ' ' + path.join(__dirname, 'fixtures/cookies.txt'),
            { cwd: __dirname },
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                expect(stdout, 'stdout').to.equal('1/1  ⚠  ' + COOKIE_STATUS + '  http://localhost:' + PORT + '/1/\n');
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );

        child.stdin.end();
    });
});
