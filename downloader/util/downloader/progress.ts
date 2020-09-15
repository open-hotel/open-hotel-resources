import { ListenErrorStream } from "../progress";

export class DownloadProgress extends ListenErrorStream {
  public loaded = 0;
  public total = 0;

  _transform(chunk: Buffer, encoding: string, cb: Function) {
    this.loaded += chunk.length;
    cb(null, {
      loaded: this.loaded,
      total: this.total,
      chunk,
    });
  }
}
