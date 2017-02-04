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
        };
    };

    self.typep = (instance, type)=>{
        if(type === true){
            return true;
        }else if(type === null){
            if(instance === null){
                return true;
            }
        }else if(instance instanceof StandardObject){
            if(instance.type === type
               || instance.isInstanceOf(type)){
                return true;
            }
        }else{
            if(!window[type]) cl.error("INVALID-TYPE",{type: type});
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
    }

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
    }

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
}

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
    }
    return self;
};

var Keyword = function(name){
    var self = this;
    Symbol.call(self, name, "KEYWORD");
    return self;
};
Keyword.prototype = Object.create(Symbol.prototype);
