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

    var idCallbacks = {};
    var reader = new LichatReader();
    var printer = new LichatPrinter();
    var status = "STARTING";

    self.openConnection = ()=>{
        self.socket = new WebSocket("ws://"+self.hostname+":"+self.port, "lichat");
        
        self.socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password || null,
                               version: LichatVersion});
        };
        self.socket.onmessage = self.handleMessage;
        self.socket.onclose = (e)=>{
            if(e.code !== 1000){
                self.handleFailure("Error "+e.code+" "+e.reason);
            }
            self.closeConnection();
        }
    };

    self.closeConnection = ()=>{
        if(status != "STOPPING"){
            status = "STOPPING";
            if(self.socket && self.socket.readyState < 2){
                self.socket.close();
            }
            self.socket = null;
        }
    };

    self.send = (wireable)=>{
        if(!self.socket) cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        var stream = new LichatStream();
        printer.toWire(wireable, stream);
        self.socket.send(stream.string);
    };

    self.s = (type, args)=>{
        args = args || {};
        if(!args.from) args.from = self.username;
        var update = cl.makeInstance(type, args);
        self.send(update);
    };

    self.handleMessage = (event)=>{
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            switch(status){
            case "STARTING":
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        cl.error("CONNECTION-FAILED",{text: "non-Update message", update: update});
                    if(update.type !== "CONNECT")
                        cl.error("CONNECTION-FAILED",{text: "non-CONNECT update", update: update});
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
            cl.format("Error during message handling: ~s", e);
        }
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
        if(!self.maybeCallHandler(update.type, update)){
            for(var s of cl.classOf(update).superclasses){
                if(self.maybeCallHandler(s.className, update))
                    break;
            }
        }
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
    };

    self.removeHandler = (update)=>{
        delete self.handlers[update];
    };

    self.addCallback = (id, handler)=>{
        if(!idCallbacks[id]){
            idCallbacks[id] = [handler];
        }else{
            idCallbacks[id].push(handler);
        }
    };

    self.removeCallback = (id)=>{
        delete idCallbacks[id];
    };

    self.addHandler("PING", ()=>{
        self.s("PONG");
    });
};
