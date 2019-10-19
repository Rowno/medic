'use strict';
const path = require('path');
const fs = require('fs');
const {exec} = require('child_process');
const {expect} = require('chai');
const express = require('express');

const CLI = path.resolve(require('../package.json').bin.medic);
const URLS_FILE = path.join(__dirname, 'fixtures/urls.txt');
const TEMP_OUTPUT_FILE = path.join(__dirname, 'fixtures/temp-results.json');
const COMPARE_FILE = path.join(__dirname, 'fixtures/results-previous.json');
const PORT = 15000;
const COOKIE_STATUS = 400;
const HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head><body></body></html>';
const app = express();
let server;
const fixtureOutput = [
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
        const child = exec(
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
        const child = exec(
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
        const fixture = [{
            url: 'http://localhost:' + PORT + '/1/',
            statusCode: 200
        }, {
            url: 'http://localhost:' + PORT + '/2/',
            statusCode: 200
        }];

        const child = exec(
            CLI + ' ' + URLS_FILE + ' --output ' + TEMP_OUTPUT_FILE,
            { cwd: __dirname },
            function (error, stdout, stderr) {
                let outputFileContent;

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
        let fixture = [
            '',
            'Changes',
            '',
            '404 →  200  http://localhost:' + PORT + '/1/',
            '',
        ].join('\n');

        fixture = fixtureOutput + fixture;

        const child = exec(
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
        const child = exec(
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
