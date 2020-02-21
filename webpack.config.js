const path = require('path');
const HtmlWebPackPlugin = require("html-webpack-plugin");
const withCSS = require('@zeit/next-css');

module.exports = {
    entry: "./src/app.js",
    output: {
        path: path.resolve('./'),
        filename: 'main.min.js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.scss$/,
                use: ["style-loader", "css-loader", "sass-loader"]
            },
            {
                test: /\.(eot|woff|woff2|ttf|svg|png|jpg|gif)$/,
                use: {
                    loader: 'url-loader',
                    options: {
                    limit: 100000,
                    name: '[name].[ext]'
                    }
                }
            }
        ]
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./src/index.html",
            filename: "./index.html"
        }),
        new HtmlWebPackPlugin({
            template: "./src/team.html",
            filename: "./team.html"
        }),

    ]
};