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
