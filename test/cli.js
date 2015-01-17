/*jshint expr:true */
'use strict';

var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;
var expect = require('chai').expect;
var connect = require('connect');

var CLI = path.resolve(require('../package.json').bin.medic);
var URLS_FILE = 'fixtures/urls.txt';
var TEMP_SAVE_FILE = path.join(__dirname, 'fixtures/temp-results.json');
var COMPARE_FILE = 'fixtures/results-previous.json';
var PORT = 15000;
var HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head><body></body></html>';
var app = connect();
var server;
var fixtureOutput = [
    '1/2  ✔  200  http://localhost:' + PORT + '/1/',
    '2/2  ✔  200  http://localhost:' + PORT + '/2/',
    '',
].join('\n');


app.use(function (req, res){
    res.end(HTML);
});


describe('cli', function () {
    before(function (done) {
        server = app.listen(15000, 'localhost', done);
    });

    after(function () {
        if (fs.existsSync(TEMP_SAVE_FILE)) {
            fs.unlinkSync(TEMP_SAVE_FILE);
        }
        server.close();
    });

    it('should get status for urls in file', function (done) {
        exec(
            CLI + ' ' + URLS_FILE,
            {cwd:__dirname},
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                expect(stdout, 'stdout').to.equal(fixtureOutput);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );
    });

    it('should save results to file', function (done) {
        var fixture = [{
            'url': 'http://localhost:' + PORT + '/1/',
            'statusCode': 200
        }, {
            'url': 'http://localhost:' + PORT + '/2/',
            'statusCode': 200
        }];

        exec(
            CLI + ' ' + URLS_FILE +' -s ' + TEMP_SAVE_FILE,
            {cwd:__dirname},
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                var saveFileContent = fs.readFileSync(TEMP_SAVE_FILE, {encoding:'utf8'});
                saveFileContent = JSON.parse(saveFileContent);

                expect(saveFileContent, 'saved results').to.deep.equal(fixture);
                expect(stdout, 'stdout').to.equal(fixtureOutput);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );
    });

    it('should output compare results', function (done) {
        var fixture = [
            '',
            'Changes',
            '',
            '404 →  200  http://localhost:15000/1/',
            '',
        ].join('\n');

        fixture = fixtureOutput + fixture;

        exec(
            CLI + ' ' + URLS_FILE +' -c ' + COMPARE_FILE,
            {cwd:__dirname},
            function (error, stdout, stderr) {
                if (error) {
                    return done(error);
                }

                expect(stdout, 'stdout').to.equal(fixture);
                expect(stderr, 'stderr').to.equal('');
                done();
            }
        );
    });
});


