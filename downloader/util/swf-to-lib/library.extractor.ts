import * as Path from "path";
import * as FS from "fs";
import * as Util from "util";
import * as CP from "child_process";
import { PassThrough } from "stream";
import Listr from "listr";
import Cheerio from "cheerio";

import { LibraryManifest, LibraryJson } from "./library.interface";
import { tryParse } from "./util";
import { JPEXS, Item } from "./jpexs";
import { CONFIG } from "../../config";
import { ProgressStream } from "../downloader/progress";
import { Tasklist } from "../tasklist/Tasklist";
import { Task } from "../tasklist/task.interface";

const mkdir = Util.promisify(FS.mkdir);
const readFile = Util.promisify(FS.readFile);
const readdir = Util.promisify(FS.readdir);
const rmdir = Util.promisify(FS.rmdir);
const writeFile = Util.promisify(FS.writeFile);

interface LibraryOptions {
  name: string;
  swfUrl: string;
  tmpDir: string;
  output: string;
  items: Item[];
  fileAnimationFilter?: (filename: string, index: number) => boolean;
}

export class LibraryTask {
  public readonly options: LibraryOptions;

  constructor(options: LibraryOptions) {
    this.options = Object.assign(
      {},
      {
        fileAnimationFilter: (item) => item.endsWith("_animation.bin"),
      },
      options
    );
  }

  extract(filename: string) {
    if (FS.existsSync(this.options.output)) {
      const stream = new PassThrough({ objectMode: true });
      stream.end({ total: 0, loaded: 0 });
      return stream;
    }

    return new JPEXS().export({
      input: filename,
      output: this.options.tmpDir,
      items: this.options.items,
    });
  }

  async manifestToJSON(manifestFile: string) {
    const manifestData = await readFile(manifestFile, { encoding: "utf8" });
    const manifestXML = Cheerio.load(manifestData, { xmlMode: true });
    const library = manifestXML("library").first();
    const assets = library.find("assets > asset").toArray();
    const aliases = library.find("assets > aliases > alias").toArray();

    const manifest: LibraryManifest = {
      name: library.attr("name"),
      version: library.attr("version"),
      assets: assets.reduce((acc, el) => {
        const asset = Cheerio(el);
        const name = asset.attr("name");
        const params = asset.children("param").toArray();

        acc[name] = params.reduce((acc, el) => {
          const param = Cheerio(el);
          const key = param.attr("key");

          acc[key] = param.attr("value");

          return acc;
        }, {});

        return acc;
      }, {}),
      aliases: aliases.reduce((acc, el) => {
        const alias = Cheerio(el);
        const name = alias.attr("name");

        acc[name] = {
          link: alias.attr("link"),
          flipv: tryParse(alias.attr("flipv")),
          fliph: tryParse(alias.attr("fliph")),
        };

        return acc;
      }, {}),
    };

    return manifest;
  }

  async animationsToJSON(animationsFile: string) {
    const animationsData = await readFile(animationsFile, { encoding: "utf8" });
    const animationsXML = Cheerio.load(animationsData, { xmlMode: true });
    const animations = animationsXML("animation").toArray();

    const extractPart = (acc, el) => {
      const part = Cheerio(el);
      const id = part.attr("id");

      part.removeAttr("id");

      acc[id] = Object.entries(part.attr()).reduce((acc, [key, value]) => {
        acc[key] = tryParse(value);
        return acc;
      }, {});

      return acc;
    };

    return animations.reduce((acc, el) => {
      const animation = Cheerio(el);
      const name = animation.attr("name");
      const frames = animation.children("frame").toArray();

      acc[name] = {
        frames: frames.map((el) => {
          const frame = Cheerio(el);
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
  }

  async createSpritesheet(
    imagesDir: string,
    texturePackerExecutable = "/usr/bin/TexturePacker",
    texturePackerArgs = [
      "--format",
      "pixijs4",
      "--texture-format",
      "png8",
      "--opt",
      "RGBA4444",
      "--max-width",
      "3000",
      "--max-height",
      "3000",
    ]
  ) {
    const sheetImage = Path.join(
      this.options.output,
      `${this.options.name}.png`
    );
    const dataFile = Path.join(
      this.options.tmpDir,
      `${this.options.name}.json`
    );

    texturePackerArgs.unshift(imagesDir);
    texturePackerArgs.push("--sheet", sheetImage);
    texturePackerArgs.push("--data", dataFile);

    CP.spawnSync(texturePackerExecutable, texturePackerArgs)
    return JSON.parse(await readFile(dataFile, { encoding: "utf8" }));
  }

  clearTemp() {
    return rmdir(this.options.tmpDir, { recursive: true });
  }

  private TASK_dir(ctx: any): Task {
    return {
      title: "Create temporary directory",
      task: async (ctx) => {
        ctx.bindataDir = Path.join(this.options.tmpDir, "binaryData");
        ctx.imagesDir = Path.join(this.options.tmpDir, "images");

        await mkdir(this.options.tmpDir, { recursive: true });
      },
    };
  }

  private TASK_extract(ctx: any): Task {
    return {
      title: "Extract",
      task: () => {
        return this.extract(this.options.swfUrl).pipe(
          new ProgressStream(":type (:percent) [:bar] :time")
        );
      },
    };
  }

  private TASK_manifest(ctx): Task {
    return {
      title: "Read manifest.xml as JSON",
      task: async (ctx) => {
        ctx.binaryDataFiles = await readdir(ctx.bindataDir);
        const manifestFile = ctx.binaryDataFiles.find((item) =>
          item.endsWith("_manifest.bin")
        );
        ctx.manifest = await this.manifestToJSON(
          Path.join(ctx.bindataDir, manifestFile)
        );
      },
    };
  }

  private TASK_spritesheet(ctx: any): Task {
    return {
      title: "Generate Spritesheet",
      task: async (ctx) => {
        if (ctx.noSpritesheet) return;
        if (
          !FS.existsSync(
            Path.join(this.options.output, `${this.options.name}.png`)
          )
        ) {
          if (FS.readdirSync(ctx.imagesDir).length) {
            ctx.override_library = true;
            ctx.spritesheet = await this.createSpritesheet(ctx.imagesDir);
          } else {
            ctx.noSpritesheet = true;
          }
        }
      },
    };
  }

  private TASK_animations(ctx: any): Task {
    return {
      title: "Convert animations to JSON",
      task: async (ctx) => {
        const animationFiles = ctx.binaryDataFiles.filter(
          this.options.fileAnimationFilter
        );
        const animations = await Promise.all(
          animationFiles.map((file) => this.animationsToJSON(Path.join(ctx.bindataDir, file)))
        );
        ctx.animations = Object.assign({}, ...animations);
      },
    };
  }

  private TASK_save(ctx: any): Task {
    return {
      title: `Save ${this.options.name}.json`,
      task: async (ctx) => {
        const filename = Path.join(
          this.options.output,
          `${this.options.name}.json`
        );

        if (!FS.existsSync(filename) || ctx.override_library) {
          const data = {
            manifest: ctx.manifest,
            spritesheet: ctx.spritesheet,
            animations: ctx.animations,
          };

          await mkdir(Path.dirname(filename), { recursive: true });
          return writeFile(filename, JSON.stringify(data, null, 2));
        }
      },
    };
  }

  createBuildTask(ctx: any): Tasklist {
    return new Tasklist([
      this.TASK_dir(ctx),
      this.TASK_extract(ctx),
      this.TASK_manifest(ctx),
      this.TASK_spritesheet(ctx),
      this.TASK_animations(ctx),
      this.TASK_save(ctx),
    ], {}, {});
  }
}
