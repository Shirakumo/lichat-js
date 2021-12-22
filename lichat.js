// Special objects
var Restart = function(name, args){
    var self = this;
    self.name = name;
    self.args = (args===undefined)?[]:args;
    return self;
};

var Symbol = function(name, pkg){
    var self = this;
    if(!name) throw "Cannot create symbol with empty name.";
    self.name = name;
    self.pkg = pkg || null;
    self.toString = ()=>{
        return self.name;
    };
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
    var classes = {};

    self.computeClassPrecedenceList = (c)=>{
        var nodes = {};
        var edges = {};
        var sorted = [];
        var map;
        map = (c)=>{
            nodes[c.className] = "unvisited";
            var prev = c;
            for(var s of c.directSuperclasses){
                if(!edges[prev.className])edges[prev.className]=[];
                cl.pushnew(s.className, edges[prev.className]);
                map(s);
                prev = s;
            }
        };
        map(c);
        // Tarjan
        var visit;
        visit = (name)=>{
            if(nodes[name] === "temporary")
                cl.error("DEPENDENCY-CYCLE",{node: name});
            nodes[name] = "temporary";
            for(target of (edges[name]||[])){
                visit(target);
            }
            delete nodes[name];
            if(cl.findClass(name))
                cl.pushnew(cl.findClass(name), sorted);
        };
        for(;;){
            var name = Object.keys(nodes)[0];
            if(name === undefined)
                break;
            visit(name);
        }
        return sorted;
    };

    self.defclass = (name, directSuperclasses, initforms, constructor)=>{
        if(directSuperclasses.length === 0)
            directSuperclasses = ["StandardObject"];
        if(initforms === undefined) initforms = {};
        if(constructor === undefined) constructor=()=>{};
        directSuperclasses = directSuperclasses.map(self.findClass);
        if(typeof name == 'string'){
            self.intern(name, "LICHAT-PROTOCOL");
        }
        for(initarg in initforms){
            self.intern(initarg.toUpperCase(), "KEYWORD");
        }

        var c = function(initargs){
            var iself = this;
            StandardObject.call(iself, initargs);
            for(var key in initforms){
                var val = initforms[key];
                iself.set(key, (val instanceof Function)?val(iself):val);
            }
            for(var superclass of directSuperclasses){
                superclass.call(iself, initargs);
            }
            constructor(iself);
            return iself;
        };
        c.prototype = Object.create(directSuperclasses[0].prototype);
        c.prototype.className = name;
        c.className = name;
        c.directSuperclasses = directSuperclasses;
        c.superclasses = self.computeClassPrecedenceList(c);

        classes[name] = c;        
        return name;
    };

    self.makeInstance = (name, ...args)=>{
        return Reflect.construct(self.findClass(name, true), args);
    };

    self.findClass = (name, error)=>{
        if(classes[name])
            return classes[name];
        if(error)
            cl.error("NO-SUCH-CLASS",{name: name});
        return null;
    };

    self.classOf = (instance)=>{
        return self.findClass(instance.className);
    };

    self.setClass = (name, c)=>{
        if(c)
            classes[name] = c;
        else
            delete classes[name];
    };

    self.requiredArg = (name)=>{
        return (e)=>{
            if(e[name] === undefined)
                cl.error("MISSING-INITARG",{object:e, initarg:name, text: "The initarg "+name+" is missing."});
            else
                return e[name];
            return null;
        };
    };

    self.typep = (instance, type)=>{
        if(type === true){
            return true;
        }else if(type === null){
            if(instance === null){
                return true;
            }
        }else if(type === "Boolean"){
            if(instance === true || instance === false){
                return true;
            }
        }else if(instance instanceof StandardObject){
            if(instance.type === type
               || instance.isInstanceOf(type)){
                return true;
            }
        }else if(window[type]){
            if(window[type].prototype.isPrototypeOf(instance)
               || instance.constructor === window[type].prototype.constructor){
                return true;
            }
        }
        return false;
    };
    
    self.intern = (name, pkg)=>{
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

    self.findSymbol = (name, pkg)=>{
        var pkgspace = symbols[pkg || "LICHAT-JS"];
        if(pkgspace === undefined) return null;
        var symbol = pkgspace[name];
        if(symbol === undefined) return null;
        return symbol;
    };

    self.kw = (name)=>{
        return self.intern(name, "KEYWORD");
    };

    self.makeSymbol = (name)=>{
        return new Symbol(name);
    };

    self.argTypecase = (object, args, ...cases)=>{
        for(var i=0; i<cases.length; i+=2){
            var type = cases[i];
            var func = cases[i+1];
            if(self.typep(object, type)){
                return func.apply(func, args);
            }
        }
        return null;
    };

    self.typecase = (object, ...cases)=>{
        self.push([], cases);
        self.push(object, cases);
        return self.argTypecase.apply(self, cases);
    };

    self.universalUnixOffset = 2208988800;

    self.getUniversalTime = ()=>{
        return Math.round(Date.now()/1000)+self.universalUnixOffset;
    };

    self.universalToUnix = (universal)=>{
        return universal-self.universalUnixOffset;
    };

    self.push = (el, arr)=>{
        arr.unshift(el);
        return arr;
    };

    self.pushnew = (el, arr)=>{
        if(arr.indexOf(el) < 0){
            self.push(el, arr);
        }
        return arr;
    };

    self.find = (el, arr, key, test)=>{
        test = test || ((a,b)=>{return a===b;});
        key = key || ((a)=>a);
        for(var item of arr){
            if(test(el, key(item)))
                return item;
        }
        return null;
    };

    self.sxhash = (object)=>{
        var str = object.toString();
        var hash = 0;
        for(var i=0; i<str.length; i++){
            hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
        }
        return hash;
    };

    self.error = (type, initargs)=>{
        initargs.stack = new Error().stack;
        var condition = new Condition(type, initargs);
        throw condition;
    };

    self.T = self.intern("T", "LICHAT-PROTOCOL");
    self.NIL = self.intern("NIL", "LICHAT-PROTOCOL");

    return self;
};

var cl = new CL();

// Inject Standard Object
var StandardObject = function(initargs){
    var self = this;
    
    self.type = self.className;

    for(var key in initargs){
        self.set(key, initargs[key]);
    }

    return self;
};
cl.setClass("StandardObject", StandardObject);
StandardObject.className = "StandardObject";
StandardObject.directSuperclasses = [];
StandardObject.superclasses = [];

StandardObject.prototype.isInstanceOf = function(superclass){
    var self = this;
    if(superclass === true)
        return true;
    if((typeof superclass) === "string")
        superclass = cl.findClass(superclass);
    return cl.find(superclass, cl.classOf(self).superclasses);
};

StandardObject.prototype.set = function(key, val){
    var self = this;
    var varname;
    if(self.fields === undefined) self.fields = [];
    if(key instanceof Symbol){
        varname = key.name.toLowerCase();
    }else{
        varname = key.toString();
    }
    self[varname] = val;
    cl.pushnew(varname, self.fields);
    return val;
};

// Special type argument to allow cheap pseudo-subclassing.
var Condition = function(type, initargs){
    var self = this;
    StandardObject.call(self, initargs);
    self.type = type;
    return self;
};
Condition.prototype = Object.create(StandardObject.prototype);
Condition.prototype.report = function(){
    var self = this;
    return "Condition of type ["+self.type+"]"+(self.text?": "+self.text:"");
};
var LichatStream = function(string){
    var self = this;
    self.string = string || "";
    var i = 0;

    self.readChar = (errorp)=>{
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            var character = self.string[i];
            i++;
            return character;
        }else if(errorp){
            cl.error("END-OF-STREAM");
        }
        return null;
    };

    self.unreadChar = ()=>{
        if(0 < i){
            i--;
        }else{
            cl.error("BEGINNING-OF-STREAM");
        }
    };

    self.peekChar = (errorp)=>{
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            return self.string[i];
        }else if(errorp){
            cl.error("END-OF-STREAM");
        }
        return null;
    };

    self.writeChar = (character)=>{
        self.string += character;
        return character;
    };

    self.writeString = (string)=>{
        self.string += string;
        return string;
    };

    self.toString = ()=>{
        return self.string;
    };
    
    return self;
};
var LichatVersion = "2.0";
var IDCounter = Math.floor(Math.random()*(+new Date()));
var nextID = ()=>{
    var ID = IDCounter;
    IDCounter++;
    return ID;
};

