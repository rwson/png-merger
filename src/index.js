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
    hasOwnProp = (obj, key) => obj.hasOwnProperty(key),
    fileToString = (file) => {
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
    pickUpPngs = async(dir) => {
        try {
            const files = fse.readdirSync(dir);
            let info;
            for (let file of files) {
                file = path.resolve(dir, file);
                if (fse.isDirectorySync(file)) {
                    pickUpPngs(file);
                } else if (regs.pngSuffix.test(file)) {
                    info = image(file).size();
                    if (info.width <= cfgs.max.width && info.height <= cfgs.max.height) {
                        pngInfos.push({
                            file,
                            ...info
                        });
                    }
                }
            }
        } catch (e) {}
    },
    sortBy = (arr, width = false) => {
        return arr.sort((prev, next) => {
            if (width) {
                return prev.width - next.width;
            }
            return prev.height - next.height;
        });
    },
    maxHeight = (row) => {
        return row[row.length - 1].height;
    },
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

const init = async({
    images = [],
    csses = [],
    level = 1
}) => {
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
        await pickUpPngs(dir);
    }
    for (let dir of csses) {
        await pickUpCsses(dir);
    }
    pngInfos = sortBy(pngInfos, true);
    pngInfos = toRows(pngInfos);

    colHeight = 0;

    colLen = pngInfos.length;
    pngInfos.forEach((row) => {
        rowLen = pngInfos.length;
        tmp = [];
        rowWidth = 0;
        row.forEach((item, index) => {
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

    canvas.dist = image(total.dist.width, total.dist.height);

    pngInfos.forEach((row, rowIndex) => {
        row.forEach(({ file, width, height, pos, drawPos }, colIndex) => {
            console.log(drawPos)
            canvas.dist.draw(image(file), pos.x, pos.y);
        });
    });

    // makeRes = await makeMarkUp(pngInfos, total);

    if (makeRes) {
        canvas.tipName = path.basename(tipPath);
        canvas.tip = image(total.tip.width, total.tip.height);

        pngInfos.forEach((row, rowIndex) => {
            row.forEach(({ file, width, height, pos }, colIndex) => {
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

    image.gc();
};

init(cfgs);