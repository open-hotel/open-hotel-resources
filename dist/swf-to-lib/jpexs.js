"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const rxjs_1 = require("rxjs");
var Item;
(function (Item) {
    Item["SCRIPT"] = "script";
    Item["IMAGE"] = "image";
    Item["SHAPE"] = "shape";
    Item["MORPHSHAPE"] = "morphshape";
    Item["MOVIE"] = "movie";
    Item["FONT"] = "font";
    Item["FRAME"] = "frame";
    Item["SPRITE"] = "sprite";
    Item["BUTTON"] = "button";
    Item["SOUND"] = "sound";
    Item["BINARY"] = "binaryData";
    Item["TEXT"] = "text";
    Item["ALL"] = "all";
    Item["FLA"] = "fla";
    Item["XFL"] = "xfl";
})(Item = exports.Item || (exports.Item = {}));
class JPEXS {
    constructor(jar = "jpexs/ffdec.jar") {
        this.jar = jar;
    }
    export(options) {
        return new rxjs_1.Observable((progress) => {
            const args = [
                "-cli",
                "-export",
                options.items.join(","),
                options.output,
                options.input,
                "-stat",
            ];
            const jpexs = child_process_1.spawn("java", ["-jar", this.jar].concat(args), {
                cwd: process.cwd(),
                stdio: [null, null, null],
            });
            jpexs.stdout.addListener("data", (e) => {
                const match = e.toString().match(/(\d+)\/(\d+)/);
                if (!match)
                    return false;
                const loaded = Number(match[1]);
                const total = Number(match[2]);
                progress.next({ loaded, total });
            });
            return progress;
        });
    }
}
exports.JPEXS = JPEXS;
//# sourceMappingURL=jpexs.js.map