import fs from "fs";
import path from "path";
import zlib from "zlib";
import sharp, { SharpOptions } from "sharp";

export enum ItemType {
  IMAGE = 36,
  BINARY = 87,
  SYMBOL = 76,
}

export enum TypeExtension {
  IMAGE = "png",
  BINARY = "xml",
}

export enum TypeDirectories {
  IMAGE = "images",
  BINARY = "binary",
}

export enum ImageTypes {
  PNG = 5,
}

function read(fd: number, start: number, length: number) {
  const buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, start);
  return buffer;
}

function readString(
  buffer: Buffer,
  offset: number = 0,
  length: number = buffer.length
) {
  let str = "";
  for (let i = offset; i < length; i++) {
    const charCode = buffer[i];

    if (charCode <= 0 || charCode >= 127) {
      break;
    }

    str += String.fromCharCode(charCode);
  }
  return str;
}

function extractSymbols(buffer: Buffer) {
  // const numOfSymbols = buffer.readUInt16LE(0);
  const symbols = {};
  buffer = buffer.slice(2);
  while (buffer.length >= 2) {
    const symbol_id = buffer.readUInt16LE(0);
    const symbol_value = readString(buffer, 2);
    symbols[symbol_id] = symbol_value;
    buffer = buffer.slice(2 + symbol_value.length + 1);
  }
  return symbols;
}

async function extractImages(buffer: Buffer) {
  const tag = {
    symbol_id: buffer.readUInt16LE(0),
    image: null,
    format: buffer.readUInt8(2),
    width: buffer.readUInt16LE(3),
    height: buffer.readUInt16LE(5),
  };

  const data = zlib.unzipSync(buffer.slice(7));

  // If image format isn't PNG return empty list
  if (tag.format != ImageTypes.PNG) return tag;

  // Image output options
  const imageOptions: SharpOptions = {
    raw: {
      channels: 4,
      width: tag.width,
      height: tag.height,
    },
  };

  tag.image = await sharp(data, imageOptions).png().toBuffer();
  return tag;
}

function extractBinary(buffer: Buffer) {
  const length = buffer.length - 5;
  return {
    symbol_id: buffer.readUInt16LE(0),
    data: Buffer.from(readString(buffer, 6, length)),
  };
}

interface ExtractOptions {
  inputFile: string;
  outputDir: string;
  filter: (item: ResourceItem) => boolean;
  fileName: (item: ResourceItem, extName: string) => string;
  itemTypes: ItemType[];
}

interface ResourceItem {
  type: ItemType;
  name: string;
  symbol_id: number;
  data: Buffer;
}

function getTagHeader(buffer: Buffer, cursor: number) {
  const tag_header = buffer.readInt16LE(cursor);
  let offset = 2;

  let [tag_code, tag_length] = [tag_header >> 6, tag_header & 0x3f];

  if (tag_length == 0x3f) {
    tag_length = buffer.readUInt32LE(cursor + offset);
    offset += 4;
  }

  return {
    tag_code,
    tag_length,
    offset,
  };
}

export async function extractSWF(config: Partial<ExtractOptions>) {
  const resourceItems: ResourceItem[] = [];
  let symbols = {};

  const options: Partial<ExtractOptions> = {
    outputDir: "out",
    itemTypes: [ItemType.BINARY, ItemType.IMAGE],
    filter: () => true,
    fileName: (item: ResourceItem, ext: string) => {
      return `${item.name}.${ext}`;
    },
  };
  Object.assign(options, config);

  let buffer = fs.readFileSync(options.inputFile);

  // Uncompress if needed
  if (buffer.slice(0, 3).toString() == "CWS") {
    buffer = Buffer.concat([
      Buffer.from("F"),
      buffer.slice(1, 8),
      zlib.unzipSync(buffer.slice(8)),
    ]);
  }

  const file_length = buffer.readUInt32LE(4);
  const header_length = 8 + 1 + Math.ceil(((buffer[8] >> 3) * 4 - 3) / 8) + 4;

  // Search for symble names
  for (let cursor = header_length; cursor < file_length; ) {
    const { tag_code, tag_length, offset } = getTagHeader(buffer, cursor);
    cursor += offset;

    if (tag_code == ItemType.SYMBOL) {
      symbols = extractSymbols(buffer.slice(cursor, cursor + tag_length));
      break;
    }

    cursor += tag_length;
  }

  for (let cursor = header_length; cursor < file_length; ) {
    const { tag_code, tag_length, offset } = getTagHeader(buffer, cursor);
    cursor += offset;

    const types = {
      async [ItemType.IMAGE]() {
        const tag = await extractImages(
          buffer.slice(cursor, cursor + tag_length)
        );
        if (tag.image) {
          return {
            type: ItemType.IMAGE,
            symbol_id: tag.symbol_id,
            name: symbols[tag.symbol_id] ?? `symbol_${tag.symbol_id}`,
            data: tag.image,
          };
        }
      },
      async [ItemType.BINARY]() {
        const tag = extractBinary(buffer.slice(cursor, cursor + tag_length));
        if (tag.data) {
          return {
            type: ItemType.BINARY,
            symbol_id: tag.symbol_id,
            name: symbols[tag.symbol_id] ?? `symbol_${tag.symbol_id}`,
            data: tag.data,
          };
        }
      },
    };

    // Filter and save extracted item
    if (tag_code in types && new Set(options.itemTypes).has(tag_code)) {
      const item = await types[tag_code]();
      if (options.filter(item)) resourceItems.push(item);
    }

    cursor += tag_length;
  }

  /*************************************
   *         MAKE OUTPUT DIRS          *
   *************************************/
  for (const type in TypeDirectories) {
    fs.mkdirSync(path.join(options.outputDir, TypeDirectories[type]), {
      recursive: true,
    });
  }

  /*************************************
   *       WRITE RESOURCE FILES        *
   *************************************/
  for (const item of resourceItems) {
    fs.writeFileSync(
      path.join(
        options.outputDir,
        TypeDirectories[ItemType[item.type]],
        options.fileName(item, TypeExtension[ItemType[item.type]])
      ),
      item.data
    );
  }
}
