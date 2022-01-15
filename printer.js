if(typeof module !== 'undefined'){
    cl = module.require('./cl.js');
    LichatStream = module.require('./stream.js');
}

var LichatPrinter = function(){
    var self = this;

    self.printSexprList = (list, stream)=>{
        stream.writeChar("(");
        try{
            for(var i=0; i<list.length; i++){
                self.printSexpr(list[i], stream);
                if(i+1 < list.length){
                    stream.writeChar(" ");
                }
            }
        }finally{
            stream.writeChar(")");
        }
    };

    self.printSexprString = (string, stream)=>{
        stream.writeChar("\"");
        try{
            for(var character of string){
                if(character === "\"" | character === "\\"){
                    stream.writeChar("\\");
                }
                stream.writeChar(character);
            }
        }finally{
            stream.writeChar("\"");
        }
    };

    self.printSexprNumber = (number, stream)=>{
        if(Math.abs(number) < 1.0){
            let e = parseInt(number.toString().split('e-')[1]);
            if(e){
                number *= Math.pow(10,e-1);
                number = '0.' + (new Array(e)).join('0') + number.toString().substring(2);
            }
        }else{
            let e = parseInt(number.toString().split('+')[1]);
            if(e > 20){
                e -= 20;
                number /= Math.pow(10,e);
                number += (new Array(e+1)).join('0');
            }
        }
        stream.writeString(number);
    };
    
    self.printSexprToken = (token, stream)=>{
        for(let character of token){
            if("\\\"():0123456789. #".indexOf(character) >= 0){
                stream.writeChar("\\");
            }
            stream.writeChar(character);
        }
    };

    self.printSexprSymbol = (symbol, stream)=>{
        switch(symbol.pkg){
        case "keyword":
            stream.writeChar(":");
            break;
        case "lichat":
            break;
        default:
            self.printSexprToken(symbol.pkg, stream);
            stream.writeChar(":");
        }
        self.printSexprToken(symbol.name, stream);
    };

    self.printSexpr = (sexpr, stream)=>{
        cl.typecase(sexpr,
                    null,      ()=> self.printSexprToken("NIL", stream),
                    "String",  ()=> self.printSexprString(sexpr, stream),
                    "Array",   ()=> self.printSexprList(sexpr, stream),
                    "Number",  ()=> self.printSexprNumber(sexpr, stream),
                    "Symbol",  ()=> self.printSexprSymbol(sexpr, stream),
                    "Boolean", ()=> self.printSexprToken((sexpr)?"T":"NIL", stream),
                    true, ()=>{
                        console.error(sexpr);
                        throw new Error(sexpr+" is unprintable");
                    });
    };

    self.toWire = (wireable, stream)=>{
        if(cl.typep(wireable, "object")){
            var list = [wireable.type];
            for(var key of wireable.fields){
                list.push(cl.findSymbol(key, "keyword"));
                list.push(wireable[key]);
            }
            self.printSexpr(list, stream);
        }else{
            self.printSexpr(wireable, stream);
        }
    };

    return self;
};

LichatPrinter.toString = (wireable)=>{
    var stream = new LichatStream();
    new LichatPrinter().toWire(wireable, stream);
    return stream.string;
};

if(typeof module !== 'undefined')
    module.exports = LichatPrinter;
