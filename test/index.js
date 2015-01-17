/*jshint expr:true */
'use strict';

var expect = require('chai').expect;
var nock = require('nock');
var medic = require('../');

var HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head><body></body></html>';


describe('index', function () {
    describe('#check', function () {
        it('should get the status of urls', function () {
            var fixture = [{
                'url': 'http://localhost/1/',
                'statusCode': 200
            }, {
                'url': 'http://localhost/2/',
                'statusCode': 404
            }];

            nock('http://localhost')
                .get('/1/')
                .reply(200, HTML)
                .get('/2/')
                .reply(404, HTML);

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
            var fixture = [{
                'url': 'http://localhost/1/',
                'statusCode': 200,
                'redirectUrl': 'http://localhost/2/'
            }];

            nock('http://localhost')
                .get('/1/')
                .reply(301, HTML, {
                    'Location': 'http://localhost/2/'
                })
                .get('/2/')
                .reply(200, HTML);

            return medic.check({
                urls: ['http://localhost/1/']
            }).then(function (result) {
                expect(result).to.deep.equal(fixture);
            });
        });


        it('should set status code to 500 for ASP.NET 500 error page', function () {
            var fixture = [{
                'url': 'http://localhost/errors/500.aspx?aspxerrorpath=/1/',
                'statusCode': 500
            }];

            nock('http://localhost')
                .get('/errors/500.aspx?aspxerrorpath=/1/')
                .reply(200, HTML);

            return medic.check({
                urls: [
                    'http://localhost/errors/500.aspx?aspxerrorpath=/1/'
                ]
            }).then(function (result) {
                expect(result).to.deep.equal(fixture);
            });
        });


        it('should call onProgress function with each URL check', function () {
            var fixture = [{
                'url': 'http://localhost/1/',
                'statusCode': 200
            }, {
                'url': 'http://localhost/2/',
                'statusCode': 404
            }];
            var count = 0;

            nock('http://localhost')
                .get('/1/')
                .reply(200, HTML)
                .get('/2/')
                .reply(404, HTML);

            return medic.check({
                urls: [
                    'http://localhost/1/',
                    'http://localhost/2/'
                ],
                onProgress: function (result) {
                    expect(result, 'progress result').to.deep.equal(fixture[count]);
                    count += 1;
                }
            }).then(function (result) {
                expect(count, 'progress count').to.equal(2);
                expect(result, 'final result').to.deep.equal(fixture);
            });
        });


        it('should support standard callbacks', function (done) {
            var fixture = [{
                'url': 'http://localhost/1/',
                'statusCode': 200
            }];

            nock('http://localhost')
                .get('/1/')
                .reply(200, HTML);

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
    });


    describe('#compare', function () {
        it('should return results that have different status codes', function () {
            var fixtureCurrent = [{
                'url': 'http://localhost/1/',
                'statusCode': 200
            }, {
                'url': 'http://localhost/2/',
                'statusCode': 404
            }];
            var fixturePrevious = [{
                'url': 'http://localhost/1/',
                'statusCode': 200
            }, {
                'url': 'http://localhost/2/',
                'statusCode': 200
            }];
            var fixtureCompare = [{
                current: {
                    'url': 'http://localhost/2/',
                    'statusCode': 404
                },
                previous: {
                    'url': 'http://localhost/2/',
                    'statusCode': 200
                }
            }];

            var result = medic.compare({
                currentResults: fixtureCurrent,
                previousResults: fixturePrevious
            });

            expect(result).to.deep.equal(fixtureCompare);
        });
    });
});


