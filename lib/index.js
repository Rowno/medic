'use strict';
const _ = require('lodash');
const bluebird = require('bluebird');
const request = require('request');
bluebird.promisifyAll(request);


/**
 * Checks the status of all the passed URLs.
 * @param  {object}   opt
 * @param  {function} callback
 * @return {Promise}
 */
function check(opt, callback) {
    const options = _.defaults(opt, {
        urls: [],
        cookies: [],
        onProgress: _.noop,
    });

    const urlRequests = options.urls.map(function (requestUrl) {
        const jar = request.jar();

        options.cookies.forEach(function (cookie) {
            jar.setCookie(request.cookie(cookie), requestUrl);
        });

        return request.getAsync({
            url: requestUrl,
            jar, // Store cookies (separate for each url)
            gzip: true,
            headers: { // Pretend to be Chrome for any bad user agent sniffers
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31'
            }
        }).spread(function (response, body) {
            const responseUrl = response.request.uri.href;
            const result = {
                url: requestUrl,
                statusCode: response.statusCode
            };

            // Hack for incorrent status code on ASP.NET 500 error page and
            // misc ASP.NET server-side errors that bypass the 500 error page
            if (responseUrl.indexOf('500.aspx') >= 0 ||
                body.indexOf('UnhandledException') >= 0) {
                result.statusCode = 500;
            }

            if (requestUrl !== responseUrl) {
                result.redirectUrl = responseUrl;
            }

            return result;
        }).error(function (error) {
            return {
                url: requestUrl,
                error: error.cause.message
            };
        }).tap(options.onProgress);
    });

    return bluebird.all(urlRequests).nodeify(callback);
}


/**
 * Compares 2 result sets to find any changes.
 * @param  {object} opt
 * @return {array}
 */
function compare(opt) {
    const changedResults = [];

    const options = _.defaults(opt, {
        currentResults: [],
        previousResults: []
    });

    const {currentResults, previousResults} = options;

    currentResults.forEach(function (currentResult) {
        const previousResult = _.find(previousResults, function (result) {
            return currentResult.url === result.url;
        });

        if (!previousResult) {
            return;
        }

        if (currentResult.statusCode !== previousResult.statusCode) {
            changedResults.push({
                current: currentResult,
                previous: previousResult
            });
        }
    });

    return changedResults;
}


exports.check = check;
exports.compare = compare;
