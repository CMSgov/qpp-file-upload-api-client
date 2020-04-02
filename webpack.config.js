const path = require('path');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const packageJson = require('./package.json');

const entry = ['./index.js'];

const _module = {
  rules: [
    {
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      use: 'babel-loader'
    }
  ]
};

const plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify('production')
    },
    buildVersion: JSON.stringify(packageJson.version)
  }),
  new UglifyJSPlugin()
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
    mode: env && env.production === 'true' ? 'production' : 'development',
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
    mode: env && env.production === 'true' ? 'production' : 'development',
    plugins,
    resolve
  });
};

module.exports = [defaultConfig, browserConfig];