cl.defclass("WIRE-OBJECT", []);
cl.defclass("UPDATE", ["WIRE-OBJECT"], {
    clock: cl.getUniversalTime,
    id: nextID,
    from: null
});
cl.defclass("PING", ["UPDATE"]);
cl.defclass("PONG", ["UPDATE"]);
cl.defclass("CONNECT", ["UPDATE"], {
    password: null,
    version: LichatVersion,
    extensions: []
});
cl.defclass("DISCONNECT", ["UPDATE"]);
cl.defclass("REGISTER", ["UPDATE"], {
    password: cl.requiredArg("password")
});
cl.defclass("CHANNEL-UPDATE", ["UPDATE"], {
    channel: cl.requiredArg("channel"),
    bridge: null
});
cl.defclass("TARGET-UPDATE", ["UPDATE"], {
    target: cl.requiredArg("target")
});
cl.defclass("TEXT-UPDATE", ["UPDATE"], {
    text: cl.requiredArg("text")
});
cl.defclass("JOIN", ["CHANNEL-UPDATE"]);
cl.defclass("LEAVE", ["CHANNEL-UPDATE"]);
cl.defclass("CREATE", ["CHANNEL-UPDATE"], {
    channel: null
});
cl.defclass("KICK", ["CHANNEL-UPDATE", "TARGET-UPDATE"]);
cl.defclass("PULL", ["CHANNEL-UPDATE", "TARGET-UPDATE"]);
cl.defclass("PERMISSIONS", ["CHANNEL-UPDATE"], {
    permissions: []
});
cl.defclass("GRANT", ["CHANNEL-UPDATE", "TARGET-UPDATE"], {
    update: cl.requiredArg("update")
});
cl.defclass("DENY", ["CHANNEL-UPDATE", "TARGET-UPDATE"], {
    update: cl.requiredArg("update")
});
cl.defclass("CAPABILITIES", ["CHANNEL-UPDATE"], {
    permitted: []
});
cl.defclass("MESSAGE", ["CHANNEL-UPDATE", "TEXT-UPDATE"], {
    bridge: null,
    link: null,
    "reply-to": null
});
cl.defclass("EDIT", ["CHANNEL-UPDATE", "TEXT-UPDATE"]);
cl.defclass("USERS", ["CHANNEL-UPDATE"], {
    users: []
});
cl.defclass("CHANNELS", ["UPDATE"], {
    channels: []
});
cl.defclass("USER-INFO", ["TARGET-UPDATE"], {
    registered: false,
    connections: 1,
    info: []
});
cl.defclass("SERVER-INFO", ["TARGET-UPDATE"], {
    attributes: [],
    connections: []
});
cl.defclass("BACKFILL", ["CHANNEL-UPDATE"]);
cl.defclass("DATA", ["CHANNEL-UPDATE"], {
    "content-type": cl.requiredArg("content-type"),
    filename: null,
    payload: cl.requiredArg("payload")
});
cl.defclass("EMOTES", ["UPDATE"], {
    names: []
});
cl.defclass("EMOTE", ["UPDATE"], {
    "content-type": cl.requiredArg("content-type"),
    name: cl.requiredArg("name"),
    payload: cl.requiredArg("payload")
});
cl.defclass("CHANNEL-INFO", ["CHANNEL-UPDATE"], {
    keys: true
});
cl.defclass("SET-CHANNEL-INFO", ["CHANNEL-UPDATE", "TEXT-UPDATE"], {
    key: cl.requiredArg("key")
});
cl.defclass("SET-USER-INFO", ["TEXT-UPDATE"], {
    key: cl.requiredArg("key")
});
cl.defclass("PAUSE", ["CHANNEL-UPDATE"], {
    by: cl.requiredArg("by")
});
cl.defclass("QUIET", ["CHANNEL-UPDATE","TARGET-UPDATE"]);
cl.defclass("UNQUIET", ["CHANNEL-UPDATE","TARGET-UPDATE"]);
cl.defclass("KILL", ["TARGET-UPDATE"]);
cl.defclass("DESTROY", ["CHANNEL-UPDATE"]);
cl.defclass("BAN", ["TARGET-UPDATE"]);
cl.defclass("UNBAN", ["TARGET-UPDATE"]);
cl.defclass("IP-BAN", [], {
    ip: cl.requiredArg("ip"),
    mask: cl.requiredArg("mask")
});
cl.defclass("IP-UNBAN", [], {
    ip: cl.requiredArg("ip"),
    mask: cl.requiredArg("mask")
});
cl.defclass("BLOCK", ["TARGET-UPDATE"]);
cl.defclass("UNBLOCK", ["TARGET-UPDATE"]);
cl.defclass("REACT", ["CHANNEL-UPDATE"], {
    target: cl.requiredArg("target"),
    "update-id": cl.requiredArg("update-id"),
    emote: cl.requiredArg("emote")
});

