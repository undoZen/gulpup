var http = require('http');
var url = require('url');

function is404(obj, cb) {
  if ('string' == typeof obj) obj = url.parse(obj);
  obj.method = 'HEAD';
  http.request(obj)
  .on('response', function (response) {
    cb(response.statusCode == 404);
  })
  .end();
}

var gutil = require('gulp-util');
var through = require('through2');
var UPYun = require('upyun-official').UPYun;

exports = module.exports = function (opts) {
  var upyun = new UPYun(opts.bucketname, opts.username, opts.password);
  return through.obj(function (file, enc, cb) {
    var that = this;
    function done() {
      that.push(file);
      cb();
    }

    if (file.isNull()) return done();

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('gulpup', 'Streaming not supported'));
      return done();
    }

    var upload = function () {
      var filePath = file.path;
      var cwd = process.cwd();
      // you don't want to upload your file to http://example.b0.upaiyun.com/Users/undozen/projects/test/dist/example.js
      // cut to current directory to get http://example.b0.upaiyun.com/dist/example.js
      if (filePath.indexOf(cwd) == 0) filePath = filePath.substring(cwd.length);
      if (filePath[0] != '/') filePath = '/' + filePath;
      upyun.writeFile(file.path, file.contents, true, function (err) {
        if (err) {
          this.emit('error', new gutil.PluginError('gulpup:', err));
        }
        gutil.log('gulpup: ' + prefix + file.path + ' **uploaded**');
        return done();
      });
    }

    if (opts.force) {
      upload();
    } else {
      var prefix = 'http://' + (opts.domain || opts.bucketname + '.b0.upaiyun.com');
      gutil.log('gulpup: checking ' + prefix + file.path);
      is404(prefix + file.path, function (noneExists) {
        if (noneExists) upload();
        else {
          gutil.log('gulpup: ' + file.path + ' **existed** on upyun server.');
          done();
        }
      });
    }

  });
}
