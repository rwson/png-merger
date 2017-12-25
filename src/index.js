#!/usr/bin/env node

import * as path from "path";
import * as fse from "fs-extra-promise";
import * as cConsole from "color-console";
import jimp from "jimp";
import css from "css";
import nodeVersion from "node-version";

if (nodeVersion.major < 6) {
    cConsole.red("png-merger requires at least version 6 of NodeJs. Please upgrade!");
    process.exit(1);
}

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
                    info = await jimp.read(file);
                    info.bitmap.data = info.bitmap.data.toString("utf8");
                    delete info.bitmap.data;
                    pngInfos.push({
                        file,
                        ...info.bitmap
                    });
                }
            }
        } catch (e) {}
    },
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

const init = async({
    images = [],
    csses = [],
    level = 1
}) => {
    const merged = [],
        canvases = [];
    for (let dir of images) {
        await pickUpPngs(dir);
    }
    for (let dir of csses) {
        await pickUpCsses(dir);
    }
    pngInfos = sortBySize(pngInfos);

};

init(cfgs);