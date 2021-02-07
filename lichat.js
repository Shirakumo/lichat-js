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
        directSuperclasses = self.mapcar(self.findClass, directSuperclasses);
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

    self.prog1 = (value, ...forms)=>{
        var ret = value();
        for(var form of forms){form();}
        return ret;
    };

    self.prog2 = (form, value, ...forms)=>{
        var ret = value();
        form();
        for(var form of forms){form();}
        return ret;
    };

    self.progn = (...forms)=>{
        var ret = null;
        for(var form of forms){ret = form();}
        return ret;
    };

    self.first = (array)=> array[0];
    self.second = (array)=> array[1];
    self.third = (array)=> array[2];
    self.fourth = (array)=> array[3];

    self.gt = (a, b)=> a>b;
    self.lt = (a, b)=> a<b;

    self.unwindProtect = (protect, cleanup)=>{
        try{
            self.prog1(protect, cleanup);
        }catch(e){
            cleanup();
            throw e;
        }
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

    self.handlerCase = (form, ...cases)=>{
        try{
            return form();
        }catch(e){
            cases.push(true);
            cases.push((e)=>{throw e;});
            self.push([e], cases);
            self.push(e, cases);
            return self.argTypecase.apply(self, cases);
        }
    };

    self.block = (name, ...forms)=>{
        var handleReturn = (r)=>{
            if(r.name === name){
                return r.value;
            }else{
                throw r;
            }
        };
        return self.handlerCase(()=>{self.progn.apply(self,forms);},
                                "Return", handleReturn);
    };

    self.retFrom = (name, value)=>{
        throw new Return(name, value);
    };

    self.ret = (value)=>{
        throw new Return(null, value);
    };

    self.restartCase = (form, ...cases)=>{
        var handleRestart = (r)=>{
            for(var i=0; i<cases.length; i++){
                var name = cases[i];
                var form = cases[i+1];
                if(name === r.name){
                    return form.apply(form, r.args);
                }
            }
            return null;
        };
        self.handlerCase(form, "Restart", handleRestart);
    };

    self.invokeRestart = (name, args)=>{
        throw new Restart.apply(name, args);
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

    self.nconc = (target, arrays)=>{
        for(var array of arrays){
            for(var item of array){
                target.push(item);
            }
        }
        return target;
    };

    self.remove = (el, arr, key)=>{
        key = key || ((a)=>a);
        var newarr = [];
        for(var item of arr){
            if(key(item) !== el)
                newarr.push(item);
        }
        return newarr;
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

    self.sort = (arr, sort, key)=>{
        key = key || ((a)=>a);
        arr.sort((a, b)=>sort(key(b), key(a)));
        return arr;
    };

    self.mapcar = (func, ...arrays)=>{
        var min = 0;
        for(arr of arrays)min = Math.max(min,arr.length);
        var result = [];
        for(var i=0; i<min; i++){
            var args = [];
            for(var array of arrays)args.push(array[i]);
            result.push(func.apply(func, args));
        }
        return result;
    };

    self.sxhash = (object)=>{
        var str = object.toString();
        var hash = 0;
        for(var i=0; i<str.length; i++){
            hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
        }
        return hash;
    };

    self.print = (object)=>{
        if(console)
            console.log(object);
        return object;
    };

    self.error = (type, initargs)=>{
        initargs.stack = new Error().stack;
        var condition = new Condition(type, initargs);
        throw condition;
    };

    var formatDispatch = {};
    self.format = (string, ...args)=>{
        var stream = new LichatStream(string);
        var varray = [""];
        loop:
        for(;;){
            var c = stream.readChar(false);
            switch(c){
            case null: break loop;
            case "~":
                var at = false, colon = false;
                readDirectiveChar:
                for(;;){
                    c = stream.readChar(false);
                    switch(c){
                    case null: self.error("FORMAT-ERROR",{text:"Premature end of format string."});
                    case "@": at = true; readDirectiveChar(); break;
                    case ":": colon = true; readDirectiveChar(); break;
                    default:
                        var dispatch = formatDispatch[c.toLowerCase()];
                        if(!dispatch)
                            self.error("FORMAT-ERROR",{text:"Unknown format directive "+c});
                        if(args.length === 0)
                            self.error("FORMAT-ERROR",{text:"No more arguments left."});
                        dispatch(varray, at, colon, args);
                        break readDirectiveChar;
                    }
                }
                break;
            default:
                varray[varray.length-1] += c;
            }
        }
        if(console)
            console.log.apply(console, varray);
        return null;
    };

    self.setFormatDispatcher = (c, handler)=>{
        formatDispatch[c.toLowerCase()] = handler;
        return handler;
    };

    self.setFormatDispatcher("a", (varray, a, c, args)=>{
        varray[varray.length-1] += args.shift();
    });

    self.setFormatDispatcher("s", (varray, a, c, args)=>{
        varray.push(args.shift());
        varray.push("");
    });

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

// Special objects
var Return = function(name, value){
    var self = this;
    self.name = (name===undefined)?null:name;
    self.value = (value===undefined)?null:value;
    return self;
};

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
    from: cl.requiredArg("from")
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
    channel: cl.requiredArg("channel")
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
cl.defclass("MESSAGE", ["CHANNEL-UPDATE", "TEXT-UPDATE"]);
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
        cl.unwindProtect(()=>{
            for(var i=0; i<list.length; i++){
                self.printSexpr(list[i], stream);
                if(i+1 < list.length){
                    stream.writeChar(" ");
                }
            }
        },()=>{
            stream.writeChar(")");
        });
    };

    self.printSexprString = (string, stream)=>{
        stream.writeChar("\"");
        cl.unwindProtect(()=>{
            for(var character of string){
                if(character === "\"" | character === "\\"){
                    stream.writeChar("\\");
                }
                stream.writeChar(character);
            }
        },()=>{
            stream.writeChar("\"");
        });
    };

    self.printSexprNumber = (number, stream)=>{
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
    
    self.printSexprToken = (token, stream)=>{
        for(var character of token){
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
            return self.safeFindSymbol(token, "LICHAT-PROTOCOL");
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

var LichatClient = function(options){
    var self = this;

    options = options || {};
    if(!options.username) options.username = "Lion";
    if(!options.password) options.password = null;
    if(!options.hostname) options.hostname = "localhost";
    if(!options.port) options.port = LichatDefaultPort;
    if(!options.handleFailure) options.handleFailure = ()=>{};

    for(var key in options){
        self[key] = options[key];
    }
    
    self.socket = null;
    self.servername = null;
    self.handlers = {};
    self.pingDelay = 15000;
    self.emotes = {};
    self.channels = {};
    self.ssl = false;

    if(window.localStorage){
        self.emotes = JSON.parse(window.localStorage.getItem("emotes")) || {};
    }

    var supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes",
                               "shirakumo-channel-info", "shirakumo-quiet", "shirakumo-pause",
                               "shirakumo-server-management", "shirakumo-ip", "shirakumo-user-info",
                               "shirakumo-icon"];
    var availableExtensions = [];
    var internalHandlers = {};
    var idCallbacks = {};
    var reader = new LichatReader();
    var printer = new LichatPrinter();
    var status = null;
    var pingTimer = null;

    self.openConnection = ()=>{
        status = "STARTING";
        var socket = new WebSocket((self.ssl?"wss://":"ws://")+self.hostname+":"+self.port, "lichat");
        socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password || null,
                               version: LichatVersion,
                               extensions: supportedExtensions,
                               socket: socket});
        };
        socket.onmessage = (e)=>{self.handleMessage(socket, e);};
        socket.onclose = (e)=>{
            if(e.code !== 1000 && status != "STOPPING"){
                self.handleFailure(new Condition("SOCKET-CLOSE", {
                    text: "Error "+e.code+" "+e.reason,
                    socket: socket,
                    event: e
                }));
            }
            self.closeConnection(socket);
        };
        self.socket = socket;
        return socket;
    };

    self.closeConnection = (socket)=>{
        socket = socket || self.socket;
        self.channels = {};
        if(status != "STOPPING"){
            status = "STOPPING";
            if(socket && socket.readyState < 2){
                socket.close();
            }
            if(self.socket == socket){ 
                self.socket = null;
            }
        }
        return socket;
    };

    self.send = (socket, wireable)=>{
        if(!socket || socket.readyState != 1)
            cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        cl.format("[Lichat] Send:~s", wireable);
        var stream = new LichatStream();
        printer.toWire(wireable, stream);
        socket.send(stream.string+'\u0000');
        return wireable;
    };

    self.s = (type, args, cb)=>{
        args = args || {};
        var socket = args.socket || self.socket;
        if(!args.from) args.from = self.username;
        delete args.socket;
        var update = cl.makeInstance(type, args);
        if(cb) self.addCallback(update.id, cb);
        return self.send(socket, update);
    };

    self.startDelayPing = (socket)=>{
        if(pingTimer) clearTimeout(pingTimer);
        pingTimer = setTimeout(()=>{
            if(socket.readyState == 1){
                self.s("PING", {socket: socket});
                self.startDelayPing(socket);
            }
        }, self.pingDelay);
        return pingTimer;
    };

    self.handleMessage = (socket, event)=>{
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            self.startDelayPing(socket);
            update.socket = socket;
            switch(status){
            case "STARTING":
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        cl.error("CONNECTION-FAILED",{text: "non-Update message", update: update});
                    if(update.type !== "CONNECT")
                        cl.error("CONNECTION-FAILED",{text: update.text, update: update});
                }catch(e){
                    self.handleFailure(e);
                    self.closeConnection(socket);
                    throw e;
                }
                status = "RUNNING";
                if(!self.username)
                    self.username = update.from;
                self.process(update);
                break;
            case "RUNNING":
                self.process(update);
                break;
            }
        }catch(e){
            cl.format("Error during message handling: ~s", e);
        }
        return self;
    };

    self.process = (update)=>{
        cl.format("[Lichat] Update:~s",update);
        var callbacks = idCallbacks[update.id];
        if(callbacks){
            for(callback of callbacks){
                try{
                    callback(update);
                }catch(e){
                    cl.format("Callback error: ~s", e);
                }
            }
            self.removeCallback(update.id);
        }
        if(!self.maybeCallInternalHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(self.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!self.maybeCallHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(self.maybeCallHandler(s.className, update))
                    break;
            }
        }
        return self;
    };

    self.maybeCallInternalHandler = (type, update)=>{
        if(internalHandlers[type]){
            internalHandlers[type](update);
            return true;
        }
        return false;
    };

    self.addInternalHandler = (update, handler)=>{
        internalHandlers[update] = handler;
        return self;
    };

    self.removeInternalHandler = (update)=>{
        delete internalHandlers[update];
        return self;
    };

    self.maybeCallHandler = (type, update)=>{
        if(self.handlers[type]){
            self.handlers[type](update);
            return true;
        }
        return false;
    };

    self.addHandler = (update, handler)=>{
        self.handlers[update] = handler;
        return self;
    };

    self.removeHandler = (update)=>{
        delete self.handlers[update];
        return self;
    };

    self.addCallback = (id, handler)=>{
        if(!idCallbacks[id]){
            idCallbacks[id] = [handler];
        }else{
            idCallbacks[id].push(handler);
        }
        return self;
    };

    self.removeCallback = (id)=>{
        delete idCallbacks[id];
        return self;
    };

    self.addEmote = (emote)=>{
        var name = ":"+emote["name"].toLowerCase().replace(/^:|:$/g,"")+":";
        self.emotes[name] = "<img class=\"emote\" alt=\""+name+"\" title=\""+name+"\" src=\"data:"+emote["content-type"]+";base64,"+emote["payload"]+"\" />";
        if(window.localStorage){
            window.localStorage.setItem("emotes", JSON.stringify(self.emotes));
        }
        return emote;
    };

    self.addInternalHandler("CONNECT", (ev)=>{
        availableExtensions = ev.extensions;
        if(cl.find("shirakumo-emotes", availableExtensions)){
            var known = [];
            for(var emote in self.emotes){
                cl.push(emote.replace(/^:|:$/g,""), known);
            }
            self.s("EMOTES", {names: known});
        }
    });

    self.addInternalHandler("PING", (ev)=>{
        self.s("PONG", {socket: ev.socket});
    });

    self.addInternalHandler("PONG", (ev)=>{
    });

    self.addInternalHandler("JOIN", (ev)=>{
        if(!self.servername)
            self.servername = ev.channel;
        if(ev.from === self.username){
            var info = {};
            info[":NEWS"] = "";
            info[":TOPIC"] = "";
            info[":RULES"] = "";
            info[":CONTACT"] = "";
            self.channels[ev.channel.toLowerCase()] = info;
            if(cl.find("shirakumo-backfill", availableExtensions)
               && ev.channel !== self.servername){
                self.s("BACKFILL", {channel: ev.channel});
            }
            if(cl.find("shirakumo-channel-info", availableExtensions)){
                self.s("CHANNEL-INFO", {channel: ev.channel});
            }
        }
    });

    self.addInternalHandler("LEAVE", (ev)=>{
        if(ev.from === self.username){
            delete self.channels[ev.from];
        }
    });

    self.addInternalHandler("EMOTE", (ev)=>{
        self.addEmote(ev);
    });

    self.addInternalHandler("SET-CHANNEL-INFO", (ev)=>{
        self.channels[ev.channel.toLowerCase()][LichatPrinter.toString(ev.key)] = ev.text;
    });
};
var LichatUI = function(chat, cclient){
    var self = this;
    var client = cclient;

    var channels = chat.querySelector(".lichat-channel-list");
    var users = chat.querySelector(".lichat-user-list");
    var output = chat.querySelector(".lichat-output");
    var input = chat.querySelector(".lichat-input");
    var topic = chat.querySelector(".lichat-topic");

    var updates = 0;
    var title = document.title;

    self.commandPrefix = "/";
    self.channel = null;
    self.channelSettings = {};
    self.notifyBy = [];
    self.commands = {};
    self.notifySound = chat.querySelector(".lichat-notify");
    self.icon = document.querySelector("head link[rel=\"shortcut icon\"]");
    self.icon = (self.icon)?self.icon.getAttribute("href"):"/favicon.ico";

    self.objectColor = (object)=>{
        var hash = cl.sxhash(object);
        var encoded = hash % 0xFFF;
        var r = 16*(1+(encoded&0xF00)>>8)-1;
        var g = 16*(1+(encoded&0x0F0)>>4)-1;
        var b = 16*(1+(encoded&0x00F)>>0)-1;
        
        return "rgb("+Math.min(200, Math.max(50, r))
            +","+Math.min(180, Math.max(80, g))
            +","+Math.min(180, Math.max(80, b))+")";
    };

    self.formatTime = (time)=>{
        var date = new Date(time*1000);
        var pd = (a)=>{return (a<10)?"0"+a:""+a;};
        return pd(date.getHours())+":"+pd(date.getMinutes())+":"+pd(date.getSeconds());
    };

    self.invokeCommand = (command, ...args)=>{
        var fun = self.commands[command];
        if(fun){
            fun.apply(self, args);
        }else{
            cl.error("NO-SUCH-COMMAND", {command: command});
        }
    };

    self.addCommand = (prefix, handler, documentation)=>{
        handler.documentation = documentation;
        self.commands[prefix] = handler;
    };

    self.removeCommand = (prefix)=>{
        delete self.commands[prefix];
    };

    self.processCommand = (command)=>{
        if(command.indexOf(self.commandPrefix) === 0){
            var args = command.substring(self.commandPrefix.length).split(" ");
            self.invokeCommand.apply(self, args);
            return true;
        }
        return false;
    };

    self.sendMessage = (text, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        client.s("MESSAGE", {channel: channel, text: text});
    };

    self.sendEdit = (text, id, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        client.s("EDIT", {channel: channel, id: id, text: text});
    };

    self.sendFile = (file, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        var reader = new FileReader();
        reader.onload = ()=>{
            var base64 = reader.result.substring(reader.result.indexOf(",")+1);
            client.s("DATA", {"channel": channel,
                              "payload": base64,
                              "content-type": file.type,
                              "filename": file.name});
        };
        reader.onerror = (e)=>{
            self.showError(e);
        };
        reader.readAsDataURL(file);
    };
    
    self.processInput = (text, chan)=>{
        if(text === undefined){
            text = input.value;
            input.value = "";
        }
        try{
            self.processCommand(text, chan) ||
                self.sendMessage(text, chan);
        }catch(e){
            self.showError(e);
        }
    };

    var autoComplete = {index: 0,
                        prefix: null,
                        pretext: null};
    self.autoCompleteInput = (text, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(text === undefined) text = input.value;

        if(autoComplete.prefix === null){
            autoComplete.index = 0;
            autoComplete.prefix = text.split(" ").splice(-1)[0].toLowerCase();
            autoComplete.pretext = text.substr(0, text.length-autoComplete.prefix.length);
        }
        
        var matches = [];
        for(var user of self.channelElement(channel).users){
            if(user.toLowerCase().indexOf(autoComplete.prefix) === 0 &&
               user !== client.username)
                matches.push(user);
        }
        for(var emote in client.emotes){
            if(emote.toLowerCase().indexOf(autoComplete.prefix) === 0)
                matches.push(emote);
        }
        if(0 < matches.length){
            matches = cl.sort(matches, cl.lt);
            var match = matches[autoComplete.index];
            input.value = autoComplete.pretext+match
                + ((autoComplete.pretext === "" && match[match.length-1] !== ":")? ": ": " ");
            autoComplete.index = (autoComplete.index+1)%matches.length;
        }
    };

    self.constructElement = (tag, options)=>{
        var el = document.createElement(tag);
        el.setAttribute("class", (options.classes||[]).join(" "));
        if(options.text) el.innerText = options.text;
        if(options.html) el.innerHTML = options.html;
        for(var attr in (options.attributes||{})){
            if(options.attributes[attr])
                el.setAttribute(attr, options.attributes[attr]);
        }
        for(var i in (options.elements||[])){
            var element = options.elements[i];
            var sub = self.constructElement(element.tag, element);
            el.appendChild(sub);
        }
        for(var data in (options.dataset||{})){
            el.dataset[data] = options.dataset[data];
        }
        return el;
    };

    self.popup = (content, okCallback)=>{
        var el = self.constructElement("div", {
            classes: ["popup-background"],
            elements: [{
                tag: "div",
                classes: ["popup"],
                attributes: {"style": "display:block"},
                elements: [
                    content,
                    {tag: "button", attributes: {"type": "submit"}, text: "Ok"}
                ]
            }]
        });
        el.addEventListener("click", (ev)=>{
            if(ev.target == el) document.body.removeChild(el);
        });
        el.querySelector("button[type=submit]").addEventListener("click", ()=>{
            if(okCallback) okCallback(el);
            document.body.removeChild(el);
        });
        document.body.appendChild(el);
        return el;
    };

    self.channelElement = (name)=>{
        name = name.toLowerCase();
        var channel = output.querySelector("[data-channel=\""+name+"\"]");
        if(!channel) cl.error("NO-SUCH-CHANNEL",{channel:name});
        return channel;
    };

    self.channelExists = (name)=>{
        try{self.channelElement(name);
            return true;
           }catch(e){return false;}
    };

    self.isAtBottom = (element)=>{
        element = element || channel;
        return (element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    };

    self.ensureMessageOptions = (options)=>{
        if(!options.clock) options.clock = cl.getUniversalTime();
        if(!options.from) options.from = "System";
        if(!options.type) options.type = "INFO";
        if(!options.channel) options.channel = self.channel;
        if(!options.text && !options.html) cl.error("NO-MESSAGE-TEXT",{message:options});
        return options;
    };

    var lastInserted = null;
    self.showMessage = (options)=>{
        options = self.ensureMessageOptions(options);
        if(cl.classOf(options)){
            classList = cl.mapcar((a)=>a.className.toLowerCase(), cl.classOf(options).superclasses);
            classList.push(cl.classOf(options).className);
        }else{
            classList = ["update"];
        }
        if(options.from === client.username) cl.push("self", classList);
        var timestamp = cl.universalToUnix(options.clock);
        // Construct element
        var el = self.constructElement("div", {
            classes: classList,
            dataset: {id: options.id,from: options.from},
            elements: [{tag: "time",
                        text: self.formatTime(timestamp),
                        attributes: {datetime: ""+timestamp}},
                       {tag: "a",
                        text: options.from,
                        classes: ["username"],
                        attributes: {style: "color:"+self.objectColor(options.from),
                                     title: options.from}},
                       {tag: "span", text: options.text, html: options.html}]
        });
        // Handle scrolling deferral.
        var channel = self.channelElement(options.channel);
        lastInserted = el;
        if(self.isAtBottom(channel)){
            var elements = el.querySelectorAll("img,audio,video");
            for(var i=0; i<elements.length; i++){
                elements[i].addEventListener("load", function(){
                    if(lastInserted === el)
                        el.scrollIntoView();
                });
            }
        }
        // Insert element in order.
        var inserted = false;
        for(var child of channel.childNodes){
            var datetime = child.querySelector("time").getAttribute("datetime");
            if(timestamp < parseInt(datetime)){
                channel.insertBefore(el, child);
                inserted = true;
                break;
            }
        }
        if(!inserted){
            channel.appendChild(el);
            el.scrollIntoView();
        }
        return el;
    };

    self.showError = (e)=>{
        if(e instanceof Condition){
            return self.showMessage({from: "System",
                                     text: ""+e.report()});
        }else{
            return self.showMessage({from: "System",
                                     text: e+""});
        }
    };

    self.editMessage = (options)=>{
        options = self.ensureMessageOptions(options);
        let channel = self.channelElement(options.channel);
        for(let child of channel.childNodes){
            if(parseInt(child.dataset.id) === options.id &&
               child.dataset.from === options.from){
                // TODO: How do we mark a message as edited?
                let span = child.lastElementChild;
                if(options.text) span.innerText = options.text;
                if(options.html) span.innerHTML = options.html;
                break;
            }
        }
    };

    self.addChannel = (n)=>{
        let name = n.toLowerCase();
        var el = self.constructElement("div", {
            classes: ["lichat-channel"],
            attributes: {"data-channel": name, "style": "display:none;"}
        });
        var settings = self.channelSettings[name] || {};
        self.channelSettings[name] = settings;
        el.users = [];
        output.appendChild(el);
        var menu = self.constructElement("a", {
            text: name,
            classes: [(name.indexOf("@")===0)? "anonymous"
                      :(name === client.servername)? "primary"
                      :  "regular"],
            attributes: {"data-channel": name,
                         "style": "color:"+(settings.color || "")},
            elements: [{
                tag: "nav",
                attributes: {"style": "display:none"},
                elements: [
                    {tag: "a", classes: ["info"], text: "Info"},
                    {tag: "a", classes: ["permissions"], text: "Permissions"},
                    {tag: "a", classes: ["settings"], text: "Settings"},
                    {tag: "a", classes: ["pull"], text: "Invite"},
                    {tag: "a", classes: ["leave"], text: "Leave"},
                ]
            }]
        });
        var nav = menu.querySelector("nav");
        nav.querySelector("a.info").addEventListener("click", ()=>{
            nav.style.display = "none";
            var els = [];
            for(var key in client.channels[name]){
                els.push({
                    tag: "div",
                    classes: ["row"],
                    elements: [
                        {tag: "label", text: key},
                        {tag: "input",
                         dataset: {"key": key},
                         attributes: {type: "text", value: client.channels[name][key]}}
                    ]
                });
            }
            self.popup({tag:"div", elements: els}, (el)=>{
                for(var field of el.querySelectorAll("input[type=text]")){
                    var key = field.dataset.key;
                    if(field.value != client.channels[name][key]){
                        client.s("SET-CHANNEL-INFO", {channel: name, key: LichatReader.fromString(key), text: field.value});
                    }
                }
            });
        });
        nav.querySelector("a.permissions").addEventListener("click", ()=>{
            nav.style.display = "none";
            self.popup({tag:"span", text: "TODO"});
        });
        nav.querySelector("a.settings").addEventListener("click", ()=>{
            nav.style.display = "none";
            self.popup({tag:"div", elements: [
                {tag: "div", classes: ["row"], elements: [
                    {tag: "label", text: "Color"},
                    {tag: "input", attributes: {type: "color", value: settings["color"]}}
                ]},
                {tag: "div", classes: ["row"], elements: [
                    {tag: "label", text: "Notify"},
                    {tag: "select", elements: [
                        {tag: "option", text: "on messages", attributes: {value: "any", selected: settings['notify'] == "any"}},
                        {tag: "option", text: "on mentions", attributes: {value: "mention", selected: settings['notify'] == "mention"}},
                        {tag: "option", text: "never", attributes: {value: "none", selected: settings['notify'] == "never"}}
                    ]}
                ]}
            ]}, (el)=>{
                settings["color"] = el.querySelector("input[type=color]").value;
                settings["notify"] = el.querySelector("select").value;
                menu.style.color = settings["color"];
            });
        });
        nav.querySelector("a.pull").addEventListener("click", ()=>{
            nav.style.display = "none";
            var user = window.prompt("Username to pull into "+name);
            if(user){
                client.s("PULL", {channel: name, target: user});
            }
        });
        nav.querySelector("a.leave").addEventListener("click", ()=>{
            nav.style.display = "none";
            client.s("LEAVE", {channel: name});
        });
        menu.addEventListener("click", ()=>{
            self.changeChannel(name);
        });
        menu.addEventListener("contextmenu", (ev)=>{
            nav.style.display = (nav.style.display == "none")? "block" : "none";
            nav.style.top = ev.clientY+"px";
            nav.style.left = ev.clientX+"px";
            ev.preventDefault();
        });
        channels.appendChild(menu);
        return self.changeChannel(name);
    };

    self.removeChannel = (name)=>{
        name = name.toLowerCase();
        output.removeChild(self.channelElement(name));
        channels.removeChild(channels.querySelector("[data-channel=\""+name+"\"]"));
        if(self.channel == name){
            self.channel = null;
            return self.changeChannel(client.servername);
        }else{
            return self.channel;
        }
    };

    self.changeChannel = (name)=>{
        name = name.toLowerCase();
        var channel = self.channelElement(name);
        if(self.channel) self.channelElement(self.channel).style.display = "none";
        if(channels.querySelector(".active"))
            channels.querySelector(".active").classList.remove("active");
        channels.querySelector("[data-channel=\""+name+"\"]").classList.add("active");
        channel.style.display = "";
        if(topic){
            var text = client.channels[name][":TOPIC"];
            topic.innerHTML = self.replaceEmotes(self.linkifyURLs(self.escapeHTML(text || "")));
        }
        self.channel = name;
        self.rebuildUserList();
        self.updateTitle();
        return channel;
    };

    self.addUser = (name, channel)=>{
        channel = self.channelElement(channel || self.channel);
        cl.pushnew(name, channel.users);
        self.rebuildUserList();
    };

    self.removeUser = (name, channel)=>{
        channel = self.channelElement(channel || self.channel);
        channel.users = cl.remove(name, channel.users);
        self.rebuildUserList();
    };

    self.rebuildUserList = ()=>{
        users.innerHTML = "";
        for(n of self.channelElement(self.channel).users){
            let name = n;
            var menu = self.constructElement("a", {
                text: name,
                classes: [(name === client.servername)? "server"
                          : "regular"],
                attributes: {"data-user": name,
                             "style": "color:"+self.objectColor(name)},
                elements: [{
                    tag: "nav",
                    attributes: {"style": "display:none"},
                    elements: [
                        {tag: "a", classes: ["info"], text: "Info"},
                        {tag: "a", classes: ["quiet"], text: "Quiet"},
                        {tag: "a", classes: ["unquiet"], text: "Unquiet"},
                        {tag: "a", classes: ["kick"], text: "Kick"},
                        {tag: "a", classes: ["kickban"], text: "Kickban"},
                    ]
                }]
            });
            var nav = menu.querySelector("nav");
            nav.querySelector("a.info").addEventListener("click", ()=>{
                nav.style.display = "none";
                self.invokeCommand("info", name);
            });
            nav.querySelector("a.kick").addEventListener("click", ()=>{
                nav.style.display = "none";
                client.s("KICK", {channel: self.channel, target: name});
            });
            nav.querySelector("a.quiet").addEventListener("click", ()=>{
                nav.style.display = "none";
                client.s("QUIET", {channel: self.channel, target: name});
            });
            nav.querySelector("a.unquiet").addEventListener("click", ()=>{
                nav.style.display = "none";
                client.s("UNQUIET", {channel: self.channel, target: name});
            });
            nav.querySelector("a.kickban").addEventListener("click", ()=>{
                nav.style.display = "none";
                if(window.confirm("Are you sure you want to ban "+name+" from "+self.channel+"?")){
                    client.s("DENY", {channel: self.channel, target: name, update: cl.li("JOIN")});
                    client.s("KICK", {channel: self.channel, target: name});
                }
            });
            menu.addEventListener("contextmenu", (ev)=>{
                nav.style.display = (nav.style.display == "none")? "block" : "none";
                nav.style.top = ev.clientY+"px";
                nav.style.left = ev.clientX+"px";
                ev.preventDefault();
            });
            users.appendChild(menu);
        }
    };

    self.reset = ()=>{
        if(output) output.innerHTML = "";
        if(users) users.innerHTML = "";
        if(channels) channels.innerHTML = "";
        self.channel = null;
    };
    
    // URL Regex by Diego Perini: https://gist.github.com/dperini/729294
    var URLRegex = new RegExp(
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

    self.linkifyURLs = (text)=>{
        let out = [];
        let word = [];
        let start = 0, cur = 0;
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

        function flushWord(){
            if(0 < word.length){
                let wordStr = word.join('');
                let unescaped = self.unescapeHTML(wordStr);
                word.length = 0;
                if(unescaped.match(URLRegex)){
                    out.push(`\u200B<a href="${unescaped}" class="userlink" target="_blank">${wordStr}</a>\u200B`);
                }else{
                    out.push(wordStr);
                }
            }
        }
    };

    self.prewrapURLs = (text)=>{
        return text.replace(URLRegex, "\u200B$&\u200B");
    };

    self.unescapeHTML = (text)=>{
        return text.replace(/&([\w]+);/g, (a,b)=>{
            switch(b){
            case "lt": return "<";
            case "gt": return ">";
            case "quot": return "\"";
            case "amp": return "&";
            default: return a;
            }
        });
    };

    self.escapeHTML = (text)=>{
        return text.replace(/([<>"&])/g, (a,b)=>{
            switch(b){
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "\"": return "&quot;";
            case "&": return "&amp;";
            default: return a;
            }
        });
    };

    self.escapeRegex = (text)=>{
        return text.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };

    self.markSelf = (text, name)=>{
        name = name || client.username || "anonymous";
        var stream = new LichatStream();
        var inLink = false;
        for(var i=0; i<text.length; i++){
            if(!inLink && text.substring(i, i+name.length) === name){
                stream.writeString("<mark>"+name+"</mark>");
                i += name.length-1;
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
    };

    self.replaceEmotes = (text)=>{
        // Find starting point
        var start = 0;        
        while(text[start] != ':' && start<text.length) start++;
        // If we do have colons in, scan for emotes.
        if(start < text.length){
            var out = text.slice(0, start);
            // Scan for next colon
            for(var end=start+1; end<text.length; end++){
                if(text[end] == ':'){
                    var emote = text.slice(start, end+1);
                    // If we do have an emote of that name
                    if(client.emotes[emote.toLowerCase()]){
                        out = out+client.emotes[emote.toLowerCase()];
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
            return out+text.slice(start,end);
        }else{
            return text;
        }
    };

    self.formatUserText = (text)=>{
        return self.replaceEmotes(self.markSelf(self.linkifyURLs(self.escapeHTML(text))));
    };

    self.updateTitle = ()=>{
        if(self.channel && client.servername)
            document.title = ((updates<=0)?"":"("+updates+") ")+self.channel+" | "+client.servername;
    };
    
    self.notify = (update)=>{
        updates++;
        self.updateTitle();
        var settings = self.channelSettings[update.channel];
        if(settings && (settings["notify"] == "none"
                        || (settings["notify"] == "mention"
                            && (!update.text || update.text.search(client.username) == -1))))
            return false;
        if(cl.find("sound", self.notifyBy) && self.notifySound){
            self.notifySound.play();
        }
        if(cl.find("desktop", self.notifyBy) && window.Notification && Notification.permission === "granted"){
            if(cl.typep(update, "TEXT-UPDATE")){
                new Notification(title, {
                    body: update.from+": "+update.text,
                    icon: self.icon,
                    tag: "lichat"
                });
            }else if(cl.typep(update, "DATA") && cl.find(update["content-type"], ["image/gif", "image/jpeg", "image/png", "image/svg+xml"])){
                new Notification(title, {
                    image: "data:"+update["content-type"]+";base64,"+update["payload"],
                    icon: self.icon,
                    tag: "lichat"
                });
            }
        }
        return true;
    };

    self.requestNotifyPermissions = ()=>{
        if(Notification.permission === "granted"){
            return true;
        }else if(Notification.permission === "denied"){
            return false;
        }else{
            Notification.requestPermission((p)=>{});
            return null;
        }
    };

    document.addEventListener("visibilitychange", (ev)=>{
        if(document.hidden){
            updates = 0;
        }
        self.updateTitle();
    });

    client.addHandler("MESSAGE", (update)=>{
        if(document.hidden){
            self.notify(update);
        }
        update.html = self.formatUserText(update.text);
        self.showMessage(update);
    });

    client.addHandler("EDIT", (update)=>{
        if(document.hidden){
            self.notify(update);
        }
        update.html = self.formatUserText(update.text);
        self.editMessage(update);
    });

    client.addHandler("DATA", (update)=>{
        switch(update["content-type"]){
        case "image/gif":
        case "image/jpeg":
        case "image/png":
        case "image/svg+xml":
            var link = "data:"+update["content-type"]+";base64,"+update["payload"];
            update.html = "<img class=\"data\" alt=\""+update["filename"]+"\" title=\""+update["filename"]+"\" src=\""+link+"\" />";
            break;
        case "audio/wave":
        case "audio/wav":
        case "audio/x-wav":
        case "audio/x-pn-wav":
        case "audio/webm":
        case "audio/ogg":
        case "audio/mpeg":
        case "audio/mp3":
        case "audio/mp4":
        case "audio/flac":
            update.html = "<audio class=\"data\" controls><source src=\"data:"+update["content-type"]+";base64,"+update["payload"]+"\" type=\""+update["content-type"]+"\"></audio>";
            break;
        case "video/webm":
        case "video/ogg":
        case "video/mp4":
        case "application/ogg":
            update.html = "<video class=\"data\" controls><source src=\"data:"+update["content-type"]+";base64,"+update["payload"]+"\" type=\""+update["content-type"]+"\"></video>";
            break;
        default:
            update.html = "<div class=\"data unsupported\">Unsupported data of type "+update["content-type"]+"</div>";
        }
        if(document.hidden){
            self.notify(update);
        }
        self.showMessage(update);
    });

    client.addHandler("JOIN", (update)=>{
        if(update.from === client.username){
            self.addChannel(update.channel);
            self.changeChannel(update.channel);
            client.s("USERS", {channel: update.channel});
        }
        self.addUser(update.from, update.channel);
        update.text = " ** joined "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("LEAVE", (update)=>{
        if(update.from === client.username){
            self.removeChannel(update.channel);
        }
        self.removeUser(update.from, update.channel);
        update.text = " ** left "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("KICK", (update)=>{
        update.text = " ** kicked "+update.target;
        self.showMessage(update);
    });

    client.addHandler("USERS", (update)=>{
        var channel = self.channelElement(update.channel);
        channel.users = update.users;
        if(update.channel === self.channel){
            self.rebuildUserList();
        }
    });

    client.addHandler("CHANNELS", (update)=>{
        update.text = "Channels: "+update.channels.join(", ");
        self.showMessage(update);
    });

    client.addHandler("REGISTER", (update)=>{
        update.text = " ** the password has been updated.";
        self.showMessage(update);
    });

    client.addHandler("USER-INFO", (update)=>{
        update.text = " ** "+update.target+" is "+
            ((update.registered)
             ? ("registered with "+update.connections+" connections")
             : "not registered");
        self.showMessage(update);
    });

    client.addHandler("SET-CHANNEL-INFO", (update)=>{
        if(self.channel == update.channel.toLowerCase() && update.key == cl.kw("TOPIC") && topic){
            topic.innerHTML = self.replaceEmotes(self.linkifyURLs(self.escapeHTML(update.text)));
        }
    });

    client.addHandler("PAUSE", (update)=>{
        if(update.by <= 0)
            update.text = " ** Paused mode has been deactivated. You can now chat freely.";
        else
            update.text = " ** Paused mode has been activated. You may only message every "+update.by+" seconds.";
        self.showMessage(update);
    });

    client.addHandler("QUIET", (update)=>{
        update.text = " ** "+update.target+" has been quieted. Their messages will no longer be visible.";
        self.showMessage(udpate);
    });

    client.addHandler("UNQUIET", (update)=>{
        update.text = " ** "+update.target+" has been unquieted. Their messages will be visible again.";
        self.showMessage(udpate);
    });

    client.addHandler("FAILURE", (update)=>{
        self.showMessage(update);
    });

    client.addHandler("CAPABILITIES", (update)=>{
        update.text = " ** You can perform the following here: "+update.updates.map((s)=>s.name).join(", ");
        self.showMessage(update);
    });

    client.addHandler("DENY", (update)=>{
        update.text = " ** "+update.target+" has been denied from "+update.update.name+"ing.";
        self.showMessage(update);
    });

    client.addHandler("GRANT", (update)=>{
        update.text = " ** "+update.target+" has been allowed to "+update.update.name+".";
        self.showMessage(update);
    });

    client.addHandler("SET-USER-INFO", (update)=>{
        update.text = " ** "+update.key+" has been updated.";
        self.showMessage(update);
    });

    client.addHandler("UPDATE", (update)=>{
        // Some events are uninteresting, so they should be ignored entirely.
        if(!cl.find(cl.classOf(update).className,
                    ["PING", "PONG", "EMOTES", "EMOTE"])){
            if(!update.text) update.text = "Received update of type "+update.type;
            self.showMessage(update);
        }
    });

    self.addCommand("help", ()=>{
        var text = "Available commands:";
        for(var name in self.commands){
            text += "<br/><label class='command'>"+self.commandPrefix+name+"</label>"
                + (self.commands[name].documentation || "");
        }
        self.showMessage({html: text});
    }, "Show all available commands");

    self.addCommand("register", (...args)=>{
        password = args.join(" ");
        if(password.length<6)
            cl.error("PASSWORD-TOO-SHORT",{text: "Your password must be at least six characters long."});
        client.s("REGISTER", {password: password});
    }, "Register your username with a password.");

    self.addCommand("create", (...args)=>{
        name = args.join(" ");
        if(!name) name = null;
        client.s("CREATE", {channel: name});
    }, "Create a new channel. Not specifying a name will create an anonymous channel.");

    self.addCommand("join", (...args)=>{
        name = args.join(" ");
        if(!name) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of the channel to join."});
        if(self.channelExists(name)){
            self.changeChannel(name);
        }else{
            client.s("JOIN", {channel: name});
        }
    }, "Join an existing channel.");

    self.addCommand("leave", (...args)=>{
        name = args.join(" ");
        if(!name) name = self.channel;
        if(self.channelExists(name))
            client.s("LEAVE", {channel: name});
    }, "Leave a channel. Not specifying a name will leave the current channel.");

    self.addCommand("pull", (user, name)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to pull."});
        if(!name) name = self.channel;
        client.s("PULL", {channel:name, target:user});
    }, "Pull a user into a channel. Not specifying a name will leave the current channel.");

    self.addCommand("kick", (user, name)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to kick."});
        if(!name) name = self.channel;
        client.s("KICK", {channel:name, target:user});
    }, "Kick a user from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("kickban", (user, name)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to kick."});
        if(!name) name = self.channel;
        client.s("DENY", {channel: name, target: user, update: cl.li("JOIN")});
        client.s("KICK", {channel: name, target: user});
    }, "Kick and ban a user from a channel. Not specifying a name will leave the current channel.");
    
    self.addCommand("users", (...args)=>{
        name = args.join(" ");
        if(!name) name = self.channel;
        client.s("USERS", {channel:name});
    }, "Fetch a list of users from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("channels", ()=>{
        client.s("CHANNELS", {});
    }, "Fetch a list of public channels.");

    self.addCommand("info", (...args)=>{
        var target = args.join(" ");
        if(!target) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to query."});
        var el = self.popup({tag:"div", classes: ["info"]}).querySelector("div.info");
        var showField = (field, parent)=>{
            parent.appendChild(self.constructElement("div", {
                classes: ["row"],
                elements: [
                    {tag: "label", text: ""+field[0]},
                    {tag: "span", text: ""+field[1]}
                ]
            }));
        };
        client.s("USER-INFO", {target: target}, (u)=>{
            if(cl.typep(u, "USER-INFO")){
                for(var field of u.fields){
                    if(field != "id" && field != "clock" && field != "from" && field != "target" && field != "info"){
                        showField([field, u[field]], el);
                    }
                }
                for(var field of (u.info || [])){
                    if(field[0].name == "ICON"){
                        var parts = field[1].split(" ");
                        el.appendChild(self.constructElement("div", {
                            classes: ["row"],
                            elements: [
                                {tag: "label", text: "Icon"},
                                {tag: "img", classes: ["icon"], attributes: {src: "data:"+parts[0]+";base64,"+parts[1]}}
                            ]
                        }));
                    }else{
                        showField([(""+field[0]).toLowerCase(), field[1]], el);
                    }
                }
            }else{
                el.appendChild = "Failed to fetch user info.";
            }
        });
        client.s("SERVER-INFO", {target: target}, (u)=>{
            if(cl.typep(u, "SERVER-INFO")){
                for(field of u.attributes) showField(field, el);
                el.appendChild(self.constructElement("div", {
                    classes: ["row"],
                    elements: [
                        {tag: "label", text: "Connections"},
                        {tag: "div", classes: ["connections"]}
                    ]
                }));
                for(var connection of u.connections){
                    var conn = self.constructElement("div", {classes: ["connection"]});
                    el.querySelector(".connections").appendChild(conn);
                    for(field of connection) showField(field, conn);
                }
            }
        });
    }, "Fetch information about a user.");

    self.addCommand("message", (name, ...args)=>{
        if(!name) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a channel to message to."});;
        client.s("MESSAGE", {channel:name, text:args.join(" ")});
    }, "Send a message to a channel. Note that you must be in the channel to send to it.");

    self.addCommand("contact", (...users)=>{
        if(users.length === 0) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of at least one user to contact."});;
        var update = cl.makeInstance("CREATE",{from: client.username});
        client.addCallback(update.id, (update)=>{
            if(update.type === "JOIN"){
                for(var user of users){
                    client.s("PULL", {channel: update.channel, target: user});
                }
            }else{
                self.showError("Failed to create anonymous channel for contacting.");
            }
        });
        client.send(update);
    }, "Contact one or more users in an anonymous channel.");

    self.addCommand("clear", ()=>{
        if(output) output.innerHTML = "";
    }, "Clear all messages from the channel.");

    self.addCommand("emotes", ()=>{
        var emotes = Object.keys(client.emotes).sort((a,b)=>{return a.localeCompare(b);});
        var text = "Available emotes:";
        for(var emote in client.emotes){
            text += "<br/><label class='emote'>"+emote+"</label> "+client.emotes[emote];
        }
        self.showMessage({html: text});
    }, "Show the available emotes.");

    self.addCommand("topic", (...args)=>{
        text = args.join(" ");
        client.s("SET-CHANNEL-INFO", {channel: self.channel, key: cl.kw("TOPIC"), text: text});
    }, "Update the channel topic.");

    self.addCommand("pause", (seconds)=>{
        client.s("PAUSE", {channel: self.channel, by: parseInt(seconds)});
    }, "Change the channel's pause mode.");

    self.addCommand("quiet", (...args)=>{
        client.s("QUIET", {channel: self.channel, target: args.join(" ")});
    }, "Quiet another user in the current channel.");

    self.addCommand("unquiet", (...args)=>{
        client.s("UNQUIET", {channel: self.channel, target: args.join(" ")});
    }, "Unquiet another user in the current channel.");

    self.addCommand("kill", (...args)=>{
        client.s("KILL", {target: args.join(" ")});
    }, "Kill a user from the server.");

    self.addCommand("destroy", (...args)=>{
        client.s("DESTROY", {channel: args.join(" ")});
    }, "Destroy a channel from the server.");

    self.addCommand("ban", (...args)=>{
        client.s("BAN", {target: args.join(" ")});
    }, "Ban a username from the server.");

    self.addCommand("unban", (...args)=>{
        client.s("UNBAN", {target: args.join(" ")});
    }, "Unban a username from the server.");

    self.addCommand("ip-ban", (ip, mask)=>{
        client.s("IP-BAN", {ip: ip, mask: mask});
    }, "Ban an IP address from the server.");

    self.addCommand("ip-unban", (ip, mask)=>{
        client.s("IP-UNBAN", {ip: ip, mask: mask});
    }, "Unban an IP address from the server.");

    self.addCommand("capabilities", ()=>{
        client.s("CAPABILITIES", {channel: self.channel});
    }, "Request information on which capabilities you have in the current channel.");

    self.addCommand("grant", (update, ...target)=>{
        client.s("GRANT", {channel: self.channel, target: target.join(" "), update: cl.findSymbol(update, "LICHAT-PROTOCOL")});
    }, "Grant permission for an update to another user.");

    self.addCommand("deny", (update, ...target)=>{
        client.s("DENY", {channel: self.channel, target: target.join(" "), update: cl.findSymbol(update, "LICHAT-PROTOCOL")});
    }, "Deny permission for an update to another user.");

    self.addCommand("server-info", (...args)=>{
        client.s("SERVER-INFO", {target: args.join(" ")});
    }, "Request server information on another user.");

    self.addCommand("set", (key, ...text)=>{
        client.s("SET-USER-INFO", {key: LichatReader.fromString(key), text: text.join(" ")});
    }, "Set user information. By default the following keys are available: :birthday :contact :location :public-key :real-name :status");

    self.addCommand("away", ()=>{
        client.s("SET-USER-INFO", {key: cl.kw("STATUS"), text: "away"});
    }, "Set yourself as being away. You can return by using /status");

    self.addCommand("status", (...text)=>{
        client.s("SET-USER-INFO", {key: cl.kw("STATUS"), text: text.join(" ")});
    }, "Set your status to a new value.");

    self.initControls = ()=>{
        input.addEventListener("keydown", (ev)=>{
            if(ev.keyCode === 9){
                ev.preventDefault();
                self.autoCompleteInput();
                return false;
            }else{
                autoComplete.prefix = null;
            }
            if(ev.keyCode === 13){
                ev.preventDefault();
                if(!ev.ctrlKey || input.tagName.toLowerCase() === "input"){
                    self.processInput();
                }else{
                    input.value = input.value+"\n";
                }
                return false;
            }
            return true;
        });
    };

    self.initControls();

    return self;
};

// TODO: Finish channel context menu.
// TODO: Allow picking notification sounds
