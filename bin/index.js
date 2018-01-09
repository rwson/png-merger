#!/usr/bin/env node
"use strict";

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require("path");

var path = _interopRequireWildcard(_path);

var _fsExtraPromise = require("fs-extra-promise");

var fse = _interopRequireWildcard(_fsExtraPromise);

var _colorConsole = require("color-console");

var cConsole = _interopRequireWildcard(_colorConsole);

var _css = require("css");

var _css2 = _interopRequireDefault(_css);

var _images = require("images");

var _images2 = _interopRequireDefault(_images);

var _puppeteer = require("puppeteer");

var _puppeteer2 = _interopRequireDefault(_puppeteer);

var _nodeVersion = require("node-version");

var _nodeVersion2 = _interopRequireDefault(_nodeVersion);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

if (_nodeVersion2.default.major < 6) {
    cConsole.red("png-merger requires at least version 6 of NodeJs. Please upgrade!");
    process.exit(1);
}

let pngInfos = [],
    cssInfos = [],
    tipPath;

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
    level: "l",
    size: "s"
});

const cfgs = {
    images: [],
    csses: [],
    level: Number(args.level || 1),
    max: {
        width: Number(args.size.split("x")[0]),
        height: Number(args.size.split("x")[1])
    }
},
      regs = {
    pngSuffix: /\.png$/,
    cssSuffix: /\.css$/,
    urlRefence: /url\s*\((\s*[A-Za-z0-9\-\_\.\/\:]+\s*)\);?/gi,
    urlPrefix: /^url\(/,
    urlSuffix: /\)[\w\W]+$/
};

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
                    info = (0, _images2.default)(file).size();
                    if (info.width <= cfgs.max.width && info.height <= cfgs.max.height) {
                        pngInfos.push(_extends({
                            file
                        }, info));
                    }
                }
            }
        } catch (e) {}
    });

    return function pickUpPngs(_x2) {
        return _ref2.apply(this, arguments);
    };
})(),
      sortBy = (arr, width = false) => {
    return arr.sort((prev, next) => {
        if (width) {
            return prev.width - next.width;
        }
        return prev.height - next.height;
    });
},
      maxHeight = row => {
    return row[row.length - 1].height;
},
      toRows = () => {
    let row,
        rowWidth,
        colHeight,
        rowIndex,
        colIndex,
        res = [];
    for (let i = 0; i < pngInfos.length;) {
        row = pngInfos.slice(i, i + 9);
        row = sortBy(row);
        row = row.map((item, index) => {
            item.pos = {};
            if (i === 0) {
                if (index === 0) {
                    item.pos = {
                        x: 0,
                        y: 0
                    };
                } else {
                    item.pos = {
                        y: 0
                    };
                    rowWidth = 0;
                    for (rowIndex = 0; rowIndex < index; rowIndex++) {
                        rowWidth += row[rowIndex].width;
                    }
                    item.pos.x = rowWidth;
                }
            } else {
                if (index === 0) {
                    item.pos = {
                        x: 0
                    };
                    colHeight = 0;
                    for (colIndex = 0; colIndex < i / 9; colIndex += 1) {
                        colHeight += maxHeight(res[colIndex]);
                    }
                    item.pos.y = colHeight;
                } else {
                    rowWidth = 0;
                    colHeight = 0;
                    for (rowIndex = 0; rowIndex < index; rowIndex++) {
                        rowWidth += row[rowIndex].width;
                    }
                    for (colIndex = 0; colIndex < i / 9; colIndex += 1) {
                        colHeight += maxHeight(res[colIndex]);
                    }
                    item.pos.x = rowWidth;
                    item.pos.y = colHeight;
                }
            }
            return item;
        });
        res.push(row);
        i += 9;
    }
    return res;
};

