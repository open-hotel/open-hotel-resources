"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jpexs_1 = require("./swf-to-lib/jpexs");
const progress_1 = __importDefault(require("progress"));
const progress = new progress_1.default(':task :percent [:bar] :etas', 100);
new jpexs_1.JPEXS().export({
    input: "resources/Habbo.swf",
    output: "out/Habbo.swf",
    items: [jpexs_1.Item.ALL],
}).subscribe(({ loaded, total }) => {
    progress.tick((loaded / total) * 100, {
        task: 'Habbo.swf'
    });
});
//# sourceMappingURL=index.js.map