cl.defclass("FAILURE", ["TEXT-UPDATE"]);
cl.defclass("MALFORMED-UPDATE", ["FAILURE"]);
cl.defclass("UPDATE-TOO-LONG", ["FAILURE"]);
cl.defclass("CONNECTION-UNSTABLE", ["FAILURE"]);
cl.defclass("TOO-MANY-CONNECTIONS", ["FAILURE"]);
cl.defclass("UPDATE-FAILURE", ["FAILURE"], {
    "update-id": cl.requiredArg("update-id")
});
cl.defclass("INVALID-UPDATE", ["UPDATE-FAILURE"]);
cl.defclass("USERNAME-MISMATCH", ["UPDATE-FAILURE"]);
cl.defclass("INCOMPATIBLE-VERSION", ["UPDATE-FAILURE"], {
    "compatible-versions": cl.requiredArg("compatible-versions")
});
cl.defclass("INVALID-PASSWORD", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-PROFILE", ["UPDATE-FAILURE"]);
cl.defclass("USERNAME-TAKEN", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-CHANNEL", ["UPDATE-FAILURE"]);
cl.defclass("ALREADY-IN-CHANNEL", ["UPDATE-FAILURE"]);
cl.defclass("NOT-IN-CHANNEL", ["UPDATE-FAILURE"]);
cl.defclass("CHANNELNAME-TAKEN", ["UPDATE-FAILURE"]);
cl.defclass("BAD-NAME", ["UPDATE-FAILURE"]);
cl.defclass("INSUFFICIENT-PERMISSIONS", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-USER", ["UPDATE-FAILURE"]);
cl.defclass("TOO-MANY-UPDATES", ["UPDATE-FAILURE"]);
cl.defclass("BAD-CONTENT-TYPE", ["UPDATE-FAILURE"], {
    "allowed-content-types": []
});
cl.defclass("NO-SUCH-CHANNEL-INFO", ["UPDATE-FAILURE"], {
    key: cl.requiredArg("key")
});
cl.defclass("MALFORMED-CHANNEL-INFO", ["UPDATE-FAILURE"]);
cl.defclass("NO-SUCH-USER-INFO", ["UPDATE-FAILURE"], {
    key: cl.requiredArg("key")
});
cl.defclass("MALFORMED-USER-INFO", ["UPDATE-FAILURE"]);
cl.defclass("CLOCK-SKEWED", ["UPDATE-FAILURE"]);
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
        };
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
        };
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

    self.printSexpr = (sexpr, stream)=>{
        cl.typecase(sexpr,
                    null,      ()=> self.printSexprToken("NIL", stream),
                    "String",  ()=> self.printSexprString(sexpr, stream),
                    "Array",   ()=> self.printSexprList(sexpr, stream),
                    "Number",  ()=> self.printSexprNumber(sexpr, stream),
                    "Symbol",  ()=> self.printSexprSymbol(sexpr, stream),
                    "Boolean", ()=> self.printSexprToken((sexpr)?"T":"NIL", stream),
                    true, ()=> cl.error("UNPRINTABLE-OBJECT",{object: sexpr}));
    };

    self.toWire = (wireable, stream)=>{
        if(cl.typep(wireable, "WIRE-OBJECT")){
            var list = [cl.findSymbol(wireable.type, "LICHAT-PROTOCOL")];
            for(var key of wireable.fields){
                list.push(cl.findSymbol(key.toUpperCase(), "KEYWORD"));
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
var LichatReader = function(){
    var self = this;

    self.whitespace = "\u0009\u000A\u000B\u000C\u000D\u0020\u0085\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\u180E\u200B\u200C\u200D\u2060\uFEFF";
    self.invalidSymbol = cl.makeSymbol("INVALID-SYMBOL");

    self.isWhitespace = (character)=>{
        return self.whitespace.indexOf(character) >= 0;
    };

    self.skipWhitespace = (stream)=>{
        while(self.isWhitespace(stream.readChar()));
        stream.unreadChar();
        return stream;
    };

    self.isProtocolSymbol = (name)=>{
        return self.protocolSymbols.indexOf(name) >= 0;
    };

    self.safeFindSymbol = (name, pkg)=>{
        if(pkg === null){
            return cl.makeSymbol(name);
        }
        return cl.intern(name, pkg);
    };

    self.readSexprList = (stream)=>{
        var array = [];
        self.skipWhitespace(stream);
        while(stream.peekChar() !== ")"){
            array.push(self.readSexpr(stream));
            self.skipWhitespace(stream);
        }
        stream.readChar();
        return array;
    };

    self.readSexprString = (stream)=>{
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

    self.readSexprKeyword = (stream)=>{
        return cl.intern(self.readSexprToken(stream), "KEYWORD");
    };

    self.readSexprNumber = (stream)=>{
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

    self.readSexprToken = (stream)=>{
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

    self.readSexprSymbol = (stream)=>{
        var token = self.readSexprToken(stream);
        if(stream.peekChar(false) === ":"){
            stream.readChar();
            if(token === "#"){
                return self.safeFindSymbol(self.readSexprToken(stream), null);
            }else{
                return self.safeFindSymbol(self.readSexprToken(stream), token);
            }
        }else{
            var symbol = self.safeFindSymbol(token, "LICHAT-PROTOCOL");
            if(symbol == cl.NIL) return null;
            if(symbol == cl.T) return true;
            return symbol;
        }
    };

    self.readSexpr = (stream)=>{
        self.skipWhitespace(stream);
        // FIXME: Catch symbol errors
        switch(stream.readChar()){
        case "(": return self.readSexprList(stream);
        case ")": cl.error("INCOMPLETE-TOKEN");
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

    self.fromWire = (stream)=>{
        var sexpr = self.readSexpr(stream);
        if(sexpr instanceof Array){
            var type = sexpr.shift();
            if(!(type instanceof Symbol))
                cl.error("MALFORMED-WIRE-OBJECT",{text: "First item in list is not a symbol.", sexpr: sexpr});
            
            var initargs = {};
            for(var i=0; i<sexpr.length; i+=2){
                var key = sexpr[i];
                var val = sexpr[i+1];
                if(! key instanceof Symbol || key.pkg !== "KEYWORD"){
                    cl.error("MALFORMED-WIRE-OBJECT",{text: "Key is not of type Keyword.", key: key});
                }
                initargs[key.name.toLowerCase()] = val;
            }
            if(initargs.id === undefined)
                cl.error("MISSING-ID", {sexpr: sexpr});
            if(initargs.clock === undefined)
                cl.error("MISSING-CLOCK", {sexpr: sexpr});
            return cl.makeInstance(type, initargs);
        }else{
            return sexpr;
        }
    };

    return self;
};

LichatReader.fromString = (string)=>{
    return new LichatReader().fromWire(new LichatStream(string));
};
var LichatDefaultPort = 1113;
var LichatDefaultSSLPort = 1114;
var EmptyIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

class LichatReaction{
    constructor(update, channel){
        this.text = update.emote;
        if(!allEmojiStrings.includes(update.emote)){
            let emote = channel.getEmote(update.emote);
            if(!emote) throw "Invalid emote.";
            this.image = emote;
        }
        this.users = [update.from];
    }

    get count(){
        return this.users.length;
    }

    get description(){
        return this.users.join(',')+" reacted with "+this.text;
    }
}

class LichatMessage{
    constructor(update, channel, options){
        options = options || {};
        this.id = update.id;
        this.from = update.from;
        this.author = channel.getUser(update.bridge || update.from);
        this.channel = channel;
        this.reactions = [];
        this.text = update.text || "";
        this.html = (options.html)? this.text: this.markupText(this.text);
        this.isSystem = options.system;
        this.gid = this.channel.name+"/"+update.id+"@"+this.author.name.toLowerCase();
        this.url = document.location.href.match(/(^[^#]*)/)[0]+"#"+this.gid;
        this.timestamp = cl.universalToUnix(update.clock);
        this.clock = new Date(this.timestamp*1000);
        this.type = update.type.toLowerCase();
        this.contentType = update.link || "text/plain";
        if(update["reply-to"])
            this.replyTo = channel.getMessage(update["reply-to"][0], update["reply-to"][1]);
        else
            this.replyTo = null;
    }

    get time(){
        let pad = (x)=>(x<10?"0":"")+x;
        return pad(this.clock.getHours())+":"+pad(this.clock.getMinutes());
    }

    get date(){
        return this.clock.toLocaleDateString()+
            ", "+this.clock.toLocaleTimeString();
    }

    get isImage(){ return this.contentType.includes("image"); }

    get isVideo(){ return this.contentType.includes("video"); }

    get isAudio(){ return this.contentType.includes("audio"); }

    get isAlert(){
        // FIXME: todo
        return false;
    }

    get isVirtual(){
        return this.id === undefined;
    }

    get isBridged(){
        return this.author.name == this.from;
    }

    get shortText(){
        return this.text.split("\n")[0];
    }

    get text(){
        return this._text;
    }

    set text(text){
        this._text = text;
        this.html = this.markupText(text);
    }

    addReaction(update){
        let reaction = this.reactions.find(e => e.text == update.emote);
        if(!reaction){
            this.reactions.push(new LichatReaction(update, this.channel));
        }else if(reaction.users.includes(update.from)){
            reaction.users = reaction.users.filter(item => item !== update.from);
            if(reaction.users.length == 0)
                this.reactions = this.reactions.filter(item => item !== reaction);
        }else{
            reaction.users.push(update.from);
        }
        return reaction;
    }

    markupText(text){
        return text;
    }
}

class LichatUser{
    constructor(name, client){
        this._name = name;
        this._client = client;
        this.info = {};
    }

    get name(){
        return this._name;
    }

    get icon(){
        let icon = this.info[":ICON"];
        if(!icon) return EmptyIcon;
        let data = icon.split(" ");
        return "data:"+data[0]+";base64,"+data[1];
    }

    get client(){
        return this._client;
    }

    get isPresent(){
        return this.isInChannel(this._client.servername);
    }

    get isSelf(){
        return this._client.username.localeCompare(this._name, undefined, { sensitivity: 'accent' }) === 0;
    }

    get isBlocked(){
        // FIXME: implement
        return false;
    }

    get isBanned(){
        // FIXME: implement
        return false;
    }

    get isAway(){
        // FIXME: implement
        return false;
    }

    get color(){
        var hash = cl.sxhash(this._name);
        var encoded = hash % 0xFFF;
        var r = 16*(1+(encoded&0xF00)>>8)-1;
        var g = 16*(1+(encoded&0x0F0)>>4)-1;
        var b = 16*(1+(encoded&0x00F)>>0)-1;
        
        return "rgb("+Math.min(200, Math.max(50, r))+
            ","+Math.min(180, Math.max(80, g))+
            ","+Math.min(180, Math.max(80, b))+")";
    }

    isQuieted(channel){
        // FIXME: implement
        return false;
    }

    isInChannel(channel){
        if(typeof(channel) === "string") channel = this._client.getChannel(channel);
        return channel.hasUser(this);
    }
}

class LichatChannel{
    constructor(name, client){
        this._name = name;
        this._client = client;
        this.wasJoined = false;
        this.users = {};
        this.emotes = {};
        this.info = {};
        this.messages = {};
        // KLUDGE: need this to stop Vue from being Weird As Fuck.
        Object.defineProperty(this.emotes, 'nested', { configurable: false });
        Object.defineProperty(this.messages, 'nested', { configurable: false });
        this.messageList = [];
        this.currentMessage = {text: "", replyTo: null};
        this.currentMessage.clear = ()=>{
            this.currentMessage.text = "";
            this.currentMessage.replyTo = null;
        };
        this.info[":NEWS"] = "";
        this.info[":TOPIC"] = "";
        this.info[":RULES"] = "";
        this.info[":CONTACT"] = "";
        // KLUDGE: spillage from ui
        this.unread = 0;
        this.alerted = false;
        this.lastRead = null;
        this.notificationLevel = 'inherit';
    }

    get name(){
        return this._name;
    }

    get client(){
        return this._client;
    }

    get isPresent(){
        return this.users[this._client.username.toLowerCase()] !== undefined;
    }

    get isPrimary(){
        return this._name == this._client.servername;
    }

    get isAnonymous(){
        // FIXME: this is broken
        return false;
    }

    get parentChannel(){
        // FIXME: handle channel trees
        return this._client.primaryChannel;
    }

    get icon(){
        let icon = this.info[":ICON"];
        if(!icon) return EmptyIcon;
        let data = icon.split(" ");
        return "data:"+data[0]+";base64,"+data[1];
    }

    get topic(){
        return this.info[":TOPIC"];
    }

    getEmote(name){
        let own = this.emotes[name.toLowerCase().replace(/^:|:$/g,"")];
        if(own) return own;
        if(!this.isPrimary) return this.parentChannel.getEmote(name);
        return null;
    }

    getEmoteList(list){
        let emotes = list || [];
        for(let emote in this.emotes) emotes.push(emote);
        if(!this.isPrimary){
            this.parentChannel.getEmoteList(emotes);
        }
        return emotes.sort();
    }

    joinUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.name === this._client.username) this.wasJoined = true;
        this.users[user.name.toLowerCase()] = user;
        return user;
    }

    leaveUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.name === this._client.username) this.wasJoined = false;
        delete this.users[user.name.toLowerCase()];
        return user;
    }

    hasUser(user){
        if(user instanceof LichatUser) user = thing.name;
        return this.users[user.toLowerCase()] !== undefined;
    }

    getUser(name){
        return this._client.getUser(name.toLowerCase());
    }

    clearUsers(){
        this.users = {};
    }

    s(type, args, noPromise){
        args = args || {};
        args.channel = this.name;
        return this._client.s(type, args, noPromise);
    }

    record(ev){
        let message = new LichatMessage(ev, this);
        let existing = this.messages[message.gid];
        this.messages[message.gid] = message;
        if(existing){
            // Update object in-place
            for(let i in this.messageList){
                if(this.messageList[i].gid == message.gid){
                    // FIXME: Vue cannot detect this change.
                    this.messageList[i] = message;
                    break;
                }
            }
        }else if(this.messageList.length == 0 || this.messageList[this.messageList.length-1].timestamp <= message.timestamp){
            this.messageList.push(message);
        }else{
            // Perform binary search insert according to clock
            let start = 0;
            let end = this.messageList.length-1;
            let stamp = message.timestamp;
            while(start<=end){
                let mid = Math.floor((start + end)/2);
                let cmp = this.messageList[mid].timestamp;
                if(stamp <= cmp &&
                   (mid == 0 || this.messageList[mid-1].timestamp <= stamp)){
                    this.messageList.splice(start, 0, message);
                    break;
                }
                if(cmp < stamp) start = mid + 1;
                else            end = mid - 1;
            }
        }
        return [message, existing?false:true];
    }

    getMessage(from, id){
        let gid = this.name+"/"+id+"@"+from.toLowerCase();
        return this.messages[gid];
    }

    deleteMessage(message){
        delete this.messages[message.gid];
        let index = this.messageList.indexOf(message);
        if(index !== -1) this.messageList.splice(index, 1);
    }

    showStatus(text, options){
        options = options || {};
        options.system = true;
        let message = new LichatMessage({
            id: nextID(),
            from: "System",
            clock: cl.getUniversalTime(),
            text: text,
            type: "MESSAGE"
        }, this, options);
        this.messageList.push(message);
        return message;
    }

    encode(){
        return {
            name: this.name,
            emotes: {...this.emotes},
            joined: this.wasJoined,
            notificationLevel: this.notificationLevel,
        };
    }

    decode(data){
        this.emotes = data.emotes;
        this.wasJoined = data.joined;
        this.notificationLevel = data.notificationLevel;
    }
}

class LichatClient{
    constructor(options){
        options = options || {};
        this.name = options.name || "Lichat";
        this.username = options.username || "";
        this.password = options.password || null;
        this.hostname = options.hostname || "localhost";
        this.port = options.port || options.ssl? LichatDefaultSSLPort: LichatDefaultPort;
        this.ssl = options.ssl;
        this.disconnectHandler = ()=>{};
        this.servername = null;
        this.pingDelay = 15000;
        this.channels = {};
        this.users = {};

        this.supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes",
                                    "shirakumo-channel-info", "shirakumo-quiet", "shirakumo-pause",
                                    "shirakumo-server-management", "shirakumo-ip", "shirakumo-user-info",
                                    "shirakumo-icon", "shirakumo-bridge", "shirakumo-block",
                                    "shirakumo-reactions", "shirakumo-link"];
        this.availableExtensions = [];
        this._socket = null;
        this._handlers = {};
        this._internalHandlers = {};
        this._idCallbacks = {};
        this._reader = new LichatReader();
        this._printer = new LichatPrinter();
        this._pingTimer = null;
        this._reconnectAttempts = 0;

        for(let data of options.channels || []){
            this.getChannel(data.name).decode(data);
        }

        this.addInternalHandler("CONNECT", (ev)=>{
            this.availableExtensions = ev.extensions;
        });

        this.addInternalHandler("PING", (ev)=>{
            this.s("PONG", {}, true);
        });

        this.addInternalHandler("PONG", (ev)=>{
        });

        this.addInternalHandler("JOIN", (ev)=>{
            if(!this.servername){
                this.servername = ev.channel;

                for(let name in this.channels){
                    let channel = this.channels[name];
                    if(channel.wasJoined && channel.name != this.servername)
                        channel.s("JOIN", {}, true);
                }
            }
            let channel = this.getChannel(ev.channel);
            channel.joinUser(ev.from);
            if(ev.from === this.username){
                if(this.isAvailable("shirakumo-backfill") && !channel.isPrimary)
                    this.s("BACKFILL", {channel: ev.channel}, true);
                if(this.isAvailable("shirakumo-channel-info"))
                    this.s("CHANNEL-INFO", {channel: ev.channel}, true);
                if(this.isAvailable("shirakumo-emotes"))
                    this.s("EMOTES", {channel: ev.channel, names: channel.getEmoteList()}, true);
            }
        });

        this.addInternalHandler("LEAVE", (ev)=>{
            let channel = this.getChannel(ev.channel);
            channel.leaveUser(ev.from);
        });

        this.addInternalHandler("EMOTE", (ev)=>{
            this.addEmote(ev);
        });

        this.addInternalHandler("SET-CHANNEL-INFO", (ev)=>{
            this.getChannel(ev.channel).info[LichatPrinter.toString(ev.key)] = ev.text;
        });

        this.addHandler("MESSAGE", (ev)=>{
            this.getChannel(ev.channel).record(ev);
        });

        this.addHandler("EDIT", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.from, ev.id);
            if(message) message.text = ev.text;
            else console.warn("Received react with no message", ev.target, ev["update-id"]);
        });

        this.addHandler("REACT", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.target, ev["update-id"]);
            if(message) message.addReaction(ev);
            else console.warn("Received react with no message", ev.target, ev["update-id"]);
        });
    }

    reconnect(){
        try{
            this.openConnection();
        }catch(e){
            this.scheduleReconnect();
        }
    }

    scheduleReconnect(){
        this._reconnectAttempts++;
        let secs = Math.pow(2, this._reconnectAttempts);
        setTimeout(()=>this.reconnect(), secs*1000);
    }

    openConnection(){
        return new Promise((ok, fail) => {
            this._socket = new WebSocket((this.ssl?"wss://":"ws://")+this.hostname+":"+this.port, "lichat");
            this._socket.onopen = ()=>{
                this.s("CONNECT", {
                    password: this.password || null,
                    version: LichatVersion,
                    extensions: this.supportedExtensions
                }, true);
            };
            this._socket.onmessage = (e)=>{
                let update = this._reader.fromWire(new LichatStream(e.data));
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        fail({text: "non-Update message", update: update});
                    else if(update.type !== "CONNECT")
                        fail({text: update.text, update: update});
                    else{
                    }
                }catch(err){
                    this.closeConnection();
                }
                if(!this.username)
                    this.username = update.from;
                if(0 < this._reconnectAttempts)
                    this._reconnectAttempts = 0;
                
                this._socket.onmessage = ev => this.handleMessage(ev);
                this._socket.onclose = ev => this.handleClose(ev);
                this.process(update);
                ok(this);
            };
            this._socket.onclose = (e)=>{
                fail(this, e);
            };
        });
    }

    closeConnection(){
        for(let channel in this.channels)
            this.channels[channel].clearUsers();
        if(this._socket && this._socket.readyState < 2){
            this._socket.onclose = ()=>{};
            this._socket.close();
        }
        this._idCallbacks = {};
        this._socket = null;
        return this;
    }

    get isConnected(){
        return this._socket && this._reconnectAttempts == 0;
    }

    send(wireable){
        if(!this._socket || this._socket.readyState != 1)
            cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        let stream = new LichatStream();
        this._printer.toWire(wireable, stream);
        this._socket.send(stream.string+'\u0000');

        if(!cl.typep(wireable, "PING") && !cl.typep(wireable, "PONG"))
            console.debug("Send", wireable);
        return wireable;
    }

    s(type, args, noPromise){
        args = args || {};
        if(!args.from) args.from = this.username;
        let update = cl.makeInstance(type, args);
        if(noPromise) return this.send(update);
        return new Promise((ok, fail)=>{
            this.addCallback(update.id, (u) => {
                if(cl.typep(u, "FAILURE")) fail(u);
                else                       ok(u);
            }, fail);
            this.send(update);
        });
    }

    startDelayPing(){
        if(this._pingTimer) clearTimeout(this._pingTimer);
        this._pingTimer = setTimeout(()=>{
            if(this._socket.readyState == 1){
                this.s("PING", {}, true);
                this.startDelayPing();
            }
        }, this.pingDelay);
        return this._pingTimer;
    }

    handleMessage(event){
        try{
            let update = this._reader.fromWire(new LichatStream(event.data));
            this.startDelayPing();
            this.process(update);
        }catch(e){
            console.error("Error during message handling", e);
        }
        return this;
    }

    handleClose(event){
        this._idCallbacks = {};
        if(event.code !== 1000){
            this.disconnectHandler(event);
            this.scheduleReconnect();
        }else{
            this.closeConnection();
        }
    }

    processCallbacks(id, update){
        let callbacks = this._idCallbacks[id];
        if(callbacks){
            for(let callback of callbacks){
                try{
                    callback.call(this, update);
                }catch(e){
                    console.error("Callback error", e);
                }
            }
            this.removeCallback(id);
        }
    }

    process(update){
        if(!cl.typep(update, "PING") && !cl.typep(update, "PONG"))
            console.debug("Update",update);
        if(cl.typep(update, "UPDATE-FAILURE"))
            this.processCallbacks(update["update-id"], update);
        else
            this.processCallbacks(update.id, update);
        if(!this.maybeCallInternalHandler(update.type, update)){
            for(let s of cl.classOf(update).superclasses){
                if(this.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!this.maybeCallHandler(update.type, update)){
            for(let s of cl.classOf(update).superclasses){
                if(this.maybeCallHandler(s.className, update))
                    break;
            }
        }
        return this;
    }

    maybeCallInternalHandler(type, update){
        if(this._internalHandlers[type]){
            this._internalHandlers[type](update);
            return true;
        }
        return false;
    }

    addInternalHandler(update, handler){
        this._internalHandlers[update] = handler;
        return this;
    }

    removeInternalHandler(update){
        delete this._internalHandlers[update];
        return this;
    }

    maybeCallHandler(type, update){
        if(this._handlers[type]){
            this._handlers[type](update);
            return true;
        }
        return false;
    }

    addHandler(update, handler){
        this._handlers[update] = handler;
        return this;
    }

    removeHandler(update){
        delete this._handlers[update];
        return this;
    }

    addCallback(id, handler){
        // FIXME: Add timeout mechanism
        if(!this._idCallbacks[id]){
            this._idCallbacks[id] = [handler];
        }else{
            this._idCallbacks[id].push(handler);
        }
        return this;
    }

    removeCallback(id, handler){
        if(handler && this._idCallbacks[id])
            this._idCallbacks[id] = this._idCallbacks[id].filter(item => item !== handler);
        else
            delete this._idCallbacks[id];
        return this;
    }

    get icon(){
        if(this.servername) return this.primaryChannel.icon;
        else return EmptyIcon;
    }

    get primaryChannel(){
        if(this.servername)
            return this.getChannel(this.servername);
        else
            return null;
    }

    getChannel(name){
        let channel = this.channels[name.toLowerCase()];
        if(channel === undefined){
            channel = new LichatChannel(name, this);
            this.channels[name.toLowerCase()] = channel;
        }
        return channel;
    }

    deleteChannel(name){
        let channel = this.channels[name.toLowerCase()];
        delete this.channels[name.toLowerCase()];
        return channel;
    }

    hasChannel(name){
        return name.toLowerCase() in this.channels;
    }

    get user(){
        if(this.username)
            return this.getUser(this.username);
        else
            return null;
    }

    getUser(name){
        let user = this.users[name.toLowerCase()];
        if(user === undefined){
            user = new LichatUser(name, this);
            this.users[name.toLowerCase()] = user;
        }
        return user;
    }

    addEmote(update){
        let name = update.name.toLowerCase().replace(/^:|:$/g,"");
        let channel = update.channel || this.servername;

        if(update.payload){
            let emote = "data:"+update["content-type"]+";base64,"+update.payload;
            this.getChannel(channel).emotes[name] = emote;
            return emote;
        }else{
            delete this.getChannel(channel).emotes[name];
            return null;
        }
    }

    isAvailable(name){
        return cl.find(name, this.availableExtensions);
    }
}
class LichatUI{
    constructor(el){
        let lichat = this;
        this.commands = {};
        this.clients = [];
        this.currentChannel = null;
        this.search = null;
        this.showEmotePicker = false;
        this.showChannelMenu = false;
        this.showClientMenu = false;
        this.showSelfMenu = false;
        this.showSettings = false;
        this.errorMessage = null;
        this.db = null;
        this.defaultClient = {
            name: "TyNET",
            hostname: "chat.tymoon.eu",
            ssl: true,
            port: LichatDefaultSSLPort
        };

        this.options = {
            transmitTyping: true,
            showNotifications: true,
            playSound: false,
            notificationLevel: 'mention',
            font: 'sans-serif',
            fontSize: '14pt',
            sidebarWidth: '15em',
        };

        let DBOpenRequest = window.indexedDB.open("lichatjs", 4);
        DBOpenRequest.onerror = e=>{
            console.error(e);
            this.initialSetup();
        };
        DBOpenRequest.onsuccess = e=>{
            this.db = e.target.result;
            // FIXME: this does not work as expected.
            //document.addEventListener('beforeunload', this.saveSetup());
            this.loadSetup();
        };
        DBOpenRequest.onupgradeneeded = e=>{
            this.db = e.target.result;
            this.setupDatabase();
        };

        let supersede = (object, field, newfun)=>{
            let original = object.prototype[field];
            object.prototype[field] = function(...args){
                let self = this;
                args.unshift((...args)=>original.apply(self, args));
                newfun.apply(this, args);
            };
        };

        supersede(LichatChannel, 'record', function(nextMethod, update){
            const [message, inserted] = nextMethod(update);
            let notify = inserted && !this.isPrimary;
            if(lichat.currentChannel == message.channel){
                let output = lichat.app.$refs.output;
                if(!output)
                    notify = false;
                else if(output.scrollTop === (output.scrollHeight - output.offsetHeight)){
                    if(!document.hidden) notify = false;
                    Vue.nextTick(() => {
                        document.getElementById(message.gid).scrollIntoView();
                    });
                }
            }
            if(notify) this.notify(message);
        });

        LichatChannel.prototype.notify = function(message){
            this.unread++;
            let notify = false;
            let level = this.notificationLevel;
            if(level == 'inherit')
                level = lichat.options.notificationLevel;
            if(level == 'all')
                notify = true;
            if(message.html.includes("<mark>")){
                if(!this.alerted) this.alerted = true;
                if(level == 'mentions')
                    notify = true;
            }
            if(notify && lichat.options.showNotifications && Notification.permission === "granted"){
                let notification = new Notification(message.from+" in "+this.name, {
                    body: (message.isImage)? undefined: message.text,
                    image: (message.isImage)? message.text: undefined,
                    tag: this.name,
                    actions: [{
                        action: "close",
                        title: "Dismiss"
                    }]
                });
                notification.addEventListener('notificationclick', (ev)=>{
                    event.notification.close();
                    if(event.action != 'close'){
                        message.highlight();
                    }
                });
            }
            if(notify && lichat.options.playSound){
                LichatUI.sound.play();
            }
            lichat.updateTitle();
        };

        document.addEventListener("visibilitychange", ()=>{
            if(!document.hidden){
                this.currentChannel.unread = 0;
                this.currentChannel.alerted = false;
                this.updateTitle();
            }
        });

        LichatMessage.prototype.markupText = function(text){
            return LichatUI.formatUserText(text, this.channel);
        };

        LichatMessage.prototype.highlight = function(){
            lichat.currentChannel = this.channel;
            Vue.nextTick(() => {
                let element = document.getElementById(this.gid);
                element.classList.add('highlight');
                element.scrollIntoView();
            });
        };

        LichatClient.prototype.addToChannelList = function(channel){
            if(this.channelList.length == 0){
                this.channelList.push(channel);
            }else if(!this.channelList.find(element => element === channel)){
                let i=1;
                for(; i<this.channelList.length; ++i){
                    if(0 < this.channelList[i].name.localeCompare(channel.name))
                        break;
                }
                this.channelList.splice(i, 0, channel);
            }
        };

        Vue.component("divider", {
            template: "<div class='divider'></div>",
            data: ()=>{return {
                target: null
            };},
            methods: {
                drag: function(ev){
                    ev.preventDefault();
                    let x = ev.clientX - this.$el.getBoundingClientRect().width;
                    lichat.options.sidebarWidth = x+"px";
                },
                stopDragging: function(ev){
                    ev.preventDefault();
                    document.removeEventListener('mousemove', this.drag);
                    document.removeEventListener('mouseup', this.stopDragging);
                }
            },
            mounted: function(){
                this.target = this.$el.previousElementSibling;
                this.$el.addEventListener('mousedown', (ev)=>{
                    document.addEventListener('mousemove', this.drag);
                    document.addEventListener('mouseup', this.stopDragging);
                });
            }
        });

        Vue.component("self-menu", {
            template: "#self-menu",
            props: {client: LichatClient},
            data: ()=>{
                return {
                    showInfo: false,
                    showIdentitySwitcher: false,
                    showStatus: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("user-menu", {
            template: "#user-menu",
            props: {user: LichatUser},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            },
            methods: {
                whisper: function(){
                    this.user.client.s("CREATE", {})
                        .then((e)=>this.user.client.s("PULL", {
                            target: this.user.name,
                            channel: e.channel
                        })).catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                block: function(){
                    this.user.client.s("BLOCK", {target: this.message.from})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been blocked."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                unblock: function(){
                    this.user.client.s("UNBLOCK", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unblocked."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                ban: function(){
                    this.user.client.s("BAN", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been banned."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                unban: function(){
                    this.user.client.s("UNBAN", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unbanned."))
                        .catch((e)=>this.user.client.showStatus("Error: "+e.text));
                    this.$emit('close');
                }
            }
        });

        Vue.component("channel-menu", {
            template: "#channel-menu",
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false,
                    showPause: false,
                    showChannelCreate: false,
                    showChannelList: false,
                    showUserList: false,
                    showPermissions: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("message-menu", {
            template: "#message-menu",
            props: {message: LichatMessage},
            data: ()=>{
                return {
                    showInfo: false
                };
            },
            methods: {
                copy: function(){
                    navigator.clipboard.writeText(this.message.text)
                        .then(()=>console.log('Copied message to clipboard'))
                        .catch((e)=>lichat.errorMessage = ""+e);
                    this.$emit('close');
                },
                kick: function(){
                    this.message.channel.s("KICK", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text));
                    this.$emit('close');
                },
                quiet: function(){
                    this.message.channel.s("QUIET", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text))
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."));
                    this.$emit('close');
                },
                unquiet: function(){
                    this.message.channel.s("UNQUIET", {target: this.message.from})
                        .catch((e)=>this.message.channel.showStatus("Error: "+e.text))
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."));
                    this.$emit('close');
                }
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("client-menu", {
            template: "#client-menu",
            props: {client: LichatClient},
            data: ()=>{
                return {
                    showConfigure: false,
                    showChannelCreate: false
                };
            },
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
            }
        });

        Vue.component("client-configure", {
            template: "#client-configure",
            props: {client: Object},
            data: ()=>{
                return {
                    errorMessage: null
                };
            },
            methods: {
                remove: function(){
                    lichat.removeClient(this.client);
                    this.close();
                },
                create: function(){
                    let client = new LichatClient(this.client);
                    lichat.addClient(client)
                        .then(()=>this.close())
                        .catch((e)=>{
                            lichat.removeClient(client);
                            this.errorMessage = e.reason || e.text || "Failed to connect";
                        });
                },
                close: function(){
                    lichat.saveSetup();
                    this.$emit('close');
                }
            }
        });

        Vue.component("create-channel", {
            template: "#create-channel",
            props: {client: LichatClient},
            data: function(){
                return {
                    name: "",
                    anonymous: false,
                    errorMessage: null
                };
            },
            methods: {
                create: function(){
                    this.client.s("CREATE", {channel: (this.anonymous)?null:this.name})
                        .then(()=>this.$emit('close'))
                        .catch((e)=>this.errorMessage = e.text);
                }
            }
        });

        Vue.component("emote-picker", {
            template: "#emote-picker",
            props: {channel: LichatChannel, classes: Array},
            data: ()=>{
                return {
                    tab: 'emotes', 
                    allEmoji: LichatUI.allEmoji
                }; 
            },
            mounted: function(){
                twemoji.parse(this.$refs.emoji);
                Vue.nextTick(() => {
                    this.$refs.input.value = "";
                    this.$refs.input.focus();
                });
            },
            methods: {
                filter: function(ev){
                    let text = ev.target.value;
                    let group = (this.tab == 'emotes')? this.$refs.emotes :
                        (this.tab == 'emoji') ? this.$refs.emoji :
                        null;
                    if(group){
                        for(let i=0; i<group.children.length; i++){
                            let child = group.children[i];
                            child.style.display = child.getAttribute("title").includes(text)? "block" : "none";
                        }
                    }
                }
            }
        });

        Vue.component("message", {
            template: "#message",
            props: {message: LichatMessage},
            data: ()=>{
                return {
                    editText: null,
                    emotePicker: false,
                    showSettings: false,
                    showUserMenu: false
                };
            },
            methods: {
                react: function(emote){
                    this.emotePicker = false;
                    if(emote)
                        this.message.channel.s("REACT", {
                            target: this.message.from,
                            "update-id": this.message.id,
                            emote: emote
                        });
                },
                edit: function(){
                    this.editText = this.editText.trimEnd();
                    this.message.channel.s("EDIT", {
                        from: this.message.from,
                        id: this.message.id,
                        text: this.editText
                    }).then(()=>this.editText = null)
                        .catch((e)=>lichat.errorMessage = e.text);
                },
                replyTo: function(){
                    lichat.currentChannel.currentMessage.replyTo = this.message;
                },
                startEditing: function(){
                    this.editText = this.message.text;
                    Vue.nextTick(() => {
                        this.$refs.input.focus();
                    });
                }
            },
            mounted: function(){
                twemoji.parse(this.$el);
            }
        });

        this.app = new Vue({
            el: el || '.client',
            data: this,
            methods: {
                switchChannel: (channel)=>{
                    channel.unread = 0;
                    channel.alerted = false;
                    this.currentChannel = channel;
                    this.updateTitle();
                    Vue.nextTick(() => {
                        this.app.$refs.output.scrollTop = this.app.$refs.output.scrollHeight;
                        this.app.$refs.input.focus();
                        
                    });
                },
                toggleSearch: ()=>{
                    if(this.search===null){
                        this.search = "";
                        Vue.nextTick(() => {
                            this.app.$refs.search.focus();
                        });
                    }else{
                        this.search = null;
                        Vue.nextTick(() => {
                            this.app.$refs.input.focus();
                        });
                    }
                },
                submit: (ev)=>{
                    let channel = this.currentChannel;
                    let message = channel.currentMessage;
                    if(!ev.getModifierState("Control") && !ev.getModifierState("Shift")){
                        message.text = message.text.trimEnd();
                        if(message.text.startsWith("/")){
                            this.processCommand(message.text, channel);
                        }else{
                            channel.s("MESSAGE", {
                                "text": message.text,
                                "reply-to": (message.replyTo)? [message.replyTo.author.name, message.replyTo.id]: null
                            }).catch((e)=>channel.showStatus("Error: "+e.text));
                        }
                        message.clear();
                    }
                },
                uploadFile: (ev)=>{
                    if(ev.type == 'click'){
                        document.getElementById("fileChooser").click();
                    }else if(ev.type == 'change'){
                        if(ev.target.files)
                            this.app.uploadFile(ev.target.files);
                    }else if(ev.type == 'drop'){
                        if(ev.dataTransfer.files)
                            this.app.uploadFile(ev.dataTransfer.files);
                    }else if(ev instanceof FileList){
                        let chain = Promise.resolve(null);
                        for(let i=0; i<ev.length; ++i){
                            chain = chain.then(this.app.uploadFile(ev[i]));
                        }
                        return chain;
                    }else if(ev instanceof File){
                        let channel = this.currentChannel;
                        let message = channel.showStatus("Uploading "+ev.name);
                        var reader = new FileReader();
                        return new Promise((ok, fail)=>{
                            reader.onload = ()=>{
                                let parts = reader.result.match(/data:(.*?)(;base64)?,(.*)/);
                                this.currentChannel.s("DATA", {
                                    filename: ev.name,
                                    "content-type": parts[1],
                                    payload: parts[3]
                                }).then(()=>ok())
                                    .catch((ev)=>{
                                        channel.showStatus("Upload failed: "+ev.text);
                                        fail(ev);
                                    })
                                    .finally(()=>channel.deleteMessage(message));
                            };
                            reader.readAsDataURL(ev);
                        });
                    }
                    return null;
                },
                performSearch: (ev)=>{
                    let channel = this.currentChannel;
                    let query = this.search;
                    this.search = null;
                    this.currentChannel.s("SEARCH", {query: query})
                        .then((ev)=>this.showSearchResults(channel, ev.results, query))
                        .catch((e)=>channel.showStatus("Error: "+e.text));
                },
                addEmote: (ev)=>{
                    this.showEmotePicker = false;
                    if(!(ev in LichatUI.allEmoji)) ev = ":"+ev+":";
                    if(ev) this.currentChannel.currentMessage.text += ev;
                }
            }
        });

        this.addCommand("help", (channel, subcommand)=>{
            if(subcommand){
                let command = this.commands["/"+subcommand];
                if(command){
                    let arglist = getParamNames(command.handler);
                    channel.showStatus("/"+subcommand+" "+arglist.join(" ")+"\n\n"+command.help);
                }else{
                    channel.showStatus("No command named "+subcommand);
                }
            }else{
                let text = "<table><thead><tr><th>Command</th><th>Help</th></tr></thead><tbody>";
                for(let name in this.commands){
                    text += "<tr><td>"+name+
                        "</td><td>"+this.commands[name].help+
                        "</td></tr>";
                }
                text += "</tbody></table>";
                channel.showStatus(text, {html: true});
            }

            let STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/mg;
            let ARGUMENT_NAMES = /([^\s,]+)/g;
            function getParamNames(func) {
                let fnStr = func.toString().replace(STRIP_COMMENTS, '');
                let result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
                if(result === null)
                    result = [];
                return result;
            }
        }, "Show help information on the available commands.");

        this.addCommand("disconnect", (channel)=>{
            channel.client.closeConnection();
            channel.showStatus("Disconnected.");
        }, "Disconnect the current client.");

        this.addCommand("join", (channel, ...name)=>{
            name = name.join(" ");
            if(channel.client.hasChannel(name) && channel.client.getChannel(name).isPresent){
                this.app.switchChannel(channel.client.getChannel(name));
            }else{
                channel.client.s("JOIN", {channel: name})
                    .then(()=>{this.currentChannel = channel.client.getChannel(name);})
                    .catch((e)=>channel.showStatus("Error: "+e.text));
            }
        }, "Join a new channel.");

        this.addCommand("leave", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : channel.name;
            channel.client.s("LEAVE", {channel: name})
                .then(()=>{
                    channel.client.channelList = channel.client.channelList.filter(c => c !== channel);
                    if(channel == this.currentChannel){
                        this.currentChannel = null;
                    }
                }).catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Leave a channel. If no channel is specified, leaves the current channel.");

        this.addCommand("create", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : null;
            channel.client.s("CREATE", {channel: name})
                .then(()=>{this.currentChannel = channel.client.getChannel(name);})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Creates a new channel. If no name is specified, creates an anonymous channel.");

        this.addCommand("kick", (channel, ...name)=>{
            channel.s("KICK", {target: name.join(" ")})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Kick a user fromde the channel.");
        
        this.addCommand("pull", (channel, ...name)=>{
            channel.s("PULL", {target: name.join(" ")})
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Pull a user into the channel.");

        this.addCommand("register", (channel, ...password)=>{
            channel.client.s("REGISTER", {password: password.join(" ")})
                .then(()=>channel.showStatus("Registration complete."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Try to register your current username with a password.");

        this.addCommand("grant", (channel, type, ...user)=>{
            channel.s("GRANT", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission granted."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Grant permission for an update type to another user in the channel.");

        this.addCommand("deny", (channel, type, ...user)=>{
            channel.s("DENY", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission denied."))
                .catch((e)=>channel.showStatus("Error: "+e.text));
        }, "Deny permission for an update type to another user in the channel.");

        // FIXME: missing commands from extensions, and also this is very repetitious...
    }

    addClient(client){
        if(this.clients.find(el => el.name == client)) 
            return false;

        client.showMenu = false;
        client.channelList = [];
        client.aliases = [];
        client.notificationLevel = 'all';

        client.getEmergencyChannel = ()=>{
            if(this.currentChannel && this.currentChannel.client == client){
                return this.currentChannel;
            }else if(0 < client.channelList.length){
                return client.channelList[0];
            }else{
                let channel = client.getChannel(client.servername || client.name);
                client.addToChannelList(channel);
                this.app.switchChannel(channel);
                return channel;
            }
        };

        client.disconnectHandler = (ev)=>{
            this.currentChannel.showStatus("Disconnected: "+(ev.reason || "connection lost"));
        };

        client.addHandler("CONNECT", (ev)=>{
            if(0 < client.channelList.length){
                client.getEmergencyChannel().showStatus("Connected");
            }
        });

        client.addHandler("JOIN", (ev)=>{
            ev.text = " ** Joined " + ev.channel;
            let channel = client.getChannel(ev.channel);
            channel.record(ev);
            if(client.getUser(ev.from.toLowerCase()).isSelf){
                client.addToChannelList(channel);
            }
            if(!this.currentChannel){
                this.app.switchChannel(channel);
            }
        });
        
        client.addHandler("LEAVE", (ev)=>{
            ev.text = " ** Left " + ev.channel;
            client.getChannel(ev.channel).record(ev);
        });

        this.clients.push(client);
        
        return client.openConnection();
    }

    removeClient(client){
        if(client.isConnected) client.closeConnection();
        let index = this.clients.indexOf(client);
        if(0 <= index){
            this.clients.splice(index, 1);
            this.saveSetup();
        }
    }

    addCommand(command, fun, help){
        this.commands["/"+command] = {
            handler: fun,
            help: help
        };
    }

    processCommand(cmdname, channel){
        try{
            let args = cmdname.split(" ");
            let command = this.commands[args[0]];
            if(!command) throw "No command named "+args[0];
            args[0] = channel;
            command.handler.apply(this, args);
        }catch(e){
            console.error(e);
            channel.showStatus("Error: "+e);
        }
    }

    showSearchResults(channel, results, query){
        
    }

    updateTitle(){
        let title = "Lichat";
        let count = 0;
        for(let client of this.clients){
            for(let channel of client.channelList){
                count += channel.unread;
            }
        }
        if(this.currentChannel)
            title = this.currentChannel.name+" | "+title;
        if(0 < count)
            title = "("+count+") "+title;
        document.title = title;
    }

    initialSetup(){
        this.addClient(new LichatClient(this.defaultClient))
            .catch((ev)=>client.getEmergencyChannel().showStatus("Connection failed "+(ev.reason || "")));
    }

    setupDatabase(){
        let ensureStore = (name, options)=>{
            if(!this.db.objectStoreNames.contains(name))
                this.db.createObjectStore(name, options);
        };
        ensureStore("clients", {keyPath: "name"});
        ensureStore("options", {keyPath: "name"});
    }

    loadSetup(){
        let tx = this.db.transaction(["clients","options"]);
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("clients").getAll().onsuccess = (ev)=>{
            for(let options of ev.target.result){
                this.addClient(new LichatClient(options));
            }
        };
        tx.objectStore("options").get("general").onsuccess = (ev)=>{
            if(ev.target.result)
                this.options = ev.target.result;
        };
    }

    saveSetup(){
        if(!this.db) return;
        console.log("Saving...");
        let tx = this.db.transaction(["clients","options"], "readwrite");
        tx.onerror = (ev)=>console.error(ev);
        let store = tx.objectStore("clients");
        store.clear();
        for(let client of this.clients){
            store.put({
                name: client.name,
                username: client.username,
                password: client.password,
                hostname: client.hostname,
                port: client.port,
                ssl: client.ssl,
                aliases: client.aliases,
                channels: client.channelList.map(c => c.encode())
            });
        }
        tx.objectStore("options").put({
            name: "general",
            ...this.options
        });
        tx.commit();
    }

    clearSetup(){
        if(!this.db) return;
        let tx = this.db.transaction("clients", "readwrite");
        let store = tx.objectStore("clients");
        store.clear();
        tx.onerror = (ev)=>console.error(ev);
    }

    static allEmoji = {};

    static sound = new Audio('notify.mp3');
    
    // URL Regex by Diego Perini: https://gist.github.com/dperini/729294
    static URLRegex = new RegExp(
        "^" +
            // protocol identifier (optional)
        // short syntax // still required
        "(?:(?:(?:https?|ftp):)?\\/\\/)" +
            // user:pass BasicAuth (optional)
        "(?:\\S+(?::\\S*)?@)?" +
            "(?:" +
            // IP address exclusion
        // private & local networks
        "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
            "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
            "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
            // IP address dotted notation octets
        // excludes loopback network 0.0.0.0
        // excludes reserved space >= 224.0.0.0
        // excludes network & broadcast addresses
        // (first & last IP address of each class)
        "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
            "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
            "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
            "|" +
            // host & domain names, may end with dot
        // can be replaced by a shortest alternative
        // (?![-_])(?:[-\\w\\u00a1-\\uffff]{0,63}[^-_]\\.)+
        "(?:" +
            "(?:" +
            "[a-z0-9\\u00a1-\\uffff]" +
            "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
            ")?" +
            "[a-z0-9\\u00a1-\\uffff]\\." +
            ")+" +
            // TLD identifier name, may end with dot
        "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)" +
            ")" +
            // port number (optional)
        "(?::\\d{2,5})?" +
            // resource path (optional)
        "(?:[/?#]\\S*)?" +
            "$", "i"
    );

    static linkifyURLs(text){
        let out = [];
        let word = [];
        let start = 0, cur = 0;

        let flushWord = ()=>{
            if(0 < word.length){
                let wordStr = word.join('');
                let unescaped = LichatUI.unescapeHTML(wordStr);
                word.length = 0;
                if(unescaped.match(LichatUI.URLRegex)){
                    out.push(`\u200B<a href="${unescaped}" class="userlink" target="_blank">${wordStr}</a>\u200B`);
                }else{
                    out.push(wordStr);
                }
            }
        };

        for(let char of text){
            // Note: unlike with 'of', text[n] would get only half of a wide unicode character
            if(char.match(/^\s$/)){
                if(start < cur){
                    flushWord();
                }
                start = cur + 1;
                out.push(char);
            }else{
                word.push(char);
            }
            cur++;
        }
        flushWord();
        return out.join('');
    }

    static unescapeHTML(text){
        return text.replace(/&([\w]+);/g, (a,b)=>{
            switch(b){
            case "lt": return "<";
            case "gt": return ">";
            case "quot": return "\"";
            case "amp": return "&";
            default: return a;
            }
        });
    }

    static escapeHTML(text){
        return text.replace(/([<>"&])/g, (a,b)=>{
            switch(b){
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "\"": return "&quot;";
            case "&": return "&amp;";
            default: return a;
            }
        });
    }

    static markSelf(text, channel){
        let names = [...channel.client.aliases];
        if(channel.client.username)
            names.push(channel.client.username);
        let stream = new LichatStream();
        let inLink = false;
        for(let i=0; i<text.length; i++){
            let match = null;
            if(!inLink){
                for(let name of names){
                    if(text.substring(i, i+name.length) === name){
                        match = name;
                        break;
                    }
                }
            }
            if(match !== null){
                stream.writeString("<mark>"+match+"</mark>");
                i += match.length-1;
            }else{
                if(!inLink && text[i] === "<" && text[i+1] === "a"){
                    inLink = true;
                }else if(inLink && text[i] === ">"){
                    inLink = false;
                }
                stream.writeChar(text[i]);
            }
        }
        return stream.string;
    }

    static replaceEmotes(text, channel){
        // Find starting point
        let start = 0;        
        while(text[start] != ':' && start<text.length) start++;
        // If we do have colons in, scan for emotes.
        if(start < text.length){
            let out = text.slice(0, start);
            let end = start+1;
            // Scan for next colon
            for(; end<text.length; end++){
                if(text[end] == ':'){
                    let emote = text.slice(start, end+1);
                    // If we do have an emote of that name
                    let content = channel.getEmote(emote);
                    if(content){
                        out = out+"<img alt='"+emote+"' title='"+emote+"' src='"+content+"'>";
                        // Scan ahead for next possible end point after "skipping" the emote.
                        end++;
                        start = end;
                        while(text[end+1] != ':' && end<text.length) end++;
                    }else{
                        out = out+emote.slice(0, -1);
                        start = end;
                    }
                }
            }
            // Stitch on ending
            return out+text.slice(start, end);
        }else{
            return text;
        }
    }

    static formatUserText(text, channel){
        return LichatUI.replaceEmotes(LichatUI.markSelf(LichatUI.linkifyURLs(LichatUI.escapeHTML(text)), channel), channel);
    }
}


(()=>{
    let request = new XMLHttpRequest();
    request.onreadystatechange = ()=>{
        if(request.readyState === XMLHttpRequest.DONE && request.status == 200){
            LichatUI.allEmoji = JSON.parse(request.responseText);
        }
    };
    request.open('GET', 'https://cdn.jsdelivr.net/npm/emojilib@3.0.4/dist/emoji-en-US.json');
    request.send();
})();
