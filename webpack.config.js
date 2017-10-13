var path = require('path');
var serverConfig = {
    target: 'node',
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'lib.node.js'
    }
};

var clientConfig = {
    target: 'web',
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'lib.js'
    }
};

module.exports = [ serverConfig, clientConfig ];