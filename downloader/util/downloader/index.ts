import URL from "url";
import { IncomingMessage } from "http";
import { http, https, FollowResponse } from "follow-redirects";
import FS from "fs";
import { dirname, basename } from "path";
import { CONFIG } from "../../config";
import { PassThrough } from "stream";
import { ProgressStream } from "../progress";
import { DownloadProgress } from "./progress";
import { Tasklist } from "../tasklist/Tasklist";
import { Task } from "../tasklist/task.interface";

export class Downloader {
  /**
   * Make a HTTP Request
   * @param {string} url
   */
  static async fetch(url: string): Promise<IncomingMessage & FollowResponse> {
    const fullUrl = URL.parse(url);
    const client = fullUrl.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      client.get(
        {
          ...fullUrl,
          headers: {
            "User-Agent": "Hello!",
          },
        },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res);
          } else if (
            res.statusCode === 404 &&
            CONFIG.ignore_not_found_downloads
          ) {
            resolve(res);
          } else {
            reject(
              new Error(
                `Request to ${url} failed with status code ${res.statusCode}.`
              )
            );
          }
        }
      );
    });
  }

  static download(
    filename: string,
    url: string,
    title?: string
  ): NodeJS.ReadableStream {
    if (FS.existsSync(filename)) {
      const stream = new DownloadProgress();
      stream.end();
      return stream;
    }

    if (url.startsWith("//")) {
      url = `${CONFIG.protocol}:${url}`;
    }

    if (title === undefined) {
      title = `Download ${url}`;
    }

    const stream = new DownloadProgress();

    // Request
    this.fetch(url)
      .then((res) => {
        stream.total = Number(res.headers["content-length"]) || 0;

        // Create directory
        FS.mkdirSync(dirname(filename), { recursive: true });

        // Write file
        res.pipe(stream);
        res.pipe(FS.createWriteStream(filename));
      })
      .catch((err) => {
        stream.destroy(err);
      });

    return stream;
  }

  static createDownloadTask(
    files: (ctx: any) => Record<string, string>,
    title = "Download files",
    concurrently = 1
  ): Task {
    return {
      title,
      task: (ctx) =>
        new Tasklist(
          Object.entries(files(ctx)).map<Task>(
            ([filename, url], index, arr) => ({
              title: `(${index + 1}/${arr.length}) ${basename(filename)}`,
              task: () => {
                return this.download(filename, url).pipe(
                  new ProgressStream(
                    ":percent [:bar] (:loadedBytes/:totalBytes) :speedBytes :time",
                    {},
                    80
                  )
                );
              },
            })
          ),
          { concurrently }
        ),
    };
  }
}
