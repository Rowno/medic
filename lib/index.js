'use strict';
var _ = require('lodash');
var bluebird = require('bluebird');
var request = require('request');
bluebird.promisifyAll(request);


/**
 * Checks the status of all the passed URLs.
 * @param  {object}   options
 * @param  {function} callback
 * @return {Promise}
 */
function check(options, callback) {
    options = _.defaults(options, {
        urls: [],
        onProgress: _.noop
    });

    var urlRequests = options.urls.map(function requestUrl(requestUrl) {
        return request.getAsync({
            url: requestUrl,
            jar: request.jar(), // Store cookies (separate for each url)
            headers: { // Pretend to be Chrome for any bad user agent sniffers
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31'
            }
        }).spread(function handleResponse(response) {
            var responseUrl = response.request.uri.href;
            var result = {
                url: requestUrl,
                statusCode: response.statusCode
            };

            // Hack for incorrent ASP.NET 500 error page status code
            if (responseUrl.indexOf('500.aspx') !== -1) {
                result.statusCode = 500;
            }

            if (requestUrl !== responseUrl) {
                result.redirectUrl = responseUrl;
            }

            return result;
        }).error(function handleError(error) {
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
 * @param  {object} options
 * @return {array}
 */
function compare(options) {
    options = _.defaults(options, {
        currentResults: [],
        previousResults: []
    });

    var currentResults = options.currentResults;
    var previousResults = options.previousResults;
    var changedResults = [];

    currentResults.forEach(function compareResult(currentResult) {
        var previousResult = _.find(previousResults, function findPreviousResult(result) {
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
