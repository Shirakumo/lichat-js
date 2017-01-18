var Symbol = function(name, pkg){
    var self = this;
    if(!name) throw "Cannot create symbol with empty name.";
    self.name = name;
    self.pkg = pkg || null;
    self.toString = function(){
        return self.name;
    }
    return self;
};

var Keyword = function(name){
    var self = this;
    Symbol.call(self, name, "KEYWORD");
    return self;
};
Keyword.prototype = Object.create(Symbol.prototype);

var CL = function(){
    var self = this;
    var symbols = {};

    self.defclass = function(name, superclass, slots, initializer){
        slots = slots || [];
        initializer = initializer || function(){}
        var c = function(initargs){
            var self = this;
            window[superclass].call(self);
            for(var i=0; i<slots.length; i+= 2){
                var name = slots[i];
                var options = slots[i+1];
                var initarg = initargs[options.initarg];
                self[name] = (initarg !== undefined)? initarg
                    : options.initform;
            }
            initializer(self);
            return self;
        }
        c.prototype = Object.create(window[superclass].prototype);
        window[name] = c;
        return name;
    };
    
    self.intern = function(name, pkg){
        var symbol = self.findSymbol(name, pkg);
        if(!symbol){
            if(pkg === "KEYWORD"){
                symbol = new Keyword(name);
            }else{
                symbol = new Symbol(name, pkg || "LICHAT-JS");
            }
            if(symbols[symbol.pkg] === undefined){
                symbols[symbol.pkg] = {};
            }
            symbols[symbol.pkg][symbol.name] = symbol;
        }
        return symbol;
    };

    self.findSymbol = function(name, pkg){
        var pkgspace = symbols[pkg || "LICHAT-JS"];
        if(pkgspace === undefined) return null;
        var symbol = pkgspace[name];
        if(symbol === undefined) return null;
        return symbol;
    };

    self.makeSymbol = function(name){
        return new Symbol(name);
    };

    self.unwindProtect = function(protect, cleanup){
        try{protect();
            cleanup();}
        catch(e){
            cleanup();
            throw e;
        }
    };

    self.typecase = function(object){
        for(var i=1; i<arguments.length; i+=2){
            var type = arguments[i];
            var func = arguments[i+1];
            if(type === true){
                return func();
            }else if(type === null){
                if(object === null){
                    return func();
                }
            }else{
                if(!window[type]) throw "Invalid type: "+type;
                if(window[type].prototype.isPrototypeOf(object)
                   || object.constructor === window[type].prototype.constructor){
                    return func();
                }
            }
        }
        return null;
    };

    self.universalUnixOffset = 2208988800;

    self.getUniversalTime = function(){
        return self.universalUnixOffset + new Date();
    }

    return self;
};

var cl = new CL();
var LichatStream = function(string){
    var self = this;
    self.string = string || "";
    var i = 0;

    self.readChar = function(errorp){
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            var character = self.string[i];
            i++;
            return character;
        }else if(errorp){
            throw "End of stream reached.";
        }else{
            return null;
        }
    };

    self.unreadChar = function(){
        if(0 < i){
            i--;
        }else{
            throw "Cannot unread more.";
        }
    };

    self.peekChar = function(errorp){
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            return self.string[i];
        }else if(errorp){
            throw "End of stream reached.";
        }else{
            return null;
        }
    };

    self.writeChar = function(character){
        self.string += character;
        i++;
        return character;
    };

    self.writeString = function(string){
        self.string += string;
        i += string.length;
        return string;
    };

    self.toString = function(){
        return self.string;
    }
    
    return self;
}
var IDCounter = Math.random(+new Date());
var nextID = function(){
    var ID = IDCounter;
    IDCounter++;
    return ID;
};

for(var name of ["WIRE-OBJECT","UPDATE","PING","PONG","CONNECT","DISCONNECT","REGISTER","CHANNEL-UPDATE","TARGET-UPDATE","TEXT-UPDATE","JOIN","LEAVE","CREATE","KICK","PULL","PERMISSIONS","MESSAGE","USERS","CHANNELS","USER-INFO","FAILURE","MALFORMED-UPDATE","CONNECTION-UNSTABLE","TOO-MANY-CONNECTIONS","UPDATE-FAILURE","INVALID-UPDATE","USERNAME-MISMATCH","INCOMPATIBLE-VERSION","INVALID-PASSWORD","NO-SUCH-PROFILE","USERNAME-TAKEN","NO-SUCH-CHANNEL","ALREADY-IN-CHANNEL","NOT-IN-CHANNEL","CHANNELNAME-TAKEN","BAD-NAME","INSUFFICIENT-PERMISSIONS","INVALID-PERMISSIONS","NO-SUCH-USER","TOO-MANY-UPDATES","NIL","T"]){
    cl.intern(name, "LICHAT-PROTOCOL");
}
for(var name of ["ID","CLOCK","FROM","PASSWORD","VERSION","CHANNEL","TARGET","TEXT","PERMISSIONS","USERS","CHANNELS","REGISTERED","CONNECTIONS","UPDATE-ID","COMPATIBLE-VERSIONS"]){
    cl.intern(name, "KEYWORD");
}

