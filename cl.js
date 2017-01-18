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
    Symbol.call(self);
    self.pkg = "KEYWORD";
    return self;
};
Keyword.prototype = Object.create(Symbol.prototype);

var CL = function(){
    var self = this;
    var symbols = {};
    
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
    }

    self.unwindProtect = function(protect, cleanup){
        try{protect();
            cleanup();}
        catch(e){
            cleanup();
            throw e;
        }
    }

    self.typecase = function(object){
        for(var i=1; i<arguments.length; i+=2){
            var type = arguments[i];
            var func = arguments[i+1];
            if(type === "T"){
                return func();
            }else{
                if(!window[type]) throw "Invalid type: "+type;
                if(window[type].prototype.isPrototypeOf(object)
                   || object.constructor === window[type].prototype.constructor){
                    return func();
                }
            }
        }
        return null;
    }

    return self;
};

var cl = new CL();
for(var name of ["WIRE-OBJECT","UPDATE","PING","PONG","CONNECT","DISCONNECT","REGISTER","CHANNEL-UPDATE","TARGET-UPDATE","TEXT-UPDATE","JOIN","LEAVE","CREATE","KICK","PULL","PERMISSIONS","MESSAGE","USERS","CHANNELS","USER-INFO","FAILURE","MALFORMED-UPDATE","CONNECTION-UNSTABLE","TOO-MANY-CONNECTIONS","UPDATE-FAILURE","INVALID-UPDATE","USERNAME-MISMATCH","INCOMPATIBLE-VERSION","INVALID-PASSWORD","NO-SUCH-PROFILE","USERNAME-TAKEN","NO-SUCH-CHANNEL","ALREADY-IN-CHANNEL","NOT-IN-CHANNEL","CHANNELNAME-TAKEN","BAD-NAME","INSUFFICIENT-PERMISSIONS","INVALID-PERMISSIONS","NO-SUCH-USER","TOO-MANY-UPDATES"]){
    cl.intern(name, "LICHAT-PROTOCOL");
}
