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

/**
 * obj.hasOwnProperty简写
 * @param  {Object} obj
 * @param  {String} key
 * @return {Boolean}
 */
hasOwnProp = (obj, key) => obj.hasOwnProperty(key),


/**
 * 读取文件内容变成字符串
 * @param  {String} file
 * @return {String/null}
 */
fileToString = file => {
    try {
        const stream = fse.readFileSync(file);
        return stream.toString("utf8");
    } catch (e) {
        return null;
    }
},


/**
 * 是否包含某个属性值
 * @param  {Object} obj
 * @param  {String} val
 * @return {Object}
 */
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


/**
 * 解析参数数组
 * @param  {Array}  args
 * @param  {Object} alias
 * @return {Object}
 */
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
}),
      cfgs = {
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

/**
 * 从某个目录提取所有css文件并解析成AST
 * @param  {String} dir
 * @return {Array}
 */
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


/**
 * 从某个目录提取符合条件的png
 * @param  {String} dir
 * @return {Array}
 */
pickUpPngs = (() => {
    var _ref2 = _asyncToGenerator(function* (dir) {
        try {
            const files = fse.readdirSync(dir),
                  { width, height } = cfgs.max;
            let info;
            for (let file of files) {
                file = path.resolve(dir, file);
                if (fse.isDirectorySync(file)) {
                    pickUpPngs(file);
                } else if (regs.pngSuffix.test(file)) {
                    info = (0, _images2.default)(file).size();
                    if (info.width <= width && info.height <= height) {
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


/**
 * 排序
 * @param  {Array}  arr
 * @param  {Boolean} width
 * @return {Array}
 */
sortBy = (arr, width = false) => {
    return arr.sort((prev, next) => {
        if (width) {
            return prev.width - next.width;
        }
        return prev.height - next.height;
    });
},


/**
 * 获取最大高度
 * @param  {Array} row
 * @return {Number}
 */
maxHeight = row => {
    return row[row.length - 1].height;
},


/**
 * 把一维数组转换成由10个项组成的二维数组
 * @return {Array}
 */
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

/**
 * 根据每个节点值生成HTML结构, 生成标注图的底图
 * @param  {[type]} nodes
 * @param  {[type]} total
 * @return {Promise}
 */
const makeMarkUp = (() => {
    var _ref3 = _asyncToGenerator(function* (nodes, total) {
        return new Promise(function (resolve, reject) {
            let html = [],
                page;
            tipPath = path.resolve(cwd, "png-tmp.png");
            html.push("<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><style type='text/css'>body {position: relative:background: transparent;}.node-el {position: absolute;font-size: 12px;color: #000;}</style></head><body>");
            for (let row of nodes) {
                for (let _ref4 of row) {
                    let { drawPos, width, height } = _ref4;

                    html.push(`<div class="node-el" style="left: ${drawPos.x}px; top: ${drawPos.y}px;">
                        <p>x: ${drawPos.x}px;</p>
                        <p>y: ${drawPos.y}px;</p>
                        <p>width: ${width}px;</p>
                        <p>height: ${height}px;</p>
                    </div>`);
                }
            }
            html.push("</body></html>");
            html = html.join("");
            try {
                _puppeteer2.default.launch().then((() => {
                    var _ref5 = _asyncToGenerator(function* (browser) {
                        page = yield browser.newPage();
                        page.setViewport(total.tip);
                        yield page.setContent(html);
                        yield page._emulationManager._client.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
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
                resolve(true);
            } catch (e) {
                resolve(false);
            }
        });
    });

    return function makeMarkUp(_x3, _x4) {
        return _ref3.apply(this, arguments);
    };
})();

/**
 * 主入口
 * @param  {Array}  options.images [description]
 * @param  {Array}  options.csses  [description]
 * @param  {Number} options.level  [description]
 */
const init = (() => {
    var _ref6 = _asyncToGenerator(function* ({
        images = [],
        csses = [],
        level = 1
    }) {

        //  canvas对象, 存储合并后的雪碧图和标注图
        const canvas = {
            dist: null,
            distName: "png-mergered.png",
            tip: null,
            tipName: "png-tip.png"
        },


        //  合并后的图片尺寸信息
        total = {
            dist: {
                width: 0,
                height: 0
            },
            tip: {
                width: 0,
                height: 0
            }
        },
              maxWidth = {
            width: 0,
            index: 0,
            colCount: 0
        };

        let colHeight, makeRes, tmpRow, tmpX, rowWidth, tmpObj, pos;

        for (let dir of images) {
            yield pickUpPngs(dir);
        }
        for (let dir of csses) {
            yield pickUpCsses(dir);
        }
        pngInfos = sortBy(pngInfos, true);
        pngInfos = toRows(pngInfos);

        colHeight = 0;

        //  获取最大宽度的一行
        pngInfos.forEach(function (row, rowIndex) {
            rowWidth = 0;
            row.forEach(function (col, colIndex) {
                rowWidth += col.width;
            });
            if (rowWidth > maxWidth.width) {
                maxWidth.width = rowWidth;
                maxWidth.index = rowIndex;
                maxWidth.colCount = row.length;
            }
        });

        //  给每一项声明drawPos(图片画布地址), 防止出现图片之间距离过小的问题
        pngInfos.forEach(function (row, rowIndex) {
            tmpRow = pngInfos[maxWidth.index];
            row.forEach(function (col, colIndex) {
                tmpObj = {
                    y: col.pos.y
                };

                if (rowIndex < maxWidth.index) {
                    if (maxWidth.colCount === 10) {
                        tmpX = tmpRow[colIndex].pos.x;
                    } else {
                        tmpX = Math.floor(maxWidth.colCount / 10 * pngInfos[maxWidth.index][colIndex - maxWidth.colCount + 9].pos.x);
                    }
                    tmpObj.x = tmpX;
                    col.drawPos = tmpObj;
                } else {
                    col.drawPos = col.pos;
                }
            });
            colHeight += maxHeight(row);
        });

        total.dist = total.tip = {
            width: maxWidth.width,
            height: colHeight
        };

        canvas.dist = (0, _images2.default)(total.dist.width, total.dist.height);
        canvas.tip = (0, _images2.default)(total.tip.width, total.dist.height);

        //  绘制雪碧图
        pngInfos.forEach(function (row) {
            row.forEach(function ({ file, drawPos }) {
                canvas.dist.draw((0, _images2.default)(file), drawPos.x, drawPos.y);
            });
        });

        canvas.dist.save(canvas.distName, {
            quality: 100 * level
        });

        //  开始绘制标注图
        makeRes = yield makeMarkUp(pngInfos, total);

        if (makeRes) {
            canvas.tip.draw((0, _images2.default)(canvas.distName), 0, 0);
            canvas.tip.draw((0, _images2.default)(tipPath), 0, 0);
            canvas.tip.save(canvas.tipName, {
                quality: 100
            });
        }

        _images2.default.gc();
    });

    return function init(_x6) {
        return _ref6.apply(this, arguments);
    };
})();

init(cfgs);