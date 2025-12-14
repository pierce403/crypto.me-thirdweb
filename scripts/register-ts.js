const fs = require('fs');
const ts = require('typescript');

function registerExtension(ext) {
  require.extensions[ext] = function (module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.React,
      },
      fileName: filename,
    });

    return module._compile(outputText, filename);
  };
}

registerExtension('.ts');
registerExtension('.tsx');