var WireObject = function(type){
    var self = this;

    self.type = type.toString();

    self.set = function(key, val){
        if(key instanceof Symbol){
            self[key.name.toLowerCase()] = val;
        }else{
            self[key.toString()] = val;
        }
        return val;
    }

    self.get = function(key){
        if(key instanceof Symbol){
            return self[key.name.toLowerCase()];
        }else{
            return self[key.toString()];
        }
    }

    return self;
};

var Update = function(type){
    var self = this;
    WireObject.call(self, type);

    self.clock = cl.getUniversalTime();
    self.id = nextID();
    
    return self;
};
Update.prototype = Object.create(WireObject.prototype);
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
var LichatReader = function(){
    var self = this;

    self.whitespace = "\u0009\u000A\u000B\u000C\u000D\u0020\u0085\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\u180E\u200B\u200C\u200D\u2060\uFEFF"
    self.invalidSymbol = cl.makeSymbol("INVALID-SYMBOL");

    self.isWhitespace = function(character){
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
        if(pkg === null){
            return cl.makeSymbol(name);
        }
        return cl.findSymbol(name, pkg) || self.invalidSymbol;
    };

    self.readSexprList = function(stream){
        var array = [];
        self.skipWhitespace(stream);
        while(stream.peekChar() !== ")"){
            array.push(self.readSexpr(stream));
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

    self.readSexprToken = function(stream){
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
            return self.safeFindSymbol(token, "LICHAT-PROTOCOL");
        }
    };

    self.readSexpr = function(stream){
        self.skipWhitespace(stream);
        // FIXME: Catch symbol errors
        switch(stream.readChar()){
        case "(": return self.readSexprList(stream);
        case ")": throw "Incomplete token";
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
            if(!(type instanceof Symbol)){
                throw "Wire object is malformed. First item in list is not a symbol: "+sexpr;
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
            if(object.id === undefined){
                throw "Missing ID on object. "+object;
            }
            if(object.clock === undefined){
                throw "Missing CLOCK on object. "+object;
            }
            return object;
            
        }else{
            return sexpr;
        }
    };

    return self;
};
var LichatVersion = "1.0";
var LichatDefaultPort = 1113;

var LichatClient = function(options){
    var self = this;
    if(!options.username) throw "Username cannot be empty";
    if(!options.password) options.password = null;
    if(!options.hostname) options.hostname = "ws://localhost";
    if(!options.port) options.port = LichatDefaultPort;

    for(var key in options){
        self[key] = options[key];
    }
    
    self.socket = null;
    self.handlers = {};
    
    var reader = new LichatReader();
    var printer = new LichatPrinter();
    var status = "STARTING";

    self.openConnection = function(){
        self.socket = new WebSocket(self.hostname, "lichat");
        self.socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password,
                               version: LichatVersion});
        };
        self.socket.onmessage = self.handleConnection;
        self.socket.onclose = self.closeConnection;
    };

    self.closeConnection = function(){
        if(!socket) throw "The client is not connected.";
        status = "STOPPING";
        if(self.socket.readyState < 2){
            self.socket.close();
        }
        self.socket = null;
    };

    self.send = function(wireable){
        if(!self.socket) throw "The client is not connected.";
        var stream = new LichatStream();
        printer.toWire(wireable, stream);
        self.socket.send(stream.string);
    };

    self.s = function(type, args){
        var update = new Update(type);
        for(var key in args){
            update[key] = args[key];
        }
        if(!update.from) update.from = self.username;
        self.send(update);
    };

    self.handleConnection = function(event){
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            switch(status){
            case "STARTING":
                if(!(update instanceof Update))
                    throw "Error during connection: non-Update message: "+update;
                if(update.type !== "CONNECT")
                    throw "Error during connection: non-CONNECT update: "+update;
                status = "RUNNING";
                break;
            case "RUNNING":
                self.process(update);
                break;
            }
        }catch(e){
            console.log(e);
        }
    };

    self.process = function(update){
        var handler = self.handlers[update.type];
        if(handler){
            handler(self, update);
        }else{
            console.log(update);
        }
    };

    self.addHandler = function(update, handler){
        self.handlers[update] = handler;
    }

    self.removeHandler = function(update){
        self.handlers[update] = null;
    }
};
