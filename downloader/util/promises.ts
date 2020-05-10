import { PassThrough } from "stream";

export function PromiseToStream(promise: Promise<any>) {
  const stream = new PassThrough({ objectMode: true });
  promise.then((res) => stream.end(res)).catch((err) => stream.destroy(err));
  return stream;
}
