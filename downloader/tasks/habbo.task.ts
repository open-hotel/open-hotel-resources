import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";
import { Downloader } from "../util/downloader";
import path from "path";
import { CONFIG } from "../config";
import { extractSWF } from "../util/extractor";
import {
  ItemType,
  ResourceItem,
  TypeDirectories,
} from "../util/extractor/types";
import { ProgressStream } from "../util/progress";
import Cheerio from "cheerio";
import FS from "fs";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";

function ExtractTask(): Task {
  return {
    title: "Extract",
    task: (ctx) => {
      const outputDir = path.join(CONFIG.tmp_dir, "Habbo");

      // If output dir exists...
      if (FS.existsSync(path.join(outputDir, "binary"))) return;

      // Extract files
      return extractSWF({
        inputFile: ctx.habboPath,
        itemTypes: [ItemType.BINARY],
        outputDir,
        fileName: (item: ResourceItem, ext: string) => {
          if (item.type == ItemType.BINARY) {
            const xml = Cheerio.load(item.data.toString(), {
              xmlMode: true,
            });
            const tagName = xml.root().children().get(0)?.name;

            switch (tagName) {
              case "geometry":
                return "HabboAvatarGeometry.xml";
              case "animationSet":
                return "HabboAvatarAnimations.xml";
              case "partSets":
                return "HabboAvatarPartSets.xml";
              case "manifest":
                return "manifest.xml";
              default:
                break;
            }
          }
          return `${item.name}.${ext}`;
        },
      }).pipe(new ProgressStream(":percent :fileName [:bar]"));
    },
  };
}

function PartSetTask(): Task {
  return {
    title: "Convert HabboAvatarPartSets.xml to JSON",
    task: async (ctx) => {
      const partSetsXMLFile = path.join(
        CONFIG.tmp_dir,
        "Habbo",
        TypeDirectories.BINARY,
        "HabboAvatarPartSets.xml"
      );
      const partSetsJSONile = path.join(
        CONFIG.output_dir,
        "HabboAvatarPartSets.json"
      );

      const data = FS.readFileSync(partSetsXMLFile, "utf8");
      const partSetsXML = Cheerio.load(data, {
        xmlMode: true,
      });

      const partSets = partSetsXML("partSet > part").toArray();
      const activePartSets = partSetsXML("activePartSet").toArray();

      const partSetsJSON = {
        partSets: partSets.reduce((acc, el) => {
          const part = Cheerio(el);
          const type = part.attr("set-type");
          part.removeAttr("set-type");
          acc[type] = part.attr();
          return acc;
        }, {}),
        activePartSets: activePartSets.reduce((acc, el) => {
          const activePartSet = Cheerio(el);
          const id = activePartSet.attr("id");
          acc[id] = activePartSet
            .children()
            .toArray()
            .map((el) => Cheerio(el).attr("set-type"));
          return acc;
        }, {}),
      };

      FS.writeFileSync(partSetsJSONile, JSON.stringify(partSetsJSON));
    },
  };
}

function AvatarGeometryTask(): Task {
  return {
    title: "Convert HabboAvatarGeometry.xml to JSON",
    task: async (ctx) => {
      const geometryXMLFile = path.join(
        CONFIG.tmp_dir,
        "Habbo",
        TypeDirectories.BINARY,
        "HabboAvatarGeometry.xml"
      );
      const geometryJSONFile = path.join(
        CONFIG.output_dir,
        "HabboAvatarGeometry.json"
      );

      const data = FS.readFileSync(geometryXMLFile, "utf8");
      const geometryXML = Cheerio.load(data, {
        xmlMode: true,
      });

      const cameras = geometryXML("camera").toArray();
      const canvases = geometryXML("canvas").toArray();
      const avatarSets = geometryXML("geometry > avatarset").toArray();
      const types = geometryXML("type").toArray();

      const camera = cameras.reduce((acc, el) => {
        Cheerio(el)
          .children()
          .toArray()
          .reduce((acc, el) => {
            acc[el.name] = Cheerio(el).text();
            return acc;
          }, acc);
        return acc;
      }, {});

      const canvas = canvases.reduce((acc, el) => {
        const canvas = Cheerio(el);
        const geometries = canvas.children().toArray();
        const scale = canvas.attr("scale");
        canvas.removeAttr("scale");

        acc[scale] = geometries.reduce((acc, el) => {
          const geometry = Cheerio(el);
          const id = geometry.attr("id");
          geometry.removeAttr("id");
          acc[id] = geometry.attr();
          return acc;
        }, {});

        return acc;
      }, {});

      const avatarset = avatarSets.reduce((acc, el) => {
        const avset = Cheerio(el);
        acc[avset.attr("id")] = avset
          .children()
          .toArray()
          .reduce((acc, el) => {
            const innerAvatarset = Cheerio(el);
            const id = innerAvatarset.attr("id");
            innerAvatarset.removeAttr("id");

            acc[id] = {
              ...innerAvatarset.attr(),

              bodyparts: innerAvatarset
                .children()
                .toArray()
                .map((el) => Cheerio(el).attr("id")),
            };
            return acc;
          }, {});
        return acc;
      }, {});

      const type = types.reduce((acc, el) => {
        const type = Cheerio(el);

        acc[type.attr("id")] = type
          .children()
          .toArray()
          .reduce((acc, el) => {
            const bodypart = Cheerio(el);
            const id = bodypart.attr("id");
            bodypart.removeAttr("id");
            acc[id] = {
              ...bodypart.attr(),
              items: bodypart
                .children()
                .toArray()
                .reduce((acc, el) => {
                  const item = Cheerio(el);
                  const id = item.attr("id");
                  item.removeAttr("id");
                  acc[id] = item.attr();
                  return acc;
                }, {}),
            };
            return acc;
          }, {});

        return acc;
      }, {});

      const avatarGeometryJSON = {
        camera,
        canvas,
        avatarset,
        type,
      };

      FS.writeFileSync(geometryJSONFile, JSON.stringify(avatarGeometryJSON));
    },
  };
}

