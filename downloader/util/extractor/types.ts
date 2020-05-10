export enum ItemType {
  IMAGE = 36,
  BINARY = 87,
  SYMBOL = 76,
}

export enum TypeExtension {
  IMAGE = "png",
  BINARY = "bin",
}

export enum TypeDirectories {
  IMAGE = "images",
  BINARY = "binary",
}

export enum ImageTypes {
  PNG = 5,
}

export interface ExtractOptions {
  inputFile: string;
  outputDir: string;
  filter: (item: ResourceItem) => boolean;
  fileName: (item: ResourceItem, extName: string) => string;
  itemTypes: ItemType[];
}

export interface ResourceItem {
  type: ItemType;
  fileName: string;
  name: string;
  symbol_id: number;
  data: Buffer;
}
