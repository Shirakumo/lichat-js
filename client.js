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
    var status = null;

    self.openConnection = ()=>{
        status = "STARTING";
        var socket = new WebSocket("ws://"+self.hostname+":"+self.port, "lichat");
        socket.onopen = ()=>{
            self.s("CONNECT", {password: self.password || null,
                               version: LichatVersion,
                               socket: socket});
        };
        socket.onmessage = (e)=>{self.handleMessage(socket, e);};
        socket.onclose = (e)=>{
            if(e.code !== 1000){
                self.handleFailure(new Condition("SOCKET-CLOSE", {
                    report: "Error "+e.code+" "+e.reason,
                    socket: socket,
                    event: e
                }));
            }
            self.closeConnection(socket);
        }
        self.socket = socket;
    };

    self.closeConnection = (socket)=>{
        socket = socket || self.socket;
        if(status != "STOPPING"){
            status = "STOPPING";
            if(socket && socket.readyState < 2){
                socket.close();
            }
            if(self.socket == socket){ 
                self.socket = null;
            }
        }
    };

    self.send = (socket, wireable)=>{
        if(!socket) cl.error("NOT-CONNECTED",{text: "The client is not connected."});
        cl.format("[Lichat] Send:~s", wireable);
        var stream = new LichatStream();
        printer.toWire(wireable, stream);
        socket.send(stream.string);
    };

    self.s = (type, args)=>{
        args = args || {};
        var socket = args.socket || self.socket;
        if(!args.from) args.from = self.username;
        delete args.socket;
        var update = cl.makeInstance(type, args);
        self.send(socket, update);
    };

    self.handleMessage = (socket, event)=>{
        try{
            var update = reader.fromWire(new LichatStream(event.data));
            update.socket = socket;
            switch(status){
            case "STARTING":
                try{
                    if(!(cl.typep(update, "WIRE-OBJECT")))
                        cl.error("CONNECTION-FAILED",{text: "non-Update message", update: update});
                    if(update.type !== "CONNECT")
                        cl.error("CONNECTION-FAILED",{text: "non-CONNECT update", update: update});
                }catch(e){
                    self.handleFailure(e);
                    self.closeConnection(socket);
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
