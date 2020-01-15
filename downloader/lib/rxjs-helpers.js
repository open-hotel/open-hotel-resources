const { Observable } = require("rxjs");

function fromStream(stream, options) {
  return new Observable(observer => {
    const dataHandler = data =>
      observer.next({
        data,
        options
      });
    const errorHandler = err => observer.error(err);
    const endHandler = () => observer.complete();

    stream.addListener("data", dataHandler);
    stream.addListener("error", errorHandler);
    stream.addListener("end", endHandler);

    stream.addListener("close", () => {
      stream.removeListener("data", dataHandler);
      stream.removeListener("error", errorHandler);
      stream.removeListener("finish", endHandler);
    });
  });
}

module.exports = {
  fromStream
};
