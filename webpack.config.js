const path = require('path');
const webpack = require('webpack');
const packageJson = require('./package.json');
const TerserPlugin = require('terser-webpack-plugin');

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

const buildPlugins = (env) => [
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(env || process.env.NODE_ENV || 'production'),
    buildVersion: JSON.stringify(packageJson.version)
  }),
  new TerserPlugin()
];

const resolve = {
  extensions: ['.js', '.json', '*']
};

const defaultConfig = (env, argv) => {
  // Checking string 'true' worked in webpack v4, v5 seems to use a boolean. Checking both to be safe
  const isProdBuild = env && (env.production === true || env.production === 'true');
  return ({
    target: 'node',
    entry,
    output: {
      library: 'QppFileUploadClient',
      libraryTarget: 'commonjs2',
      filename: 'node.js',
      path: path.resolve(__dirname, 'dist')
    },
    devtool: isProdBuild ? 'source-map' : 'eval-source-map',
    mode: isProdBuild ? 'production' : 'development',
    module: _module, // module is already defined
    plugins: buildPlugins(isProdBuild ? 'production' : 'development'),
    resolve
  });
};


const browserConfig = (env, argv) => {
  // Checking string 'true' worked in webpack v4, v5 seems to use a boolean. Checking both to be safe
  const isProdBuild = env && (env.production === true || env.production === 'true');
  return ({
    target: 'web',
    entry,
    output: {
      libraryTarget: 'commonjs2',
      library: 'QppFileUploadClient',
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist')
    },
    devtool: isProdBuild ? 'source-map' : 'eval-source-map',
    module: _module, // module is already defined
    mode: isProdBuild ? 'production' : 'development',
    plugins: buildPlugins(isProdBuild ? 'production' : 'development'),
    resolve
  });
};

module.exports = [ defaultConfig, browserConfig ];
