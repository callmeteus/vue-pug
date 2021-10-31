const pug = require("pug");
const load = require("pug-load");

/**
 * Transpiles pug to vue templates
 */
module.exports = class PugViewTranspiler {
    /**
     * Processes a control node
     * @param items The node items
     * @param vueAttr The vue attribute
     * @param emptyStr The vue empty comment string
     * @returns 
     */
    static #processControlNode(items, vueAttr, emptyStr) {
        // If it's empty
        if (!items.length) {
            return {
                type: "Comment",
                val: emptyStr,
                buffer: true,
                line: 0,
                column: 0,
                filename: null 
            }
        } else
        // If the first item attribute name is the first vue attribute name
        if (items[0].attrs.find(a => a.name == vueAttr[0].name)) {
            return {
                block: {
                    type: "Block",
                    nodes: items
                },
                attrs: vueAttr,
                type: "Tag",
                name: "template",
                selfClosing: false,
                attributeBlocks: [],
                isInline: false
            };
        } else {
            // Push the vue attributes inside the node attributes
            items[0].attrs.push(...vueAttr);
            return items[0];
        }
    }

    /**
     * Escapes and encapsulates a value into a string
     * @param {String} val The value to be escaped and encapsulated
     * @returns 
     */
    static #escapeValue(val) {
        return `"${val.replace(/"/g, "\\\"").replace(/\n/g, "")}"`;
    }

    /**
     * Processes pug parser attributes
     * @param {{
     *  name: string,
     *  val: string,
     *  mustEscape: boolean
     * }[]} attrs An array of pug attributes
     * @returns 
     */
    static #processAttributes(attrs) {
        for(let attr of attrs) {
            // If the attribute has no value, ignore it
            if (typeof attr.val !== "string") {
                continue;
            }

            // Check if the attribute is a class and needs to be escaped
            if (attr.name === "class" && attr.mustEscape) {
                // Check if it looks JSON encoded
                if (/^\{[^]*?\}$/m.test(attr.val)) {
                    // Bind it to vue
                    attr.val = this.#escapeValue(attr.val);
                    attr.name = "v-bind:class";
                    attr.mustEscape = false;
                }
            } else
            // Check if can be a v-on bind or a direct function bind
            if (
                attr.mustEscape && (
                    attr.name.startsWith("on:") || attr.name.startsWith("@")
                )
            ) {
                // Bind it to vue
                attr.name = attr.name.startsWith("on:") ? "v-" + attr.name : attr.name.substring(1);
                attr.val = this.#escapeValue(attr.val);
                attr.mustEscape = false;
            } else
            // @note this goest last
            // Check if it must be escaped and doesn't starts and ends with quotes
            if (
                attr.mustEscape && !(
                    (
                        attr.val.startsWith('"') && attr.val.endsWith('"')
                    ) || 
                    (
                        attr.val.startsWith("'") && attr.val.endsWith("'")
                    )
                )
            ) {
                // We'll blindly assume it's an attribute that Vue needs to escape here
                attr.name = ":" + attr.name;
                attr.val = this.#escapeValue(attr.val);
                attr.mustEscape = false;
            }
        }

        return attrs;
    }

    /**
     * Processes an array of pug nodes
     * @param nodes The pug node array to be processed
     * @param insideConditional If it's inside a conditional
     * @returns 
     */
    static #processNodes(nodes, insideConditional = false) {
        // Iterate over all node
        for(let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // Check if the node has any attribute
            if (node.attrs !== undefined) {
                // Process them
                node.attrs = this.#processAttributes(node.attrs);
            }

            // Check if it's a "code" node and needs to be escaped
            if (node.type === "Code" && node.mustEscape) {
                // Blindly pass it to vue
                node.val = this.#escapeValue(node.val);
                node.mustEscape = false;
            }

            // Check if it's not an "each" or a "conditional" node
            if(!/Each|Conditional/.test(node.type)) {
                // If the node has a block
                if (node.block) {
                    // Parse the children nodes
                    node.block.nodes = this.#processNodes(node.block.nodes);
                }

                // If it's a code node and has a buffer
                if (node.type == "Code" && node.buffer && node.mustEscape) {
                    node.type = "Text";
                    node.val = `{{${node.val}}}`;

                    delete node.buffer;
                    delete node.mustEscape;
                    delete node.isInline;
                }

                continue;
            }

            // Check if it's a conditional node
            if (node.consequent) {
                const newNodes = [],
                    consequent = this.#processNodes(node.consequent.nodes),
                    name = insideConditional? "v-else-if" : "v-if",
                    vueIfAttr = [{ name, val: `"${node.test}"`, mustEscape: false }]

                newNodes.push(
                    this.#processControlNode(consequent, vueIfAttr, `empty ${name}=${node.test}`)
                )

                // Check if the condition has an "else" alternative
                if (node.alternate) {
                    // Check if it"s in fact a block
                    if (node.alternate.type == "Block") {
                        const alternate = this.#processNodes(node.alternate.nodes);
                        const vueElseAttr = [{ name: "v-else", val: true, mustEscape: false }];

                        newNodes.push(
                            this.#processControlNode(alternate, vueElseAttr, `empty v-else`)
                        )
                    } else {
                        // Assume it's an array of nodes and process them
                        newNodes.push( ...this.#processNodes([node.alternate], true));
                    }
                }

                nodes.splice(i, 1, ...newNodes);
                i += newNodes.length-1;
            } else {
                // Assume it's a loop
                const loop = (node.key ? `"(${node.val}, ${node.key})` : `"${node.val}` )+ ` in ${node.obj}"`;
                const vueLoopAttr = [{ name: "v-for", val: loop, mustEscape: false }];
                
                if (node.key && node.key.toLowerCase() == "key") {
                    vueLoopAttr.push({name: ":key", val: `"${node.key}"`, mustEscape: false });
                }

                const children = this.#processNodes(node.block.nodes);
                nodes[i] = this.#processControlNode(children, vueLoopAttr, `empty v-for=${loop}`);
            }
        }

        return nodes;
    }

    /**
     * Transpiles a pug template to a vue <template> tag with pug lang
     * @param {String} template The pug template to be transpiled
     * @param {{
     *  filename: string,
     *  context: import("webpack").LoaderContext
     * }} options The compiler options
     * @returns {String}
     */
    static transpile(template, options = {}) {
        return pug.render(template, {
            name: "pupper",
            self: true,
            filename: options.filename,
            plugins: [{
                postParse: (block) => {
                    block.nodes = this.#processNodes(block.nodes);
                    return block;
                },
                resolve(request, source) {
                    let file = load.resolve(request, source);

                    options.context.addDependency(file);
                    return file;
                }
            }]
        });
    }
}