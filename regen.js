let cl = module.require('./cl.js');
let LichatStream = module.require('./stream.js');
let LichatReader = module.require('./reader.js');
let fs = require('fs');

module.exports = (files)=>{
    files = files || ['spec/lichat.sexpr', 'spec/shirakumo.sexpr'];
    let reader = new LichatReader();
    let classes = new Map();
    let extensions = [];

    let parseExpr = (expr)=>{
        switch(expr[0].name){
        case 'define-package':
            break;
        case 'define-object':
            classes.set(expr[1], [
                expr[2],
                expr.slice(3)
            ]);
            break;
        case 'define-object-extension':
            let def = classes.get(expr[1]);
            def[0] = [...def[0], ...expr[2]];
            def[1] = [...def[1], ...expr.slice(3)];
            break;
        case 'define-extension':
            extensions.push(expr[1]);
            for(let i=2; i<expr.length; ++i){
                parseExpr(expr[i]);
            }
            break;
        }
    };

    for(let file of files){
        console.log("Parsing", file);
        let stream = new LichatStream(fs.readFileSync(file).toString());
        try{
            while(true)
                parseExpr(reader.readSexpr(stream));
        }catch(e){
            if(e.message !== "END-OF-STREAM")
                throw e;
        }
    }
    
    result = "var LichatExtensions = ['"+extensions.join("','")+"'];\n";
    result += "(()=>{ let s = cl.intern;\n";
    
    let symb = (symbol)=>{
        return "s('"+symbol.name+"','"+symbol.pkg+"')";
    };
    
    classes.forEach((args, name)=>{
        if(!args[0].length) args[0] = [cl.intern("object", "lichat")];
        result += "cl.defclass("+symb(name)+", ["+args[0].map(symb).join(",")+"]";
        if(args[1].length){
            result += ", {\n";
            for(let slot of args[1]){
                let name = slot[0];
                let req = !slot.includes(cl.kw("optional"));
                result += "   '"+name.name+"': "+(req?"cl.requiredArg('"+name.name+"')":"null")+",\n";
                }
            result += "}";
            }
        result += ");\n";
    });
    
    result += "})();\n";
    fs.writeFileSync(__dirname+'/wire-object.js', result);
    return classes;
};

if (require.main === module)
    module.exports();