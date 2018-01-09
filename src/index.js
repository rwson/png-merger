#!/usr/bin/env node

import * as path from "path";
import * as fse from "fs-extra-promise";
import * as cConsole from "color-console";
import css from "css";
import image from "images";
import puppeteer from "puppeteer";
import nodeVersion from "node-version";

if (nodeVersion.major < 6) {
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
    fileToString = (file) => {
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
        args = args.map((arg) => arg.replace(/^-+/, ""));
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
const pickUpCsses = async(dir) => {
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
                            ast = css.parse(content);
                            cssInfos.push({
                                ast,
                                file
                            });
                        }
                    }
                }
            }
        } catch (e) {}
    },

    /**
     * 从某个目录提取符合条件的png
     * @param  {String} dir
     * @return {Array}
     */
    pickUpPngs = async(dir) => {
        try {
            const files = fse.readdirSync(dir),
                { width, height } = cfgs.max;
            let info;
            for (let file of files) {
                file = path.resolve(dir, file);
                if (fse.isDirectorySync(file)) {
                    pickUpPngs(file);
                } else if (regs.pngSuffix.test(file)) {
                    info = image(file).size();
                    if (info.width <= width && info.height <= height) {
                        pngInfos.push({
                            file,
                            ...info
                        });
                    }
                }
            }
        } catch (e) {}
    },

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
    maxHeight = (row) => {
        return row[row.length - 1].height;
    },

    /**
     * 把一维数组转换成由10个项组成的二维数组
     * @return {Array}
     */
    toRows = () => {
        let row, rowWidth, colHeight, rowIndex, colIndex, res = [];
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
 * @return {Boolean}
 */
const makeMarkUp = async(nodes, total) => {
    let html = [], page;
    tipPath = path.resolve(cwd, "png-tip.jpg");
    html.push("<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><style type='text/css'>body {position: relative:background: transparent;}.node-el {position: absolute;font-size: 12px;color: #336;}</style></head><body>");
    for (let row of nodes) {
        for (let { pos, textPos, width, height } of row) {
            html.push(`<div class="node-el" style="left: ${textPos.x}px; top: ${textPos.y}px;">
                        x: ${pos.x} <br/> y: ${pos.y}
                    </div>`);
        }
    }
    html.push("</body></html>");
    html = html.join("");
    try {
        puppeteer.launch({
            ...total.tip
        }).then(async browser => {
            page = await browser.newPage();
            await page.setContent(html);
            await page.screenshot({
                path: tipPath,
                fullPage: true
            });
            await browser.close();
        });
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * 主入口
 * @param  {Array}  options.images [description]
 * @param  {Array}  options.csses  [description]
 * @param  {Number} options.level  [description]
 */
const init = async({
    images = [],
    csses = [],
    level = 1
}) => {
    const canvas = {
            dist: null,
            distName: `png-mergered2.png`,
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
        },
        maxWidth = {
            width: 0,
            index: 0,
            colCount: 0
        };

    let colHeight, makeRes, tmpRow, tmpX, rowWidth, tmpObj, pos;

    for (let dir of images) {
        await pickUpPngs(dir);
    }
    for (let dir of csses) {
        await pickUpCsses(dir);
    }
    pngInfos = sortBy(pngInfos, true);
    pngInfos = toRows(pngInfos);

    colHeight = 0;  

    //  获取最大宽度的一行
    pngInfos.forEach((row, rowIndex) => {
        rowWidth = 0;
        row.forEach((col, colIndex) => {
            rowWidth += col.width;
        });
        if (rowWidth > maxWidth.width) {
            maxWidth.width = rowWidth;
            maxWidth.index = rowIndex;
            maxWidth.colCount = row.length;
        }
    });

    //  给每一项声明drawPos(图片画布地址), 防止出现图片之间距离过小的问题
    pngInfos.forEach((row, rowIndex) => {
        tmpRow = pngInfos[maxWidth.index];
        row.forEach((col, colIndex) => {
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
                pos = {
                    x: tmpObj.x,
                    y: tmpObj.y + col.height
                };
                col.drawPos = tmpObj;
            } else {
                col.drawPos = col.pos;
            }
            col.textPos = pos;
        });
        colHeight += maxHeight(row);
    });

    total.dist = {
        width: maxWidth.width,
        height: colHeight
    };

    total.tip = {
        width: maxWidth.width,
        height: colHeight + pngInfos.length * 50
    };

    canvas.dist = image(total.dist.width, total.dist.height);

    //  绘制雪碧图
    pngInfos.forEach((row, rowIndex) => {
        row.forEach(({ file, drawPos }, colIndex) => {
            canvas.dist.draw(image(file), drawPos.x, drawPos.y);
        });
    });

    makeRes = await makeMarkUp(pngInfos, total);

    if (makeRes) {
        canvas.tipName = path.basename(tipPath);
        canvas.tip = image(total.tip.width, total.tip.height);

        pngInfos.forEach((row, rowIndex) => {
            row.forEach(({ file, width, height, pos }, colIndex) => {
                canvas.tip.draw(image(file), pos.x, tmp.y);
            });
        });
        canvas.tip.save(canvas.tipName);
    }

    canvas.dist.save(canvas.distName, {
        quality: 100 * level
    });

    image.gc();
};

init(cfgs);