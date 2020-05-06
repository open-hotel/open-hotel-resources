import { spawn } from "child_process";
import { PassThrough, Transform } from "stream";
import { Observable } from "rxjs";

export enum Item {
  SCRIPT = "script",
  IMAGE = "image",
  SHAPE = "shape",
  MORPHSHAPE = "morphshape",
  MOVIE = "movie",
  FONT = "font",
  FRAME = "frame",
  SPRITE = "sprite",
  BUTTON = "button",
  SOUND = "sound",
  BINARY = "binaryData",
  TEXT = "text",
  ALL = "all",
  FLA = "fla",
  XFL = "xfl",
}

interface ExportOptions {
  input: string;
  output: string;
  items: Item[];
}

class JPEXSProgress extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, cb) {
    const match = chunk.toString().match(/^Exported\s+([^\s]+)\s+(\d+)\/(\d+)/);
    if (!match) return cb();

    const type = match[1];
    const loaded = Number(match[2]);
    const total = Number(match[3]);

    cb(null, { loaded, total, type, done: false });
  }
}

export class JPEXS {
  constructor(public readonly jar = "jpexs/ffdec.jar") {}

  export(options: ExportOptions) {
    const progressStream = new JPEXSProgress();
    const args = [
      "-cli",
      "-export",
      options.items.join(","),
      options.output,
      options.input,
      "-stat",
    ];
    const jpexs = spawn("java", ["-jar", this.jar].concat(args), {
      cwd: process.cwd(),
      stdio: [null, null, null],
    });

    let lastType: string = null;

    jpexs.stdout.pipe(progressStream);
    jpexs.on("error", (e) => progressStream.emit("error", e));
    jpexs.stderr.setEncoding("utf8").on("data", (data) => {
      progressStream.emit("error", new Error(data));
    });

    return progressStream;
  }
}
