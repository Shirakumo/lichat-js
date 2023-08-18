if(typeof module !== 'undefined'){
    cl = module.require('./cl.js');
    LichatStream = module.require('./stream.js');
}

var LichatReader = function(){
    this.whitespace = "\u0009\u000A\u000B\u000C\u000D\u0020\u0085\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\u180E\u200B\u200C\u200D\u2060\uFEFF";
    this.invalidSymbol = cl.intern("INVALID-SYMBOL");

    this.isWhitespace = (character)=>{
        return this.whitespace.indexOf(character) >= 0;
    };

    this.skipWhitespace = (stream)=>{
        while(this.isWhitespace(stream.readChar()));
        stream.unreadChar();
        return stream;
    };

    this.readSexprList = (stream)=>{
        var array = [];
        this.skipWhitespace(stream);
        while(stream.peekChar() !== ")"){
            array.push(this.readSexpr(stream));
            this.skipWhitespace(stream);
        }
        stream.readChar();
        return array;
    };

    this.readSexprString = (stream)=>{
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

    this.readSexprKeyword = (stream)=>{
        return cl.intern(this.readSexprToken(stream), "keyword");
    };

    this.readSexprNumber = (stream)=>{
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
                break;
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

    this.readSexprToken = (stream)=>{
        stream.peekChar();
        var out = new LichatStream();
        loop:
        for(;;){
            var character = stream.readChar(false);
            switch(character){
            case null: break loop;
            case "\\": out.writeChar(stream.readChar()); break;
            case "(": case ")": case ".": case " ": case "\"": case ":":
            case "0": case "1": case "2": case "3": case "4":
            case "5": case "6": case "7": case "8": case "9":
                stream.unreadChar(); break loop;
            default:
                out.writeChar(character.toUpperCase());
            }
        }
        return out.string;
    };

    this.readSexprSymbol = (stream)=>{
        var token = this.readSexprToken(stream);
        if(stream.peekChar(false) === ":"){
            stream.readChar();
            return cl.intern(this.readSexprToken(stream), token);
        }else{
            var symbol = cl.intern(token, "LICHAT");
            if(symbol == cl.NIL) return null;
            if(symbol == cl.T) return true;
            return symbol;
        }
    };

    this.readSexpr = (stream)=>{
        this.skipWhitespace(stream);
        // FIXME: Catch symbol errors
        switch(stream.readChar()){
        case "(": return this.readSexprList(stream);
        case ")": throw new Error("INCOMPLETE-TOKEN");
        case "\"": return this.readSexprString(stream);
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9": case ".":
            stream.unreadChar();
            return this.readSexprNumber(stream);
        case ":": return this.readSexprKeyword(stream);
        default:
            stream.unreadChar();
            return this.readSexprSymbol(stream);
        }
    };

    this.parseUpdate = (sexpr)=>{
        var type = sexpr.shift();
        if(!cl.symbolp(type))
            throw new Error("First item in list is not a symbol: "+sexpr);
        
        var initargs = {};
        for(var i=0; i<sexpr.length; i+=2){
            var key = sexpr[i];
            var val = sexpr[i+1];
            if(!cl.symbolp(key) || key.pkg !== "keyword"){
                throw new Error(key+" is not of type Keyword.");
            }
            initargs[key.name.toLowerCase()] = val;
        }
        if(initargs.id === undefined)
            throw new Error("MISSING-ID");
        if(initargs.clock === undefined)
            throw new Error("MISSING-CLOCK");
        return cl.makeInstance(type, initargs);
    };

    this.fromWire = (stream)=>{
        var sexpr = this.readSexpr(stream);
        if(sexpr instanceof Array){
            return this.parseUpdate(sexpr);
        }else{
            return sexpr;
        }
    };

    return this;
};

LichatReader.fromString = (string)=>{
    return new LichatReader().readSexpr(new LichatStream(string));
};

if(typeof module !== 'undefined')
    module.exports = LichatReader;
