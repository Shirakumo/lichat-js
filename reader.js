var LichatReader = function(){
    var self = this;

    self.whitespace = "\u0009\u000A\u000B\u000C\u000D\u0020\u0085\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\u180E\u200B\u200C\u200D\u2060\uFEFF"
    self.invalidSymbol = cl.makeSymbol("INVALID-SYMBOL");

    self.isWhistepace = function(character){
        return self.whitespace.indexOf(character) >= 0;
    };

    self.skipWhitespace = function(stream){
        while(self.isWhitespace(stream.readChar()));
        stream.unreadChar();
        return stream;
    };

    self.isProtocolSymbol = function(name){
        return self.protocolSymbols.indexOf(name) >= 0;
    };

    self.safeFindSymbol = function(name, pkg){
        if(pkg === "KEYWORD"){
            return cl.intern(name, pkg);
        }
        if(pkg === "LICHAT-PROTOCOL" && cl.findSymbol(name, pkg)){
            return cl.findSymbol(name, pkg);
        }
        if(pkg === null){
            return cl.makeSymbol(name);
        }
        return self.invalidSymbol;
    };

    self.readSexprList = function(stream){
        var array = [];
        self.skipWhitespace(stream);
        while(stream.peekChar() !== ")"){
            array.push(self.readSexpr());
            self.skipWhitespace(stream);
        }
        stream.readChar();
        return array;
    };

    self.readSexprString = function(stream){
        var out = new LichatStream();
        loop:
        for(;;){
            var character = stream.readChar();
            switch(character){
            case "\\": out.writeChar(stream.readChar()); break;
            case "\"": break loop;
            default: out.writeChar(character);
            }
        }
        return out.string;
    };

    self.readSexprKeyword = function(stream){
        return self.safeFindSymbol(self.readSexprToken(stream), "KEYWORD");
    };

    self.readSexprNumber = function(stream){
        var out = new LichatStream();
        var point = false;
        loop:
        for(var i=0;; i++){
            var character = stream.readChar(false);
            switch(character){
            case null: break loop;
            case ".":
                if(point){
                    stream.unreadChar();
                    break loop;
                }else{
                    point = i;
                }
                break;
            case "0": case "1": case "2": case "3": case "4":
            case "5": case "6": case "7": case "8": case "9":
                out.writeChar(character);
            default:
                stream.unreadChar();
                break loop;
            }
        }
        var numberString = out.string;
        var number = (numberString === "")? 0 : parseInt(numberString);
        if(point){
            var decimal = numberString.length - point;
            return number/Math.pow(10,decimal);
        }else{
            return number;
        }
    };

    self.readSexprToken = function(stream){
        stream.peekChar();
        var out = new LichatStream();
        loop:
        for(;;){
            var character = stream.readChar(false);
            switch(character){
            case null: break loop;
            case "\\": out.writeChar(stream.readChar()); break;
            case "(": case ")": case ".": case " ": case "\"":
            case "0": case "1": case "2": case "3": case "4":
            case "5": case "6": case "7": case "8": case "9":
                stream.unreadChar(); break loop;
            default:
                out.writeChar(character.toUpperCase());
            }
        }
        return out.string;
    };

    self.readSexprSymbol = function(stream){
        var token = self.readSexprToken(stream);
        if(stream.peekChar(false) === ":"){
            stream.readChar();
            if(token === "#"){
                return self.safeFindSymbol(self.readSexprToken(stream), null);
            }else{
                return self.safeFindSymbol(self.readSexprToken(stream), token);
            }
        }else{
            self.safeFindSymbol(token, "LICHAT-PROTOCOL");
        }
    };

    self.readSexpr = function(stream){
        self.skipWhitespace(stream);
        // FIXME: Catch symbol errors
        switch(stream.readChar()){
        case "(": return self.readSexprList(stream);
        case ")": throw "Icomplete token";
        case "\"": return self.readSexprString(stream);
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9": case ".":
            stream.unreadChar();
            return self.readSexprNumber(stream);
        case ":": return self.readSexprKeyword(stream);
        default:
            stream.unreadChar();
            return self.readSexprSymbol(stream);
        }
    };

    self.fromWire = function(stream){
        var sexpr = self.readSexpr(stream);
        if(sexpr instanceof Array){
            var type = sexpr.shift();
            if(! type instanceof Keyword){
                throw "Wire object is malformed. First item in list is not a keyword: "+sexpr;
            }
            
            var object = new WireObject(type);
            for(var i=0; i<sexpr.length; i+=2){
                var key = sexpr[i];
                var val = sexpr[i+1];
                if(! key instanceof Symbol || key.pkg !== "KEYWORD"){
                    throw "Wire object is malformed. Key is not of type Keyword: "+sexpr;
                }
                object.set(key, val);
            }
            if(!object.id){
                throw "Missing ID on object. "+object;
            }
            if(!object.clock){
                throw "Missing CLOCK on object. "+object;
            }
            return object;
            
        }else{
            return sexpr;
        }
    };

    return self;
};
