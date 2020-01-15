const URL = require("url");
const http = require("http");
const https = require("https");
const { from } = require("rxjs");

/**
 * Make a HTTP Request
 * @param {string} url
 */
function fetch(options) {
  const url = URL.parse(options.url);
  const client = url.protocol === "https:" ? https : http;
  const request = new Promise((resolve, reject) => {
    client.get(
      {
        ...url,
        headers: {
          "User-Agent": "Habbo"
        }
      },
      res => {
        const { location = null } = res.headers;
        if (res.statusCode % 300 < 99) {
          resolve(fetch(location));
        } else if (res.statusCode % 200 < 99) {
          resolve({
            ...options,
            stream: res,
          });
        } else {
          return reject(
            new Error(`Request Failed with status code ${res.statusCode}.`)
          );
        }
      }
    );
  });
  return from(request);
}

module.exports = fetch;
