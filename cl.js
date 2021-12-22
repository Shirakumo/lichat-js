// Special objects
var CL = function(){
    var self = this;
    var symbols = {};
    var classes = {};

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
            symbol = new Symbol(name, pkg || "LICHAT-JS");
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
    if(cl.symbolp(key)){
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
