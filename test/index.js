'use strict';
const {expect} = require('chai');
const nock = require('nock');
const medic = require('../');

const SUCCESS = 200;
const MOVED = 301;
const NOT_FOUND = 404;
const HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head><body></body></html>';


describe('index', function () {
    describe('#check', function () {
        it('should get the status of urls', function () {
            const fixture = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS
            }, {
                url: 'http://localhost/2/',
                statusCode: NOT_FOUND
            }];

            nock('http://localhost')
                .get('/1/')
                .reply(SUCCESS, HTML)
                .get('/2/')
                .reply(NOT_FOUND, HTML);

            return medic.check({
                urls: [
                    'http://localhost/1/',
                    'http://localhost/2/'
                ]
            }).then(function (result) {
                expect(result).to.deep.equal(fixture);
            });
        });


        it('should track redirects', function () {
            const fixture = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS,
                redirectUrl: 'http://localhost/2/'
            }];

            nock('http://localhost')
                .get('/1/')
                .reply(MOVED, HTML, {
                    Location: 'http://localhost/2/'
                })
                .get('/2/')
                .reply(SUCCESS, HTML);

            return medic.check({
                urls: ['http://localhost/1/']
            }).then(function (result) {
                expect(result).to.deep.equal(fixture);
            });
        });


        it('should set status code to 500 for ASP.NET 500 error page', function () {
            const fixture = [{
                url: 'http://localhost/errors/500.aspx?aspxerrorpath=/1/',
                statusCode: 500
            }];

            nock('http://localhost')
                .get('/errors/500.aspx?aspxerrorpath=/1/')
                .reply(SUCCESS, HTML);

            return medic.check({
                urls: [
                    'http://localhost/errors/500.aspx?aspxerrorpath=/1/'
                ]
            }).then(function (result) {
                expect(result).to.deep.equal(fixture);
            });
        });


        it('should call onProgress function with each URL check', function () {
            const fixture = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS
            }, {
                url: 'http://localhost/2/',
                statusCode: NOT_FOUND
            }];
            let count = 0;

            nock('http://localhost')
                .get('/1/')
                .reply(SUCCESS, HTML)
                .get('/2/')
                .reply(NOT_FOUND, HTML);

            return medic.check({
                urls: [
                    'http://localhost/1/',
                    'http://localhost/2/'
                ],
                onProgress (result) {
                    expect(result, 'progress result').to.deep.equal(fixture[count]);
                    count += 1;
                }
            }).then(function (result) {
                expect(count, 'progress count').to.equal(2);
                expect(result, 'final result').to.deep.equal(fixture);
            });
        });


        it('should support standard callbacks', function (done) {
            const fixture = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS
            }];

            nock('http://localhost')
                .get('/1/')
                .reply(SUCCESS, HTML);

            medic.check({
                urls: ['http://localhost/1/']
            }, function (error, result) {
                if (error) {
                    return done(error);
                }

                expect(result, 'final result').to.deep.equal(fixture);
                done();
            });
        });


        it('should set cookies', function (done) {
            const fixture = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS
            }];

            nock('http://localhost', { reqheaders: { Cookie: 'Location=nz' } })
                .get('/1/')
                .reply(SUCCESS, HTML);

            medic.check({
                cookies: ['Location=nz'],
                urls: ['http://localhost/1/'],
            }, function (error, result) {
                if (error) {
                    return done(error);
                }

                expect(result, 'final result').to.deep.equal(fixture);
                done();
            });
        });
    });


    describe('#compare', function () {
        it('should return results that have different status codes', function () {
            const fixtureCurrent = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS
            }, {
                url: 'http://localhost/2/',
                statusCode: NOT_FOUND
            }];
            const fixturePrevious = [{
                url: 'http://localhost/1/',
                statusCode: SUCCESS
            }, {
                url: 'http://localhost/2/',
                statusCode: SUCCESS
            }];
            const fixtureCompare = [{
                current: {
                    url: 'http://localhost/2/',
                    statusCode: NOT_FOUND
                },
                previous: {
                    url: 'http://localhost/2/',
                    statusCode: SUCCESS
                }
            }];

            const result = medic.compare({
                currentResults: fixtureCurrent,
                previousResults: fixturePrevious
            });

            expect(result).to.deep.equal(fixtureCompare);
        });
    });
});
