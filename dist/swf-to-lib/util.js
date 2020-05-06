"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function tryParse(value) {
    try {
        return JSON.parse(value);
    }
    catch (e) {
        return value;
    }
}
exports.tryParse = tryParse;
//# sourceMappingURL=util.js.map