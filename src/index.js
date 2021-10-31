const PugViewTranspiler = require("./transpiler");

/**
 * @param {String} source The source file
 * @returns 
 */
module.exports = function(source) {
    return "module.exports = " + JSON.stringify(
        PugViewTranspiler.transpile(source, {
            filename: this.resourcePath,
            context: this
        })
    );
};