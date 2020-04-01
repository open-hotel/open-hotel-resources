const fs = require('fs')
const XML = require('xml2js')

function parseValue (value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

convert()