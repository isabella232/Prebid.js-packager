
let shell   = require('shelljs'),
    del     = require('del'),
    url     = require('url'),
    crypto  = require('crypto'),
    path    = require('path'),
    http    = require('http'),
    fs      = require('fs'),
    uglify  = require('uglify-js'),
    _       = require('lodash');

function download(url, dest, cb) {
    let file = fs.createWriteStream(dest);
    return http.get(url, function (response) {
        response.pipe(file);
        file.on('finish', function () {
            file.close(cb);
        });
    }).on('error', function (err) {
        fs.unlink(dest);
        if (cb) {
            cb(err.message);
        }
    });
}

function install(code, config) {
    let workingDir = path.join(config.workingDir, 'code');
    let outputDir = path.join(config.outputDir, 'code');

    console.log("Cleaning code installer working directory...");

    del.sync(workingDir);
    shell.mkdir('-p', outputDir);

    return (
        Promise.all(code.map(resource => new Promise((resolve, reject) => {
            let hashName = crypto.createHash("md5")
                                .update(resource)
                                .digest('hex')
                                .substring(0, 7) + '.js';
            let outputFile = path.join(outputDir, hashName);

            // handle external resources
            if (url.parse(resource).host) {
                console.log(`Downloading code ${resource}...`);

                download(resource, outputFile, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve([resource, outputFile]);
                });
            } else if (fs.existsSync(resource)) {
                console.log(`Copying code file ${resource}...`);

                // TODO: maybe add some build tools here, like browserify or webpack and stuff
                fs.readFile(resource, 'utf-8', (err, data) => {
                    if (err) {
                        return reject(err);
                    }

                    let minified = uglify.minify(data);

                    if (minified.error) {
                        return reject(minified.error);
                    }

                    data = minified.code;

                    fs.writeFile(outputFile, data, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve([resource, outputFile]);
                    });
                });
            } else {
                fs.writeFile(outputFile, resource, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve([resource, outputFile]);
                });
                resolve([resource, outputFile]);
            }
        })))
    ).then(results => results.reduce((manifest, result) => {
        manifest[result[0]] = result[1];
        return manifest;
    }, {}));
}


module.exports = {
    install
};