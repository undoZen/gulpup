var http = require('http');
var url = require('url');
var fs = require('fs');

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
  var uploadedFilePath = process.cwd() + '/.upyun.uploaded.list';
  var exists = fs.existsSync(uploadedFilePath);
  var uploaded = exists ? JSON.parse('{' + fs.readFileSync(uploadedFilePath, 'utf-8').trim().replace(/,$/, '') + '}') : {};

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

    var filePath = file.path;
    if (filePath.indexOf(file.base) == 0) filePath = filePath.substring(file.base.length);
    if (filePath[0] != '/') filePath = '/' + filePath;

    var upload = function () {
      // you don't want to upload your file to http://example.b0.upaiyun.com/Users/undozen/projects/test/dist/js/example.js
      // cut to current directory to get http://example.b0.upaiyun.com/js/example.js
      upyun.writeFile(filePath, file.contents, true, function (err) {
        if (err) {
          this.emit('error', new gutil.PluginError('gulpup:', err));
        }
        uploaded[filePath] = 1;
        fs.appendFile(uploadedFilePath, '\n"'+filePath+'": 1,');
        gutil.log('gulpup: ' + prefix + filePath + ' **uploaded**');
        return done();
      });
    }

    if (opts.force) {
      upload();
    } else {
      var prefix = 'http://' + (opts.domain || opts.bucketname + '.b0.upaiyun.com');
      gutil.log('gulpup: checking ' + prefix + filePath);
      if (uploaded[filePath]) {
        gutil.log('gulpup: ' + filePath + ' **already uploaded**.');
        done();
        return;
      }
      is404(prefix + filePath, function (noneExists) {
        if (noneExists) upload();
        else {
          uploaded[filePath] = 1;
          fs.appendFile(uploadedFilePath, '\n"'+filePath+'": 1,');
          gutil.log('gulpup: ' + filePath + ' **existed** on upyun server.');
          done();
        }
      });
    }

  });
}
