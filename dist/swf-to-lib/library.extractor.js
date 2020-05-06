"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Path = __importStar(require("path"));
const FS = __importStar(require("fs"));
const Util = __importStar(require("util"));
const JPEXS = __importStar(require("jpexs-flash-decompiler"));
const CP = __importStar(require("child_process"));
const cheerio_1 = __importDefault(require("cheerio"));
const util_1 = require("./util");
const mkdir = Util.promisify(FS.mkdir);
const readFile = Util.promisify(FS.readFile);
const readdir = Util.promisify(FS.readdir);
const rmdir = Util.promisify(FS.rmdir);
const writeFile = Util.promisify(FS.writeFile);
var LibraryItem;
(function (LibraryItem) {
    LibraryItem["ALL"] = "all";
    LibraryItem["FLA"] = "fla";
    LibraryItem["TEXT"] = "text";
    LibraryItem["SCRIPT"] = "script";
    LibraryItem["IMAGE"] = "image";
    LibraryItem["SHAPE"] = "shape";
    LibraryItem["MOVIE"] = "movie";
    LibraryItem["FONT"] = "font";
    LibraryItem["FRAME"] = "frame";
    LibraryItem["SPRITE"] = "sprite";
    LibraryItem["BUTTON"] = "button";
    LibraryItem["SOUND"] = "sound";
    LibraryItem["BINARY"] = "binaryData";
    LibraryItem["MORPHSHAPE"] = "morphshape";
})(LibraryItem || (LibraryItem = {}));
class Library {
    constructor(name, filename, options = {
        output: "./output",
        tmp_dir: "./tmp",
        items: [LibraryItem.ALL],
    }) {
        this.name = name;
        this.filename = filename;
        this.options = options;
    }
    extract() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Extracting ${this.filename}...`);
            return new Promise((resolve, reject) => {
                JPEXS.extract({
                    file: this.filename,
                    output: this.options.tmp_dir,
                    items: this.options.items,
                }, (error) => {
                    if (error)
                        return reject(error);
                    resolve();
                });
            });
        });
    }
    manifestToJSON(manifestFile) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Converting manifest of ${this.filename} to JSON...`);
            const manifestData = yield readFile(manifestFile, { encoding: "utf8" });
            const manifestXML = cheerio_1.default.load(manifestData, { xmlMode: true });
            const library = manifestXML("library").first();
            const assets = library.children("assets > asset").toArray();
            const aliases = library.children("assets > aliases > alias").toArray();
            const manifest = {
                id: library.attr("id"),
                version: library.attr("version"),
                assets: assets.reduce((acc, el) => {
                    const asset = cheerio_1.default(el);
                    const name = asset.attr("name");
                    const params = asset.children("param").toArray();
                    acc[name] = params.reduce((acc, el) => {
                        const param = cheerio_1.default(el);
                        const key = param.attr("key");
                        acc[key] = param.attr("value");
                        return acc;
                    }, {});
                    return acc;
                }, {}),
                aliases: aliases.reduce((acc, el) => {
                    const alias = cheerio_1.default(el);
                    const name = alias.attr("name");
                    acc[name] = {
                        link: alias.attr("link"),
                        flipv: util_1.tryParse(alias.attr("flipv")),
                        fliph: util_1.tryParse(alias.attr("fliph")),
                    };
                    return acc;
                }, {}),
            };
            return manifest;
        });
    }
    animationsToJSON(animationsFile) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Building animations from ${this.filename}...`);
            const animationsData = yield readFile(animationsFile, { encoding: "utf8" });
            const animationsXML = cheerio_1.default.load(animationsData, { xmlMode: true });
            const animations = animationsXML("animation").toArray();
            const extractPart = (acc, el) => {
                const part = cheerio_1.default(el);
                const id = part.attr("id");
                part.removeAttr("id");
                acc[id] = Object.entries(part.attr()).reduce((acc, [key, value]) => {
                    acc[key] = util_1.tryParse(value);
                    return acc;
                }, {});
                return acc;
            };
            return animations.reduce((acc, el) => {
                const animation = cheerio_1.default(el);
                const name = animation.attr("name");
                const frames = animation.children("frame").toArray();
                acc[name] = {
                    frames: frames.map((el) => {
                        const frame = cheerio_1.default(el);
                        const parts = frame.children("bodypart").toArray();
                        const fxParts = frame.children("fx").toArray();
                        const bodyParts = parts.reduce(extractPart, {});
                        const fx = fxParts.reduce(extractPart, {});
                        return {
                            bodyParts,
                            fx,
                        };
                    }),
                };
                return acc;
            }, {});
        });
    }
    createSpritesheet(imagesDir, texturePackerExecutable = "/usr/bin/TexturePacker", texturePackerArgs = [
        "--format",
        "pixijs4",
        "--texture-format",
        "png8",
        "--max-width",
        "3000",
        "--max-height",
        "3000",
        "RGBA4444",
    ]) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Building spritesheet of ${this.filename}...`);
            const sheetImage = Path.join(this.options.output, `${this.name}.png`);
            const dataFile = Path.join(this.options.tmp_dir, `${this.name}.json`);
            texturePackerArgs.unshift(imagesDir);
            texturePackerArgs.push("--sheet", sheetImage);
            texturePackerArgs.push("--data", dataFile);
            CP.spawnSync(texturePackerExecutable, texturePackerArgs);
            return JSON.parse(yield readFile(dataFile, { encoding: "utf8" }));
        });
    }
    createLibraryJSON() {
        return __awaiter(this, void 0, void 0, function* () {
            const binaryDataDir = Path.join(this.options.tmp_dir, "binaryData");
            const imagesDir = Path.join(this.options.tmp_dir, "binaryData");
            const binaryDataFiles = yield readdir(binaryDataDir);
            const manifestFile = binaryDataFiles.find((item) => item.endsWith("_manifest.bin"));
            const animationFiles = binaryDataFiles.filter((item) => item.endsWith("_animation.bin"));
            const manifest = yield this.manifestToJSON(Path.join(binaryDataDir, manifestFile));
            const spritesheet = yield this.createSpritesheet(imagesDir);
            const animations = yield Promise.all(animationFiles.map((file) => this.animationsToJSON(file)));
            return {
                manifest,
                spritesheet,
                animations: Object.assign({}, ...animations),
            };
        });
    }
    clearTemp() {
        console.log("Clean temporary files...");
        return rmdir(this.options.tmp_dir, { recursive: true });
    }
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Building ${this.filename}...`);
            yield mkdir(this.options.tmp_dir, { recursive: true });
            yield this.extract();
            const libraryJSON = yield this.createLibraryJSON();
            const filename = Path.join(this.options.output, `${this.name}.json`);
            console.log(`Saving ${filename}...`);
            yield writeFile(filename, JSON.stringify(libraryJSON, null, 2));
        });
    }
}
exports.Library = Library;
//# sourceMappingURL=library.extractor.js.map