const fs = require('fs');
const gulp = require('gulp');
const concat = require('concat-stream');
const del = require('del');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const browserify = require('browserify');
const watchify = require('watchify');
const source = require('vinyl-source-stream');
const gutil = require('gulp-util');
const buffer = require('vinyl-buffer');
const plumber = require('gulp-plumber');
const uglify = require('gulp-uglify');
const pump = require('pump');
const debounce = require('lodash').debounce;

const isDebug = true;

const bundleConfigLocation = 'bundle-config.json';

//default error handler
function xerr(ee){
	return ee.on('error', gutil.log);
}

function toArray(sth){
	return [].concat(sth).filter(Boolean);
}

function getBundleConfig(name){
	try{
		var config = JSON.parse(fs.readFileSync(bundleConfigLocation));
		return (config && name)?config[name]:config;
	}catch(e){
		console.error(e);
	}
	return null;
}

function AsyncCounter(done, msg){
	var total = 0,
		cur = 0;
	return () => {
		total ++;
		console.log('['+msg+']: total=', total);
		return () => {
			cur ++;
			console.log('['+msg+']: cur=', cur, ', done='+(cur >= total));
			cur >= total && typeof done.call == 'function' && done.call();
		};
	};
}

function doSass(done){
	console.log('do sass ...');

	done = done || function(){};

	gulp.src(['src/css/sass/**/*.scss'])
        .pipe(plumber())
		.pipe(xerr(sourcemaps.init()))
		.pipe(sass().on('error', sass.logError))
		.pipe(xerr(sourcemaps.write('./')))
		.pipe(gulp.dest('build/css'))
		.on('end', done);
}

function doCopyres(done){
	console.log('do copy resources ...');

	done = done || function(){};

	const counter = AsyncCounter(done, 'copyres');

	gulp.src(['src/*.json', 'src/*.html']).pipe(plumber()).pipe(gulp.dest('build/')).on('end', counter());
	gulp.src(['src/html/**/*']).pipe(plumber()).pipe(gulp.dest('build/html/')).on('end', counter());
	gulp.src(['!(src/css/**/*.scss)', 'src/css/**/*']).pipe(plumber()).pipe(gulp.dest('build/css/')).on('end', counter());
	gulp.src(['src/img/**/*']).pipe(plumber()).pipe(gulp.dest('build/img/')).on('end', counter());
}

function doBundleExternals(done){
	console.log('do bundle externals ...');

	done = done || function(){};

	const exts = getBundleConfig('common');

	if(!exts){
		done();
		return;
	}

	pump([
		browserify({ 'debug': isDebug }).require(exts).bundle(),
		source('common.js'),
		buffer(),
		uglify(),
		gulp.dest('build/lib')
	], done);
	
	/*
	xerr(xerr(browserify({ 'debug': isDebug })
		.require(exts))
		.bundle())
		.pipe(plumber())
		.pipe(xerr(source('common.js')))
		.pipe(gulp.dest('build/lib'))
		.on('end', done);
	 */
}

function doBundleSources(done){
	console.log('do bundle sources ...');

	done = done || function(){};

	const counter = AsyncCounter(done, 'bundle-sources'),
		  config = getBundleConfig();

	if(!config){
		done();
		return;
	}

	config.entries.forEach(entry => {
		xerr(xerr(browserify({ 'debug': isDebug })
			.add(entry.file)
			.external(config.common))
			.bundle())
			.pipe(plumber())
			.pipe(xerr(source(entry.name)))
			.pipe(xerr(buffer()))
			.pipe(xerr(sourcemaps.init({ 'loadMaps': true })))
			.on('error', gutil.log)
			.pipe(xerr(sourcemaps.write('./')))
			.pipe(gulp.dest('build/js'))
			.on('end', counter());
	});
}

gulp.task('clean', () => {
	return del('build');
});

gulp.task('copyres', ['clean'], (cb) => {
	doCopyres(cb);
});

gulp.task('sass', ['copyres'], (cb) => {
	doSass(cb);
});

gulp.task('bundle-externals', ['sass'], (cb) => {
	doBundleExternals(cb);
});

gulp.task('bundle-sources', ['bundle-externals'], (cb) => {
	doBundleSources(cb);
});

gulp.task('watch-res', ['build'], () => {
	gulp.watch([
		'!src/css/**/*.scss',
		'!src/js/**/*',
		'src/css/**/*.css',
		'src/img/**/*',
		'src/html/**/*.html',
		'src/*.html',
		'src/*.json'
	], () => {
		doCopyres();
	});
});

gulp.task('watch-sass', ['build'], () => {
	gulp.watch([
		'src/css/sass/**/*.scss'
	], () => {
		doSass();
	});
});

gulp.task('watch-sources', ['build'], () => {
	var doBundle = debounce(() => {
		doBundleExternals();
		doBundleSources();
	}, 1500);

	gulp.watch([
		'src/js/**/*.js'
	], doBundle);

	gulp.watch([bundleConfigLocation], doBundle);
});

gulp.task('watch', ['build', 'watch-res', 'watch-sass', 'watch-sources'], cb => cb());

gulp.task('build', ['clean', 'copyres', 'sass', 'bundle-externals', 'bundle-sources'], cb => cb());

gulp.task('default', ['build']);
