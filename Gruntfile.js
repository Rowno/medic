'use strict';
var loadGruntTasks = require('load-grunt-tasks');
var timeGrunt = require('time-grunt');


module.exports = function (grunt) {
    timeGrunt(grunt);

    grunt.initConfig({
        eslint: {
            all: [
                '**/*.js',
                '!node_modules/**/*'
            ]
        },
        mochacli: {
            all: []
        }
    });

    loadGruntTasks(grunt);
    grunt.registerTask('test', ['mochacli', 'eslint']);
    grunt.registerTask('default', 'test');
};
