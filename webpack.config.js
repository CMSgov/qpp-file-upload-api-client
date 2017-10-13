const path = require('path');
const webpack = require('webpack');

const entry = ['./index.js'];

const _module = {
    rules: [{
        test: /\.(js)?$/,
        loader: 'babel-loader',
        exclude: /node_modules/
    }]
};

const resolve = {
    extensions: ['.js', '.json', '*']
};

const defaultConfig = (env, argv) => {
    
    return ({
        target: 'node',
        entry,
        output: {
            library: 'QppFileUploadClient',
            // libraryTarget: 'umd',
            filename: 'node.js',
            path: path.resolve(__dirname, 'dist')
        },
        // devtool: env.production == 'true' ? 'source-map' : 'eval-source-map',
        module: _module, // module is already defined
        // plugins,
        resolve
    });
}


const browserConfig = (env, argv) => {

    return ({
        target: 'web',
        entry,
        output: {
            // libraryTarget: 'var',
            library: 'QppFileUploadClient',
            filename: 'index.js',
            path: path.resolve(__dirname, 'dist')
        },
        // devtool: env.production == 'true' ? 'source-map' : 'eval-source-map',
        module: _module, // module is already defined
        // plugins,
        resolve
    });
}

module.exports = [defaultConfig, browserConfig];