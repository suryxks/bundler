import { transformFromAstSync } from "@babel/core";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import fs from "fs";
import path from "path";

const traverse = _traverse.default;
let ID = 0;
function createAsset(filename) {
  const content = fs.readFileSync(filename, "utf-8");
  const ast = parse(content, { ecmaVersion: "latest", sourceType: "module" });
  const dependencies = [];
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });
  const id = ID++;
  const { code } = transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env"],
  });
  return {
    id,
    filename,
    dependencies,
    code,
  };
}
function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const queue = [mainAsset];

  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);

    asset.mapping = {};

    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const child = createAsset(absolutePath);
      asset.mapping[relativePath] = child.id;

      queue.push(child);
    });
  }
  return queue;
}
function bundle(graph) {
  let modules = "";
  graph.forEach((mod) => {
    modules += `${mod.id}:[
       function(require,module,exports){
        ${mod.code}
     },
     ${JSON.stringify(mod.mapping)}
    ],`;
  });
  const result = `
      (function(modules){
            function require(id){
               const [fn,mapping]=modules[id]

               function localRequire(relativepath){
                 return require(mapping[relativepath])
               }
           
               const module={exports:{}}   
               fn(localRequire,module,module.exports);

               return module.exports
            }
            require(0);
      })({
         ${modules}
      })
    `;

  return result;
}
const graph = createGraph("./example/entry.js");
const result = bundle(graph);
console.log(result);
