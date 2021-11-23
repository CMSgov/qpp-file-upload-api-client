// This file is just a test to make sure node-style imports are configured properly
// I just ran this with `node server-test.js` to verify the output.
// It may be useful to someone in the future.
// eslint-disable-next-line no-console
const uploader = require('./dist/node.js');
const fs = require('fs');
const path = require('path');
//replace this with location of local file
const jsonFileLocation = path.join(__dirname, 'test/test-file.json');

console.log(uploader);

const jsonFileContents = JSON.stringify(JSON.parse(fs.readFileSync(jsonFileLocation)));
console.log(jsonFileContents);

let requestHeaders = {
  Authorization: 'Bearer fake-token',
  'organization-id': 'individual'
};

uploader.fileUploader(jsonFileContents, 'JSON', requestHeaders, 'http://local.semanticbits.com:8081',
  (err, createdMeasurementSets) => {
    if(err) {
      console.log(err);
    }

    console.log(createdMeasurementSets);
  });
