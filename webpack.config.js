const path = require('path');
const webpack = require('webpack');

const packageJson = require('./package.json');

const entry = ['./index.js'];

const _module = {
  rules: [{
    test: /\.(js)?$/,
    loader: 'babel-loader',
    exclude: /node_modules/
  }]
};

const plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify('production')
    },
    buildVersion: JSON.stringify(packageJson.version)
  }),
  new webpack.optimize.UglifyJsPlugin(),
];

const resolve = {
  extensions: ['.js', '.json', '*']
};

const defaultConfig = (env, argv) => {
    
  return ({
    target: 'node',
    entry,
    output: {
      library: 'QppFileUploadClient',
      libraryTarget: 'commonjs2',
      filename: 'node.js',
      path: path.resolve(__dirname, 'dist')
    },
    devtool: env && env.production == 'true' ? 'source-map' : 'eval-source-map',
    module: _module, // module is already defined
    plugins,
    resolve
  });
};


const browserConfig = (env, argv) => {

  return ({
    target: 'web',
    entry,
    output: {
      libraryTarget: 'commonjs2',
      library: 'QppFileUploadClient',
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist')
    },
    devtool: env && env.production == 'true' ? 'source-map' : 'eval-source-map',
    module: _module, // module is already defined
    plugins,
    resolve
  });
};

module.exports = [defaultConfig, browserConfig];