const makeMarkUp = (() => {
    var _ref3 = _asyncToGenerator(function* (nodes, total) {
        let html = [],
            page;
        tipPath = path.resolve(cwd, "png-tip.jpg");
        html.push("<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><style type='text/css'>body {position: relative:background: transparent;}.node-el {position: absolute;font-size: 12px;color: #336;}</style></head><body>");
        for (let row of nodes) {
            for (let _ref4 of row) {
                let { pos, textPos, width, height } = _ref4;

                html.push(`<div class="node-el" style="left: ${textPos.x}px; top: ${textPos.y}px;">
                        x: ${pos.x} <br/> y: ${pos.y}
                    </div>`);
            }
        }
        html.push("</body></html>");
        html = html.join("");
        try {
            _puppeteer2.default.launch(_extends({}, total.tip)).then((() => {
                var _ref5 = _asyncToGenerator(function* (browser) {
                    page = yield browser.newPage();
                    yield page.setContent(html);
                    yield page.screenshot({
                        path: tipPath,
                        fullPage: true
                    });
                    yield browser.close();
                });

                return function (_x5) {
                    return _ref5.apply(this, arguments);
                };
            })());
            return true;
        } catch (e) {
            return false;
        }
    });

    return function makeMarkUp(_x3, _x4) {
        return _ref3.apply(this, arguments);
    };
})();

const init = (() => {
    var _ref6 = _asyncToGenerator(function* ({
        images = [],
        csses = [],
        level = 1
    }) {
        const canvas = {
            dist: null,
            distName: `png-mergered.png`,
            tip: null,
            tipName: null
        },
              total = {
            dist: {
                width: 0,
                height: 0
            },
            tip: {
                width: 0,
                height: 0
            }
        };

        let tmp, rowWidth, colHeight, makeRes, rowLen, colLen, pos;

        for (let dir of images) {
            yield pickUpPngs(dir);
        }
        for (let dir of csses) {
            yield pickUpCsses(dir);
        }
        pngInfos = sortBy(pngInfos, true);
        pngInfos = toRows(pngInfos);

        colHeight = 0;

        colLen = pngInfos.length;
        pngInfos.forEach(function (row) {
            rowLen = pngInfos.length;
            tmp = [];
            rowWidth = 0;
            row.forEach(function (item, index) {
                // item.drawPos = {
                //     x: pngInfos[colLen - 1][index] ? pngInfos[colLen - 1][index].pos.x : item.pos.x,
                //     y: item.pos.y
                // };
                // pos = {
                //     x: item.pos.x,
                //     y: item.pos.y + (index * 50)
                // };
                // row[index].textPos = pos;
                // rowWidth += item.width;
            });
            colHeight += maxHeight(row);
            tmp.push(rowWidth);
        });

        total.dist = {
            width: Math.max.apply(null, tmp),
            height: colHeight
        };

        total.tip = {
            width: Math.max.apply(null, tmp),
            height: colHeight + pngInfos.length * 50
        };

        canvas.dist = (0, _images2.default)(total.dist.width, total.dist.height);

        pngInfos.forEach(function (row, rowIndex) {
            row.forEach(function ({ file, width, height, pos, drawPos }, colIndex) {
                console.log(drawPos);
                canvas.dist.draw((0, _images2.default)(file), pos.x, pos.y);
            });
        });

        // makeRes = await makeMarkUp(pngInfos, total);

        if (makeRes) {
            canvas.tipName = path.basename(tipPath);
            canvas.tip = (0, _images2.default)(total.tip.width, total.tip.height);

            pngInfos.forEach(function (row, rowIndex) {
                row.forEach(function ({ file, width, height, pos }, colIndex) {
                    // canvas.tip.draw(image(file), pos.x, tmp.y);
                });
            });
            // canvas.tip.save(canvas.tipName);
        }

        if (typeof canvas.dist.save === "function") {
            canvas.dist.save(canvas.distName, {
                quality: 100 * level
            });
        }

        _images2.default.gc();
    });

    return function init(_x6) {
        return _ref6.apply(this, arguments);
    };
})();

init(cfgs);