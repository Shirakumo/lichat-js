// Special objects
var CL = function(){
    var self = this;
    var symbols = {};
    var classes = {};

    // Helper class to represent a Lichat symbol (pkg+name)
    var Symbol = function(name, pkg){
        var self = this;
        if(!name) throw "Cannot create symbol with empty name.";
        self.name = name.toLowerCase();
        self.pkg = pkg.toLowerCase();
        self.toString = ()=>{
            return self.name;
        };
        return self;
    };

    // Function to simulate serialised inheritance ala CLOS.
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
                throw new Error("Dependency cycle around "+name);
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

    // Another CLOS facsimile. Only really handles slots though, as our
    // update type "classes" only need to hold data.
    self.defclass = (name, directSuperclasses, initforms, constructor)=>{
        if(directSuperclasses.length === 0)
            directSuperclasses = ["object"];
        if(initforms === undefined) initforms = {};
        if(constructor === undefined) constructor=()=>{};
        directSuperclasses = directSuperclasses.map(self.findClass);
        if(typeof name == 'string'){
            self.intern(name, "lichat");
        }
        for(initarg in initforms){
            self.intern(initarg, "keyword");
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

        self.setClass(name, c);
        return name;
    };

    self.makeInstance = (name, ...args)=>{
        return Reflect.construct(self.findClass(name, true), args);
    };

    self.findClass = (name, error)=>{
        if(name instanceof Symbol)
            name = name.name;
        name = name.toLowerCase();
        let found = classes[name];
        if(found)
            return found;
        if(error)
            throw new Error("No such class "+name);
        return null;
    };

    self.classOf = (instance)=>{
        return self.findClass(instance.className);
    };

    self.setClass = (name, c)=>{
        if(name instanceof Symbol)
            name = name.name;
        
        name = name.toLowerCase();
        if(c)
            classes[name] = c;
        else
            delete classes[name];
    };

    self.requiredArg = (name)=>{
        return (e)=>{
            if(e[name] === undefined)
                throw new Error("Object "+e.type+" is missing the initarg "+name);
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
        }else if(type === "Symbol"){
            return self.symbolp(instance);
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
            symbol = new Symbol(name, pkg || "lichat-js");
            if(symbols[symbol.pkg] === undefined){
                symbols[symbol.pkg] = {};
            }
            symbols[symbol.pkg][symbol.name] = symbol;
        }
        return symbol;
    };

    self.findSymbol = (name, pkg)=>{
        var pkgspace = symbols[pkg? pkg.toLowerCase(): "lichat-js"];
        if(pkgspace === undefined) return null;
        var symbol = pkgspace[name.toLowerCase()];
        if(symbol === undefined) return null;
        return symbol;
    };

    self.kw = (name)=>{
        return self.intern(name, "keyword");
    };

    self.symbolp = (thing)=>{
        return thing.constructor === Symbol;
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

    self.unixToUniversal = (unix)=>{
        return unix+self.universalUnixOffset;
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

    self.base64toBlob = (base64Data, contentType)=>{
        contentType = contentType || '';
        var sliceSize = 1024;
        var byteCharacters = atob(base64Data);
        var bytesLength = byteCharacters.length;
        var slicesCount = Math.ceil(bytesLength / sliceSize);
        var byteArrays = new Array(slicesCount);

        for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
            var begin = sliceIndex * sliceSize;
            var end = Math.min(begin + sliceSize, bytesLength);

            var bytes = new Array(end - begin);
            for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
                bytes[i] = byteCharacters[offset].charCodeAt(0);
            }
            byteArrays[sliceIndex] = new Uint8Array(bytes);
        }
        return new Blob(byteArrays, { type: contentType });
    };

    self.base64URLtoBlob = (url)=>{
        let matches = url.match(/^data:([^;]+);(base64,)?(.*)$/);
        if(matches) return self.base64toBlob(matches[3], matches[1]);
        matches = url.match(/^([^ ]+) (.*)$/);
        if(matches) return self.base64toBlob(matches[2], matches[1]);
        return null;
    };

    self.T = self.intern("T", "LICHAT");
    self.NIL = self.intern("NIL", "LICHAT");

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
cl.setClass("object", StandardObject);
StandardObject.className = cl.intern("object", "lichat");
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
    if(cl.symbolp(key)){
        varname = key.name.toLowerCase();
    }else{
        varname = key.toString();
    }
    self[varname] = val;
    cl.pushnew(varname, self.fields);
    return val;
};

cl.StandardObject = StandardObject;

if(typeof module !== 'undefined')
    module.exports = cl;
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
            throw new Error("END-OF-STREAM");
        }
        return null;
    };

    self.unreadChar = ()=>{
        if(0 < i){
            i--;
        }else{
            throw new Error("BEGINNING-OF-STREAM");
        }
    };

    self.peekChar = (errorp)=>{
        if(errorp === undefined)errorp = true;
        if(i < self.string.length){
            return self.string[i];
        }else if(errorp){
            throw new Error("END-OF-STREAM");
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

if(typeof module !== 'undefined')
    module.exports = LichatStream;
//// AUTOGENERATED// This file has been auto-generated from Lichat protocol spec files.// To update it, please run regen.js: node regen.jsvar LichatExtensions = ['shirakumo-backfill','shirakumo-data','shirakumo-emote','shirakumo-edit','shirakumo-channel-trees','shirakumo-channel-info','shirakumo-server-management','shirakumo-pause','shirakumo-quiet','shirakumo-ip','shirakumo-bridge','shirakumo-link','shirakumo-markup','shirakumo-user-info','shirakumo-shared-identity','shirakumo-sign','shirakumo-history','shirakumo-block','shirakumo-reactions','shirakumo-replies','shirakumo-last-read','shirakumo-typing','shirakumo-otp'];
(()=>{ let s = cl.intern;
cl.defclass(s('update','lichat'), [s('object','lichat')], {
   'id': cl.requiredArg('id'),
   'clock': null,
   'from': null,
   'signature': null,
});
cl.defclass(s('ping','lichat'), [s('update','lichat')]);
cl.defclass(s('pong','lichat'), [s('update','lichat')]);
cl.defclass(s('connect','lichat'), [s('update','lichat')], {
   'password': null,
   'version': cl.requiredArg('version'),
   'extensions': cl.requiredArg('extensions'),
   'otp-token': null,
});
cl.defclass(s('disconnect','lichat'), [s('update','lichat')]);
cl.defclass(s('register','lichat'), [s('update','lichat')], {
   'password': cl.requiredArg('password'),
   'otp-key': null,
});
cl.defclass(s('channel-update','lichat'), [s('update','lichat')], {
   'channel': cl.requiredArg('channel'),
   'bridge': null,
});
cl.defclass(s('target-update','lichat'), [s('update','lichat')], {
   'target': cl.requiredArg('target'),
});
cl.defclass(s('text-update','lichat'), [s('update','lichat')], {
   'text': cl.requiredArg('text'),
   'rich': null,
});
cl.defclass(s('join','lichat'), [s('channel-update','lichat')]);
cl.defclass(s('leave','lichat'), [s('channel-update','lichat')]);
cl.defclass(s('message','lichat'), [s('channel-update','lichat'),s('text-update','lichat')], {
   'link': null,
   'reply-to': null,
});
cl.defclass(s('create','lichat'), [s('update','lichat')], {
   'channel': null,
});
cl.defclass(s('kick','lichat'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('pull','lichat'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('permissions','lichat'), [s('channel-update','lichat')], {
   'permissions': null,
});
cl.defclass(s('grant','lichat'), [s('channel-update','lichat'),s('target-update','lichat')], {
   'update': cl.requiredArg('update'),
});
cl.defclass(s('deny','lichat'), [s('channel-update','lichat'),s('target-update','lichat')], {
   'update': cl.requiredArg('update'),
});
cl.defclass(s('users','lichat'), [s('channel-update','lichat')], {
   'users': null,
});
cl.defclass(s('channels','lichat'), [s('channel-update','lichat')], {
   'channels': null,
   'channel': null,
});
cl.defclass(s('user-info','lichat'), [s('target-update','lichat')], {
   'registered': null,
   'connections': null,
   'info': null,
});
cl.defclass(s('capabilities','lichat'), [s('channel-update','lichat')], {
   'permitted': null,
});
cl.defclass(s('server-info','lichat'), [s('target-update','lichat')], {
   'attributes': cl.requiredArg('attributes'),
   'connections': cl.requiredArg('connections'),
});
cl.defclass(s('failure','lichat'), [s('text-update','lichat')]);
cl.defclass(s('malformed-update','lichat'), [s('failure','lichat')]);
cl.defclass(s('update-too-long','lichat'), [s('failure','lichat')]);
cl.defclass(s('connection-unstable','lichat'), [s('failure','lichat')]);
cl.defclass(s('too-many-connections','lichat'), [s('failure','lichat')]);
cl.defclass(s('update-failure','lichat'), [s('failure','lichat')], {
   'update-id': cl.requiredArg('update-id'),
});
cl.defclass(s('invalid-update','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('already-connected','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('username-mismatch','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('incompatible-version','lichat'), [s('update-failure','lichat')], {
   'compatible-versions': cl.requiredArg('compatible-versions'),
});
cl.defclass(s('invalid-password','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-profile','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('username-taken','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-channel','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('registration-rejected','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('already-in-channel','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('not-in-channel','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('channelname-taken','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('too-many-channels','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('bad-name','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('insufficient-permissions','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('invalid-permissions','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-user','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('too-many-updates','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('clock-skewed','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('warning','lichat'), [s('text-update','lichat')], {
   'update-id': cl.requiredArg('update-id'),
});
cl.defclass(s('updates-throttled','lichat'), [s('warning','lichat')]);
cl.defclass(s('backfill','shirakumo'), [s('channel-update','lichat')], {
   'since': null,
});
cl.defclass(s('data','shirakumo'), [s('channel-update','lichat')], {
   'content-type': cl.requiredArg('content-type'),
   'filename': null,
   'payload': cl.requiredArg('payload'),
});
cl.defclass(s('bad-content-type','shirakumo'), [s('update-failure','lichat')], {
   'allowed-content-types': cl.requiredArg('allowed-content-types'),
});
cl.defclass(s('emotes','shirakumo'), [s('channel-update','lichat')], {
   'names': null,
});
cl.defclass(s('emote','shirakumo'), [s('channel-update','lichat')], {
   'content-type': cl.requiredArg('content-type'),
   'name': cl.requiredArg('name'),
   'payload': cl.requiredArg('payload'),
});
cl.defclass(s('emote-list-full','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('edit','shirakumo'), [s('message','lichat')]);
cl.defclass(s('no-such-parent-channel','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('channel-info','shirakumo'), [s('channel-update','lichat')], {
   'keys': cl.requiredArg('keys'),
});
cl.defclass(s('set-channel-info','shirakumo'), [s('channel-update','lichat'),s('text-update','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('no-such-channel-info','shirakumo'), [s('update-failure','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('malformed-channel-info','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('kill','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('destroy','shirakumo'), [s('channel-update','lichat')]);
cl.defclass(s('ban','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('unban','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('blacklist','shirakumo'), [s('update','lichat')], {
   'target': null,
});
cl.defclass(s('pause','shirakumo'), [s('channel-update','lichat')], {
   'by': cl.requiredArg('by'),
});
cl.defclass(s('quiet','shirakumo'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('unquiet','shirakumo'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('quieted','shirakumo'), [s('channel-update','lichat')], {
   'target': null,
});
cl.defclass(s('ip-ban','shirakumo'), [s('update','lichat')], {
   'ip': cl.requiredArg('ip'),
   'mask': cl.requiredArg('mask'),
});
cl.defclass(s('ip-unban','shirakumo'), [s('update','lichat')], {
   'ip': cl.requiredArg('ip'),
   'mask': cl.requiredArg('mask'),
});
cl.defclass(s('ip-blacklist','shirakumo'), [s('update','lichat')], {
   'target': null,
});
cl.defclass(s('bad-ip-format','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('bridge','shirakumo'), [s('channel-update','lichat')]);
cl.defclass(s('set-user-info','shirakumo'), [s('text-update','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('malformed-user-info','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-user-info','shirakumo'), [s('update-failure','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('share-identity','shirakumo'), [s('update','lichat')], {
   'key': null,
});
cl.defclass(s('unshare-identity','shirakumo'), [s('update','lichat')], {
   'key': null,
});
cl.defclass(s('list-shared-identities','shirakumo'), [s('update','lichat')], {
   'identities': null,
});
cl.defclass(s('assume-identity','shirakumo'), [s('target-update','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('search','shirakumo'), [s('channel-update','lichat')], {
   'results': null,
   'offset': null,
   'query': null,
});
cl.defclass(s('block','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('unblock','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('blocked','shirakumo'), [s('update','lichat')], {
   'target': null,
});
cl.defclass(s('react','shirakumo'), [s('channel-update','lichat')], {
   'target': cl.requiredArg('target'),
   'update-id': cl.requiredArg('update-id'),
   'emote': cl.requiredArg('emote'),
});
cl.defclass(s('last-read','shirakumo'), [s('channel-update','lichat')], {
   'target': null,
   'update-id': null,
});
cl.defclass(s('typing','shirakumo'), [s('channel-update','lichat')]);
cl.defclass(s('invalid-otp-key','shirakumo'), [s('update-failure','lichat')]);
})();
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
        case "shirakumo":
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
// Class encapsulating a reaction, which is either an emoji or a Lichat emote
// combined with a list of users that used this reaction. Used to keep track
// of reactions to messages.
class LichatReaction{
    constructor(update, channel){
        this.text = update.emote;
        // This regex detects valid unicode emoji strings.
        let emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;
        if(!emojiRegex.test(update.emote)){
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
// Representation of a user on a lichat connection.
// Note that the same user will still have separate LichatUser instances across multiple
// clients/connections.
class LichatUser{
    constructor(data, client){
        if(typeof data === 'string')
            data = {name: data};

        // The user's chosen name (case preserved)
        this._name = data.name;
        this._client = client;

        // Local nickname of the user, in case the client would like to display a different
        // name than what is used in actual updates.
        this.nickname = data.nickname || data.name;

        // Info fields supported through the shirakumo-user-info extension. Keys are
        // printed representations of symbols.
        this.info = data.info || {
            ":birthday": "",
            ":contact": "",
            ":location": "",
            ":public-key": "",
            ":real-name": "",
            ":status": "",
            ":icon": ""
        };
    }

    // Returns a globally unique identifier for the given user.
    get gid(){
        return this._client.servername+"  "+this._name;
    }

    get name(){
        return this._name;
    }

    // Returns an URL that can be used for the user's icon.
    get icon(){
        let icon = this.info[":icon"];
        if(!icon) return EmptyIcon;
        else      return icon.url;
    }

    get client(){
        return this._client;
    }

    // Returns a CSS colour string to be used for the user.
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

    // Returns true if the user is known to be connected at the moment.
    get isPresent(){
        return this.isInChannel(this._client.servername);
    }

    // Returns true if the user is from the current client's own connection.
    get isSelf(){
        return this._client.username.localeCompare(this._name, undefined, { sensitivity: 'accent' }) === 0;
    }

    // Returns true if the user is the server administrative account.
    get isServer(){
        return this._client.servername.localeCompare(this._name, undefined, { sensitivity: 'accent' }) === 0;;
    }

    // Returns true if the user has been blocked and thus their messages should not be shown.
    get isBlocked(){
        // FIXME: implement
        return false;
    }

    // Returns true if the user has been banned and thus they should not be able to connect.
    get isBanned(){
        // FIXME: implement
        return false;
    }

    // Returns true if the user has been shadow-banned in the given channel.
    isQuieted(channel){
        if(typeof(channel) === "string") channel = this._client.getChannel(channel);
        return channel.isQuieted(this);
    }

    // Returns true if the ser is currently present in the given channel.
    isInChannel(channel){
        if(typeof(channel) === "string") channel = this._client.getChannel(channel);
        return channel.hasUser(this);
    }

    // Convenience function to send an update with the target set to this user.
    s(type, args, noPromise){
        args = args || {};
        args.target = this.name;
        return this._client.s(type, args, noPromise);
    }
}
// Representation of a channel on a particular client/connection.
class LichatChannel{
    constructor(data, client){
        if(typeof data === 'string')
            data = {name: data};
        
        this._name = data.name;
        this._client = client;

        // Whether the client used to be joined to this channel
        // Used to determine whether to re-join the channel on reconnect.
        this.wasJoined = data.wasJoined || false;

        // Map of *present* LichatUser objects representing them.
        // Index is a downcased version of their name.
        this.users = {};

        // Map of emotes specific to this channel.
        // An emote is an object with fields blob and url. The former being
        // the basic binary blob of the emote data, and the url being a
        // usable URL of the image for use in img tags.
        // The keys are the actual emote names without colons.
        this.emotes = data.emotes || {};

        // Info fields supported through the shirakumo-channel-info extension.
        // Keys are printed representations of symbols.
        this.info = data.info || {
            ":news": "",
            ":topic": "",
            ":rules": "",
            ":contact": "",
            ":icon": ""
        };

        // Map of known messages in the channel. Values are LichatMessages,
        // keys are their GIDs.
        this.messages = {};

        // Chronological list of all the messages from oldest to newest.
        this.messageList = [];

        // Whether there are any users currently typing in this channel.
        this.hasTypers = false;

        // JS timer ID to keep track of typing indicator
        this._typingTimeout = null;

        // Map of currently typing users for tracking.
        this._typingUsers = new Map();

        // List of updates that are known to be permitted to be sent in
        // the channel. If NULL, set is unknown.
        this._capabilities = null;

        // Set of users known to be quieted in the channel.
        this._quieted = new WeakSet();

        // KLUDGE: need this to stop Vue from being Weird As Fuck.
        Object.defineProperty(this.emotes, 'nested', { configurable: false });
        Object.defineProperty(this.messages, 'nested', { configurable: false });

        // KLUDGE: spillage from ui
        // Used to keep track of the current message that the user is composing
        // and in particular the replyTo message reference.
        this.currentMessage = {text: "", replyTo: null};
        this.currentMessage.clear = ()=>{
            this.currentMessage.text = "";
            this.currentMessage.replyTo = null;
        };

        // Used to keep track of actually visible messages, which should be a window
        // of all messages in order to keep the browser from exploding.
        this.uiMessageList = [];

        // Counter for number of unread messages in the channel.
        this.unread = 0;

        // Whether there have been any messages that were alerts that haven't been seen.
        this.alerted = false;

        // Reference to the message that was last marked as having been read.
        // This can be synced through the shirakumo-last-read extension.
        this.lastRead = data.lastRead || null;

        // The level of notifications on this channel. Should be one of:
        // - none     --- Do not notify at all
        // - all      --- Notify on any message whatsoever
        // - mentions --- Notify only on messages mentioning the current user
        // - inherit  --- Inherit notification level from client's global setting
        this.notificationLevel = data.notificationLevel || this.isPrimary? 'none' : 'inherit';

        let lastSlash = this._name.lastIndexOf('/');
        // Keeps track of the parent channel's name, should this be a child channel.
        if(lastSlash === -1)
            this._parentChannelName = null;
        else
            this._parentChannelName = this._name.slice(0, lastSlash);
    }

    // Globally unique string identifying this channel.
    get gid(){
        return this._client.servername+"  "+this._name;
    }

    get name(){
        return this._name;
    }

    get client(){
        return this._client;
    }

    // Returns true if the user is currently in this channel.
    get isPresent(){
        return this.users[this._client.username.toLowerCase()] !== undefined;
    }

    // Returns true if the channel is the administrative channel for the server.
    get isPrimary(){
        return this._name == this._client.servername;
    }

    // Returns true if the channel is anonymous and thus transitive.
    get isAnonymous(){
        return this._name[0] === '@';
    }

    // Returns the parent LichatChannel object that this channel should
    // inherit from.
    get parentChannel(){
        let name = this._parentChannelName;
        if(name === null)
            return this._client.primaryChannel;
        else
            return this._client.getChannel(name);
    }

    // Returns the icon URL for the channel for use in img tags.
    get icon(){
        let icon = this.info[":icon"];
        if(!icon) return EmptyIcon;
        else      return icon.url;
    }

    // Returns the channel's topic string.
    get topic(){
        return this.info[":topic"];
    }

    // Returns the set of update types that the user can send on this channel.
    // If unknown, will fetch the capabilities list and tentatively return the empty list.
    // You should use LichatChannel.isPermitted instead of manually checking this list.
    get capabilities(){
        if(this._capabilities == null){
            this._capabilities = [];
            this.s("capabilities", {})
                .catch((e)=>{
                    this._capabilities = null;
                    if(cl.typep(e, "too-many-updates"))
                        setTimeout(this.capabilities, 1000);
                });
        }
        return this._capabilities;
    }

    set capabilities(value){
        this._capabilities = value.sort();
    }

    // Returns the list of LichatUsers currently known to be typing in this channel.
    get typingUsers(){
        let currentClock = cl.getUniversalTime();
        let users = [];
        for(const [user, clock] of this._typingUsers){
            if(currentClock - clock < 5)
                users.push(user);
            else
                delete this._typingUsers.delete(user);
        }
        this.hasTypers = 0 < users.length;
        return users;
    }

    // Returns the emote object of the given name, if known.
    getEmote(name){
        let own = this.emotes[name.toLowerCase().replace(/^:|:$/g,"")];
        if(own) return own.url;
        if(!this.isPrimary) return this.parentChannel.getEmote(name);
        return null;
    }

    // Returns the list of all emotes available in this channel, including
    // emotes inherited from parent channels.
    getEmoteList(list){
        let emotes = list || [];
        for(let emote in this.emotes) emotes.push(emote);
        if(!this.isPrimary){
            this.parentChannel.getEmoteList(emotes);
        }
        return emotes.sort();
    }

    // Adds the given user to the list of present users in the channel.
    joinUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.name === this._client.username) this.wasJoined = true;
        this.users[user.name.toLowerCase()] = user;
        return user;
    }

    // Removes the given user from the list of present users in the channel.
    leaveUser(user){
        if(typeof(user) === "string") user = this._client.getUser(user);
        if(user.isSelf){
            this.wasJoined = false;
            this.users = {};
        }else{
            delete this.users[user.name.toLowerCase()];
        }
        return user;
    }

    // Returns true if the given user is present in the channel.
    hasUser(user){
        if(user instanceof LichatUser) user = user.name;
        return this.users[user.toLowerCase()] !== undefined;
    }

    // Returns the user object of the given name.
    getUser(name){
        return this._client.getUser(name);
    }

    // Returns a list of usernames of users currently present.
    getUserList(){
        return Object.keys(this.users);
    }

    clearUsers(){
        this.users = {};
    }

    // Returns true if the given user is shadow-banned in the channel.
    isQuieted(user){
        return this._quieted.has(user);
    }

    // Set the user as having been typing at the given time.
    setTyping(user, clock){
        if(user.isSelf) return;
        this.hasTypers = true;
        this._typingUsers.set(user, clock);
        
        if(this._typingTimeout !== null)
            clearTimeout(this._typingTimeout);
        this._typingTimeout = setTimeout(()=>{
            this._typingTimeout = null;
            console.log(this.typingUsers);
        }, 5000);
    }

    // Convenience to send an update with the channel field set.
    s(type, args, noPromise){
        args = args || {};
        args.channel = this.name;
        return this._client.s(type, args, noPromise);
    }

    // Record the message in the channel's history.
    // Returns a list of:
    // - The LichatMessage object representing the message
    // - Whether the message was already in the history or not
    record(message){
        if(!(message instanceof LichatMessage))
            message = new LichatMessage(message, this);
        let existing = this.messages[message.gid];
        this.messages[message.gid] = message;
        if(existing){
            Object.assign(existing, message);
        }else{
            LichatChannel._insertMessageSorted(message, this.messageList);
        }
        return [message, existing?false:true];
    }

    // Returns the LichatMessage object identified by the from/id pair, if any.
    getMessage(from, id){
        let gid = LichatMessage.makeGid(this, from, id);
        return this.messages[gid];
    }

    // Removes the given message from the channel's history.
    deleteMessage(message){
        delete this.messages[message.gid];
        let index = this.messageList.indexOf(message);
        if(index !== -1) this.messageList.splice(index, 1);
    }

    // Convenience function to show a local status text in the channel.
    showStatus(text, options){
        options = options || {};
        options.system = true;
        let message = new LichatMessage({
            id: this._client.nextID(),
            from: "System",
            clock: cl.getUniversalTime(),
            text: text,
            type: "message"
        }, this, options);
        this.messageList.push(message);
        return message;
    }

    // Convenience function to show an error message in the channel.
    showError(error, prefix){
        console.error(error);
        let message = prefix || 'Error';
        if(cl.typep(error, 'failure'))
            message += ": "+error.text;
        else if(error instanceof Error)
            message += ": "+error.message;
        else if(error instanceof DOMException)
            message += ": "+error.message;
        else if(typeof error === 'string')
            message += ": "+error;
        return this.showStatus(message);
    }

    // Returns true if it is known that the user is permitted to send
    // updates of the given type to this channel. If this returns
    // false, should probably not send the message, as it will most
    // likely fail with a permission denied.
    isPermitted(update){
        if(typeof update === 'string' || update instanceof String)
            update = cl.intern(update, "lichat");
        let caps = this.capabilities;
        if(caps == []) return true; // Default to true. The server will deny later anyway.
        return this.capabilities.includes(update);
    }

    // Records the given emote update in the channel's list of known
    // emotes. This also handles emote deletions or updates correctly.
    addEmote(update){
        let name = update.name.toLowerCase().replace(/^:|:$/g,"");
        if(update.payload){
            let emote = this.emotes[name];
            if(emote) URL.revokeObjectURL(emote.url);
            else emote = {};
            emote.blob = cl.base64toBlob(update.payload, update["content-type"]);
            emote.url = URL.createObjectURL(emote.blob);
            this.emotes[name] = emote;
            return emote;
        }else{
            delete this.emotes[name];
            return null;
        }
    }
}

// Convenience function to insert a message in the correct position in the given list,
// taking into account timestamp ordering and out of order insertions.
LichatChannel._insertMessageSorted = (message, list)=>{
    if(list.length == 0 || list[list.length-1].timestamp <= message.timestamp){
        list.push(message);
    }else{
        // Perform binary search insert according to clock
        let start = 0;
        let end = list.length-1;
        let stamp = message.timestamp;
        while(start<=end){
            let mid = Math.floor((start + end)/2);
            let cmp = list[mid].timestamp;
            if(stamp <= cmp &&
               (mid == 0 || list[mid-1].timestamp <= stamp)){
                list.splice(start, 0, message);
                break;
            }
            if(cmp < stamp) start = mid + 1;
            else            end = mid - 1;
        }
    }
};
// Class encapsulating a Lichat message within a channel.
class LichatMessage{
    constructor(update, channel, options){
        options = options || {};
        // Local id from the update itself
        this.id = update.id;

        // Name of the user that sent the message
        this.from = update.from;

        // The actual user object from which the message came
        this.author = channel.client.getUser(update.bridge || update.from);

        // The channel object in which the message was sent
        this.channel = channel;

        // List of LichatReaction objects tied to the message.
        this.reactions = [];

        // Plaintext representation of the massage without markup.
        this.text = update.text || "";

        // Rich text representation of the message. This will have parsed URLs and emote images and so on.
        this.html = (options.html)? this.text: this.markupText(this.text);

        // Whether the message is a system message. If true, the message was faked locally.
        this.isSystem = options.system;

        // A "globally unique ID" that should identify the message across all channels and clients.
        this.gid = options.gid || LichatMessage.makeGid(channel, update.from, update.id);

        // A link to the message within the client.
        this.url = document.location.href.match(/(^[^#]*)/)[0]+"#"+this.gid;

        // The Unix timestamp of when the message was sent.
        this.timestamp = cl.universalToUnix(update.clock);

        // A JS Date object of when the message was sent.
        this.clock = new Date(this.timestamp*1000);

        // The originating update type as a simple string.
        this.type = update.type.name;

        // What content this message contains as a mime-type.
        // For embeds, this can be something like image/png.
        this.contentType = update.link || "text/plain";

        // The message type this message is in reply to, if any.
        if(update["reply-to"])
            this.replyTo = channel.getMessage(update["reply-to"][0], update["reply-to"][1]);
        else
            this.replyTo = null;
    }

    get client(){
        return this.channel.client;
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

    // Whether this message should be considered an alert for the user.
    get isAlert(){
        let pattern = this.client.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp(pattern, "gi").test(this.text);
    }

    // Whether the message actually came from a real update or not.
    get isVirtual(){
        return this.id === undefined;
    }

    // Whether the message came from a user using the shirakumo-bridged extension to send
    // a message on behalf of another user or not. In that case, should display the message
    // specially to indicate the spoof-iness to the user.
    get isBridged(){
        return this.author.name == this.from;
    }

    // Shortened version of the message for use in blurbs, notification popups, etc.
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

    // Process a new reaction update on the message and update the internal reactions
    // bookkeeping logic. Returns the recation objcet that represents the update.
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

// Constructs a string identifying the message in a globally unique way.
LichatMessage.makeGid = (channel, author, id)=>{
    return channel.client.servername+"  "+channel.name+"  "+author.toLowerCase()+"  "+id;
};
// Define some defaults that apply globally.
var LichatVersion = "2.0";
var LichatDefaultPort = 1113;
var LichatDefaultSSLPort = 1114;
var LichatDefaultClient = {
    name: "TyNET",
    username: "",
    password: "",
    aliases: [],
    hostname: "chat.tymoon.eu",
    port: LichatDefaultSSLPort,
    ssl: true
};
var EmptyIcon = URL.createObjectURL(cl.base64toBlob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "image/png"));

// Representation of a connection to a Lichat server.
class LichatClient{
    constructor(options){
        options = options || {};
        // The name of the client. Only used for local representation.
        this.name = options.name || "Lichat";

        // The name the user uses to connect and send messages with.
        this.username = options.username || "";
        this.password = options.password || null;
        this.hostname = options.hostname || "localhost";
        this.port = options.port || (options.ssl? LichatDefaultSSLPort: LichatDefaultPort);

        // Whether we're connecting via SSL or not.
        this.ssl = options.ssl || (options.port == LichatDefaultSSLPort);

        // Function to be called when a disconnect happens.
        this.disconnectHandler = ()=>{};

        // The actual name of the server. This is not the same as the hostname.
        this.servername = null;

        // How long to wait until a ping message is sent.
        this.pingDelay = 15000;

        // How many times we've tried to ping.
        this._pingAttempts = 0;

        // How many times to try and send a ping before we force a disconnect.
        this.pingAttempts = 5;

        // Map of channel names to LichatChannel instances.
        this.channels = {};

        // Map of user names to LichatUser instances.
        this.users = {};

        // List of extensions supported by this client.
        this.supportedExtensions = ["shirakumo-data", "shirakumo-backfill", "shirakumo-emotes",
                                    "shirakumo-channel-info", "shirakumo-quiet", "shirakumo-pause",
                                    "shirakumo-server-management", "shirakumo-ip", "shirakumo-user-info",
                                    "shirakumo-icon", "shirakumo-bridge", "shirakumo-block",
                                    "shirakumo-reactions", "shirakumo-link", "shirakumo-typing",
                                    "shirakmuo-history"];
        this.supportedExtensions = this.supportedExtensions.filter((extension)=>
            !(options.disabledExtensions || []).includes(extension));

        // List of extensions actually available (determined after connection).
        this.availableExtensions = ["shirakumo-icon"];

        // WebSocket object used for communication
        this._socket = null;

        // Map of update types to handler functions. These are for users.
        this._handlers = {};

        // Map of update types to handler functions. These are for our internal use.
        this._internalHandlers = {};

        // Map of update IDs to callback handler functions.
        this._idCallbacks = {};

        //  Reader/Writer objects for the wire protocol.
        this._reader = new LichatReader();
        this._printer = new LichatPrinter();

        // ID of the JS timer used to handle ping timeouts.
        this._pingTimer = null;

        // Tracker for how many reconnections there's been.
        this._reconnectAttempts = 0;

        // Counter for the next ID to use when sending updates.
        this._IDCounter = Math.floor(Math.random()*(+new Date()));

        // Reconstruct channels from options passed.
        for(let data of options.channels || []){
            let channel = new LichatChannel(data, this);
            this.channels[channel.name.toLowerCase()] = channel;
        }

        // Reconstruct users from options passed.
        for(let data of options.users || []){
            let user = new LichatUser(data, this);
            this.users[user.name.toLowerCase()] = user;
        }

        // Define internal message handlers to perform necessary plumbing.
        this.addInternalHandler("connect", (ev)=>{
            this.availableExtensions = ev.extensions.filter((extension)=>this.supportedExtensions.includes(extension));
        });

        this.addInternalHandler("ping", (ev)=>{
            this.s("pong", {}, true);
        });

        this.addInternalHandler("pong", (ev)=>{
        });

        this.addInternalHandler("join", (ev)=>{
            // If we don't know the server name yet this is the first join message
            // and thus must be the primary channel according to protocol.
            if(!this.servername)
                this.servername = ev.channel;
            let channel = this.getChannel(ev.channel);
            channel.joinUser(ev.from);
            // If we've joined, there's a few plumbing requests we want to make.
            if(ev.from === this.username){
                if(channel.isPrimary){
                    // If we've now joined the primary channel, send join requests for all
                    // channels we were previously or are currently joined to.
                    // We delay this by a bit to allow other stuff to populate.
                    setTimeout(()=>{
                        if(!this.isConnected) return;
                        for(let name in this.channels){
                            let channel = this.channels[name];
                            if(channel.wasJoined && !channel.isPresent)
                                channel.s("join", {}, true);
                        }
                    }, 500);
                }
                // Refresh info, as it might have changed in our absence.
                channel.s("users", {}, true);
                if(this.isAvailable("shirakumo-channel-info"))
                    channel.s("channel-info", {keys: true}, true);
                if(this.isAvailable("shirakumo-emotes"))
                    channel.s("emotes", {names: channel.getEmoteList()}, true);
            }
        });

        this.addInternalHandler("leave", (ev)=>{
            let channel = this.getChannel(ev.channel);
            channel.leaveUser(ev.from);
        });

        this.addInternalHandler("emote", (ev)=>{
            this.addEmote(ev);
        });

        // Convenience function to handle the special case of the icon update,
        // which we need to translate to an icon object.
        let handleIconInfo = (info, ev)=>{
            if(ev.key !== cl.kw('icon')) return null;

            let key = LichatPrinter.toString(ev.key);
            if(info[key]) URL.revokeObjectURL(info[key].url);
            
            let data = ev.text.split(" ");
            let blob = cl.base64toBlob(data[1], data[0]);
            info[key] = {
                blob: blob,
                url: URL.createObjectURL(blob)
            };
            return info[key];
        };

        this.addInternalHandler("set-channel-info", (ev)=>{
            if(!handleIconInfo(this.getChannel(ev.channel).info, ev))
                this.getChannel(ev.channel).info[LichatPrinter.toString(ev.key)] = ev.text;
        });

        this.addInternalHandler("set-user-info", (ev)=>{
            let target = ev.target || this.username;
            if(!handleIconInfo(this.getUser(target).info, ev))
                this.getUser(target).info[LichatPrinter.toString(ev.key)] = ev.text;
        });

        this.addInternalHandler("user-info", (ev)=>{
            let user = this.getUser(ev.target || this.username);
            for(let entry of ev.info){
                user.info[LichatPrinter.toString(entry[0])] = entry[1];
            }
        });

        this.addInternalHandler("message", (ev)=>{
            this.getChannel(ev.channel).record(ev);
        });

        this.addInternalHandler("edit", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.from, ev.id);
            if(message) message.text = ev.text;
            else console.warn("Received react with no message", ev.target, ev["update-id"]);
        });

        this.addInternalHandler("react", (ev)=>{
            let message = this.getChannel(ev.channel).getMessage(ev.target, ev["update-id"]);
            if(message) message.addReaction(ev);
            else console.warn("Received react with no message", ev.target, ev["update-id"]);
        });

        this.addInternalHandler("capabilities", (ev)=>{
            this.getChannel(ev.channel).capabilities = ev.permitted;
        });

        this.addInternalHandler("users", (ev)=>{
            for(let name of ev.users){
                this.getChannel(ev.channel).users[name.toLowerCase()] = this.getUser(name);
            }
        });

        this.addInternalHandler("typing", (ev)=>{
            this.getChannel(ev.channel).setTyping(this.getUser(ev.from), ev.clock);
        });

        this.addInternalHandler("quiet", (ev)=>{
            this.getChannel(ev.channel)._quieted.add(this.getUser(ev.target));
        });
        
        this.addInternalHandler("unquiet", (ev)=>{
            this.getChannel(ev.channel)._quieted.delete(this.getUser(ev.target));
        });
        
        this.addInternalHandler("quieted", (ev)=>{
            let set = new WeakSet();
            for(let username in ev.target)
                set.add(this.getUser(username));
            this.getChannel(ev.channel)._quieted = set;
        });
    }

    // Used to perform a manual reconnect.
    reconnect(){
        try{
            this.clearReconnect();
            this.openConnection()
                .catch(()=>this.scheduleReconnect());
        }catch(e){
            this.scheduleReconnect();
        }
    }

    // Schedules another reconnect after an increasing delay.
    scheduleReconnect(){
        this._reconnectAttempts++;
        let secs = Math.min(600, Math.pow(2, this._reconnectAttempts));
        this._reconnecter = setTimeout(()=>this.reconnect(), secs*1000);
    }

    // Cancel reconnection attempts
    clearReconnect(){
        if(this._reconnecter){
            clearTimeout(this._reconnecter);
            this._reconnecter = null;
            this._reconnectAttempts = 0;
        }
    }

    // Handle the WebSocket and Lichat protocol handshake.
    // Returns a promise that will be fulfilled once the Lichat handshake
    // has been completed and the connection is fully usable. The argument
    // for the promise will be the client itself.
    openConnection(){
        return new Promise((ok, fail) => {
            let localFail = fail;
            this._socket = new WebSocket((this.ssl?"wss://":"ws://")+this.hostname+":"+this.port, "lichat");
            this._socket.onopen = ()=>{
                this.s("connect", {
                    password: this.password || null,
                    version: LichatVersion,
                    extensions: this.supportedExtensions
                }, true);
            };
            this._socket.onmessage = (e)=>{
                let update = this._reader.fromWire(new LichatStream(e.data));
                try{
                    if(!(cl.typep(update, "object")))
                        fail({text: "non-Update message", update: update});
                    else if(update.type.name !== "connect")
                        fail({text: update.text, update: update});
                    else{
                    }
                }catch(err){
                    this.closeConnection();
                }
                this.clearReconnect();
                
                if(!this.username)
                    this.username = update.from;

                this._socket.onmessage = ev => this.handleMessage(ev);
                this._socket.onerror = ev => this.handleError(ev);
                this._socket.onclose = ev => this.handleClose(ev);
                this.process(update);
                ok(this);
            };
            this._socket.onerror = ev => fail(this, ev);
            this._socket.onclose = ev => fail(this, ev);
        });
    }

    // Closes the connection and clears out any internal state
    // related to it, such as lists of present users in channels.
    closeConnection(){
        this.clearReconnect();
        for(let channel in this.channels)
            this.channels[channel].clearUsers();
        if(this._pingTimer){
            clearTimeout(this._pingTimer);
            this._pingTimer = null;
        }
        if(this._socket && this._socket.readyState < 2){
            this._socket.onclose = ()=>{};
            this._socket.close();
        }
        this._idCallbacks = {};
        this._socket = null;
        return this;
    }

    // Returns true if the client is currently connected.
    // This returns true even if the client has not completed the
    // WebSocket or Lichat handshakes and is just trying to establish
    // a connection at this time.
    get isConnected(){
        return this._socket && this._reconnectAttempts == 0;
    }

    // Returns true if the client is currently trying to establish
    // a connection.
    get isConnecting(){
        return this._socket && 0 < this._reconnectAttempts;
    }

    // Returns the next ID to be used in an update.
    nextID(){
        let ID = this._IDCounter;
        this._IDCounter++;
        return ID;
    }

    // Sends a wireable object to the server.
    send(wireable){
        if(!this._socket || this._socket.readyState != 1)
            throw new Error("The client is not connected.");
        if(!cl.typep(wireable, "ping") && !cl.typep(wireable, "pong"))
            console.debug("Send", wireable);
        let stream = new LichatStream();
        this._printer.toWire(wireable, stream);
        this._socket.send(stream.string+'\u0000');
        return wireable;
    }

    // Sends an update of the given type and fields to the server.
    // Returns a promise that is fulfilled if the server replies to the update
    // positively, and failed if the server replies with a failure. The promise
    // arguments are the response updates.
    // If noPromise is true, returns the sent update instance instead.
    s(type, args, noPromise){
        args = args || {};
        if(!args.from) args.from = this.username;
        if(!args.clock) args.clock = cl.getUniversalTime();
        if(!args.id) args.id = this.nextID();
        let update = cl.makeInstance(type, args);
        if(noPromise) return this.send(update);
        return new Promise((ok, fail)=>{
            try{
                this.send(update);
            }catch(e){
                fail(e);
            }
            this.addCallback(update.id, (u) => {
                if(cl.typep(u, "failure")) fail(u);
                else                       ok(u);
            }, fail);
        });
    }

    // Used to start the process of sending a pingback in case of lack of updates
    startDelayPing(){
        if(this._pingTimer) clearTimeout(this._pingTimer);
        this._pingTimer = setTimeout(()=>{
            if(this.pingAttempts <= this._pingAttempts){
                console.log("Failed too many ping attempts, reconnecting...");
                this.handleClose({message: "Ping timeout."});
            }else if(this._socket.readyState == 1){
                console.log("Haven't seen any updates in a while, pinging...");
                this.s("ping", {}, true);
                this.startDelayPing();
                this._pingAttempts++;
            }
        }, this.pingDelay);
        return this._pingTimer;
    }

    // Parses and distributes the WebSocket event.
    handleMessage(event){
        try{
            let update = this._reader.fromWire(new LichatStream(event.data));
            this._pingAttempts = 0;
            this.startDelayPing();
            this.process(update);
        }catch(e){
            console.error("Error during message handling", e);
        }
        return this;
    }

    handleError(event){
        console.warn("Got error", event);
        handleClose(event);
    }

    // Processes a WebSocket close event.
    handleClose(event){
        console.warn("Got close", event);
        this._idCallbacks = {};
        if(event.code !== 1000){
            this.disconnectHandler(event);
            this.scheduleReconnect();
        }else{
            this.closeConnection();
        }
    }

    // Processes all callback functions that registered for
    // the given ID. After they have run, the callbacks are
    // deregistered.
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

    // Processes the given update by passing it to callbacks and handlers.
    // This respects the update's class hierarchy and calls all applicable handlers.
    process(update){
        if(!cl.typep(update, "ping") && !cl.typep(update, "pong"))
            console.debug("Update",update);
        if(cl.typep(update, "update-failure"))
            this.processCallbacks(update["update-id"], update);
        else
            this.processCallbacks(update.id, update);
        if(!this.maybeCallInternalHandler(update.type.name, update)){
            for(let s of cl.classOf(update).superclasses){
                if(this.maybeCallInternalHandler(s.className, update))
                    break;
            }
        }
        if(!this.maybeCallHandler(update.type.name, update)){
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

    // Returns the icon URL that should be used to represent the client.
    get icon(){
        if(this.servername) return this.primaryChannel.icon;
        else return EmptyIcon;
    }

    // Returns the LichatChannel object that represents the server's primary channel.
    get primaryChannel(){
        if(this.servername)
            return this.getChannel(this.servername);
        else
            return null;
    }

    // Returns the LichatChannel object of the given name.
    // If the name is unknown, a new channel object is made and registered.
    getChannel(name){
        let channel = this.channels[name.toLowerCase()];
        if(channel === undefined){
            channel = new LichatChannel(name, this);
            this.channels[name.toLowerCase()] = channel;
        }
        return channel;
    }

    // Removes the given channel from the client permanently.
    // This does not leave the channel. Use with care.
    deleteChannel(channel){
        if(typeof(channel) === "string") channel = this.getChannel(channel);
        delete this.channels[name.toLowerCase()];
        return channel;
    }

    // Returns true if the given channel is known on this client.
    hasChannel(channel){
        if(typeof(channel) !== "string") channel = channel.name;
        return channel.toLowerCase() in this.channels;
    }

    // Returns the client's connecting LichatUser instance.
    get user(){
        if(this.username)
            return this.getUser(this.username);
        else
            return null;
    }

    // Returns the LichatUser object of the given name.
    // If the name is unknown, a new user object is made and registered.
    getUser(name){
        let user = this.users[name.toLowerCase()];
        if(user === undefined){
            user = new LichatUser(name, this);
            this.users[name.toLowerCase()] = user;
        }
        return user;
    }

    addEmote(update){
        let channel = update.channel || this.servername;
        return this.getChannel(channel).addEmote(update);
    }

    // Returns true if the protocol extension of the given name is supported.
    isAvailable(name){
        return cl.find(name, this.availableExtensions);
    }

    // Returns true if you can send an update of the given type to the primary channel.
    isPermitted(update){
        if(!this.primaryChannel) return false;
        return this.primaryChannel.isPermitted(update);
    }
}

// Function to parse a search query string into a structure
// that is accepted as per the shirakumo-search extension.
LichatClient.parseQuery = (query)=>{
    let parseWord = (i)=>{
        let start = i;
        for(; i<query.length; ++i){
            let char = query[i];
            if(char == ':' || char == ' ' || char == '"')
                break;
        }
        if(start === i) return null;
        return [i, query.slice(start, i)];
    };

    let parseString = (i)=>{
        if(query[i] == '"'){
            ++i;
            for(let start=i; i<query.length; ++i){
                if(query[i] == '"' && query[i-1] != '!')
                    return [i+1, query.slice(start, i)];
            }
        }
        return null;
    };

    let parseToken = (i)=>{
        return parseString(i) || parseWord(i);
    };

    let parseField = (i)=>{
        let word = parseWord(i);
        if(word && query[word[0]] == ':'){
            i = word[0];
            let token = null;
            for(; !token; ++i) token = parseToken(i);
            return [token[0], word[1], token[1]];
        }
        return null;
    };

    let parseDate = (i)=>{
        // FIXME: do
        return cl.T;
    };
    
    let i = 0;
    let parts = {
        after: [],
        before: [],
            in: [],
        from: [],
        text: []
    };
    for(; i<query.length;){
        let field = parseField(i);
        if(field){
            i = field[0];
            parts[field[1].toLowerCase()].push(field[2]);
            continue;
        }
        let token = parseToken(i);
        if(token){
            i = token[0];
            parts['text'].push(token[1]);
            continue;
        }
        ++i;
    }

    query = [];
    if(parts.after.length || parts.before.length){
        query.push(cl.kw('clock'));
        query.push([parseDate(parts.after), parseDate(parts.before)]);
    }
    if(parts.from.length){
        query.push(cl.kw('from'));
        query.push(parts.from);
    }
    if(parts.text.length){
        query.push(cl.kw('text'));
        query.push(parts.text);
    }
    return [query, (parts.in.length)? parts.in[0] : null];
};
class LichatUI{
    constructor(el, config){
        console.log("Setting up Lichat", this, config);
        let lichat = this;
        // Map of command prefixes to handler functions
        this.commands = {};
        
        // List of LichatClient instances
        this.clients = [];

        // Pointer to currently visible LichatChannel instance
        this.currentChannel = null;

        // Whether the output should auto-scroll to the end
        this.autoScroll = true;

        // The current search query or null if none.
        this.search = null;

        // The currently displayed error message, or null if none.
        this.errorMessage = null;

        // Whether the UI should be in "mobile mode" or not.
        // If in mobile mode, hides the client/channel list and
        // minimises other UI elements for a compacter display.
        this.isMobile = (config.mobile !== undefined)
            ? config.mobile
            : (document.body.getBoundingClientRect().width < 500);

        // Whether the client is in "embedded" mode, meaning being
        // shown on an external website and should thus always show
        // the login and not save the configuration.
        this.embedded = config.embedded;

        // Toggles to keep track of popups
        this.showEmotePicker = false;
        this.showChannelMenu = false;
        this.showClientMenu = false;
        this.showSelfMenu = false;
        this.showSettings = false;
        this.showSideBar = !(this.embedded || this.isMobile);

        // Tracker for the IndexedDB object
        this.db = null;

        // The universal time at which the last TYPING update was sent out.
        this.lastTypingUpdate = 0;

        // The default client configuration options.
        this.defaultClientConfig = {...LichatDefaultClient};

        // Function to call once the UI is fully initialised and connected.
        this._init = null;

        // The local user preferences.
        this.options = {
            transmitTyping: !this.embedded,
            showNotifications: !this.embedded,
            playSound: false,
            notificationLevel: 'mention',
            font: 'sans-serif',
            fontSize: '14',
            sidebarWidth: '15em',
        };

        // Tracking information for the tab auto-completion
        this.autoComplete = {
            index: 0,
            prefix: null,
            pretext: null
        };

        // Restore connections/clients from the config object.
        if(config.connection){
            for(let key in config.connection){
                let value = config.connection[key];
                if(value !== null) this.defaultClientConfig[key] = value;
            }
            if(config.connection.ssl === undefined)
                this.defaultClientConfig.ssl = (config.connection.port == LichatDefaultSSLPort);
        }

        // Tracking for the current mouse position. We need this ugly crap to
        // ensure we can place popups at the correct positions.
        let mouseX = 0, mouseY = 0;
        ["mousemove", "mousedown", "touchmove", "touchstart"].forEach((e)=>document.addEventListener(e, (ev)=>{
            mouseX = ev.clientX;
            mouseY = ev.clientY;
        }));

        // Track whether the tab has gone out of focus. If we have become unhidden,
        // clear alerts and update unreads, assuming the user has now read the new
        // messages.
        // FIXME: should check whether we've actually scrolled to the bottom or not.
        document.addEventListener("visibilitychange", ()=>{
            if(!document.hidden && this.currentChannel){
                this.currentChannel.unread = 0;
                this.currentChannel.alerted = false;
                this.updateTitle();
            }
        });

///////////////////////////// CLIENT OBJECT HOOKS //////////////////////////////////////

        // Helper to supersede a method.
        let supersede = (object, field, newfun)=>{
            let original = object.prototype[field];
            object.prototype[field] = function(...args){
                let self = this;
                args.unshift((...args)=>original.apply(self, args));
                newfun.apply(this, args);
            };
        };

        // Inject into the LichatChannel's record method, so that we can add behaviour.
        supersede(LichatChannel, 'record', function(nextMethod, update, ignore){
            // First process the message as usual, this will update the messageList.
            const [message, inserted] = nextMethod(update);
            if(ignore) return [message, inserted];

            // If it wasn't in the primary channel or a generated message, save it in
            // the local database.
            if(!message.isSystem && !message.channel.isPrimary)
                lichat.saveMessage(message);

            // Insert it into our list of displayed messages and drop messages if there's
            // too many now.
            // FIXME: This should check whether we've been scrolled up. If so, we probably
            //        do not want to insert the message unless it is within the current
            //        region of visible messages already.
            LichatChannel._insertMessageSorted(message, message.channel.uiMessageList);
            if(500 < message.channel.uiMessageList.length){
                message.channel.uiMessageList.shift();
            }

            // Check whether we should notify for this message at all.
            let notify = inserted && !this.isPrimary;
            if(lichat.currentChannel == message.channel){
                let output = lichat.app.$refs.output;
                // If this channel is current but not visible (wtf) don't notify.
                if(!output)
                    notify = false;
                else if(lichat.autoScroll){
                    // Don't notify if the current channel is visible, since we
                    // assume the user is actually reading the messages.
                    if(!document.hidden) notify = false;
                    // If we should auto scroll, perform some delay logic to ensure
                    // we make the message visible once all images and such have
                    // been loaded.
                    Vue.nextTick(() => {
                        let el = document.getElementById(message.gid);
                        if(el){
                            let imgs = el.querySelectorAll("img");
                            el.scrollIntoView();
                            Promise.all([].map.call(imgs, (img)=>
                                new Promise((ok)=>{
                                    if(img.complete) ok();
                                    else img.addEventListener('load', ok);
                                })))
                                .then(()=>el.scrollIntoView());
                        }
                    });
                }
            }
            if(notify) this.notify(message);
            return [message, inserted];
        });

        // Inject a function to handle notifications of messages for the channel.
        LichatChannel.prototype.notify = function(message){
            let notify = false;
            let level = this.notificationLevel;
            if(message.author.isSelf) return;
            // Process the notification level
            if(level == 'inherit' || !level)
                level = lichat.options.notificationLevel;
            if(level == 'all')
                notify = true;
            // Check if the message includes important stuff via <mark> (this is kinda hacky tbh)
            if(message.html.includes("<mark>")){
                if(!this.alerted) this.alerted = true;
                if(level == 'mentions')
                    notify = true;
            }
            // If we should notify and we have permission for popups, make one!
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
                // If the player clicks the popup, highlight the message in the UI.
                notification.addEventListener('notificationclick', (ev)=>{
                    ev.notification.close();
                    if(ev.action != 'close'){
                        message.highlight();
                    }
                });
            }
            // Play a sound if so desired.
            if(notify && lichat.options.playSound){
                LichatUI.sound.play();
            }
            this.unread++;
            lichat.updateTitle();
        };

        // Supersede the markup function with our own that knows about
        // user preferences like aliases and such.
        LichatMessage.prototype.markupText = function(text){
            return LichatUI.formatUserText(text, this.channel);
        };

        // Function to highlight a message in the UI and present it to the user.
        LichatMessage.prototype.highlight = function(){
            lichat.app.switchChannel(this.channel);
            Vue.nextTick(() => {
                let element = document.getElementById(this.gid);
                element.classList.add('highlight');
                element.scrollIntoView();
            });
        };

        // Function to add a channel into the list of shown channels in the side bar.
        LichatClient.prototype.addToChannelList = function(channel){
            if(this.channelList.length == 0){
                this.channelList.push(channel);
                lichat.saveClient(this);
            }else if(!this.channelList.find(element => element === channel)){
                // Insert the channel in the correct position according to name.
                let i=1;
                for(; i<this.channelList.length; ++i){
                    if(0 < this.channelList[i].name.localeCompare(channel.name))
                        break;
                }
                this.channelList.splice(i, 0, channel);
                lichat.saveClient(this);
            }
        };

        // Function to remove a channel from the list of shown channels.
        LichatClient.prototype.removeFromChannelList = function(channel){
            let index = this.channelList.indexOf(channel);
            if(0 <= index){
                this.channelList.splice(index, 1);
                lichat.saveClient(this);
            }
            if(channel == lichat.currentChannel){
                if(this.channelList.length <= index)
                    index = this.channelList.length-1;
                lichat.app.switchChannel(this.channelList[index]);
            }
        };
        
///////////////////////////// VUE COMPONENTS //////////////////////////////////////

        // Draggable divider to allow customising the width of the sidebar.
        Vue.component("divider", {
            template: "<div class='divider'></div>",
            data: ()=>{return {
                target: null
            };},
            methods: {
                drag: function(ev){
                    let x = (ev.clientX || event.touches[0].pageX)
                        - this.$el.getBoundingClientRect().width;
                    lichat.options.sidebarWidth = x+"px";
                },
                stopDragging: function(ev){
                    console.log(ev);
                    document.removeEventListener('mousemove', this.drag);
                    document.removeEventListener('mouseup', this.stopDragging);
                    document.removeEventListener('touchmove', this.drag);
                    document.removeEventListener('touchend', this.stopDragging);
                }
            },
            mounted: function(){
                this.target = this.$el.previousElementSibling;
                this.$el.addEventListener('mousedown', (ev)=>{
                    document.addEventListener('mousemove', this.drag);
                    document.addEventListener('mouseup', this.stopDragging);
                });
                this.$el.addEventListener('touchstart', (ev)=>{
                    document.addEventListener('touchmove', this.drag);
                    document.addEventListener('touchend', this.stopDragging);
                });
            }
        });

        // Base "class" to handle popup behaviours in the UI.
        let popup = {
            mounted: function(){
                document.addEventListener('click', (ev)=>{
                    this.$emit('close');
                });
                this.$el.style.left = mouseX+"px";
                this.$el.style.top = mouseY+"px";
                this.$nextTick(()=>{
                    this.fitInView();
                });
            },
            methods: {
                fitInView: function(){
                    let rect = this.$el.getBoundingClientRect();
                    if(rect.left < 0){
                        this.$el.style.right = "";
                        this.$el.style.left = "10px";
                    }
                    if(rect.top < 0){
                        this.$el.style.bottom = "";
                        this.$el.style.top = "10px";
                    }
                    if(window.innerWidth < rect.right){
                        this.$el.style.left = "";
                        this.$el.style.right = "10px";
                    }
                    if(window.innerHeight < rect.bottom){
                        this.$el.style.top = "";
                        this.$el.style.bottom = "10px";
                    }
                }
            }
        };

        // Base "class" to handle popups that have an input field in the UI.
        let inputPopup = {
            data: function(){
                return {
                    errorMessage: ""
                };
            },
            mounted: function(){
                Vue.nextTick(() => {
                    let input = this.$el.querySelector("input");
                    if(input){
                        input.focus();
                    }
                });
            }
        };

        // Component for plain popups in the UI. These show some generic HTML.
        Vue.component("popup", {
            template: "#popup",
            mixins: [popup, inputPopup],
            props: ['prompt']
        });

        // Component for the menu when the user clicks on their own icon.
        Vue.component("self-menu", {
            template: "#self-menu",
            mixins: [popup],
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
            },
            methods: {
                setStatus: function(status){
                    if(status !== undefined){
                        this.client.s("set-user-info", {key: cl.kw('status'), value: status})
                            .then(()=>this.$emit('close'));
                    }
                }
            }
        });

        // Component for the menu when the user clicks on a user in the chat log.
        Vue.component("user-menu", {
            template: "#user-menu",
            mixins: [popup],
            props: {user: LichatUser},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false
                };
            },
            methods: {
                whisper: function(){
                    this.user.client.s("create", {})
                        .then((e)=>this.user.client.s("pull", {
                            target: this.user.name,
                            channel: e.channel
                        })).catch((e)=>this.user.client.showError(e));
                    this.$emit('close');
                },
                block: function(){
                    this.user.client.s("block", {target: this.message.from})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been blocked."))
                        .catch((e)=>this.user.client.showError(e));
                    this.$emit('close');
                },
                unblock: function(){
                    this.user.client.s("unblock", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unblocked."))
                        .catch((e)=>this.user.client.showError(e));
                    this.$emit('close');
                },
                ban: function(){
                    this.user.client.s("ban", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been banned."))
                        .catch((e)=>this.user.client.showError(e));
                    this.$emit('close');
                },
                unban: function(){
                    this.user.client.s("unban", {target: this.user.name})
                        .then((e)=>this.user.client.showStatus(this.user.name+" has been unbanned."))
                        .catch((e)=>this.user.client.showError(e));
                    this.$emit('close');
                }
            }
        });

        // Component for the menu that appears when the user clicks on a channel's top menu (the three dots)
        Vue.component("channel-menu", {
            template: "#channel-menu",
            mixins: [popup],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    showInvite: false,
                    showInfo: false,
                    showChannelCreate: false,
                    showChannelList: false,
                    showUserList: false,
                    showRules: false
                };
            },
            methods: {
                invite: function(user){
                    if(user)
                        this.channel.s("pull", {target: user});
                    this.showInvite = false;
                    this.$emit('close');
                },
                leave: function(){
                    this.channel.s("leave")
                        .then(()=>this.channel.client.removeFromChannelList(this.channel));
                    this.$emit('close');
                }
            }
        });

        // Component for the menu that appears when the user clicks on a message's dots icon.
        Vue.component("message-menu", {
            template: "#message-menu",
            mixins: [popup],
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
                    this.message.channel.s("kick", {target: this.message.from})
                        .catch((e)=>this.message.channel.showError(e));
                    this.$emit('close');
                },
                quiet: function(){
                    this.message.channel.s("quiet", {target: this.message.from})
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."))
                        .catch((e)=>this.message.channel.showError(e));
                    this.$emit('close');
                },
                unquiet: function(){
                    this.message.channel.s("unquiet", {target: this.message.from})
                        .then((e)=>this.message.channel.showStatus(this.message.from+" has been quieted."))
                        .catch((e)=>this.message.channel.showError(e));
                    this.$emit('close');
                }
            }
        });

        // Component for the menu that appears when the user clicks a client's dots icon.
        Vue.component("client-menu", {
            template: "#client-menu",
            mixins: [popup],
            props: {client: LichatClient},
            data: ()=>{
                return {
                    showConfigure: false,
                    showChannelList: false,
                    showChannelCreate: false
                };
            }
        });

        // Component for the client configure popup. This is also used for the
        // first-time setup and the minimised embedded mode login.
        Vue.component("client-configure", {
            template: "#client-configure",
            mixins: [inputPopup],
            props: {client: Object},
            data: ()=>{
                return {
                    options: this.defaultClient,
                    tab: 'settings',
                    aliases: "",
                    bans: [],
                    ipBans: []
                };
            },
            created: function(){
                if(this.client){
                    Object.assign(this.options, this.client);
                    this.options.aliases = this.client.aliases.join("  ");
                    if(this.client.isConnected){
                        if(this.client.isPermitted('ban')){
                            this.client.s("blacklist", {})
                                .then((ev)=>this.bans = ev.target)
                                .catch((ev)=>this.errorMessage = ev.text);
                        }
                        if(this.client.isPermitted('ip-ban'))
                            this.client.s("ip-blacklist", {})
                                .then((ev)=>this.ipBans = ev.target)
                                .catch((ev)=>this.errorMessage = ev.text);
                    }
                }
                if(this.options.autoconnect){
                    this.create();
                }
            },
            methods: {
                remove: function(){
                    lichat.removeClient(this.client);
                    this.close();
                },
                submit: function(){
                    if(this.client instanceof LichatClient)
                        this.save();
                    else
                        this.create();
                },
                create: function(){
                    let client = new LichatClient(this.options);
                    lichat.addClient(client)
                        .then(()=>{
                            if(lichat._init) lichat._init(client);
                            lichat._init = null;
                            lichat.saveClient(client);
                            this.$emit('close');
                        })
                        .catch((e)=>{
                            lichat.removeClient(client);
                            this.errorMessage = e.reason || e.text || "Failed to connect";
                            let focus = (el)=>{
                                Vue.nextTick(()=>{
                                    el.classList.add("flash");
                                    el.focus();
                                });
                            };
                            if(cl.typep(e.update, 'invalid-password') || cl.typep(e, 'no-such-profile'))
                                focus(this.$refs.password);
                            if(cl.typep(e.update, 'username-taken'))
                                focus(this.$refs.username);
                            if(cl.typep(e.update, 'bad-name'))
                                focus(this.$refs.username);
                        });
                },
                close: function(){
                    if(!this.options.embedded)
                        this.$emit('close');
                },
                save: function(){
                    this.client.name = this.options.name;
                    this.client.aliases = this.options.aliases.split("  ");
                    this.client.username = this.options.username;
                    this.client.password = this.options.password;
                    this.client.hostname = this.options.hostname;
                    this.client.port = this.options.port;
                    this.client.ssl = this.options.ssl;
                    lichat.saveClient(this.client);
                    this.$emit('close');
                },
                deleteBan: function(ev){
                    this.client.s("unban", {target: ev.target.closest("a").getAttribute("name")})
                        .then((ev)=>this.bans = this.bans.filter((name)=>name !== ev.target))
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                addBan: function(ev){
                    this.client.s("ban", {target: this.$refs.name.value})
                        .then((ev)=>{
                            this.bans.push(ev.target);
                            this.$refs.name.value = '';
                        })
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                deleteIpBan: function(ev){
                    this.client.s("ip-unban", {ip: ev.target.closest("a").getAttribute("ip"),
                                               mask: ev.target.closest("a").getAttribute("mask")})
                        .then((ev)=>this.client.s("ip-blacklist"))
                        .then((ev)=>this.ipBans = ev.target)
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                addIpUnban: function(ev){
                    this.client.s("ip-unban", {ip: this.$refs.ip.value, mask: this.$refs.mask.value})
                        .then((ev)=>{
                            this.$refs.ip.value = '';
                            this.$refs.mask.value = '';
                            return this.client.s("ip-blacklist");
                        })
                        .then((ev)=>this.ipBans = ev.target)
                        .catch((ev)=>this.errorMessage = ev.text);
                    this.$refs.name.value = '';
                },
                addIpBan: function(ev){
                    this.client.s("ip-ban", {ip: this.$refs.ip.value, mask: this.$refs.mask.value})
                        .then((ev)=>{
                            this.$refs.ip.value = '';
                            this.$refs.mask.value = '';
                            return this.client.s("ip-blacklist");
                        })
                        .then((ev)=>this.ipBans = ev.target)
                        .catch((ev)=>this.errorMessage = ev.text);
                },
            }
        });

        // Component for the popup that handles user preferences and configurations independent of connections.
        Vue.component('ui-configure', {
            template: "#ui-configure",
            mixins: [inputPopup],
            props: {options: Object},
            data: ()=>{
                let it = document.fonts.entries();
                let fonts = [];
                while(true){
                    let font = it.next();
                    if(font.done){
                        break;
                    }else{
                        fonts.push(font.value[0].family);
                    }
                }
                let knownFonts = ['Arial','Calibri','Comic Sans MS','Consolas','Courier New'];
                for(let font of knownFonts)
                    if(document.fonts.check("12px "+font))
                        fonts.push(font);

                fonts = [...new Set(fonts)].sort();
                fonts.unshift('serif');
                fonts.unshift('monospace');
                fonts.unshift('sans-serif');
                
                return {
                    havePermission: Notification.permission === 'granted',
                    fonts: fonts
                };
            },
            mounted: function(){
                this.$el.querySelector("input").focus();
            },
            methods: {
                requestPermission: function(){
                    Notification.requestPermission()
                        .then((permission)=>{
                            switch(permission){
                            case 'granted': this.havePermission = true; break;
                            case 'denied': this.errorMessage = "Lichat cannot show desktop notifications unless you grant permission."; break;
                            }});
                },
                close: function(){
                    lichat.saveOptions();
                    this.$emit('close');
                },
                clear: function(){
                    lichat.clearSetup();
                    this.$emit('close');
                }
            }
        });

        // Component that handles a user list and allows picking a user from that list.
        Vue.component("select-user", {
            template: "#select-user",
            mixins: [inputPopup],
            props: {client: LichatClient},
            data: function(){
                return {
                    users: [],
                };
            },
            created: function(){
                this.users = Object.keys(this.client.users);
            }
        });

        // Component that handles the creation of a new channel via popup.
        Vue.component("create-channel", {
            template: "#create-channel",
            mixins: [inputPopup],
            props: {client: LichatClient, channel: Object},
            data: function(){
                return {
                    name: "",
                    anonymous: false
                };
            },
            created: function(){
                if(this.channel)
                    this.name = this.channel.name+"/";
            },
            mounted: function(){
                this.$el.querySelector("input").focus();
            },
            methods: {
                create: function(){
                    this.client.s("create", {channel: (this.anonymous)?null:this.name})
                        .then(()=>this.$emit('close'))
                        .catch((e)=>this.errorMessage = e.text);
                }
            }
        });

        // Popup component that shows a list of all users and provides options for them.
        Vue.component("list-users", {
            template: "#list-users",
            mixins: [inputPopup],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    userList: [],
                    userMenu: null
                };
            },
            created: function(){
                this.filter();
            },
            methods: {
                filter: function(){
                    let filter = (this.$refs.input)? this.$refs.input.value : "";
                    filter = filter.toLowerCase();
                    let list = [];
                    for(let user of Object.values(this.channel.users)){
                        if(user.name.includes(filter))
                            list.push(user);
                    }
                    this.userList = list.sort();
                }
            }
        });

        // Popup component that shows a list of all channels on the server and provides options for them.
        // TODO: Add support for the shirakumo-channel-trees extension and show an expandable tree of
        //       channels. Need to query for sub-channels on each expansion.
        Vue.component("list-channels", {
            template: "#list-channels",
            mixins: [inputPopup],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    channelList: [],
                    channelMenu: null,
                    channels: []
                };
            },
            created: function(){
                let target = this.channel.isPrimary? this.channel.client : this.channel;
                target.s("channels")
                    .then((e)=>{
                        for(let name of e.channels)
                            this.channels.push(this.channel.client.getChannel(name));
                        this.filter();
                    })
                    .catch((e)=>this.errorMessage = e.text);
            },
            methods: {
                filter: function(){
                    let filter = (this.$refs.input)? this.$refs.input.value : "";
                    filter = filter.toLowerCase();
                    let list = [];
                    for(let channel of this.channels){
                        if(channel.name.includes(filter))
                            list.push(channel);
                    }
                    this.channelList = list.sort();
                },
                join: function(channel){
                    this.channel.client.s("join", {channel: channel.name})
                        .then(()=>{
                            lichat.app.switchChannel(channel);
                            this.$emit('close');
                        })
                        .catch((e)=>{
                            if(cl.typep(e, "already-in-channel"))
                                lichat.app.switchChannel(channel);
                            else
                                this.errorMessage = e.text;
                        });
                }
            }
        });

        // Popup component that shows an emote and emoji picker.
        Vue.component("emote-picker", {
            template: "#emote-picker",
            mixins: [popup, inputPopup],
            props: {channel: LichatChannel, classes: Array},
            data: ()=>{
                return {
                    tab: 'emotes', 
                    allEmoji: LichatUI.allEmoji
                }; 
            },
            mounted: function(){
                twemoji.parse(this.$refs.emoji);
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

        // Base "class" for common functionality in configuration widgets and popups.
        let configureWidget = {
            data: ()=>{
                return {
                    tab: 'info',
                    errorMessage: null,
                    info: {}
                };
            },
            created: function(){
                Object.assign(this.info, this.object.info);
            },
            methods: {
                isImage: function(key){
                    return key === ':icon';
                },
                toURL: function(value){
                    if(!value) return EmptyIcon;
                    else if(typeof value === 'string'){
                        let parts = value.split(" ");
                        return "data:"+parts[0]+";base64,"+parts[1];
                    }else{
                        return value.url;
                    }
                },
                setImage: function(ev){
                    let key = ev.target.getAttribute("name");
                    let onFile = ()=>{
                        this.$refs.file.removeEventListener('change', onFile);
                        let file = this.$refs.file.files[0];
                        if(file){
                            var reader = new FileReader();
                            reader.onload = ()=>{
                                let parts = reader.result.match(/data:(.*?)(;base64)?,(.*)/);
                                this.info[key] = parts[1]+" "+parts[3];
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    this.$refs.file.addEventListener('change', onFile);
                    this.$refs.file.click();
                },
                saveInfo: function(){
                    for(let key in this.info){
                        let value = this.info[key];
                        if(value !== this.object.info[key]){
                            this.object.s(this.setInfoUpdate, {key: LichatReader.fromString(key), text: value})
                                .then((e)=>this.object.info[key] = e.text)
                                .catch((e)=>this.errorMessage = e.text);
                        }
                    }
                },
            }
        };

        // Popup component for a user's options such as their server and user information.
        Vue.component("user-configure", {
            template: "#user-configure",
            mixins: [configureWidget],
            props: {user: LichatUser},
            data: ()=>{
                return {
                    registered: false,
                    connections: 0,
                    channels: [],
                    registeredOn: [],
                    connectionInfo: []
                };
            },
            computed: {
                object: function(){return this.user;},
                setInfoUpdate: ()=>"set-user-info"
            },
            created: function(){
                for(let channel of this.user.client.channelList){
                    if(channel.hasUser(this.user))
                        this.channels.push(channel.name);
                }
                if(this.user.client.isPermitted('user-info'))
                    this.user.s('user-info')
                    .then((ev)=>{
                        this.registered = ev.registered;
                        this.connections = ev.connections;
                        Object.assign(this.info, this.user.info);
                    })
                    .catch((ev)=>this.errorMessage = ev.text);
                if(this.user.client.isPermitted('server-info'))
                    this.user.s('server-info')
                    .then((ev)=>{
                        for(let entry of ev.attributes){
                            if(entry[0] == cl.intern("channels", "lichat")){
                                this.channels = entry[1];
                            }else if(entry[0] == cl.intern("registered-on", "lichat")){
                                this.registeredOn = cl.universalToUnix(entry[1]);
                            }
                        }
                        this.connectionInfo = [];
                        for(let connection of ev.connections){
                            let info = {};
                            for(let entry of connection){
                                if(entry[0] == cl.intern("connected-on", "lichat")){
                                    info.connectedOn = cl.universalToUnix(entry[1]);
                                }else if(entry[0] == cl.intern("ip", "shirakumo")){
                                    info.ip = entry[1];
                                }else if(entry[0] == cl.intern("ssl", "shirakumo")){
                                    info.ssl = entry[1];
                                }
                            }
                            this.connectionInfo.push(info);
                        }
                    })
                    .catch((ev)=>this.errorMessage = ev.text);
            },
            methods: {
                kill: function(){
                    this.user.s("kill")
                        .then(()=>this.$emit('close'))
                        .catch((ev)=>this.errorMessage = ev.text);
                }
            }
        });

        // Popup component for a channel's options such as their emotes, permissions, bans, etc.
        Vue.component("channel-configure", {
            template: "#channel-configure",
            mixins: [configureWidget],
            props: {channel: LichatChannel},
            data: ()=>{
                return {
                    emotes: [],
                    permissions: []
                };
            },
            created: function(){
                for(let name in this.channel.emotes){
                    this.emotes.push([name, this.channel.emotes[name]]);
                }
                this.emotes.sort((a,b)=>(a[0]<b[0])?-1:+1);
                if(this.channel.isPermitted("permissions"))
                    this.channel.s("permissions")
                    .then((e)=>{
                        for(let expr of e.permissions){
                            let rule = {
                                update: LichatPrinter.toString(expr[0]),
                                type: '',
                                users: [],
                            };
                            if(expr[1] === true)
                                rule.type = '-';
                            else if(expr[1] === null)
                                rule.type = '+';
                            else{
                                rule.type = expr[1][0].name;
                                rule.users = expr[1].slice(1);
                            }
                            this.permissions.push(rule);
                        }
                    })
                    .catch((e)=>this.errorMessage = e.text);
            },
            computed: {
                object: function(){return this.channel;},
                setInfoUpdate: ()=>"set-channel-info"
            },
            methods: {
                deleteEmote: function(ev){
                    let name = ev.target.closest("a").getAttribute("name");
                    this.channel.s("emote", {"content-type": "image/png", name: name, payload: ""})
                        .then((e)=>this.emotes = this.emotes.filter((o)=>o[0] !== e.name))
                        .catch((e)=>this.errorMessage = e.text);
                },
                uploadEmote: function(ev){
                    let file = this.$refs.file.files[0];
                    let name = this.$refs.name.value;
                    if(!file){
                        this.errorMessage = "Need to select a file.";
                        return;
                    }
                    if(!name){
                        this.errorMessage = "Need a name.";
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = ()=>{
                        let parts = reader.result.match(/data:(.*?)(;base64)?,(.*)/);
                        this.channel.s("emote", {
                            name: name,
                            "content-type": parts[1],
                            payload: parts[3]
                        }).then((ev)=>{
                            this.emotes.push([ev.name, this.toURL(ev["content-type"]+" "+ev.payload)]);
                            this.emotes.sort((a,b)=>(a[0]<b[0])?-1:+1);
                        })
                            .catch((e)=>this.errorMessage = e.text);
                    };
                    reader.readAsDataURL(file);
                },
                addUser: function(ev, rule){
                    if(ev.target.value !== '')
                        cl.pushnew(ev.target.value, rule.users);
                    ev.target.value='';
                },
                savePermissions: function(){
                    let expr = [];
                    for(let rule of this.permissions){
                        expr.push([LichatReader.fromString(rule.update),
                                   [cl.intern(rule.type, "lichat"), ...rule.users]]);
                    }
                    this.channel.s("permissions", {permissions: expr})
                        .catch((e)=>this.errorMessage = e.text);
                },
                toggleSlowMode: function(){
                    this.channel.s("pause", {by: Integer.parseInt(this.$refs.pause.value)})
                        .catch((ev)=>this.errorMessage = ev.text);
                },
                destroy: function(ev){
                    this.channel.s("destroy")
                        .then(()=>this.$emit('close'))
                        .catch((ev)=>this.errorMessage = ev.text);
                }
            }
        });

        // Base component representing a message in the UI. Adds extra stuff such as for
        // editing, emotes, and handling the popups.
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
                        this.message.channel.s("react", {
                            target: this.message.from,
                            "update-id": this.message.id,
                            emote: emote
                        });
                },
                edit: function(){
                    this.editText = this.editText.trimEnd();
                    this.message.channel.s("edit", {
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
                isConnected(client){
                    return client._socket && client._reconnectAttempts == 0;
                },
                // Switches the visible channel to the requested one.
                switchChannel: (channel)=>{
                    channel.unread = 0;
                    channel.alerted = false;
                    if(this.isMobile) this.showSideBar = false;
                    this.currentChannel = channel;
                    this.updateTitle();
                    Vue.nextTick(() => {
                        this.app.$refs.output.scrollTop = this.app.$refs.output.scrollHeight;
                        this.app.$refs.input.focus();
                    });
                },
                // Toggles the search field on or off.
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
                // Handles auto completion requests and typing updates.
                handleKeypress: (ev)=>{
                    if(ev.keyCode === 9){
                        ev.preventDefault();
                        this.currentChannel.currentMessage.text = this.autoCompleteInput(this.currentChannel.currentMessage.text);
                    }else{
                        this.autoComplete.prefix = null;
                        if(this.options.transmitTyping && this.currentChannel.client.isAvailable("shirakumo-typing")
                           && this.lastTypingUpdate+4 < cl.getUniversalTime() && this.currentChannel.isPermitted('TYPING')){
                            this.lastTypingUpdate = cl.getUniversalTime();
                            this.currentChannel.s("typing", {}, true);
                        }
                    }
                },
                // Handles message submission and multiline input.
                submit: (ev)=>{
                    let channel = this.currentChannel;
                    let message = channel.currentMessage;
                    if(!ev.getModifierState("Control") && !ev.getModifierState("Shift")){
                        message.text = message.text.trimEnd();
                        if(message.text.startsWith("/")){
                            this.processCommand(channel, message.text);
                        }else{
                            channel.s("message", {
                                "text": message.text,
                                "reply-to": (message.replyTo)? [message.replyTo.author.name, message.replyTo.id]: null
                            }).catch((e)=>channel.showError(e));
                        }
                        message.clear();
                    }else{
                        message.text += '\n';
                    }
                },
                // Handles any kind of file upload, be it through a file input, drag&drop, or pastes.
                // Ultimately sends a DATA update, if the file can be successfully read in.
                // Returns a promise that fulfils if the update was sent successfully and fails in any
                // other case.
                uploadFile: (ev)=>{
                    console.log(ev);
                    if(ev.type == 'click'){
                        document.getElementById("fileChooser").click();
                    }else if(ev.type == 'change'){
                        if(ev.target.files)
                            return this.app.uploadFile(ev.target.files);
                    }else if(ev.type == 'drop'){
                        if(ev.dataTransfer)
                            return this.app.uploadFile(ev.dataTransfer);
                    }else if(ev.type == 'paste'){
                        if(ev.clipboardData)
                            return this.app.uploadFile(ev.clipboardData);
                    }else if(ev instanceof DataTransfer){
                        if(ev.files)
                            return this.app.uploadFile(ev.files);
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
                                this.currentChannel.s("data", {
                                    filename: ev.name,
                                    "content-type": parts[1],
                                    payload: parts[3]
                                }).then(()=>ok())
                                    .catch((e)=>{
                                        channel.showError(e);
                                        fail(e);
                                    })
                                    .finally(()=>channel.deleteMessage(message));
                            };
                            reader.readAsDataURL(ev);
                        });
                    }
                    return null;
                },
                // Perform a search query and show the results once available.
                performSearch: (ev)=>{
                    let [query, channel] = LichatClient.parseQuery(this.search);
                    channel = (channel === null)? this.currentChannel : this.currentChannel.client.getChannel(channel);
                    this.search = null;
                    this.currentChannel.s("search", {query: query})
                        .then((ev)=>this.showSearchResults(channel, ev.results, query))
                        .catch((e)=>channel.showError(e));
                },
                // Add an emote to the message being composed right now.
                addEmote: (emote)=>{
                    this.showEmotePicker = false;
                    if(emote){
                        if(!(emote in LichatUI.allEmoji)) emote = ":"+emote+":";
                        // FIXME: This is wrong as it does not respect cursor position.
                        this.currentChannel.currentMessage.text += emote;
                        this.app.$refs.input.focus();
                    }
                },
                formatUserText: (text, channel)=>{
                    return LichatUI.formatUserText(text, channel);
                },
                // Checks whether we should start auto scrolling if the user reached the bottom of the scrollback.
                handleScroll: (ev)=>{
                    let output = this.app.$refs.output;
                    this.autoScroll = Math.abs(output.scrollTop - (output.scrollHeight - output.offsetHeight)) < 5;
                }
            }
        });

///////////////////////////// UI COMMANDS //////////////////////////////////////
        
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
            let perform = ()=>this.app.switchChannel(channel.client.getChannel(name));
            if(channel.client.hasChannel(name) && channel.client.getChannel(name).isPresent){
                perform();
            }else{
                channel.client.s("join", {channel: name})
                    .then(perform)
                    .catch((e)=>{
                        if(cl.typep(e, "already-in-channel")) perform();
                        else channel.showError(e);
                    });
            }
        }, "Join a new channel.");

        this.addCommand("leave", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : channel.name;
            let perform = ()=>channel.client.removeFromChannelList(channel.client.getChannel(name));
            if(channel.client.hasChannel(name) && !channel.client.getChannel(name).isPresent){
                perform();
            }else{
                channel.client.s("leave", {channel: name})
                    .then(perform)
                    .catch((e)=>{
                        if(cl.typep(e, "not-in-channel")) perform();
                        else channel.showError(e);
                    });
            }
        }, "Leave a channel. If no channel is specified, leaves the current channel.");

        this.addCommand("create", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : null;
            channel.client.s("create", {channel: name})
                .then(()=>this.app.switchChannel(channel.client.getChannel(name)))
                .catch((e)=>channel.showError(e));
        }, "Creates a new channel. If no name is specified, creates an anonymous channel.");

        this.addCommand("kick", (channel, ...name)=>{
            channel.s("kick", {target: name.join(" ")})
                .catch((e)=>channel.showError(e));
        }, "Kick a user fromde the channel.");
        
        this.addCommand("pull", (channel, ...name)=>{
            channel.s("pull", {target: name.join(" ")})
                .catch((e)=>channel.showError(e));
        }, "Pull a user into the channel.");

        this.addCommand("register", (channel, ...password)=>{
            password = password.join(" ");
            channel.client.s("register", {password: password})
                .then(()=>{
                    channel.client.password = password;
                    channel.showStatus("Registration complete.");
                })
                .catch((e)=>channel.showError(e));
        }, "Try to register your current username with a password.");

        this.addCommand("grant", (channel, type, ...user)=>{
            channel.s("grant", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission granted."))
                .catch((e)=>channel.showError(e));
        }, "Grant permission for an update type to another user in the channel.");

        this.addCommand("deny", (channel, type, ...user)=>{
            channel.s("deny", {update: LichatReader.fromString(type), target: user.join(" ")})
                .then(()=>channel.showStatus("Permission denied."))
                .catch((e)=>channel.showError(e));
        }, "Deny permission for an update type to another user in the channel.");

        // FIXME: missing commands from extensions, and also this is very repetitious...
    }
    
///////////////////////////// SUPPORT METHODS //////////////////////////////////////

    // Returns a promise that succeeds once the UI has been fully set up and
    // the client connected.
    init(){
        return new Promise((ok, fail)=>{
            if(this.embedded){
                this._init = ok;
                this.defaultClientConfig.embedded = true;
                this.defaultClientConfig.disabledExtensions = ["shirakumo-channel-info"];
                this.showClientMenu = true;
            }else{
                let DBOpenRequest = window.indexedDB.open("lichatjs", 7);
                DBOpenRequest.onerror = e=>{
                    console.error(e);
                    this.initialSetup()
                        .then(ok,fail);
                };
                DBOpenRequest.onsuccess = e=>{
                    this.db = e.target.result;
                    this.loadSetup()
                        .then(ok,fail);
                };
                DBOpenRequest.onupgradeneeded = e=>{
                    this.db = e.target.result;
                    this.setupDatabase();
                };
            }
        });
    }

    get defaultClient(){
        if(this.clients.length == 0){
            return {...this.defaultClientConfig};
        }else{
            let template = this.clients[0];
            return {
                name: "",
                username: template.username,
                password: "",
                aliases: template.aliases,
                hostname: "",
                port: LichatDefaultSSLPort,
                ssl: true
            };
        }
    }

    // Adds a new client objcet and ties it into the UI.
    // This is also responsible for setting up the various update handler
    // callbacks to process them and trigger changes in the UI.
    addClient(client){
        if(this.clients.find(el => el.name == client)) 
            return false;

        client.showMenu = false;
        client.channelList = [];
        client.aliases = [];
        client.notificationLevel = 'all';

        // Returns a "minimally usable channel" to output errors to.
        client.getEmergencyChannel = ()=>{
            if(this.currentChannel && this.currentChannel.client == client){
                return this.currentChannel;
            }else if(0 < client.channelList.length){
                return client.channelList[0];
            }else if(client.servername){
                return client.getChannel(client.servername);
            }else{
                return {
                    showStatus: (e)=>console.info("Note:", e),
                    showError: (e)=>console.error("Error:", e),
                    client: client
                };
            }
        };

        client.disconnectHandler = (e)=>{
            client.getEmergencyChannel().showError(e, "Disconnected");
        };

        client.addHandler("connect", (ev)=>{
            if(0 < client.channelList.length){
                client.getEmergencyChannel().showStatus("Connected");
            }
        });

        client.addHandler("join", (ev)=>{
            // Stub out the text and record it like a regular message update.
            ev.text = " ** Joined " + ev.channel;
            let channel = client.getChannel(ev.channel);
            channel.record(ev);
            // If we're joining, add the channel to the list and request backfill
            if(client.getUser(ev.from).isSelf){
                client.addToChannelList(channel);
                if(!channel.isPrimary){
                    let promise = this.loadMessages(channel);
                    if(client.isAvailable("shirakumo-backfill") && !this.embedded){
                        // Use the promise to delay the execution until we're out of this
                        // callback. Otherwise stuff gets hairy.
                        promise.then(()=>{
                            // Determine last non-self message timestamp and then backfill since.
                            let since = null;
                            for(let i=channel.messageList.length-1; 0<i; i--){
                                let message = channel.messageList[i];
                                if(!message.author.isSelf){
                                    since = cl.unixToUniversal(message.timestamp);
                                    break;
                                }
                            }
                            channel.s("BACKFILL", {since: since}, true);
                        });
                    }
                }
            }
            // If we don't have a channel yet, switch to this one.
            if(!this.currentChannel){
                this.app.switchChannel(channel);
            }
        });
        
        client.addHandler("leave", (ev)=>{
            ev.text = " ** Left " + ev.channel;
            client.getChannel(ev.channel).record(ev);
        });

        client.addHandler("user-info", (ev)=>{
            this.saveUser(client.getUser(ev.target || client.username));
        });

        client.addHandler("set-channel-info", (ev)=>{
            this.saveChannel(client.getChannel(ev.channel));
        });

        client.addHandler("emote", (ev)=>{
            this.saveChannel(client.getChannel(ev.channel));
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
        // FIXME: delete saved messages
    }

    addCommand(command, fun, help){
        this.commands["/"+command] = {
            handler: fun,
            help: help
        };
    }

    invokeCommand(channel, commandname, args){
        let command = this.commands[commandname];
        if(!command) throw "No command named "+commandname;
        command.handler.apply(this, [channel, ...args]);
    }

    processCommand(channel, commandstring){
        try{
            let args = commandstring.split(" ");
            let command = args.shift();
            this.invokeCommand(channel, command, args);
        }catch(e){
            console.error(e);
            channel.showError(e);
        }
    }

    // Show the search results by constructing a fake channel that we can display.
    showSearchResults(channel, results, query){
        let tempChannel = Object.assign(Object.create(Object.getPrototypeOf(channel)), channel);
        tempChannel.isVirtual = true;
        tempChannel.previous = channel;
        tempChannel.messages = {};
        Object.defineProperty(tempChannel.messages, 'nested', { configurable: false });
        tempChannel.messageList = [];
        for(let list of results)
            tempChannel.record(channel.client._reader.parseUpdate(list), true);
        this.currentChannel = tempChannel;
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

    initialSetup(client){
        return this.addClient(new LichatClient(client || this.defaultClient))
            .catch((e)=>client.getEmergencyChannel().showError(e, "Connection failed"));
    }

///////////////////////////// IndexedDB STORAGE INTEGRATION //////////////////////////////////////

    setupDatabase(){
        let ensureStore = (name, options)=>{
            if(!this.db.objectStoreNames.contains(name)){
                return this.db.createObjectStore(name, options);
            }else{
                return {createIndex: ()=>{}};
            }
        };
        ensureStore("clients", {keyPath: "name"});
        ensureStore("options", {keyPath: "name"});
        ensureStore("messages", {keyPath: "gid"}).createIndex("server", "server");
        ensureStore("channels", {keyPath: "gid"}).createIndex("server", "server");
        ensureStore("users", {keyPath: "gid"}).createIndex("server", "server");
    }
    
    _mapIndexed(store, index, fn){
        if(!this.db) return Promise.resolve(null);
        return new Promise((ok, fail)=>{
            let tx = this.db.transaction([store]);
            tx.onerror = (ev)=>{console.error(ev); fail(ev);};
            tx.objectStore(store)
                .index("server")
                .openCursor(IDBKeyRange.only(index))
                .onsuccess = (ev)=>{
                    let cursor = ev.target.result;
                    if(!cursor){
                        ok();
                        return;
                    }
                    let data = cursor.value;
                    fn(data);
                    cursor.continue();
                };
        });
    }

    saveMessage(message, tx){
        if(!tx && !this.db) return null;
        if(!tx) tx = this.db.transaction(["messages"], "readwrite");
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("messages")
            .put({
                gid: message.gid,
                id: message.id,
                from: message.from,
                bridge: message.author.name,
                channel: message.channel.name,
                text: message.text,
                clock: cl.unixToUniversal(message.timestamp),
                type: message.type,
                link: message.contentType,
                server: message.channel.gid
            });
        return tx;
    }

    loadMessages(channel){
        return this._mapIndexed("messages", channel.gid, (data)=>{
            channel.record(data, true);
        });
    }

    saveUser(user, tx){
        if(!tx && !this.db) return null;
        if(!tx) tx = this.db.transaction(["users"], "readwrite");
        let info = {...user.info};
        info[':icon'] = info[':icon']? info[':icon'].blob : '';
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("users")
            .put({
                gid: user.gid,
                name: user.name,
                info: info,
                nickname: user.nickname,
                server: user.client.servername
            });
        return tx;
    }

    loadUsers(client){
        return this._mapIndexed("users", client.servername, (data)=>{
            let user = client.getUser(data.name);
            user.nickname = data.nickname;
            Object.assign(user.info, data.info);
            if(data.info[':icon']){
                if(typeof data.info[':icon'] === 'string')
                    data.info[':icon'] = cl.base64URLtoBlob(data.info[':icon']);
                user.info[':icon'] = {
                    blob: data.info[':icon'],
                    url: URL.createObjectURL(data.info[':icon'])
                };
            }
        });
    }

    saveChannel(channel, tx){
        if(!tx && !this.db) return null;
        if(!tx) tx = this.db.transaction(["channels"], "readwrite");
        let emotes = {};
        for(let name in channel.emotes)
            emotes[name] = channel.emotes[name].blob;
        let info = {...channel.info};
        info[':icon'] = info[':icon']? info[':icon'].blob : '';
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("channels")
            .put({
                gid: channel.gid,
                name: channel.name,
                info: info,
                emotes: emotes,
                server: channel.client.servername
            });
        return tx;
    }

    loadChannels(client){
        return this._mapIndexed("channels", client.servername, (data)=>{
            let channel = client.getChannel(data.name);
            for(let name in data.emotes){
                if(typeof data.emotes[name] === 'string')
                    data.emotes[name] = cl.base64URLtoBlob(data.emotes[name]);
                channel.emotes[name] = {
                    blob: data.emotes[name],
                    url: URL.createObjectURL(data.emotes[name])
                };
            }
            Object.assign(channel.info, data.info);
            if(data.info[':icon']){
                if(typeof data.info[':icon'] === 'string')
                    data.info[':icon'] = cl.base64URLtoBlob(data.info[':icon']);
                channel.info[':icon'] = {
                    blob: data.info[':icon'],
                    url: URL.createObjectURL(data.info[':icon'])
                };
            }
        });
    }

    saveClient(client, tx){
        if(!tx && !this.db) return null;
        if(!tx) tx = this.db.transaction(["clients"], "readwrite");
        tx.onerror = (ev)=>console.error(ev);
        tx.objectStore("clients")
            .put({
                name: client.name,
                username: client.username,
                password: client.password,
                hostname: client.hostname,
                server: client.servername,
                port: client.port,
                ssl: client.ssl,
                aliases: client.aliases,
                channels: client.channelList.map(channel => {
                    return {
                        name: channel.name,
                        wasJoined: channel.wasJoined,
                        notificationLevel: channel.notificationLevel
                    };
                })
            });
        return tx;
    }

    loadClients(tx){
        return new Promise((ok, fail)=>{
            if(!tx && !this.db){ fail("No db"); return; }
            if(!tx) tx = this.db.transaction(["clients"]);
            tx.onerror = (ev)=>{console.error(ev);fail(ev);};
            tx.objectStore("clients").getAll().onsuccess = (ev)=>{
                if(ev.target.result.length == 0){
                    this.showClientMenu = true;
                }else{
                    let chain = Promise.resolve(null);
                    for(let options of ev.target.result){
                        let client = new LichatClient(options);
                        client.servername = options.server;
                        chain = chain.then(()=>this.loadUsers(client))
                            .then(()=>this.loadChannels(client))
                            .then(()=>this.addClient(client))
                            .catch((e)=>{
                                try{client.getEmergencyChannel().showError(e, "Connection failed");}
                                catch(e){}
                                fail(e);
                            });
                    }
                    chain.then(ok);
                }
            };
        });
    }

    saveOptions(tx){
        if(!tx && !this.db) return null;
        if(!tx) tx = this.db.transaction(["options"], "readwrite");
        tx.objectStore("options").put({
            name: "general",
            ...this.options
        });
        return tx;
    }

    loadOptions(tx){
        return new Promise((ok, fail)=>{
            if(!tx && !this.db){ fail("No db"); return; }
            if(!tx) tx = this.db.transaction(["options"]);
            tx.onerror = (ev)=>{console.error(ev);fail(ev);};
            tx.objectStore("options").get("general").onsuccess = (ev)=>{
                if(ev.target.result)
                    this.options = ev.target.result;
                ok();
            };
        });
    }

    saveSetup(){
        if(!this.db) return;
        let tx = this.db.transaction(["options", "clients", "channels", "users"], "readwrite");
        this.saveOptions(tx);
        for(let client of this.clients){
            this.saveClient(client, tx);
            for(let name in client.users)
                this.saveUser(client.users[name], tx);
            for(let name in client.channels)
                this.saveChannel(client.channels[name], tx);
        }
    }

    loadSetup(){
        return this.loadOptions()
            .then(()=>this.loadClients());
    }

    clearSetup(){
        if(!this.db) return null;
        let stores = ["options", "clients", "channels", "users", "messages"];
        let tx = this.db.transaction(stores, "readwrite");
        tx.onerror = (ev)=>console.error(ev);
        for(let store of stores)
            tx.objectStore(store).clear();
        for(let client of this.clients)
            this.removeClient(client);
        this.showClientMenu = true;
        return tx;
    }

    readSetup(stores){
        stores = stores || ["options", "clients", "channels", "users"];
        let tx = this.db.transaction(stores, "readwrite");
        for(let store of stores){
            tx.objectStore(store).getAll().onsuccess = (ev)=>{
                console.log(store, ev.target.result);
            };
        }
    }

///////////////////////////// TEXT INPUT AND OUTPUT SUPPORT //////////////////////////////////////

    autoCompleteInput(text){
        // FIXME: this is not a very good auto-completer, as it chokes on completions with spaces.
        let ac = this.autoComplete;
        if(ac.prefix === null){
            ac.index = 0;
            ac.prefix = text.split(" ").splice(-1)[0].toLowerCase();
            ac.pretext = text.substr(0, text.length-ac.prefix.length);
        }
        
        var matches = [];
        for(let user of this.currentChannel.getUserList()){
            if(user.toLowerCase().indexOf(ac.prefix) === 0 &&
               user !== this.currentChannel.client.username)
                matches.push(user);
        }
        for(let emote of this.currentChannel.getEmoteList()){
            emote = ":"+emote+":";
            if(emote.toLowerCase().indexOf(ac.prefix) === 0)
                matches.push(emote);
        }
        if(0 < matches.length){
            matches.sort();
            let match = matches[ac.index];
            ac.index = (ac.index+1)%matches.length;
            return ac.pretext+match
                + ((ac.pretext === "" && match[match.length-1] !== ":")? ": ": " ");
        }
        return text;
    }

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
        let names = channel.client.aliases.filter((alias)=>alias !== '');
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
LichatUI.allEmoji = {};
LichatUI.sound = new Audio('notify.mp3');
// URL Regex by Diego Perini: https://gist.github.com/dperini/729294
LichatUI.URLRegex = new RegExp(
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
