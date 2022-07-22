var package = require('../package.json')
var fs = require('fs');
var content = {
  "edgeworker-version": package.version,
  "description": package.description
};

try {
  fs.writeFileSync('dist/bundle.json', JSON.stringify(content));
} catch (e) {
  console.log("Cannot write file ", e);
}
