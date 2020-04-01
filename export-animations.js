const { DOMParser } = require("xmldom");
const cheerio = require("cheerio");
const { readFileSync, writeFileSync } = require("fs");
const $ = cheerio.load(readFileSync("animations.xml", { encoding: "utf8" }), {
  xmlMode: true
});

function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

const animations = $("action")
  .toArray()
  .reduce((acc, action) => {
    const name = action.attribs.id;
    const parts = $("part", action).toArray();
    const offsets = $(`offsets > frame`, action).toArray();

    acc[name] = acc[name] || {};

    acc[name].frames = parts.reduce((acc, part) => {
      const type = part.attribs["set-type"];
      $("frame", part)
        .toArray()
        .forEach((frame, i) => {
          acc[i] = acc[i] || {};
          Object.assign(acc[i], {
            [type]: Object.entries(frame.attribs).reduce(
              (acc, [key, value]) => ({ ...acc, [key]: parseValue(value) }),
              {}
            )
          });
        });

      return acc;
    }, acc[name].frames || []);

    if (offsets.length) {
      acc[name].offsets = offsets.reduce((acc, frame) => {
        acc[frame.attribs.id] = $("directions > direction", frame)
          .toArray()
          .reduce((acc, direction) => {
            acc[direction.attribs.id] = $("bodypart", direction)
              .toArray()
              .reduce((acc, part) => {
                acc[part.attribs.id] = Object.entries(part.attribs).reduce(
                  (acc, [key, value]) => key === 'id' ? acc : ({
                    ...acc,
                    [key]: parseValue(value)
                  }),
                  {}
                );
                return acc;
              }, {});
            return acc;
          }, {});
        return acc;
      }, {});
    }

    return acc;
  }, {});

console.log(animations);

writeFileSync("dist/animations.json", JSON.stringify(animations));
