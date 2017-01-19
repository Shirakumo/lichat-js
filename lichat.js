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
        return  +new Date()+self.universalUnixOffset;
    };

    self.universalToUnix = function(universal){
        return universal-self.universalUnixOffset;
    };

    self.pushnew = function(el, arr){
        if(arr.indexOf(el) < 0){
            arr.push(el);
        }
        return arr;
    }

    self.remove = function(el, arr, test){
        test = test || function(a,b){return a===b;}
        var newarr = [];
        for(var item of arr){
            if(!test(item, el))
                newarr.push(item);
        }
        return newarr;
    }

    self.sxhash = function(object){
        var str = object.toString();
        var hash = 0;
        for(var i=0; i<str.length; i++){
            hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
        }
        return hash;
    };

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
    self.fields = [];

    self.set = function(key, val){
        var varname;
        if(key instanceof Symbol){
            varname = key.name.toLowerCase();
        }else{
            varname = key.toString();
        }
        self[varname] = val;
        self.fields.push(varname);
        return val;
    }

    return self;
};

var Update = function(type){
    var self = this;
    WireObject.call(self, type);

    self.set("clock", cl.getUniversalTime());
    self.set("id", nextID());
    
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
                    stream.writeChar(" ");
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

    options = options || {};
    if(!options.username) options.username = "Lion";
    if(!options.password) options.password = null;
    if(!options.hostname) options.hostname = "ws://localhost";
    if(!options.port) options.port = LichatDefaultPort;
    if(!options.handleFailure) options.handleFailure = function(){};

    for(var key in options){
        self[key] = options[key];
    }
    
    self.socket = null;
    self.servername = null;
    self.handlers = {};

    var callbacks = {};
    var reader = new LichatReader();
    var printer = new LichatPrinter();
    var status = "STARTING";

    self.openConnection = function(){
        self.socket = new WebSocket(self.hostname+":"+self.port, "lichat");
        
        self.socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password || null,
                               version: LichatVersion});
        };
        self.socket.onmessage = self.handleMessage;
        self.socket.onclose = function(e){
            if(e.code !== 1000){
                self.handleFailure("Error "+e.code+" "+e.reason);
            }
            self.closeConnection();
        }
    };

    self.closeConnection = function(){
        if(!self.socket) throw "The client is not connected.";
        if(status != "STOPPING"){
            status = "STOPPING";
            if(self.socket.readyState < 2){
                self.socket.close();
            }
            self.socket = null;
        }
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
            update.set(key, args[key]);
        }
        if(!update.from) update.set("from", self.username);
        self.send(update);
    };

    self.handleMessage = function(event){
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            switch(status){
            case "STARTING":
                try{
                    if(!(update instanceof WireObject))
                        throw "Error during connection: non-Update message: "+update;
                    if(update.type !== "CONNECT")
                        throw "Error during connection: non-CONNECT update: "+update;
                }catch(e){
                    self.handleFailure(e);
                    self.closeConnection();
                    throw e;
                }
                status = "RUNNING";
                self.servername = update.from;
                self.process(update);
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
        console.log("[Lichat] Update:",update);
        var handler = self.handlers[update.type];
        var handlers = callbacks[update.id];
        if(handlers){
            for(handler of handlers){
                try{
                    handler(update);
                }catch(e){
                    console.log(e);
                }
            }
            self.removeCallback(update.id);
        }
        if(handler){
            handler(update, self);
        }else{
            console.log(update);
        }
    };

    self.addHandler = function(update, handler){
        self.handlers[update] = handler;
    }

    self.removeHandler = function(update){
        delete self.handlers[update];
    }

    self.addCallback = function(id, handler){
        if(!callbacks[id]){
            callbacks[id] = [handler];
        }else{
            callbacks[id].push(handler);
        }
    }

    self.removeCallback = function(id){
        delete callbacks[id];
    }

    self.addHandler("PING", function(){
        self.s("PONG");
    });
};
var LichatUI = function(chat,client){
    var self = this;
    var client = client;

    var channels = chat.querySelector(".lichat-channel-list");
    var users = chat.querySelector(".lichat-user-list");
    var output = chat.querySelector(".lichat-output");
    var input = chat.querySelector(".lichat-input");

    self.commandPrefix = "/";
    self.channel = null;
    self.commands = {};

    self.objectColor = function(object){
        var hash = cl.sxhash(object);
        var encoded = hash % 0xFFFFFF;
        var r = (encoded&0xFF0000)>>16, g = (encoded&0x00FF00)>>8, b = (encoded&0x0000FF)>>0
        return "rgb("+Math.min(200, Math.max(50, r))
            +","+Math.min(200, Math.max(50, g))
            +","+Math.min(200, Math.max(50, b))+")";
    }

    self.formatTime = function(time){
        var date = new Date(time*1000);
        var pd = function(a){return (a<10)?"0"+a:""+a;}
        return pd(date.getHours())+":"+pd(date.getMinutes())+":"+pd(date.getSeconds());
    }

    self.invokeCommand = function(command){
        var args = Array.prototype.slice.call(arguments);
        var fun = self.commands[args.shift().toLowerCase()];
        if(fun){
            fun.apply(self, args);
        }else{
            throw "No such command "+command
        }
    };

    self.addCommand = function(prefix, handler, documentation){
        handler.documentation = documentation
        self.commands[prefix] = handler;
    };

    self.removeCommand = function(prefix){
        delete self.commands[prefix];
    };

    self.processCommand = function(command){
        if(command.indexOf(self.commandPrefix) === 0){
            var args = command.substring(self.commandPrefix.length).split(" ");
            self.invokeCommand.apply(self, args);
            return true;
        }
        return false;
    };

    self.sendMessage = function(text, channel){
        if(channel === undefined) channel = self.channel;
        if(!channel) throw "No active channel to send a message to."
        client.s("MESSAGE", {channel: channel, text: text});
    };
    
    self.processInput = function(text, chan){
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

    self.constructElement = function(tag, options){
        var el = document.createElement(tag);
        el.setAttribute("class", (options.classes||[]).join(" "));
        if(options.html) el.innerHTML = options.html;
        if(options.text) el.innerText = options.text;
        for(var attr in (options.attributes||{})){
            el.setAttribute(attr, options.attributes[attr]);
        }
        for(var tag in (options.elements||{})){
            var sub = self.constructElement(tag, options.elements[tag]);
            el.appendChild(sub);
        }
        return el;
    };

    self.channelElement = function(name){
        var channel = output.querySelector("[data-channel=\""+name+"\"]");
        if(!channel) throw "No channel named "+name+" exists.";
        return channel;
    };

    self.showMessage = function(options){
        if(!options.clock) options.clock = cl.getUniversalTime();
        if(!options.from) options.from = "System";
        if(!options.type) options.type = "INFO";
        if(!options.channel) options.channel = self.channel;
        if(!options.text && !options.html) throw "Can't show a message without text!";
        var el = self.constructElement("div", {
            classes: ["message", options.type.toLowerCase()],
            elements: {"time": {text: self.formatTime(cl.universalToUnix(options.clock))},
                       "a": {text: options.from,
                             attributes: {style: "color:"+self.objectColor(options.from)}},
                       "span": {text: options.text, html: options.html}}
        });
        self.channelElement(options.channel).appendChild(el);
        return el;
    };

    self.showError = function(e){
        return self.showMessage({from: "System",
                                 text: e+""});
    };

    self.addChannel = function(name){
        var el = self.constructElement("div", {
            classes: ["lichat-channel"],
            attributes: {"data-channel": name, "style": "display:none;"}
        });
        el.users = [];
        output.appendChild(el);
        var menu = self.constructElement("a", {
            text: name,
            classes: [(name.indexOf("@")===0)? "anonymous"
                      :(name === client.servername)? "primary"
                      :  "regular"],
            attributes: {"data-channel": name}
        });
        menu.addEventListener("click", function(){
            self.changeChannel(name);
        });
        channels.appendChild(menu);
        return self.changeChannel(name);
    };

    self.removeChannel = function(name){
        output.removeChild(self.channelElement(name));
        channels.removeChild(channels.querySelectorr("[data-channel=\""+name+"\"]"));
        return self.changeChannel(client.servername);
    };

    self.changeChannel = function(name){
        var channel = self.channelElement(name);
        if(self.channel) self.channelElement(self.channel).style.display = "none";
        if(channels.querySelector(".active"))
            channels.querySelector(".active").classList.remove("active");
        channels.querySelector("[data-channel=\""+name+"\"]").classList.add("active");
        channel.style.display = "";
        self.channel = name;
        self.rebuildUserList();
        return channel;
    };

    self.addUser = function(name, channel){
        channel = self.channelElement(channel || self.channel);
        cl.pushnew(name, channel.users);
        if(channel.dataset.name === self.channel){
            self.rebuildUserList();
        }
    };

    self.removeUser = function(name, channel){
        channel = self.channelElement(channel || self.channel);
        channel.users = cl.remove(name, channel.users);
        if(channel.dataset.name === self.channel){
            self.rebuildUserList();
        }
    };

    self.rebuildUserList = function(){
        users.innerHTML = "";
        for(name of self.channelElement(self.channel).users){
            var menu = self.constructElement("a", {
                text: name,
                classes: [(name === client.servername)? "server"
                          : "regular"],
                attributes: {"data-user": name,
                             "style": "color:"+self.objectColor(name)}
            });
            users.appendChild(menu);
        }
    }

    client.addHandler("MESSAGE", function(update){
        self.showMessage(update);
    });

    client.addHandler("JOIN", function(update){
        if(update.from === client.username){
            self.addChannel(update.channel);
            client.s("USERS", {channel: update.channel});
        }
        self.addUser(update.from, update.channel);
        update.text = " ** joined "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("LEAVE", function(update){
        if(update.from === client.username){
            self.removeChannel(update.channel);
        }
        self.removeUser(update.from, update.channel);
        update.text = " ** left "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("USERS", function(update){
        var channel = self.channelElement(update.channel);
        channel.users = update.users;
        if(update.channel === self.channel){
            self.rebuildUserList();
        }
    });

    self.addCommand("help", function(){
        var text = "Available commands:";
        for(var name in self.commands){
            text += "<br/><label class='command'>"+self.commandPrefix+name+"</label>"
                +(self.commands[name].documentation || "")
        }
        self.showMessage({html: text});
    }, "Show all available commands");

    self.addCommand("create", function(name){
        if(!name) name = null;
        client.s("CREATE", {channel: name});
    }, "Create a new channel. Not specifying a name will create an anonymous channel.");

    self.addCommand("join", function(name){
        if(!name) throw "You must supply the name of the channel to join."
        client.s("JOIN", {channel: name});
    }, "Join an existing channel.");

    self.addCommand("leave", function(name){
        if(!name) name = self.channel;
        client.s("LEAVE", {channel: name});
    }, "Leave a channel. Not specifying a name will leave the current channel.");

    self.addCommand("pull", function(user, name){
        if(!user) throw "You must supply the name of a user to pull."
        if(!name) name = self.channel;
        client.s("PULL", {channel:name, target:user});
    }, "Pull a user into a channel. Not specifying a name will leave the current channel.");

    self.addCommand("kick", function(user, name){
        if(!user) throw "You must supply the name of a user to kick."
        if(!name) name = self.channel;
        client.s("KICK", {channel:name, target:user});
    }, "Kick a user from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("users", function(name){
        if(!name) name = self.channel;
        client.s("USERS", {channel:name});
    }, "Fetch a list of users from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("channels", function(){
        client.s("CHANNELS", {});
    }, "Fetch a list of public channels.");

    self.addCommand("info", function(user){
        if(!user) throw "You must supply the name of a user to query."
        client.s("USER-INFO", {target:user});
    }, "Fetch information about a user.");

    self.addCommand("message", function(name){
        if(!name) throw "You must supply the name of a channel to message to.";
        var args = Array.prototype.slice.call(arguments,1);
        client.s("KICK", {channel:name, text:args.join(" ")});
    }, "Send a message to a channel. Note that you must be in the channel to send to it.");

    self.addCommand("contact", function(user){
        if(!user) throw "You must supply the name of at least one user to contact.";
        var update = new Update("KICK");
        update.set("from", client.username);
        client.addCallback(update.id, function(update){
            if(update.type === "JOIN"){
                for(var i=0; i<arguments.length; i++){
                    client.s("PULL", {channel:update.channel, target:arguments[i]});
                }
            }else{
                self.showError("Failed to create anonymous channel for contacting.");
            }
        });
        client.send(update);
    }, "Contact one or more users in an anonymous channel.");

    self.initControls = function(){
        input.addEventListener("keydown", function(ev){
            if(ev.keyCode === 13 && ev.ctrlKey){
                self.processInput();
                return false;
            }
        });
    };

    self.initControls();

    return self;
}
