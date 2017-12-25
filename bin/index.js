#!/usr/bin/env node
"use strict";

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require("path");

var path = _interopRequireWildcard(_path);

var _fsExtraPromise = require("fs-extra-promise");

var fse = _interopRequireWildcard(_fsExtraPromise);

var _colorConsole = require("color-console");

var cConsole = _interopRequireWildcard(_colorConsole);

var _jimp = require("jimp");

var _jimp2 = _interopRequireDefault(_jimp);

var _css = require("css");

var _css2 = _interopRequireDefault(_css);

var _nodeVersion = require("node-version");

var _nodeVersion2 = _interopRequireDefault(_nodeVersion);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

if (_nodeVersion2.default.major < 6) {
    cConsole.red("png-merger requires at least version 6 of NodeJs. Please upgrade!");
    process.exit(1);
}

const cwd = process.cwd(),
      hasOwnProp = (obj, key) => obj.hasOwnProperty(key),
      fileToString = file => {
    try {
        const stream = fse.readFileSync(file);
        return stream.toString("utf8");
    } catch (e) {
        return null;
    }
},
      contain = (obj = {}, val = "") => {
    for (let key of Object.keys(obj)) {
        if (obj[key] === val) {
            return {
                contained: true,
                key
            };
        }
    }
    return {
        contained: false
    };
},
      parseArgs = (args = [], alias = {}) => {
    const res = {};
    args = args.map(arg => arg.replace(/^-+/, ""));
    if (!args.length) {
        let content = fileToString(path.resolve(cwd, ".png-mergerc"));
        content = JSON.parse(content);
        return content;
    }
    for (let arg of args) {
        if (arg.indexOf("=") > -1) {
            arg = arg.split("=");
            if (hasOwnProp(res, arg[0])) {
                if (!Array.isArray(res[arg[0]])) {
                    res[arg[0]] = [res[arg[0]]];
                }
                res[arg[0]].push(arg[1]);
            } else {
                res[arg[0]] = arg[1];
            }
            const {
                contained,
                key
            } = contain(alias, arg[0]);
            if (contained) {
                if (hasOwnProp(res, key)) {
                    if (!Array.isArray(res, key)) {
                        res[key] = [res[key]];
                    }
                    res[key].push(arg[1]);
                } else {
                    res[key] = arg[1];
                }
            }
        } else {
            res[arg] = true;
            const {
                contained,
                key
            } = contain(alias, arg);
            if (contained) {
                res[key] = true;
            }
        }
    }
    return res;
},
      args = parseArgs(process.argv.slice(2), {
    images: "i",
    csses: "c",
    level: "l"
});

const cfgs = {
    images: [],
    csses: [],
    level: Number(args.level || 1)
},
      regs = {
    pngSuffix: /\.png$/,
    cssSuffix: /\.css$/,
    urlRefence: /url\s*\((\s*[A-Za-z0-9\-\_\.\/\:]+\s*)\);?/gi,
    urlPrefix: /^url\(/,
    urlSuffix: /\)[\w\W]+$/
},
      maxPngSize = {
    width: 10000,
    height: 10000
};

let pngInfos = [],
    cssInfos = [];

if (args.images) {
    if (Array.isArray(args.images)) {
        for (let dir of args.images) {
            cfgs.images.push(path.resolve(cwd, dir));
        }
    } else {
        cfgs.images.push(path.resolve(cwd, args.images));
    }
}

if (args.csses) {
    if (Array.isArray(args.csses)) {
        for (let dir of args.csses) {
            cfgs.csses.push(path.resolve(cwd, dir));
        }
    } else {
        cfgs.csses.push(path.resolve(cwd, args.csses));
    }
}

const pickUpCsses = (() => {
    var _ref = _asyncToGenerator(function* (dir) {
        try {
            const files = fse.readdirSync(dir);
            let content, ast;
            for (let file of files) {
                file = path.resolve(dir, file);
                stat = fse.statSync(file);
                if (fse.isDirectorySync(file)) {
                    pickUpCsses(file);
                } else {
                    if (regs.cssSuffix.test(file)) {
                        content = fileToString(file);
                        if (content !== null) {
                            ast = _css2.default.parse(content);
                            cssInfos.push({
                                ast,
                                file
                            });
                        }
                    }
                }
            }
        } catch (e) {}
    });

    return function pickUpCsses(_x) {
        return _ref.apply(this, arguments);
    };
})(),
      pickUpPngs = (() => {
    var _ref2 = _asyncToGenerator(function* (dir) {
        try {
            const files = fse.readdirSync(dir);
            let info;
            for (let file of files) {
                file = path.resolve(dir, file);
                if (fse.isDirectorySync(file)) {
                    pickUpPngs(file);
                } else if (regs.pngSuffix.test(file)) {
                    info = yield _jimp2.default.read(file);
                    info.bitmap.data = info.bitmap.data.toString("utf8");
                    delete info.bitmap.data;
                    pngInfos.push(_extends({
                        file
                    }, info.bitmap));
                }
            }
        } catch (e) {}
    });

    return function pickUpPngs(_x2) {
        return _ref2.apply(this, arguments);
    };
})(),
      sortBySize = () => {
    return pngInfos.sort((prev, next) => {
        return prev.width - next.width;
    });
},
      toRows = () => {
    let tmp;
    const res = [];
    for (let i = 0; i < pngInfos.length;) {
        i += 9;
    }
    return res;
};

const init = (() => {
    var _ref3 = _asyncToGenerator(function* ({
        images = [],
        csses = [],
        level = 1
    }) {
        const merged = [],
              canvases = [];
        for (let dir of images) {
            yield pickUpPngs(dir);
        }
        for (let dir of csses) {
            yield pickUpCsses(dir);
        }
        pngInfos = sortBySize(pngInfos);
    });

    return function init(_x3) {
        return _ref3.apply(this, arguments);
    };
})();

init(cfgs);