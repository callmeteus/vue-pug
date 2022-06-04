const PugViewTranspiler = require("./transpiler");

function CompileFile(source, header = "module.exports = ") {
    return header + JSON.stringify(
        PugViewTranspiler.transpile(source, {
            filename: this.resourcePath,
            context: this
        })
    );
};

/**
 * To be used as a middleware
 * @param {String} source The source file
 * @returns 
 */
module.exports = CompileFile;

/**
 * To be used with Vite
 * @param {{
 *  test: RegExp
 * }} config The configuration parameters
 * @returns 
 */
module.exports.vite = function(config = {
    test: /\.pug$/
}) {
    return {
        name: "vue-pug",

        transform(contents, id) {
            if (id.match(config.test)) {
                const generatedCode = module.exports(contents, "export default ");

                return {
                    code: generatedCode,
                    map: null
                };
            }
        }
    }
};