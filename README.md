#vue-pug
Compiles plain pug files into vue.js templates; compatible with webpack

---

# Usage
- As a webpack loader

webpack.config.js
```javascript
module.exports = {
    entry: {
        index: {
            import: "src/index.js"
        }
    },
    module: {
        rules: [
            {
                "test": /\.pvue$/,
                "use": [
                    "vue-pug"
                ]
            }
        ]
    }
};
```

src/template.pvue
```pug
h2|Hewwo Wowd! owo
p="You're visiting" + author + "'s page, and currently is " + time + " o'clock :)"

if author != "Matheus Giovani"
    p|Boo, the author is not Matheus Giovani! :(
else
    p|Welcome to the original plugin author page!

each item in items
    p=item.text
```

src/index.js
```javascript
const app = new Vue({
    el: "#app",
    template: require("./template.pvue"),
    data: {
        author: "Matheus Giovani",
        time: (new Date()).toLocaleTimeString(),
        items: [
            {
                text: "Test item"
            },
            {
                text: "Second test item"
            }
        ]
    }
});
```