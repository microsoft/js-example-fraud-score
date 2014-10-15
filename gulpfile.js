/*
 * Copyright (C) 2010-2014 by Revolution Analytics Inc.
 *
 * This program is licensed to you under the terms of Version 2.0 of the
 * Apache License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * Apache License 2.0 (http://www.apache.org/licenses/LICENSE-2.0) for more
 * details.
 */

var gulp       = require('gulp'),
    jshint     = require('gulp-jshint'),
    browserify = require('gulp-browserify'),
    concat     = require('gulp-concat'),
    server     = require('gulp-express'),
    unzip      = require('gulp-unzip');

gulp.task('deployr-deps', function(){  
  gulp.src('./.modules/*.zip')
    .pipe(unzip())
    .pipe(gulp.dest('./node_modules'))
});

gulp.task('lint', function() {
  gulp.src([ '!./client/app/js/bundled.js', 
             './client/app/**/*.js', 
             '!./client/app/bower_components/**/*',
             '!./client/app/js/vendor/**/*' ])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('browserify', function() {
  gulp.src(['client/app/js/main.js'])
  .pipe(browserify({
    insertGlobals: true,
    debug: true
  }))
  .pipe(concat('bundled.js'))
  .pipe(gulp.dest('./client/app/js'))
});

gulp.task('server', function () {
    //start the server at the beginning of the task
    server.run({
        file: 'server.js'
    });

    //restart the server when file changes
    gulp.watch(['client/app/**/*.html'], server.notify);
    gulp.watch(['client/app/js/**/*.js'], ['lint', 'browserify']);
    gulp.watch(['client/app/css/**/*.css']);
});

gulp.task('default', ['lint', 'browserify', 'server'] );