function AvatarAnimationsTask(): Task {
  return {
    title: "Convert HabboAvatarAnimations.xml to JSON",
    task: async (ctx) => {
      const animationsXMLFile = path.join(
        CONFIG.tmp_dir,
        "Habbo",
        TypeDirectories.BINARY,
        "HabboAvatarAnimations.xml"
      );
      const animationsJSONFile = path.join(
        CONFIG.output_dir,
        "HabboAvatarAnimations.json"
      );

      const data = FS.readFileSync(animationsXMLFile, "utf8");
      const actionsXML = Cheerio.load(data, {
        xmlMode: true,
      });

      const actions = actionsXML("animationSet > action").toArray();

      const actionsJSON = actions.reduce((acc, el) => {
        const animation = Cheerio(el);
        const id = animation.attr("id");
        const parts = animation.children("part").toArray();
        const offsetFrames = animation.find("offsets > frame").toArray();

        acc[id] = {
          desc: id,
          frames: parts.reduce((acc, el) => {
            const part = Cheerio(el);
            const frames = part.children("frame").toArray();
            const partType = part.attr("set-type");

            frames.reduce((acc, el) => {
              const frame = Cheerio(el);
              const number = Number(frame.attr("number"));
              frame.removeAttr("number");

              if (!(number in acc)) {
                acc[number] = {
                  bodyparts: {},
                };
              }

              acc[number].bodyparts[partType] = {
                ...frame.attr(),
                frame: number,
              };

              return acc;
            }, acc);

            return acc;
          }, []),
        };

        if (offsetFrames.length) {
          offsetFrames.reduce((acc, el) => {
            const frame = Cheerio(el);
            const id = frame.attr("id");
            const directions = frame.find("directions > direction").toArray();

            if (!(id in acc)) {
              acc[id] = {};
            }

            acc[id].offsets = directions.reduce((acc, el) => {
              const direction = Cheerio(el);
              const id = direction.attr("id");
              const children = direction.children().toArray();

              acc[id] = children.reduce((acc, el) => {
                const child = Cheerio(el);
                const id = child.attr("id");
                child.removeAttr("id");

                acc[id] = child.attr();

                return acc;
              }, {});

              return acc;
            }, {});
            return acc;
          }, acc[id].frames);
        }

        return acc;
      }, {});

      FS.writeFileSync(animationsJSONFile, JSON.stringify(actionsJSON));
    },
  };
}

export function ExtractTileCursorTask(): Task {
  return {
    title: "Extract TileCursor",
    task: (ctx) => {
      const output_dir = path.join(CONFIG.output_dir, "TileCursor")
      // If output dir exists...
      if (FS.existsSync(path.join(output_dir, "binary"))) return;

      return new LibraryTask({
        items: [ItemType.BINARY, ItemType.IMAGE],
        name: "TileCursor",
        output: output_dir,
        tmpDir: path.join(CONFIG.tmp_dir, "TileCursor"),
        swfFile: path.join(CONFIG.tmp_dir, "TileCursor", 'TileCursor.swf')
      }).createBuildTask(ctx);
    },
  };
}

export const HabboTask = (): Task => {
  return {
    title: "Habbo",
    task: (ctx) => {
      ctx.habboPath = path.join(CONFIG.tmp_dir, "Habbo", "Habbo.swf");
      ctx.tileCursorPath = path.join(
        CONFIG.tmp_dir,
        "TileCursor",
        "TileCursor.swf"
      );

      return new Tasklist([
        Downloader.createDownloadTask((ctx) => ({
          [ctx.habboPath]:
            ctx.external_variables.get("flash.client.url") + "Habbo.swf",
          [ctx.tileCursorPath]:
            ctx.external_variables.get("flash.client.url") + "TileCursor.swf",
        })),
        ExtractTask(),
        ExtractTileCursorTask(),
        PartSetTask(),
        AvatarGeometryTask(),
        AvatarAnimationsTask(),
      ]);
    },
  };
};
