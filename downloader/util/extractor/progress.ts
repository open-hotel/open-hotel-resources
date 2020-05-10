import { ListenErrorStream } from "../progress";
import { ResourceItem } from "./types";

export class ExtractProgress extends ListenErrorStream {
  public loaded = 0;

  constructor(public total: number) {
    super();
  }

  _transform(item: ResourceItem, encoding: string, cb: Function) {
    this.loaded++;
    cb(null, {
      loaded: this.loaded,
      total: this.total,
      ...item,
    });
  }
}
