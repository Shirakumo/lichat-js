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
