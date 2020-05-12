import * as Path from "path";
import * as FS from "fs";
import * as Util from "util";
import * as CP from "child_process";
import { PassThrough } from "stream";
import Cheerio from "cheerio";

import { LibraryManifest, LibraryJson } from "./library.interface";
import { tryParse } from "../";
import { CONFIG } from "../../config";
import { ProgressStream } from "../progress";
import { Tasklist } from "../tasklist/Tasklist";
import { Task } from "../tasklist/task.interface";
import { extractSWF } from "../extractor";
import { ItemType } from "../extractor/types";

const mkdir = Util.promisify(FS.mkdir);
const readFile = Util.promisify(FS.readFile);
const readdir = Util.promisify(FS.readdir);
const rmdir = Util.promisify(FS.rmdir);
const writeFile = Util.promisify(FS.writeFile);

interface LibraryOptions {
  name: string;
  swfFile: string;
  tmpDir: string;
  output: string;
  items: ItemType[];
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

    return extractSWF({
      inputFile: filename,
      outputDir: this.options.tmpDir,
      itemTypes: this.options.items,
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

    // Frames
    const getFrames = (frames: Cheerio) => {
      if (!frames.length) return undefined;
      frames.toArray().map((el) => {
        const frame = Cheerio(el);
        const bodyparts = frame.children("bodypart,fx").toArray();

        return {
          bodyparts: bodyparts.reduce((acc, el) => {
            const bodypart = Cheerio(el);
            const id = bodypart.attr("id");
            bodypart.removeAttr("id");

            // Body Part Items
            const items = bodypart
              .children("item")
              .toArray()
              .reduce((acc, el) => {
                const item = Cheerio(el);
                const id = item.attr("id");
                item.removeAttr("id");

                acc[id] = tryParse(item.attr());

                return acc;
              }, {});

            acc[id] = {
              ...tryParse(bodypart.attr()),
              items: Object.keys(items).length ? items : undefined,
            };
            return acc;
          }, {}),
        };
      });
    };
    // End Frames

    return animations.reduce((acc, el) => {
      const animation = Cheerio(el);
      const name = animation.attr("name");
      const desc = animation.attr("desc");

      // Frames
      const frames = getFrames(animation.children("frame"));

      // Overrides
      const overrides = animation
        .children("override")
        .toArray()
        .reduce((acc, el) => {
          const override = Cheerio(el);
          const id = override.attr("override");
          override.removeAttr("override");

          acc[id] = {
            ...tryParse(override.attr()),
            frames: getFrames(override.children("frame")),
          };
          return acc;
        }, {});
      // End Overrides

      // Add
      const add = animation
        .children("add")
        .toArray()
        .reduce((acc, el) => {
          const add = Cheerio(el);
          const id = add.attr("id");
          add.removeAttr("id");

          acc[id] = tryParse(add.attr());

          return acc;
        }, {});
      // End Add

      // Remove
      const remove = animation
        .children("remove")
        .toArray()
        .map((el) => Cheerio(el).attr("id"));
      // End Remove

      // Sprite
      const sprites = animation
        .children("sprite")
        .toArray()
        .reduce((acc, el) => {
          const sprite = Cheerio(el);
          const id = sprite.attr("id");
          sprite.removeAttr("id");
          const directions = sprite.children("direction").toArray();

          acc[id] = {
            ...tryParse(sprite.attr()),
            directions:
              directions.length === 0
                ? undefined
                : directions.reduce((acc, el) => {
                    const dir = Cheerio(el);
                    const id = dir.attr("id");
                    dir.removeAttr("id");

                    acc[id] = tryParse(dir.attr());

                    return acc;
                  }, {}),
          };

          return acc;
        }, {});
      // End Sprite

      // Shadow
      const shadow = animation.children("shadow").first().attr("id");
      // End Shadow

      // Directions
      const direction = tryParse(
        animation.children("direction").first().attr()
      );
      // End Directions

      acc[name] = {
        desc,
        frames,
        overrides: Object.keys(overrides).length ? overrides : undefined,
        add: Object.keys(add).length ? add : undefined,
        remove: remove.length ? remove : undefined,
        sprites: Object.keys(sprites).length ? sprites : undefined,
        shadow: shadow || undefined,
        direction: direction || undefined,
      };
      return acc;
    }, {});
  }

  async createSpritesheet(
    imagesDir: string,
    texturePackerExecutable = CONFIG.texture_packer.executable,
    texturePackerArgs = [...CONFIG.texture_packer.args]
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

    const resPacker = CP.spawnSync(texturePackerExecutable, texturePackerArgs);
    if (resPacker.stderr.length) {
      console.error(resPacker.stderr.toString());
      if (CONFIG.exit_on_error) process.exit(1);
    }
    return JSON.parse(await readFile(dataFile, { encoding: "utf8" }));
  }

  clearTemp() {
    return rmdir(this.options.tmpDir, { recursive: true });
  }

  private TASK_dir(ctx: any): Task {
    return {
      title: "Create temporary directory",
      task: async (ctx) => {
        ctx.bindataDir = Path.join(this.options.tmpDir, "binary");
        ctx.imagesDir = Path.join(this.options.tmpDir, "images");

        await mkdir(this.options.tmpDir, { recursive: true });
      },
    };
  }

  private TASK_extract(ctx: any): Task {
    return {
      title: "Extract",
      task: () => {
        return this.extract(this.options.swfFile).pipe(
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
          animationFiles.map((file) =>
            this.animationsToJSON(Path.join(ctx.bindataDir, file))
          )
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
          return writeFile(filename, JSON.stringify(data));
        }
      },
    };
  }

  createBuildTask(ctx: any): Tasklist {
    return new Tasklist(
      [
        this.TASK_dir(ctx),
        this.TASK_extract(ctx),
        this.TASK_manifest(ctx),
        this.TASK_spritesheet(ctx),
        this.TASK_animations(ctx),
        this.TASK_save(ctx),
      ],
      {},
      {}
    );
  }
}
