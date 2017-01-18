var LichatPrinter = function(){
    var self = this;

    self.printSexprList = function(list, stream){
        stream.writeChar("(");
        cl.unwindProtect(()=>{
            for(var i=0; i<list.length; i++){
                self.printSexpr(list[i], stream);
                if(i+1 < list.length){
                    stream.writeChar(",");
                }
            }
        },()=>{
            stream.writeChar(")");
        });
    };

    self.printSexprString = function(string, stream){
        stream.writeChar("\"");
        cl.unwindProtect(()=>{
            for(var character of string){
                if(character === "\""){
                    stream.writeChar("\\");
                }
                stream.writeChar(character);
            }
        },()=>{
            stream.writeChar("\"");
        });
    };

    self.printSexprNumber = function(number, stream){
        if(Math.abs(number) < 1.0){
            var e = parseInt(number.toString().split('e-')[1]);
            if(e){
                number *= Math.pow(10,e-1);
                number = '0.' + (new Array(e)).join('0') + number.toString().substring(2);
            }
        }else{
            var e = parseInt(number.toString().split('+')[1]);
            if(e > 20){
                e -= 20;
                number /= Math.pow(10,e);
                number += (new Array(e+1)).join('0');
            }
        }
        stream.writeString(number);
    };
    
    self.printSexprToken = function(token, stream){
        for(var character of token){
            if("\"():0123456789. #".indexOf(character) >= 0){
                stream.writeChar("\\");
            }
            stream.writeChar(character);
        }
    };

    self.printSexprSymbol = function(symbol, stream){
        switch(symbol.pkg){
        case null:
            stream.writeChar("#");
            stream.writeChar(":");
            break;
        case "KEYWORD":
            stream.writeChar(":");
            break;
        case "LICHAT-PROTOCOL":
            break;
        default:
            self.printSexprToken(symbol.pkg, stream);
            stream.writeChar(":");
        }
        self.printSexprToken(symbol.name, stream);
    };

    self.printSexpr = function(sexpr, stream){
        cl.typecase(sexpr,
                    null,     ()=> self.printSexprToken("NIL", stream),
                    "String", ()=> self.printSexprString(sexpr, stream),
                    "Array",  ()=> self.printSexprList(sexpr, stream),
                    "Number", ()=> self.printSexprNumber(sexpr, stream),
                    "Symbol", ()=> self.printSexprSymbol(sexpr, stream),
                    true, ()=> {throw "Unprintable object "+sexpr;});
    };

    self.toWire = function(wireable, stream){
        if(wireable instanceof WireObject){
            var list = [wireable.type];
            for(var key in wireable){
                if(key !== "type"){
                    list.push(key);
                    list.push(wireable[key]);
                }
            }
            self.printSexpr(list, stream);
        }else{
            self.printSexpr(wireable, stream);
        }
    };

    return self;
};
